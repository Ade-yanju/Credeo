/**
 * Vodium Ledger — grace-period nudges.
 *
 * When a trial or a paid period lapses, the vendor keeps full access for
 * GRACE_DAYS while we tell them, three times, exactly what is about to change.
 * The point is that the lockout should never be a surprise — a vendor who
 * discovers it by failing to log a credit in front of a customer is a vendor
 * we have lost.
 *
 * DELIVERY: email always (every vendor has a verified address — auth is
 * email + password), plus a free WhatsApp message when their 24-hour session
 * happens to be open. No template is used here deliberately: nudges would need
 * their own approved Meta template, and email already guarantees the message
 * lands. Compare lib/vendor-digest.ts, which makes the same call for the same
 * reason.
 *
 * SEND-ONCE: each stage writes a SubscriptionEvent, and that row is the lock.
 * A cron re-run, a double-fire, or two deploys in one day cannot re-nudge.
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { GRACE_DAYS } from "@/lib/entitlement";
import { messages } from "@/lib/whatsapp/messages";
import { sendWhatsAppMessage } from "@/lib/whatsapp/outbound";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import { hasOpenSession } from "@/lib/whatsapp/session-window";
import { hasSubscriptionEvent, recordSubscriptionEvent, type SubscriptionEventReason } from "@/lib/subscription-events";

const DAY_MS = 86_400_000;

export interface GraceNudgeResult {
  sent: number;
  skipped: number;
  failed: number;
  whatsapp: number;
  email: number;
}

type Stage = {
  reason: Extract<SubscriptionEventReason, `grace_nudge_${string}`>;
  minDays: number;
};

/**
 * Highest stage first. We send only the highest stage the vendor has reached
 * and not yet been sent — if the cron was down from day 0 to day 6 we send the
 * final warning, not a burst of three.
 */
const STAGES: Stage[] = [
  { reason: "grace_nudge_day6", minDays: GRACE_DAYS - 1 },
  { reason: "grace_nudge_day3", minDays: 3 },
  { reason: "grace_nudge_day0", minDays: 0 },
];

export async function sendGraceNudges(input?: { now?: Date }): Promise<GraceNudgeResult> {
  const now = input?.now ?? new Date();
  const result: GraceNudgeResult = { sent: 0, skipped: 0, failed: 0, whatsapp: 0, email: 0 };

  // Everyone currently inside their grace window.
  const inGrace = await prisma.vendorSubscription.findMany({
    where: {
      status: { in: ["EXPIRED", "PAST_DUE"] },
      graceEndsAt: { gt: now },
    },
    select: {
      id: true,
      vendorId: true,
      plan: true,
      status: true,
      monthlyAmount: true,
      graceEndsAt: true,
      vendor: {
        select: { phone: true, email: true, ownerName: true, businessName: true, organizationId: true },
      },
    },
  });

  for (const sub of inGrace) {
    try {
      if (!sub.graceEndsAt) {
        result.skipped++;
        continue;
      }

      const lapsedAt = new Date(sub.graceEndsAt.getTime() - GRACE_DAYS * DAY_MS);
      const daysSinceLapse = Math.floor((now.getTime() - lapsedAt.getTime()) / DAY_MS);
      const daysLeft = Math.max(0, Math.ceil((sub.graceEndsAt.getTime() - now.getTime()) / DAY_MS));

      const stage = STAGES.find((s) => daysSinceLapse >= s.minDays);
      if (!stage) {
        result.skipped++;
        continue;
      }

      if (await hasSubscriptionEvent(sub.vendorId, stage.reason)) {
        result.skipped++;
        continue;
      }

      const body =
        stage.reason === "grace_nudge_day6"
          ? messages.trialEndedGraceFinal()
          : stage.reason === "grace_nudge_day3"
            ? messages.trialEndedGraceMidway(daysLeft)
            : messages.trialEndedGraceStart(daysLeft);

      // WhatsApp — free and immediate, but only inside an open window.
      if (await hasOpenSession(sub.vendor.phone, now)) {
        try {
          const creds = (await getOrgChannelCredentials(sub.vendor.organizationId)) ?? undefined;
          await sendWhatsAppMessage(sub.vendor.phone, body, creds);
          result.whatsapp++;
        } catch (err) {
          console.warn(
            `[grace-nudge] WhatsApp failed for vendor ${sub.vendorId}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      // Email — the channel that always lands.
      if (sub.vendor.email) {
        try {
          await sendGraceEmail({
            to: sub.vendor.email,
            ownerName: sub.vendor.ownerName,
            businessName: sub.vendor.businessName,
            daysLeft,
            isFinal: stage.reason === "grace_nudge_day6",
          });
          result.email++;
        } catch (err) {
          console.warn(
            `[grace-nudge] email failed for vendor ${sub.vendorId}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      // Written last, and only once: the event IS the send-once lock, so it
      // must not be written before the attempt.
      await recordSubscriptionEvent({
        vendorId: sub.vendorId,
        subscriptionId: sub.id,
        fromStatus: sub.status,
        toStatus: sub.status,
        plan: sub.plan,
        monthlyAmount: sub.monthlyAmount.toString(),
        reason: stage.reason,
        occurredAt: now,
      });
      result.sent++;
    } catch (err) {
      console.error(
        `[grace-nudge] failed for vendor ${sub.vendorId}:`,
        err instanceof Error ? err.message : err
      );
      result.failed++;
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Email                                                              */
/* ------------------------------------------------------------------ */

async function sendGraceEmail(input: {
  to: string;
  ownerName: string;
  businessName: string;
  daysLeft: number;
  isFinal: boolean;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vodiumledger.com";
  const upgradeUrl = `${appUrl}/dashboard/upgrade`;

  if (!process.env.RESEND_API_KEY) {
    console.log(
      `\n[GRACE NUDGE EMAIL -> ${input.to}]\n` +
      `  Shop: ${input.businessName}\n` +
      `  Days left: ${input.daysLeft}\n` +
      `  Final warning: ${input.isFinal}\n` +
      `  Upgrade: ${upgradeUrl}\n`
    );
    return;
  }

  // Constructed per call, not at module scope: a provider client built at
  // import time runs during `next build`, where the key may be absent.
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Vodium Ledger <noreply@vodiumledger.com>",
    to: input.to,
    subject: input.isFinal
      ? `Last day of full access for ${input.businessName}`
      : `${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"} left before ${input.businessName} goes read-only`,
    html: buildGraceHtml({ ...input, upgradeUrl }),
  });
}

function buildGraceHtml(input: {
  ownerName: string;
  businessName: string;
  daysLeft: number;
  isFinal: boolean;
  upgradeUrl: string;
}): string {
  const headline = input.isFinal
    ? "Today is your last day of full access"
    : `${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"} left of full access`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;padding:48px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #EFEDE5;">
        <tr>
          <td style="background:#0A0A0A;padding:30px 40px;">
            <p style="margin:0;font-family:Georgia,serif;font-size:20px;color:#C9A961;letter-spacing:0.15em;">VODIUM LEDGER</p>
            <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:0.18em;text-transform:uppercase;">Your subscription</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:12px;color:#C9A961;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">Free trial ended</p>
            <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:25px;color:#0A0A0A;line-height:1.25;">
              ${headline}
            </h1>
            <p style="margin:0 0 22px;font-size:15px;color:#5F615D;line-height:1.65;">
              Hello ${input.ownerName}, the free trial for ${input.businessName} has ended.
              Your records are safe and nothing has been deleted.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7ED;border:1px solid #EFE2BF;border-radius:12px;margin-bottom:26px;">
              <tr><td style="padding:18px 22px;">
                <p style="margin:0 0 10px;font-size:11px;color:#8A6A1F;letter-spacing:0.14em;text-transform:uppercase;">What changes when access ends</p>
                <p style="margin:0 0 6px;font-size:14px;color:#0A0A0A;">You keep viewing your book and recording money customers pay you.</p>
                <p style="margin:0;font-size:14px;color:#5F615D;">Adding new credit, invoices and reminders pause until you renew.</p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${input.upgradeUrl}" style="display:inline-block;background:#C9A961;color:#0A0A0A;font-weight:800;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;">
                  Renew my plan
                </a>
              </td></tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              Already renewed? You can ignore this message.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Vodium Ledger — weekly report run.
 *
 * Ties the pieces together: work out the week, find the vendors who actually
 * traded, build each report, and send the PDF over WhatsApp.
 *
 * Ordering matters here — vendorsWithActivity() narrows to vendors who logged at
 * least one credit before we touch anything expensive, so a shop that was quiet
 * costs one row in a groupBy rather than a report render.
 */

import { prisma } from "@/lib/prisma";
import { signReportToken } from "@/lib/bnpl-token";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import { sendWeeklyReport } from "@/lib/whatsapp/weekly-report-delivery";
import { buildWeeklyReport, lastCompleteWeek, vendorsWithActivity } from "@/lib/weekly-report";

export interface WeeklyReportRunResult {
  weekStart: string;
  weekEnd: string;
  candidates: number;
  sent: number;
  /** Built and attempted, but WhatsApp could not deliver (template not live). */
  undelivered: number;
  /** Skipped by the no-credits or locked-account rules. */
  skipped: number;
  failed: number;
}

export async function runWeeklyReports(input?: { now?: Date }): Promise<WeeklyReportRunResult> {
  const now = input?.now ?? new Date();
  const { weekStart, weekEnd } = lastCompleteWeek(now);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vodiumledger.com";

  const candidates = await vendorsWithActivity(weekStart, weekEnd);

  const result: WeeklyReportRunResult = {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    candidates: candidates.length,
    sent: 0,
    undelivered: 0,
    skipped: 0,
    failed: 0,
  };

  for (const vendorId of candidates) {
    try {
      const data = await buildWeeklyReport({ vendorId, weekStart, weekEnd, now });
      if (!data) {
        // Locked account, or the credits vanished between the two queries.
        result.skipped++;
        continue;
      }

      // Meta fetches this link itself, so it must be absolute and public.
      const pdfLink = `${appUrl}/report/${signReportToken(vendorId, weekStart)}/pdf`;
      const creds = (await getOrgChannelCredentials(data.organizationId)) ?? undefined;

      const delivery = await sendWeeklyReport({ data, pdfLink, creds, now });
      if (delivery.delivered) result.sent++;
      else result.undelivered++;
    } catch (err) {
      console.error(
        `[weekly-report] failed for vendor ${vendorId}:`,
        err instanceof Error ? err.message : err
      );
      result.failed++;
    }
  }

  return result;
}

/**
 * Vendors who logged credit in the week but are locked out — i.e. exactly who
 * the paid-feature rule withheld a report from. Surfaced for the admin view so
 * the withholding is visible rather than invisible.
 */
export async function reportsWithheldForLockout(weekStart: Date, weekEnd: Date): Promise<number> {
  const candidates = await vendorsWithActivity(weekStart, weekEnd);
  if (candidates.length === 0) return 0;

  const active = await prisma.vendor.count({
    where: {
      id: { in: candidates },
      subscription: { OR: [{ status: { in: ["TRIAL", "ACTIVE"] } }, { graceEndsAt: { gt: new Date() } }] },
    },
  });
  return candidates.length - active;
}

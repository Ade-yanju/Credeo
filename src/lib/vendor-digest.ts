/**
 * Vodium Ledger — weekly vendor digest.
 *
 * A short WhatsApp summary of a vendor's ledger: who is overdue, who paid, and
 * a simple cash-flow read. This is the "intelligence" half of the product
 * promise — the vendor sees what their book is doing without opening a
 * dashboard they mostly don't open.
 *
 * WINDOW NOTE: digests go to VENDORS, who message the bot regularly, so they
 * normally land inside an open 24-hour session. We still check, and skip rather
 * than send into a closed window — a weekly nice-to-have does not justify
 * burning a template send, and a silently-dropped digest is worse than none.
 * (Reminders and invoices, which must arrive, use deliver-then-upgrade instead.)
 */

import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/utils";
import { generateVendorDigest } from "@/lib/ai";
import { sendWhatsAppMessage } from "@/lib/whatsapp/outbound";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import { hasOpenSession } from "@/lib/whatsapp/session-window";

const OPEN_STATUSES = ["OUTSTANDING", "DUE_SOON", "OVERDUE", "PARTIALLY_PAID"] as const;

export interface DigestRunResult {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

/**
 * Build and send the digest to every active vendor.
 * Vendors with nothing outstanding are skipped — an empty digest is noise.
 */
export async function sendWeeklyDigests(input?: { now?: Date }): Promise<DigestRunResult> {
  const now = input?.now ?? new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const vendors = await prisma.vendor.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, phone: true, businessName: true, organizationId: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const vendor of vendors) {
    try {
      const credits = await prisma.credit.findMany({
        where: { vendorId: vendor.id, status: { in: [...OPEN_STATUSES] } },
        select: {
          amount: true,
          amountRepaid: true,
          dueDate: true,
          status: true,
          student: { select: { fullName: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 200,
      });

      if (!credits.length) {
        skipped++;
        continue;
      }

      const totalOutstanding = credits.reduce(
        (s, c) => s + Math.max(0, Number(c.amount) - Number(c.amountRepaid)),
        0,
      );
      if (totalOutstanding <= 0) {
        skipped++;
        continue;
      }

      const overdue = credits
        .filter((c) => c.dueDate < now)
        .slice(0, 5)
        .map((c) => ({
          name: c.student.fullName,
          amount: Math.max(0, Number(c.amount) - Number(c.amountRepaid)),
          daysLate: Math.max(
            0,
            Math.floor((now.getTime() - c.dueDate.getTime()) / 86_400_000),
          ),
        }));

      const repayments = await prisma.repayment.findMany({
        where: { credit: { vendorId: vendor.id }, createdAt: { gte: weekAgo } },
        select: { amount: true, credit: { select: { student: { select: { fullName: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      // Only send where it will actually be delivered (see WINDOW NOTE above).
      if (!(await hasOpenSession(vendor.phone, now))) {
        skipped++;
        continue;
      }

      const body =
        (await generateVendorDigest({
          shopName: vendor.businessName,
          totalOutstanding,
          overdue,
          recentRepayments: repayments.map((r) => ({
            name: r.credit.student.fullName,
            amount: Number(r.amount),
          })),
        })) ?? fallbackDigest({ totalOutstanding, overdue, repaymentCount: repayments.length });

      const creds = (await getOrgChannelCredentials(vendor.organizationId)) ?? undefined;
      await sendWhatsAppMessage(vendor.phone, `📊 *Your week on Vodium Ledger*\n\n${body}`, creds);
      sent++;
    } catch (err) {
      console.error(`[digest] failed for vendor ${vendor.id}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  return { sent, skipped, failed, total: vendors.length };
}

/** Plain digest used when AI is unavailable — the numbers still reach the vendor. */
function fallbackDigest(input: {
  totalOutstanding: number;
  overdue: Array<{ name: string; amount: number; daysLate: number }>;
  repaymentCount: number;
}): string {
  const lines = [`You have ${formatNaira(input.totalOutstanding)} still owing.`];
  if (input.overdue.length) {
    lines.push("", "Overdue:");
    for (const o of input.overdue) {
      lines.push(`• ${o.name} — ${formatNaira(o.amount)} (${o.daysLate} day${o.daysLate === 1 ? "" : "s"} late)`);
    }
  }
  if (input.repaymentCount) {
    lines.push("", `${input.repaymentCount} repayment${input.repaymentCount === 1 ? "" : "s"} came in this week.`);
  }
  lines.push("", "Reply *LIST* to see everyone owing.");
  return lines.join("\n");
}

/**
 * Vodium Ledger — weekly vendor report (data layer).
 *
 * "How did my shop do last week?" answered in two numbers a vendor actually
 * cares about: how much credit they gave out, and how much money came back.
 *
 * The week maths lives in lib/weekly-report-week.ts (pure, unit-tested) and is
 * re-exported here so callers have one import.
 *
 * TWO SKIP RULES, both deliberate:
 *   1. No credits logged in the week → no report. A report saying "you did
 *      nothing" is noise that trains vendors to ignore the channel.
 *   2. Locked-out vendors → no report. It is a paid feature, and one more
 *      concrete reason to renew.
 */

import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/entitlement";
import { lastCompleteWeek, formatWeekRange } from "@/lib/weekly-report-week";

export { lastCompleteWeek, formatWeekRange };

export interface WeeklyReportData {
  vendorId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string | null;
  organizationId: string | null;
  weekStart: Date;
  weekEnd: Date;
  /** Credit extended during the week. */
  creditsLoggedCount: number;
  creditsLoggedTotal: number;
  /** Money received during the week, from repayments. */
  amountReceivedTotal: number;
  repaymentCount: number;
  /** Still owed across the whole book as at the end of the week. */
  closingOutstanding: number;
  newCustomers: number;
  topCustomers: Array<{ name: string; amount: number }>;
}

const OPEN_STATUSES = ["OUTSTANDING", "DUE_SOON", "OVERDUE", "PARTIALLY_PAID"] as const;

/**
 * Build the report for one vendor, or null when they should be skipped.
 */
export async function buildWeeklyReport(input: {
  vendorId: string;
  weekStart: Date;
  weekEnd: Date;
  now?: Date;
}): Promise<WeeklyReportData | null> {
  const { vendorId, weekStart, weekEnd } = input;
  const now = input.now ?? new Date();

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true, businessName: true, ownerName: true, phone: true, email: true,
      organizationId: true, subscription: true,
    },
  });
  if (!vendor) return null;

  // Skip rule 2: paid feature.
  if (!getEntitlement(vendor.subscription, now).canWrite) return null;

  const credits = await prisma.credit.findMany({
    where: { vendorId, createdAt: { gte: weekStart, lte: weekEnd } },
    select: { amount: true, studentId: true, student: { select: { fullName: true } } },
  });

  // Skip rule 1: nothing logged, nothing to say.
  if (credits.length === 0) return null;

  const [repayments, openCredits, newCustomers] = await Promise.all([
    prisma.repayment.findMany({
      where: { credit: { vendorId }, receivedAt: { gte: weekStart, lte: weekEnd } },
      select: { amount: true, credit: { select: { student: { select: { fullName: true } } } } },
    }),
    // Closing position: everything still open as at the end of the week. Credits
    // created after the week are excluded so the figure matches the period.
    prisma.credit.findMany({
      where: { vendorId, status: { in: [...OPEN_STATUSES] }, createdAt: { lte: weekEnd } },
      select: { amount: true, amountRepaid: true },
    }),
    prisma.student.count({
      where: { credits: { some: { vendorId } }, createdAt: { gte: weekStart, lte: weekEnd } },
    }),
  ]);

  const creditsLoggedTotal = credits.reduce((sum, c) => sum + Number(c.amount), 0);
  const amountReceivedTotal = repayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const closingOutstanding = openCredits.reduce(
    (sum, c) => sum + Math.max(0, Number(c.amount) - Number(c.amountRepaid)),
    0
  );

  // Who took the most credit this week — the names a vendor scans for first.
  const byCustomer = new Map<string, number>();
  for (const c of credits) {
    const name = c.student.fullName;
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + Number(c.amount));
  }
  const topCustomers = [...byCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  return {
    vendorId: vendor.id,
    shopName: vendor.businessName,
    ownerName: vendor.ownerName,
    phone: vendor.phone,
    email: vendor.email,
    organizationId: vendor.organizationId,
    weekStart,
    weekEnd,
    creditsLoggedCount: credits.length,
    creditsLoggedTotal,
    amountReceivedTotal,
    repaymentCount: repayments.length,
    closingOutstanding,
    newCustomers,
    topCustomers,
  };
}

/**
 * Vendors worth considering for the week: active accounts that logged at least
 * one credit in the window. Narrowing here keeps us from loading every vendor
 * only to discard most of them.
 */
export async function vendorsWithActivity(weekStart: Date, weekEnd: Date): Promise<string[]> {
  const rows = await prisma.credit.groupBy({
    by: ["vendorId"],
    where: {
      createdAt: { gte: weekStart, lte: weekEnd },
      vendor: { status: "ACTIVE" },
    },
  });
  return rows.map((r) => r.vendorId);
}

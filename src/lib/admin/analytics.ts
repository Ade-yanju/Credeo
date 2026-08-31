/**
 * Platform analytics — credit-logging and repayment *behaviour*, not just totals.
 *
 * Every query is read-only and scoped to a rolling window so the dashboard stays
 * cheap as the ledger grows. Repayment timing is measured against each credit's
 * own due date, so an hour-long credit and a term-long credit are judged fairly.
 */

import { prisma } from "@/lib/prisma";

export interface MonthPoint { month: string; extended: number; recovered: number }
export interface OnTimePoint { month: string; onTimeRate: number; settled: number }
export interface TimingBucket { bucket: string; count: number }
export interface HourCell { day: string; hour: number; count: number }
export interface VendorRow { name: string; community: string; credits: number; recovered: number; recoveryRate: number }
export interface SizeBucket { bucket: string; count: number }
export interface InvoiceSourceRow { source: "WEB" | "WHATSAPP"; count: number; total: number; paid: number }
export interface VendorEngagementRow { name: string; community: string; interactions30d: number; lastInteractedAt: string | null; credits30d: number; invoices30d: number }

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getAnalytics() {
  const [
    creditTotals, repaidTotals, activeSubs,
    totalCredits, paidCredits, writtenOff, partial, overdue, outstanding,
    totalVendors, totalCustomers,
    monthly, onTime, timing, logHours, topVendors, sizeBuckets,
    scoreDist, repeatCustomers, vendorActivity, invoiceSources, vendorEngagement, activeInteractionVendors,
  ] = await Promise.all([
    prisma.credit.aggregate({ _sum: { amount: true }, _avg: { amount: true } }),
    prisma.repayment.aggregate({ _sum: { amount: true } }),
    prisma.vendorSubscription.findMany({ where: { status: "ACTIVE" }, select: { monthlyAmount: true } }),

    prisma.credit.count(),
    prisma.credit.count({ where: { status: "PAID" } }),
    prisma.credit.count({ where: { status: "WRITTEN_OFF" } }),
    prisma.credit.count({ where: { status: "PARTIALLY_PAID" } }),
    prisma.credit.count({ where: { status: "OVERDUE" } }),
    prisma.credit.count({ where: { status: { in: ["OUTSTANDING", "DUE_SOON"] } } }),

    prisma.vendor.count(),
    prisma.student.count(),

    // ── Volume: money extended vs money actually recovered, by month ──────────
    prisma.$queryRaw<Array<{ month: string; extended: number; recovered: number; credits: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', c."createdAt"), 'Mon') AS month,
        COALESCE(SUM(c.amount), 0)::float                  AS extended,
        COALESCE(SUM(c."amountRepaid"), 0)::float          AS recovered,
        COUNT(*)::int                                      AS credits
      FROM "Credit" c
      WHERE c."createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', c."createdAt")
      ORDER BY DATE_TRUNC('month', c."createdAt") ASC
    `,

    // ── Repayment discipline: share of settled credits closed by the due date ─
    prisma.$queryRaw<Array<{ month: string; on_time: number; settled: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', c."closedAt"), 'Mon')                        AS month,
        COUNT(*) FILTER (WHERE c."closedAt" <= c."dueDate")::int                 AS on_time,
        COUNT(*)::int                                                            AS settled
      FROM "Credit" c
      WHERE c."closedAt" IS NOT NULL
        AND c."closedAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', c."closedAt")
      ORDER BY DATE_TRUNC('month', c."closedAt") ASC
    `,

    // ── How late, when they do pay (against each credit's own due date) ───────
    prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
      SELECT bucket, COUNT(*) AS count FROM (
        SELECT CASE
          WHEN c."closedAt" <= c."dueDate"                                    THEN 'On time or early'
          WHEN c."closedAt" <= c."dueDate" + INTERVAL '3 days'                THEN '1–3 days late'
          WHEN c."closedAt" <= c."dueDate" + INTERVAL '7 days'                THEN '4–7 days late'
          WHEN c."closedAt" <= c."dueDate" + INTERVAL '30 days'               THEN '8–30 days late'
          ELSE 'Over 30 days late'
        END AS bucket
        FROM "Credit" c
        WHERE c."closedAt" IS NOT NULL AND c.status = 'PAID'
      ) t
      GROUP BY bucket
    `,

    // ── When vendors actually log credit (day of week × hour, last 90 days) ───
    prisma.$queryRaw<Array<{ dow: number; hour: number; count: bigint }>>`
      SELECT
        EXTRACT(DOW  FROM c."createdAt")::int AS dow,
        EXTRACT(HOUR FROM c."createdAt")::int AS hour,
        COUNT(*)                              AS count
      FROM "Credit" c
      WHERE c."createdAt" >= NOW() - INTERVAL '90 days'
      GROUP BY 1, 2
    `,

    // ── Vendor leaderboard, ranked by recovery not just volume ───────────────
    prisma.$queryRaw<Array<{ name: string; community: string; credits: bigint; extended: number; recovered: number }>>`
      SELECT
        v."businessName"                              AS name,
        COALESCE(cm."shortName", cm.name, '—')        AS community,
        COUNT(c.id)                                   AS credits,
        COALESCE(SUM(c.amount), 0)::float             AS extended,
        COALESCE(SUM(c."amountRepaid"), 0)::float     AS recovered
      FROM "Vendor" v
      JOIN "Credit" c    ON c."vendorId" = v.id
      LEFT JOIN "Community" cm ON cm.id = v."communityId"
      GROUP BY v.id, v."businessName", cm."shortName", cm.name
      ORDER BY COUNT(c.id) DESC
      LIMIT 6
    `,

    // ── Typical credit size — where the book's risk actually sits ────────────
    prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
      SELECT bucket, COUNT(*) AS count FROM (
        SELECT CASE
          WHEN amount <   1000 THEN 'Under ₦1k'
          WHEN amount <   5000 THEN '₦1k–5k'
          WHEN amount <  20000 THEN '₦5k–20k'
          WHEN amount < 100000 THEN '₦20k–100k'
          ELSE '₦100k+'
        END AS bucket
        FROM "Credit"
      ) t
      GROUP BY bucket
    `,

    prisma.$queryRaw<Array<{ tier: string; count: bigint }>>`
      SELECT CASE
        WHEN "vodiumScore" >= 750 THEN 'excellent'
        WHEN "vodiumScore" >= 650 THEN 'good'
        WHEN "vodiumScore" >= 450 THEN 'fair'
        ELSE 'poor'
      END AS tier, COUNT(*) AS count
      FROM "Student" GROUP BY 1
    `,

    // ── Do customers come back? Repeat borrowing is the retention signal ──────
    prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
      SELECT bucket, COUNT(*) AS count FROM (
        SELECT CASE
          WHEN COUNT(c.id) = 1 THEN '1 credit'
          WHEN COUNT(c.id) <= 3 THEN '2–3 credits'
          WHEN COUNT(c.id) <= 9 THEN '4–9 credits'
          ELSE '10+ credits'
        END AS bucket
        FROM "Student" s JOIN "Credit" c ON c."studentId" = s.id
        GROUP BY s.id
      ) t GROUP BY bucket
    `,

    // ── Vendor engagement: the churn predictor (credits logged this week) ─────
    prisma.$queryRaw<Array<{ active_7d: bigint; active_30d: bigint; ever: bigint }>>`
      SELECT
        COUNT(DISTINCT c."vendorId") FILTER (WHERE c."createdAt" >= NOW() - INTERVAL '7 days')  AS active_7d,
        COUNT(DISTINCT c."vendorId") FILTER (WHERE c."createdAt" >= NOW() - INTERVAL '30 days') AS active_30d,
        COUNT(DISTINCT c."vendorId")                                                            AS ever
      FROM "Credit" c
    `,

    // Invoice adoption by the channel vendors use to issue them.
    prisma.$queryRaw<Array<{ source: "WEB" | "WHATSAPP"; count: bigint; total: number; paid: number }>>`
      SELECT i.source, COUNT(*) AS count,
             COALESCE(SUM(i.total), 0)::float AS total,
             COALESCE(SUM(i."amountPaid"), 0)::float AS paid
      FROM "Invoice" i
      GROUP BY i.source
    `,

    // A vendor is active when they interact with the product, not only when
    // they log credit. Audit events cover web actions; invoices and credits
    // are included directly so older records remain visible too.
    prisma.$queryRaw<Array<{ name: string; community: string; interactions30d: bigint; last_interacted: Date | null; credits30d: bigint; invoices30d: bigint }>>`
      WITH events AS (
        SELECT c."vendorId" AS vendor_id, c."createdAt" AS occurred_at, 'credit' AS kind
        FROM "Credit" c
        UNION ALL
        SELECT i."vendorId", i."createdAt", 'invoice'
        FROM "Invoice" i
        UNION ALL
        SELECT a."actorId", a."createdAt", 'interaction'
        FROM "AuditLog" a
        WHERE a."actorType" = 'vendor' AND a."actorId" IS NOT NULL
      )
      SELECT v."businessName" AS name,
             COALESCE(cm."shortName", cm.name, '—') AS community,
             COUNT(e.occurred_at) FILTER (WHERE e.occurred_at >= NOW() - INTERVAL '30 days') AS "interactions30d",
             MAX(e.occurred_at) AS last_interacted,
             COUNT(*) FILTER (WHERE e.kind = 'credit' AND e.occurred_at >= NOW() - INTERVAL '30 days') AS "credits30d",
             COUNT(*) FILTER (WHERE e.kind = 'invoice' AND e.occurred_at >= NOW() - INTERVAL '30 days') AS "invoices30d"
      FROM "Vendor" v
      LEFT JOIN events e ON e.vendor_id = v.id
      LEFT JOIN "Community" cm ON cm.id = v."communityId"
      GROUP BY v.id, v."businessName", cm."shortName", cm.name
      ORDER BY "interactions30d" DESC, last_interacted DESC NULLS LAST
    `,

    prisma.$queryRaw<Array<{ active_30d: bigint }>>`
      WITH events AS (
        SELECT c."vendorId" AS vendor_id, c."createdAt" AS occurred_at FROM "Credit" c
        UNION ALL
        SELECT i."vendorId", i."createdAt" FROM "Invoice" i
        UNION ALL
        SELECT a."actorId", a."createdAt" FROM "AuditLog" a
        WHERE a."actorType" = 'vendor' AND a."actorId" IS NOT NULL
      )
      SELECT COUNT(DISTINCT vendor_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '30 days') AS active_30d
      FROM events
    `,
  ]);

  const num = (v: bigint | number | null | undefined) => Number(v ?? 0);

  const mrr = activeSubs.reduce((s, x) => s + Number(x.monthlyAmount), 0);
  const totalTracked = Number(creditTotals._sum.amount ?? 0);
  const totalRecovered = Number(repaidTotals._sum.amount ?? 0);
  const avgCredit = Number(creditTotals._avg.amount ?? 0);

  // Repayment timing, kept in narrative order (best → worst).
  const TIMING_ORDER = ["On time or early", "1–3 days late", "4–7 days late", "8–30 days late", "Over 30 days late"];
  const timingBuckets: TimingBucket[] = TIMING_ORDER.map((bucket) => ({
    bucket,
    count: num(timing.find((t) => t.bucket === bucket)?.count),
  }));
  const settledTotal = timingBuckets.reduce((s, b) => s + b.count, 0);
  const onTimeShare = settledTotal ? Math.round((timingBuckets[0].count / settledTotal) * 100) : 0;

  const hourCells: Record<string, number> = {};
  for (const r of logHours) hourCells[`${DAY_LABELS[r.dow]}-${r.hour}`] = num(r.count);

  const activity = vendorActivity[0] ?? { active_7d: 0n, active_30d: 0n, ever: 0n };
  const invoiceSourceRows: InvoiceSourceRow[] = (["WEB", "WHATSAPP"] as const).map((source) => {
    const row = invoiceSources.find((r) => r.source === source);
    return { source, count: num(row?.count), total: Number(row?.total ?? 0), paid: Number(row?.paid ?? 0) };
  });

  return {
    headline: {
      mrr, arr: mrr * 12, totalTracked, totalRecovered, avgCredit,
      totalCredits, totalVendors, totalCustomers,
      outstandingValue: Math.max(totalTracked - totalRecovered, 0),
      recoveryRate: totalTracked > 0 ? Math.round((totalRecovered / totalTracked) * 100) : 0,
      repaymentRate: totalCredits > 0 ? Math.round((paidCredits / totalCredits) * 100) : 0,
      defaultRate: totalCredits > 0 ? Math.round((writtenOff / totalCredits) * 100) : 0,
      onTimeShare,
      activeVendors7d: num(activity.active_7d),
      activeVendors30d: num(activity.active_30d),
      vendorsEverLogged: num(activity.ever),
      totalInvoices: invoiceSourceRows.reduce((sum, row) => sum + row.count, 0),
      webInvoices: invoiceSourceRows.find((row) => row.source === "WEB")?.count ?? 0,
      whatsappInvoices: invoiceSourceRows.find((row) => row.source === "WHATSAPP")?.count ?? 0,
      activeVendorsInteracting30d: num(activeInteractionVendors[0]?.active_30d),
    },
    health: { paidCredits, partial, overdue, writtenOff, outstanding, totalCredits },
    monthly: monthly.map((m) => ({ month: m.month, extended: m.extended, recovered: m.recovered, credits: m.credits })),
    onTime: onTime.map((r) => ({
      month: r.month,
      settled: r.settled,
      onTimeRate: r.settled > 0 ? Math.round((r.on_time / r.settled) * 100) : 0,
    })) as OnTimePoint[],
    timingBuckets,
    settledTotal,
    hourCells,
    days: DAY_LABELS,
    topVendors: topVendors.map((v) => ({
      name: v.name,
      community: v.community,
      credits: num(v.credits),
      recovered: v.recovered,
      recoveryRate: v.extended > 0 ? Math.round((v.recovered / v.extended) * 100) : 0,
    })) as VendorRow[],
    sizeBuckets: ["Under ₦1k", "₦1k–5k", "₦5k–20k", "₦20k–100k", "₦100k+"].map((bucket) => ({
      bucket,
      count: num(sizeBuckets.find((b) => b.bucket === bucket)?.count),
    })) as SizeBucket[],
    scoreDist: (["excellent", "good", "fair", "poor"] as const).map((tier) => ({
      tier,
      count: num(scoreDist.find((r) => r.tier === tier)?.count),
    })),
    repeatCustomers: ["1 credit", "2–3 credits", "4–9 credits", "10+ credits"].map((bucket) => ({
      bucket,
      count: num(repeatCustomers.find((r) => r.bucket === bucket)?.count),
    })),
    invoiceSources: invoiceSourceRows,
    vendorEngagement: vendorEngagement.map((v) => ({
      name: v.name,
      community: v.community,
      interactions30d: num(v.interactions30d),
      lastInteractedAt: v.last_interacted?.toISOString() ?? null,
      credits30d: num(v.credits30d),
      invoices30d: num(v.invoices30d),
    })) as VendorEngagementRow[],
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;

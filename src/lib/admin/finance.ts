/**
 * Finance analytics — subscription revenue, conversion and risk.
 *
 * MRR HISTORY: this is now a real point-in-time series, reconstructed from
 * SubscriptionEvent (see lib/subscription-events.ts) rather than inferred from
 * each still-active vendor's start date. For any month it answers "who was
 * ACTIVE at the end of that month, and what were they paying?".
 *
 * ONE HONEST CAVEAT REMAINS: the event log only began at the
 * 20260818000000_subscription_entitlement migration, which seeded one
 * `backfill_genesis` row per existing subscription carrying its CURRENT status
 * at its creation date. So months before that migration show those vendors at
 * today's status, not the status they actually held then. Months after it are
 * exact. `mrrSeries[].reconstructed` flags the affected points so the UI can
 * mark them instead of quietly presenting a guess as history.
 */

import { prisma } from "@/lib/prisma";
import { getEntitlement, GRACE_DAYS } from "@/lib/entitlement";

export const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter ₦2k",
  GROWTH:  "Growth ₦5k",
  PRO:     "Business Pro ₦10k",
};

export interface MrrPoint {
  month: string;
  /** Month-over-month change. Negative when churn outweighed new signups. */
  netChange: number;
  /** MRR actually being paid at that month's end. */
  mrr: number;
  /** Vendors paying at that month's end. */
  payingVendors: number;
  /** True where the point relies on backfilled genesis rows — see file header. */
  reconstructed: boolean;
}
export interface CohortRow { month: string; joined: number; converted: number; stillTrial: number; lost: number; rate: number }

/**
 * A vendor whose subscription has lapsed. This is the list that did not exist
 * before — previously the admin could see a COUNT of expired trials but had no
 * way to see who they were or to chase them.
 */
export interface LapsedVendorRow {
  subscriptionId: string;
  vendorId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string | null;
  plan: string;
  status: string;
  monthlyAmount: number;
  /** Exact date the trial/period ended, from the event log. Null if unknown. */
  lapsedAt: string | null;
  /** Whole days since it lapsed. */
  daysExpired: number | null;
  graceEndsAt: string | null;
  /** Derived entitlement: GRACE (still full access) or LOCKED (read-only). */
  state: string;
  daysUntilLockout: number | null;
  creditCount: number;
  outstanding: number;
}

export async function getFinance() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [subs, mrrSnapshots, cohorts, churnedThisMonth, newTrialsThisMonth, expiringTrials, renewals, lapsedSubs, lapseEvents, outstandingByVendor, conversionDurations] =
    await Promise.all([
      prisma.vendorSubscription.findMany({
        include: { vendor: { select: { businessName: true, ownerName: true, phone: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
      }),

      // TRUE point-in-time MRR. For each of the last 6 month-ends, take each
      // vendor's most recent subscription event at that moment and sum the ones
      // that were ACTIVE. This is what the old "new MRR by start month"
      // approximation could not answer.
      prisma.$queryRaw<Array<{ month: string; sort_key: Date; mrr: number; active: number; genesis_only: boolean }>>`
        WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', NOW() - INTERVAL '5 months'),
            DATE_TRUNC('month', NOW()),
            INTERVAL '1 month'
          ) AS month
        ),
        snapshot AS (
          SELECT DISTINCT ON (m.month, e."vendorId")
            m.month,
            e."vendorId",
            e."toStatus",
            e."monthlyAmount",
            e."reason"
          FROM months m
          JOIN "SubscriptionEvent" e
            ON e."occurredAt" < m.month + INTERVAL '1 month'
          ORDER BY m.month, e."vendorId", e."occurredAt" DESC
        )
        SELECT
          TO_CHAR(month, 'Mon')                                                       AS month,
          month                                                                       AS sort_key,
          COALESCE(SUM("monthlyAmount") FILTER (WHERE "toStatus" = 'ACTIVE'), 0)::float AS mrr,
          COUNT(*) FILTER (WHERE "toStatus" = 'ACTIVE')::int                          AS active,
          -- Flags a month whose picture rests only on backfilled rows.
          BOOL_AND("reason" = 'backfill_genesis')                                      AS genesis_only
        FROM snapshot
        GROUP BY month
        ORDER BY month ASC
      `,

      // Trial → paid conversion, by signup month. The number that decides
      // whether the free trial is doing its job.
      prisma.$queryRaw<Array<{ month: string; joined: number; converted: number; still_trial: number; lost: number }>>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', vs."createdAt"), 'Mon')                              AS month,
          COUNT(*)::int                                                                    AS joined,
          COUNT(*) FILTER (WHERE vs.status = 'ACTIVE')::int                                AS converted,
          COUNT(*) FILTER (WHERE vs.status = 'TRIAL')::int                                 AS still_trial,
          COUNT(*) FILTER (WHERE vs.status IN ('CANCELLED','EXPIRED','PAST_DUE'))::int     AS lost
        FROM "VendorSubscription" vs
        WHERE vs."createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', vs."createdAt")
        ORDER BY DATE_TRUNC('month', vs."createdAt") ASC
      `,

      // Churn timing now comes from the event log. This used to filter on
      // VendorSubscription.updatedAt, which ANY later write to the row moved —
      // a plan edit or a Paystack ping silently re-dated a churn.
      prisma.subscriptionEvent.count({
        where: {
          toStatus: { in: ["CANCELLED", "EXPIRED"] },
          reason: { not: "backfill_genesis" },
          occurredAt: { gte: monthAgo },
        },
      }),
      prisma.vendorSubscription.count({ where: { status: "TRIAL", createdAt: { gte: monthAgo } } }),

      // Actionable: trials about to lapse — each one is revenue to save this week.
      prisma.vendorSubscription.findMany({
        where: { status: "TRIAL", trialEndsAt: { gte: now, lte: in7Days } },
        include: { vendor: { select: { businessName: true, ownerName: true, phone: true } } },
        orderBy: { trialEndsAt: "asc" },
        take: 20,
      }),

      // Paying vendors whose period ends within 7 days.
      prisma.vendorSubscription.count({
        where: { status: "ACTIVE", currentPeriodEnd: { gte: now, lte: in7Days } },
      }),

      // Everyone who has actually lapsed — the chase list.
      prisma.vendorSubscription.findMany({
        where: { status: { in: ["EXPIRED", "PAST_DUE", "CANCELLED"] } },
        include: {
          vendor: {
            select: {
              id: true, businessName: true, ownerName: true, phone: true, email: true,
              _count: { select: { credits: true } },
            },
          },
        },
        orderBy: { graceEndsAt: "desc" },
      }),

      // The exact lapse moment per vendor, newest first.
      prisma.subscriptionEvent.findMany({
        where: {
          toStatus: { in: ["EXPIRED", "PAST_DUE", "CANCELLED"] },
          reason: { not: "backfill_genesis" },
        },
        select: { vendorId: true, occurredAt: true },
        orderBy: { occurredAt: "desc" },
      }),

      // Money still on the book of lapsed vendors — the reason chasing them
      // matters beyond the subscription fee.
      prisma.credit.groupBy({
        by: ["vendorId"],
        where: { status: { in: ["OUTSTANDING", "DUE_SOON", "OVERDUE", "PARTIALLY_PAID"] } },
        _sum: { amount: true, amountRepaid: true },
      }),

      // How long conversion actually takes: trial start → first ACTIVE.
      prisma.$queryRaw<Array<{ avg_days: number | null }>>`
        WITH first_active AS (
          SELECT "vendorId", MIN("occurredAt") AS at
          FROM "SubscriptionEvent"
          WHERE "toStatus" = 'ACTIVE' AND "reason" <> 'backfill_genesis'
          GROUP BY "vendorId"
        ),
        trial_start AS (
          SELECT "vendorId", MIN("occurredAt") AS at
          FROM "SubscriptionEvent"
          WHERE "toStatus" = 'TRIAL'
          GROUP BY "vendorId"
        )
        SELECT AVG(EXTRACT(EPOCH FROM (fa.at - ts.at)) / 86400)::float AS avg_days
        FROM first_active fa
        JOIN trial_start ts ON ts."vendorId" = fa."vendorId"
        WHERE fa.at > ts.at
      `,
    ]);

  const activeSubs  = subs.filter((s) => s.status === "ACTIVE");
  const trialSubs   = subs.filter((s) => s.status === "TRIAL");
  const pastDueSubs = subs.filter((s) => s.status === "PAST_DUE");
  const cancelled   = subs.filter((s) => s.status === "CANCELLED").length;
  const expired     = subs.filter((s) => s.status === "EXPIRED").length;

  const mrr = activeSubs.reduce((s, x) => s + Number(x.monthlyAmount), 0);
  const revenueAtRisk = pastDueSubs.reduce((s, x) => s + Number(x.monthlyAmount), 0);
  const trialMrrPotential = trialSubs.reduce((s, x) => s + Number(x.monthlyAmount), 0);

  // Point-in-time MRR, plus the month-over-month movement between snapshots.
  let previousMrr = 0;
  const mrrSeries: MrrPoint[] = mrrSnapshots.map((m) => {
    const netChange = m.mrr - previousMrr;
    previousMrr = m.mrr;
    return {
      month: m.month,
      netChange,
      mrr: m.mrr,
      payingVendors: m.active,
      reconstructed: m.genesis_only === true,
    };
  });

  // ── Lapsed vendors: the chase list ────────────────────────────────────────
  // Newest lapse wins — the events query is already ordered desc, so the first
  // entry per vendor is the current one.
  const lapsedAtByVendor = new Map<string, Date>();
  for (const event of lapseEvents) {
    if (!lapsedAtByVendor.has(event.vendorId)) lapsedAtByVendor.set(event.vendorId, event.occurredAt);
  }

  const outstandingMap = new Map<string, number>();
  for (const row of outstandingByVendor) {
    outstandingMap.set(
      row.vendorId,
      Math.max(0, Number(row._sum.amount ?? 0) - Number(row._sum.amountRepaid ?? 0))
    );
  }

  const lapsedVendors: LapsedVendorRow[] = lapsedSubs.map((sub) => {
    const entitlement = getEntitlement(sub, now);
    // Prefer the observed event; fall back to the grace stamp so a row seeded by
    // the migration still shows something rather than a blank.
    const lapsedAt =
      lapsedAtByVendor.get(sub.vendorId) ??
      (sub.graceEndsAt ? new Date(sub.graceEndsAt.getTime() - GRACE_DAYS * 86_400_000) : null);

    return {
      subscriptionId: sub.id,
      vendorId: sub.vendorId,
      businessName: sub.vendor.businessName,
      ownerName: sub.vendor.ownerName,
      phone: sub.vendor.phone,
      email: sub.vendor.email,
      plan: PLAN_LABELS[sub.plan] ?? sub.plan,
      status: sub.status,
      monthlyAmount: Number(sub.monthlyAmount),
      lapsedAt: lapsedAt ? lapsedAt.toISOString() : null,
      daysExpired: lapsedAt
        ? Math.max(0, Math.floor((now.getTime() - lapsedAt.getTime()) / 86_400_000))
        : null,
      graceEndsAt: sub.graceEndsAt ? sub.graceEndsAt.toISOString() : null,
      state: entitlement.state,
      daysUntilLockout: entitlement.daysUntilLockout,
      creditCount: sub.vendor._count.credits,
      outstanding: outstandingMap.get(sub.vendorId) ?? 0,
    };
  });

  const inGrace = lapsedVendors.filter((v) => v.state === "GRACE");
  const lockedOut = lapsedVendors.filter((v) => v.state === "LOCKED");
  // Recurring revenue that has actually stopped, not "at risk".
  const mrrLostToExpiry = lockedOut.reduce((sum, v) => sum + v.monthlyAmount, 0);
  const avgDaysToConvert = conversionDurations[0]?.avg_days ?? null;

  const cohortRows: CohortRow[] = cohorts.map((c) => ({
    month: c.month,
    joined: c.joined,
    converted: c.converted,
    stillTrial: c.still_trial,
    lost: c.lost,
    rate: c.joined > 0 ? Math.round((c.converted / c.joined) * 100) : 0,
  }));

  const decided = cohortRows.reduce((s, c) => s + c.converted + c.lost, 0);
  const convertedAll = cohortRows.reduce((s, c) => s + c.converted, 0);

  const planMix = (["STARTER", "GROWTH", "PRO"] as const).map((plan) => {
    const rows = subs.filter((s) => s.plan === plan);
    const active = rows.filter((s) => s.status === "ACTIVE");
    return {
      plan,
      label: PLAN_LABELS[plan],
      active: active.length,
      trial: rows.filter((s) => s.status === "TRIAL").length,
      total: rows.length,
      contribution: active.reduce((s, x) => s + Number(x.monthlyAmount), 0),
    };
  });

  return {
    kpi: {
      mrr,
      arr: mrr * 12,
      arpu: activeSubs.length ? Math.round(mrr / activeSubs.length) : 0,
      activeCount: activeSubs.length,
      trialCount: trialSubs.length,
      pastDueCount: pastDueSubs.length,
      revenueAtRisk,
      trialMrrPotential,
      churnedThisMonth,
      newTrialsThisMonth,
      renewalsDue7d: renewals,
      cancelled,
      expired,
      totalSubs: subs.length,
      // Lapsed-account picture. inGrace still has full access and is the group
      // worth calling TODAY; lockedOut is already read-only.
      inGraceCount: inGrace.length,
      lockedOutCount: lockedOut.length,
      mrrLostToExpiry,
      // Null until at least one vendor has genuinely converted post-migration —
      // shown as "—" rather than a fabricated 0.
      avgDaysToConvert: avgDaysToConvert === null ? null : Math.round(avgDaysToConvert),
      // Conversion across every cohort whose outcome is already DECIDED. The
      // denominator ships alongside it: "100%" off a single decided vendor is
      // noise, and a rate without its sample size invites a bad call.
      conversionRate: decided > 0 ? Math.round((convertedAll / decided) * 100) : 0,
      conversionDecided: decided,
      conversionConverted: convertedAll,
      churnRate: activeSubs.length + churnedThisMonth > 0
        ? Math.round((churnedThisMonth / (activeSubs.length + churnedThisMonth)) * 100)
        : 0,
    },
    mrrSeries,
    cohortRows,
    planMix,
    lapsedVendors,
    statusMix: [
      { label: "Active (paying)", count: activeSubs.length },
      { label: "On trial",        count: trialSubs.length },
      { label: "Past due",        count: pastDueSubs.length },
      { label: "Cancelled",       count: cancelled },
      { label: "Expired",         count: expired },
    ],
    expiringTrials: expiringTrials.map((t) => ({
      id: t.id,
      businessName: t.vendor.businessName,
      ownerName: t.vendor.ownerName,
      phone: t.vendor.phone,
      plan: PLAN_LABELS[t.plan] ?? t.plan,
      monthlyAmount: Number(t.monthlyAmount),
      trialEndsAt: t.trialEndsAt ? t.trialEndsAt.toISOString() : null,
      daysLeft: t.trialEndsAt
        ? Math.max(0, Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
        : null,
    })),
    subscriptions: subs.map((s) => ({
      id: s.id,
      businessName: s.vendor.businessName,
      ownerName: s.vendor.ownerName,
      plan: PLAN_LABELS[s.plan] ?? s.plan,
      status: s.status,
      monthlyAmount: Number(s.monthlyAmount),
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

export type FinanceData = Awaited<ReturnType<typeof getFinance>>;

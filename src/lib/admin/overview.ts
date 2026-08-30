/**
 * Admin overview — platform health plus, crucially, an ATTENTION QUEUE.
 *
 * An overview that only reports totals leaves the reader asking "so what do I
 * do?". Everything below either states where the platform stands or names
 * something that needs a human this week, with the route to act on it.
 */

import { prisma } from "@/lib/prisma";

export interface AttentionItem {
  id: string;
  label: string;
  count: number;
  detail: string;
  href: string;
  severity: "critical" | "warning" | "info";
}

export async function getOverview({ includeFinance = true }: { includeFinance?: boolean } = {}) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    vendorsByStatus, totalCustomers, creditSums, repaidSums,
    activeSubs, totalCredits, creditsThisWeek, creditsPrevWeek,
    overdueCredits, writtenOff, openDisputes, pastDueSubs, expiringTrials,
    signupTrend, communities, quietVendors, recentActivity,
  ] = await Promise.all([
    prisma.vendor.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.student.count(),
    prisma.credit.aggregate({ _sum: { amount: true } }),
    prisma.credit.aggregate({ _sum: { amountRepaid: true } }),
    prisma.vendorSubscription.findMany({ where: { status: "ACTIVE" }, select: { monthlyAmount: true } }),
    prisma.credit.count(),
    prisma.credit.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.credit.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.credit.count({ where: { status: "OVERDUE" } }),
    prisma.credit.count({ where: { status: "WRITTEN_OFF" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.vendorSubscription.count({ where: { status: "PAST_DUE" } }),
    prisma.vendorSubscription.count({ where: { status: "TRIAL", trialEndsAt: { gte: now, lte: in7Days } } }),

    // Vendor signups by month — the growth line that matters in the pilot.
    prisma.$queryRaw<Array<{ month: string; vendors: number }>>`
      SELECT TO_CHAR(DATE_TRUNC('month', v."createdAt"), 'Mon') AS month,
             COUNT(*)::int                                      AS vendors
      FROM "Vendor" v
      WHERE v."createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', v."createdAt")
      ORDER BY DATE_TRUNC('month', v."createdAt") ASC
    `,

    prisma.community.findMany({
      select: { name: true, shortName: true, _count: { select: { vendors: true, students: true } } },
      orderBy: { vendors: { _count: "desc" } },
      take: 6,
    }),

    // Vendors who logged credit before but have gone quiet for 14+ days.
    // This is the churn signal — a vendor who stops logging has stopped using it.
    prisma.$queryRaw<Array<{ id: string; name: string; last_logged: Date; total: number }>>`
      SELECT v.id, v."businessName" AS name, MAX(c."createdAt") AS last_logged, COUNT(c.id)::int AS total
      FROM "Vendor" v
      JOIN "Credit" c ON c."vendorId" = v.id
      GROUP BY v.id, v."businessName"
      HAVING MAX(c."createdAt") < NOW() - INTERVAL '14 days'
      ORDER BY MAX(c."createdAt") ASC
      LIMIT 8
    `,

    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, actorType: true, entityType: true, createdAt: true },
    }),
  ]);

  const activeVendors = vendorsByStatus.find((v) => v.status === "ACTIVE")?._count._all ?? 0;
  const totalVendors = vendorsByStatus.reduce((s, v) => s + v._count._all, 0);
  const mrr = activeSubs.reduce((s, x) => s + Number(x.monthlyAmount), 0);
  const tracked = Number(creditSums._sum.amount ?? 0);
  const recovered = Number(repaidSums._sum.amountRepaid ?? 0);

  const wowChange = creditsPrevWeek > 0
    ? Math.round(((creditsThisWeek - creditsPrevWeek) / creditsPrevWeek) * 100)
    : creditsThisWeek > 0 ? 100 : 0;

  // Ordered by urgency — money and trust first, growth second.
  const attention: AttentionItem[] = ([
    {
      id: "disputes", label: "Open disputes", count: openDisputes,
      detail: "Customers contesting a credit — every day open is trust lost",
      href: "/admin/disputes", severity: "critical",
    },
    {
      id: "pastdue", label: "Past-due subscriptions", count: pastDueSubs,
      detail: "Paying vendors whose payment failed", href: "/admin/finance", severity: "critical",
    },
    {
      id: "quiet", label: "Vendors gone quiet", count: quietVendors.length,
      detail: "Logged credit before, nothing for 14+ days — the churn signal",
      href: "/admin/vendors", severity: "warning",
    },
    {
      id: "trials", label: "Trials ending this week", count: expiringTrials,
      detail: "Revenue to save with a phone call", href: "/admin/finance", severity: "warning",
    },
    {
      id: "overdue", label: "Overdue credits", count: overdueCredits,
      detail: "Past their due date and unpaid across the platform",
      href: "/admin/analytics", severity: "info",
    },
  ] as AttentionItem[]).filter((a) => a.count > 0);

  return {
    kpi: {
      totalVendors, activeVendors, totalCustomers,
      mrr: includeFinance ? mrr : 0,
      tracked: includeFinance ? tracked : 0,
      recovered: includeFinance ? recovered : 0,
      outstanding: includeFinance ? Math.max(tracked - recovered, 0) : 0,
      recoveryRate: includeFinance && tracked > 0 ? Math.round((recovered / tracked) * 100) : 0,
      totalCredits, creditsThisWeek, wowChange,
      defaultRate: includeFinance && totalCredits > 0 ? Math.round((writtenOff / totalCredits) * 100) : 0,
      openDisputes, pastDueSubs: includeFinance ? pastDueSubs : 0, expiringTrials: includeFinance ? expiringTrials : 0,
      overdueCredits: includeFinance ? overdueCredits : 0,
    },
    attention: includeFinance ? attention : attention.filter((item) => item.id !== "pastdue" && item.id !== "trials"),
    signupTrend,
    communities: communities.map((c) => ({
      name: c.shortName ?? c.name,
      vendors: c._count.vendors,
      customers: c._count.students,
    })),
    quietVendors: quietVendors.map((v) => ({
      name: v.name,
      total: v.total,
      daysQuiet: Math.floor((now.getTime() - new Date(v.last_logged).getTime()) / 86_400_000),
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      actorType: a.actorType,
      entityType: a.entityType,
      at: a.createdAt.toISOString(),
    })),
  };
}

export type OverviewData = Awaited<ReturnType<typeof getOverview>>;

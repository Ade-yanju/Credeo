import { prisma } from "@/lib/prisma";
import { ACTIVE_ACQUISITION_STAGES } from "@/lib/acquisition";

const stages = ["IDENTIFIED", "CONTACTED", "RESPONDED", "QUALIFIED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "ONBOARDING", "ACTIVATED", "WON", "LOST", "UNQUALIFIED"] as const;

export async function getAcquisitionDashboard() {
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const [prospects, campaigns, communities, ambassadors, admins] = await Promise.all([
    prisma.acquisitionProspect.findMany({
      include: {
        community: { select: { name: true, shortName: true } },
        campaign: { select: { id: true, name: true } },
        ambassador: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        convertedVendor: { select: { id: true, businessName: true } },
      },
      orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.acquisitionCampaign.findMany({ include: { _count: { select: { prospects: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.community.findMany({ select: { id: true, name: true, shortName: true }, orderBy: { name: "asc" } }),
    prisma.ambassador.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.adminUser.findMany({ where: { activatedAt: { not: null }, role: { in: ["SUPER_ADMIN", "MARKETING", "CUSTOMER_CARE"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  const active = prospects.filter((p) => (ACTIVE_ACQUISITION_STAGES as readonly string[]).includes(p.stage));
  const queue = {
    overdue: active.filter((p) => p.nextActionAt && p.nextActionAt < now),
    today: active.filter((p) => p.nextActionAt && p.nextActionAt >= now && p.nextActionAt <= todayEnd),
    qualifiedNoAction: prospects.filter((p) => p.stage === "QUALIFIED" && !p.nextActionAt),
    upcomingDemos: prospects.filter((p) => p.stage === "DEMO_SCHEDULED"),
    onboarding: prospects.filter((p) => p.stage === "ONBOARDING"),
  };
  const count = (stage: string) => prospects.filter((p) => p.stage === stage).length;
  const pct = (numerator: number, denominator: number) => denominator >= 5 ? Math.round((numerator / denominator) * 100) : null;
  const identified = prospects.length;
  const contacted = prospects.filter((p) => p.contactedAt).length;
  const responded = prospects.filter((p) => p.respondedAt).length;
  const qualified = prospects.filter((p) => p.qualifiedAt).length;
  const demos = prospects.filter((p) => p.demoScheduledAt).length;
  const activated = prospects.filter((p) => p.activatedAt).length;
  const won = prospects.filter((p) => p.wonAt).length;
  const sourceRows = Array.from(new Set(prospects.map((p) => p.source))).map((source) => {
    const rows = prospects.filter((p) => p.source === source);
    return { source, leads: rows.length, qualified: rows.filter((p) => p.qualifiedAt).length, activated: rows.filter((p) => p.activatedAt).length, won: rows.filter((p) => p.wonAt).length };
  }).sort((a, b) => b.leads - a.leads);
  const locationRows = Array.from(new Set(prospects.map((p) => p.community?.shortName ?? p.community?.name ?? p.locationText ?? "Unspecified"))).map((location) => {
    const rows = prospects.filter((p) => (p.community?.shortName ?? p.community?.name ?? p.locationText ?? "Unspecified") === location);
    return { location, leads: rows.length, activated: rows.filter((p) => p.activatedAt).length };
  }).sort((a, b) => b.activated - a.activated || b.leads - a.leads);
  return {
    prospects, campaigns: campaigns.map((c) => ({ ...c, budgetAmount: c.budgetAmount ? Number(c.budgetAmount) : null, actualSpendAmount: c.actualSpendAmount ? Number(c.actualSpendAmount) : null })),
    communities, ambassadors, admins, queue,
    kpi: { identified, contacted, responded, qualified, demos, activated, won, contactRate: pct(contacted, identified), responseRate: pct(responded, contacted), qualificationRate: pct(qualified, responded), demoRate: pct(demos, qualified), activationRate: pct(activated, qualified), winRate: pct(won, activated) },
    stages: stages.map((stage) => ({ stage, count: count(stage) })), sourceRows, locationRows,
  };
}
export type AcquisitionDashboardData = Awaited<ReturnType<typeof getAcquisitionDashboard>>;

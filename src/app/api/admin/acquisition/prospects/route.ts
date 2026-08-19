import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS, ACQUISITION_READERS, ACTIVE_ACQUISITION_STAGES } from "@/lib/acquisition";
import { normalisePhone } from "@/lib/utils";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const enumValues = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);
const sourceValues = ["GOOGLE_BUSINESS", "SOCIAL_MEDIA", "AMBASSADOR_REFERRAL", "DIRECT_OUTBOUND", "EVENT_COMMUNITY", "PARTNERSHIP", "MANUAL_ENTRY", "OTHER"] as const;
const stageValues = ["IDENTIFIED", "CONTACTED", "RESPONDED", "QUALIFIED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "ONBOARDING", "ACTIVATED", "WON", "LOST", "UNQUALIFIED"] as const;
const priorityValues = ["LOW", "NORMAL", "HIGH"] as const;
const actionValues = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO", "VISIT", "RESEARCH", "OTHER"] as const;
const vendorValues = ["PROVISION_SHOP", "FOOD_CANTEEN", "LAUNDRY", "PRINTING", "BARBING_SALON", "HAIR_SALON", "PHARMACY", "MINI_MART", "OTHER"] as const;
const businessSizeValues = ["SOLO", "MICRO", "SMALL", "MEDIUM", "LARGE", "UNKNOWN"] as const;
const transactionVolumeBandValues = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH", "UNKNOWN"] as const;
const creditBehaviorValues = ["NONE", "PAPER_LEDGER", "SPREADSHEET", "WHATSAPP", "DIGITAL_TOOL", "UNKNOWN"] as const;
const whatsAppUsageValues = ["ACTIVE_PERSONAL", "WHATSAPP_BUSINESS", "LIMITED", "NONE", "UNKNOWN"] as const;
const fitValues = ["HIGH", "MEDIUM", "LOW", "UNQUALIFIED"] as const;

const schema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  vendorType: enumValues(vendorValues).optional().nullable(),
  communityId: z.string().cuid().optional().nullable(),
  locationText: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  businessSize: enumValues(businessSizeValues).default("UNKNOWN"),
  transactionVolumeBand: enumValues(transactionVolumeBandValues).default("UNKNOWN"),
  creditBehavior: enumValues(creditBehaviorValues).default("UNKNOWN"),
  whatsAppUsage: enumValues(whatsAppUsageValues).default("UNKNOWN"),
  fit: enumValues(fitValues).default("MEDIUM"),
  fitNotes: z.string().trim().max(2000).optional().nullable(),
  source: enumValues(sourceValues),
  sourceDetail: z.string().trim().max(300).optional().nullable(),
  campaignId: z.string().cuid().optional().nullable(),
  ambassadorId: z.string().cuid().optional().nullable(),
  assignedToAdminId: z.string().cuid().optional().nullable(),
  priority: enumValues(priorityValues).default("NORMAL"),
  nextActionType: enumValues(actionValues).optional().nullable(),
  nextActionAt: z.string().datetime().optional().nullable(),
  nextActionNote: z.string().trim().max(1000).optional().nullable(),
  stage: enumValues(stageValues).default("IDENTIFIED"),
  forceCreate: z.boolean().optional(),
});

function canRead(role: string) { return (ACQUISITION_READERS as readonly string[]).includes(role); }
function canWrite(role: string) { return (ACQUISITION_OPERATORS as readonly string[]).includes(role); }

async function validateReferences(d: z.infer<typeof schema>) {
  const [community, campaign, ambassador, owner] = await Promise.all([
    d.communityId ? prisma.community.findUnique({ where: { id: d.communityId }, select: { id: true } }) : null,
    d.campaignId ? prisma.acquisitionCampaign.findUnique({ where: { id: d.campaignId }, select: { id: true } }) : null,
    d.ambassadorId ? prisma.ambassador.findUnique({ where: { id: d.ambassadorId }, select: { id: true, status: true } }) : null,
    d.assignedToAdminId ? prisma.adminUser.findUnique({ where: { id: d.assignedToAdminId }, select: { id: true, activatedAt: true, role: true } }) : null,
  ]);
  if (d.communityId && !community) return "Community not found";
  if (d.campaignId && !campaign) return "Campaign not found";
  if (d.ambassadorId && (!ambassador || ambassador.status !== "ACTIVE")) return "Ambassador must be active";
  if (d.assignedToAdminId && (!owner || !owner.activatedAt || !(ACQUISITION_OPERATORS as readonly string[]).includes(owner.role))) return "Owner must be an active acquisition operator";
  return null;
}

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRead(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const search = p.get("search")?.trim() ?? "";
  const stage = p.get("stage");
  const source = p.get("source");
  const owner = p.get("owner");
  const queue = p.get("queue");
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const where = {
    ...(stage ? { stage: stage as (typeof stageValues)[number] } : {}),
    ...(source ? { source: source as (typeof sourceValues)[number] } : {}),
    ...(owner ? { assignedToAdminId: owner } : {}),
    ...(search ? { OR: [
      { businessName: { contains: search, mode: "insensitive" as const } },
      { contactName: { contains: search, mode: "insensitive" as const } },
      { phone: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
    ...(queue === "overdue" ? { stage: { in: [...ACTIVE_ACQUISITION_STAGES] }, nextActionAt: { lt: now } } : {}),
    ...(queue === "today" ? { stage: { in: [...ACTIVE_ACQUISITION_STAGES] }, nextActionAt: { gte: now, lte: todayEnd } } : {}),
    ...(queue === "qualified-no-action" ? { stage: "QUALIFIED" as const, nextActionAt: null } : {}),
    ...(queue === "onboarding" ? { stage: "ONBOARDING" as const } : {}),
  };
  const prospects = await prisma.acquisitionProspect.findMany({
    where,
    include: {
      community: { select: { name: true, shortName: true } },
      campaign: { select: { id: true, name: true } },
      ambassador: { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true } },
      convertedVendor: { select: { id: true, businessName: true } },
    },
    orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 300,
  });
  return NextResponse.json({ prospects });
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const phone = d.phone ? normalisePhone(d.phone) : null;
  if (d.phone && !phone) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  const email = d.email?.toLowerCase() ?? null;
  if ((ACTIVE_ACQUISITION_STAGES as readonly string[]).includes(d.stage) &&
      (!d.assignedToAdminId || !d.nextActionType || !d.nextActionAt || !d.nextActionNote)) {
    return NextResponse.json({ error: "Active prospects need an owner and a clear next action." }, { status: 400 });
  }
  if (d.source === "AMBASSADOR_REFERRAL" && !d.ambassadorId) {
    return NextResponse.json({ error: "Ambassador-sourced prospects must name the ambassador." }, { status: 400 });
  }
  const referenceError = await validateReferences(d);
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });
  const [prospects, vendors] = await Promise.all([
    phone || email ? prisma.acquisitionProspect.findMany({ where: { OR: [
      ...(phone ? [{ phone }] : []), ...(email ? [{ email }] : []),
    ] }, select: { id: true, businessName: true, stage: true, phone: true, email: true } }) : Promise.resolve([]),
    phone || email ? prisma.vendor.findMany({ where: { OR: [
      ...(phone ? [{ phone }] : []), ...(email ? [{ email }] : []),
    ] }, select: { id: true, businessName: true, phone: true, email: true } }) : Promise.resolve([]),
  ]);
  if (!d.forceCreate && (prospects.length || vendors.length)) {
    return NextResponse.json({ duplicateWarning: true, prospects, vendors }, { status: 409 });
  }
  const now = new Date();
  const { forceCreate: _forceCreate, ...prospectData } = d;
  const prospect = await prisma.acquisitionProspect.create({
    data: {
      ...prospectData,
      phone, email,
      nextActionAt: d.nextActionAt ? new Date(d.nextActionAt) : null,
      capturedByAdminId: session.id === "__super__" ? null : session.id,
      ...(d.stage === "CONTACTED" ? { contactedAt: now } : {}),
      ...(d.stage === "RESPONDED" ? { respondedAt: now } : {}),
      ...(d.stage === "QUALIFIED" ? { qualifiedAt: now } : {}),
      ...(d.stage === "DEMO_SCHEDULED" ? { demoScheduledAt: now } : {}),
    },
  });
  await prisma.acquisitionActivity.create({ data: {
    prospectId: prospect.id, type: "NOTE", outcome: "Prospect identified", body: d.fitNotes ?? null,
    createdByAdminId: session.id === "__super__" ? null : session.id,
  } });
  void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.prospect_created", entityType: "AcquisitionProspect", entityId: prospect.id, ipAddress: ipFromRequest(req), metadata: { source: d.source } });
  return NextResponse.json({ prospect }, { status: 201 });
}

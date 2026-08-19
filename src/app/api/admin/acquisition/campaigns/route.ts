import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS, ACQUISITION_READERS } from "@/lib/acquisition";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  source: z.enum(["GOOGLE_BUSINESS", "SOCIAL_MEDIA", "AMBASSADOR_REFERRAL", "DIRECT_OUTBOUND", "EVENT_COMMUNITY", "PARTNERSHIP", "MANUAL_ENTRY", "OTHER"]),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).default("DRAFT"),
  startAt: z.string().datetime().optional().nullable(), endAt: z.string().datetime().optional().nullable(),
  ownerAdminId: z.string().cuid().optional().nullable(), budgetAmount: z.number().min(0).optional().nullable(),
  actualSpendAmount: z.number().min(0).optional().nullable(), notes: z.string().trim().max(2000).optional().nullable(),
});

export async function GET() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_READERS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const campaigns = await prisma.acquisitionCampaign.findMany({
    include: { owner: { select: { id: true, name: true } }, _count: { select: { prospects: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  if (d.startAt && d.endAt && new Date(d.endAt) < new Date(d.startAt)) {
    return NextResponse.json({ error: "Campaign end date must be after its start date." }, { status: 400 });
  }
  if (d.ownerAdminId) {
    const owner = await prisma.adminUser.findUnique({ where: { id: d.ownerAdminId }, select: { activatedAt: true, role: true } });
    if (!owner?.activatedAt || !(ACQUISITION_OPERATORS as readonly string[]).includes(owner.role)) {
      return NextResponse.json({ error: "Owner must be an active acquisition operator." }, { status: 400 });
    }
  }
  const campaign = await prisma.acquisitionCampaign.create({ data: {
    ...d, startAt: d.startAt ? new Date(d.startAt) : null, endAt: d.endAt ? new Date(d.endAt) : null,
  } });
  void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.campaign_created", entityType: "AcquisitionCampaign", entityId: campaign.id, ipAddress: ipFromRequest(req), metadata: { source: campaign.source } });
  return NextResponse.json({ campaign }, { status: 201 });
}

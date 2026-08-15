import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS, ACQUISITION_READERS, ACTIVE_ACQUISITION_STAGES, stageTimestampPatch } from "@/lib/acquisition";
import { normalisePhone } from "@/lib/utils";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const stages = ["IDENTIFIED", "CONTACTED", "RESPONDED", "QUALIFIED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "ONBOARDING", "ACTIVATED", "WON", "LOST", "UNQUALIFIED"] as const;
const actions = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO", "VISIT", "RESEARCH", "OTHER"] as const;
const priorities = ["LOW", "NORMAL", "HIGH"] as const;
const schema = z.object({
  businessName: z.string().trim().min(2).max(120).optional(), contactName: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(), email: z.string().trim().email().max(255).nullable().optional(),
  stage: z.enum(stages).optional(), priority: z.enum(priorities).optional(), assignedToAdminId: z.string().cuid().nullable().optional(),
  nextActionType: z.enum(actions).nullable().optional(), nextActionAt: z.string().datetime().nullable().optional(),
  nextActionNote: z.string().trim().max(1000).nullable().optional(), sourceDetail: z.string().trim().max(300).nullable().optional(),
  fitNotes: z.string().trim().max(2000).nullable().optional(), lossReason: z.string().trim().max(1000).nullable().optional(),
  unqualifiedReason: z.string().trim().max(1000).nullable().optional(),
});
const canRead = (role: string) => (ACQUISITION_READERS as readonly string[]).includes(role);
const canWrite = (role: string) => (ACQUISITION_OPERATORS as readonly string[]).includes(role);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRead(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const prospect = await prisma.acquisitionProspect.findUnique({
    where: { id: params.id },
    include: {
      community: true, campaign: true, ambassador: true, capturedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      convertedVendor: { select: { id: true, businessName: true, phone: true, email: true, subscription: true, _count: { select: { credits: true } } } },
      activities: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { occurredAt: "desc" } },
    },
  });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  return NextResponse.json({ prospect });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const existing = await prisma.acquisitionProspect.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  const d = parsed.data;
  const phone = d.phone === undefined ? undefined : d.phone ? normalisePhone(d.phone) : null;
  if (d.phone && !phone) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  const stage = d.stage ?? existing.stage;
  const owner = d.assignedToAdminId === undefined ? existing.assignedToAdminId : d.assignedToAdminId;
  const action = d.nextActionType === undefined ? existing.nextActionType : d.nextActionType;
  const at = d.nextActionAt === undefined ? existing.nextActionAt : d.nextActionAt ? new Date(d.nextActionAt) : null;
  const note = d.nextActionNote === undefined ? existing.nextActionNote : d.nextActionNote;
  if ((ACTIVE_ACQUISITION_STAGES as readonly string[]).includes(stage) && (!owner || !action || !at || !note)) {
    return NextResponse.json({ error: "Active prospects need an owner and a clear next action." }, { status: 400 });
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const prospect = await tx.acquisitionProspect.update({
      where: { id: params.id },
      data: {
        ...d, phone, email: d.email === undefined ? undefined : d.email?.toLowerCase() ?? null,
        nextActionAt: d.nextActionAt === undefined ? undefined : at,
        ...(d.stage && d.stage !== existing.stage ? stageTimestampPatch(d.stage, now) : {}),
      },
    });
    if (d.stage && d.stage !== existing.stage) {
      await tx.acquisitionActivity.create({ data: {
        prospectId: params.id, type: "STATUS_CHANGE", stageFrom: existing.stage, stageTo: d.stage,
        outcome: "Pipeline stage changed", createdByAdminId: session.id === "__super__" ? null : session.id,
      } });
    }
    return prospect;
  });
  void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.prospect_updated", entityType: "AcquisitionProspect", entityId: params.id, ipAddress: ipFromRequest(req), metadata: { stage: updated.stage } });
  return NextResponse.json({ prospect: updated });
}

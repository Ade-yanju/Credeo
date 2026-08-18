import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS, ACQUISITION_READERS, ACTIVE_ACQUISITION_STAGES, isTerminalAcquisitionStage, stageTimestampPatch } from "@/lib/acquisition";
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
  reopen: z.literal(true).optional(), reopenReason: z.string().trim().min(3).max(500).optional(),
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
  if (d.reopen) {
    if (existing.stage !== "LOST" && existing.stage !== "UNQUALIFIED") {
      return NextResponse.json({ error: "Only lost or unqualified prospects can be reopened." }, { status: 400 });
    }
    if (stage !== "IDENTIFIED" || !d.reopenReason) {
      return NextResponse.json({ error: "Reopening requires a reason and restarts the prospect at Identified." }, { status: 400 });
    }
  } else if (stage !== existing.stage) {
    if (existing.stage === "LOST" || existing.stage === "UNQUALIFIED" || existing.stage === "WON") {
      return NextResponse.json({ error: "Closed prospects can only be reopened through the explicit reopen action." }, { status: 400 });
    }
    if (stage === "ACTIVATED" || stage === "WON") {
      return NextResponse.json({ error: "Activated and won stages are set only by verified product lifecycle events." }, { status: 400 });
    }
    if (stage === "LOST" || stage === "UNQUALIFIED") {
      // A qualified operator may close an active prospect at any point with a reason.
    } else {
      const nextStage: Partial<Record<typeof existing.stage, string>> = {
        IDENTIFIED: "CONTACTED", CONTACTED: "RESPONDED", RESPONDED: "QUALIFIED",
        QUALIFIED: "DEMO_SCHEDULED", DEMO_SCHEDULED: "DEMO_COMPLETED", DEMO_COMPLETED: "ONBOARDING",
      };
      if (nextStage[existing.stage] !== stage) {
        return NextResponse.json({ error: "Prospects must advance through the acquisition pipeline one stage at a time." }, { status: 400 });
      }
      if (stage === "ONBOARDING" && !existing.convertedVendorId) {
        return NextResponse.json({ error: "Onboarding starts only after the prospect is linked to a vendor through registration or an explicit match." }, { status: 400 });
      }
    }
  }
  if (d.stage === "LOST" && !d.lossReason && !existing.lossReason) {
    return NextResponse.json({ error: "A loss reason is required when closing a prospect as lost." }, { status: 400 });
  }
  if (d.stage === "UNQUALIFIED" && !d.unqualifiedReason && !existing.unqualifiedReason) {
    return NextResponse.json({ error: "An unqualified reason is required when closing a prospect." }, { status: 400 });
  }
  if (d.assignedToAdminId) {
    const ownerRecord = await prisma.adminUser.findUnique({ where: { id: d.assignedToAdminId }, select: { activatedAt: true, role: true } });
    if (!ownerRecord?.activatedAt || !(ACQUISITION_OPERATORS as readonly string[]).includes(ownerRecord.role)) {
      return NextResponse.json({ error: "Owner must be an active acquisition operator." }, { status: 400 });
    }
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const { reopen: _reopen, reopenReason: _reopenReason, ...prospectData } = d;
    const prospect = await tx.acquisitionProspect.update({
      where: { id: params.id },
      data: {
        ...prospectData, phone, email: d.email === undefined ? undefined : d.email?.toLowerCase() ?? null,
        nextActionAt: d.nextActionAt === undefined ? undefined : at,
        ...(d.stage && isTerminalAcquisitionStage(d.stage) ? { nextActionType: null, nextActionAt: null, nextActionNote: null } : {}),
        ...(d.stage && d.stage !== existing.stage ? stageTimestampPatch(d.stage, now) : {}),
      },
    });
    if (d.stage && d.stage !== existing.stage) {
      await tx.acquisitionActivity.create({ data: {
        prospectId: params.id, type: "STATUS_CHANGE", stageFrom: existing.stage, stageTo: d.stage,
        outcome: d.reopen ? `Prospect reopened: ${d.reopenReason}` : "Pipeline stage changed", createdByAdminId: session.id === "__super__" ? null : session.id,
      } });
    }
    return prospect;
  });
  void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.prospect_updated", entityType: "AcquisitionProspect", entityId: params.id, ipAddress: ipFromRequest(req), metadata: { stage: updated.stage } });
  return NextResponse.json({ prospect: updated });
}

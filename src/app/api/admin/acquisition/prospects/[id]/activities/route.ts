import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS } from "@/lib/acquisition";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const schema = z.object({
  type: z.enum(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO", "FOLLOW_UP_COMPLETED"]),
  outcome: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().max(3000).optional().nullable(),
  nextActionType: z.enum(["CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO", "VISIT", "RESEARCH", "OTHER"]).optional().nullable(),
  nextActionAt: z.string().datetime().optional().nullable(),
  nextActionNote: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const prospect = await prisma.acquisitionProspect.findUnique({ where: { id: params.id } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  const d = parsed.data;
  if ((prospect.stage === "LOST" || prospect.stage === "UNQUALIFIED" || prospect.stage === "WON") && d.nextActionType) {
    return NextResponse.json({ error: "Closed prospects cannot receive a new follow-up action." }, { status: 400 });
  }
  if ((d.nextActionType || d.nextActionAt || d.nextActionNote) && (!d.nextActionType || !d.nextActionAt || !d.nextActionNote)) {
    return NextResponse.json({ error: "A next action needs type, date/time, and note." }, { status: 400 });
  }
  const now = new Date();
  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.acquisitionActivity.create({ data: {
      prospectId: params.id, type: d.type, outcome: d.outcome ?? null, body: d.body ?? null,
      nextActionAt: d.nextActionAt ? new Date(d.nextActionAt) : null,
      createdByAdminId: session.id === "__super__" ? null : session.id,
    } });
    await tx.acquisitionProspect.update({ where: { id: params.id }, data: {
      ...(d.type === "CALL" || d.type === "WHATSAPP" || d.type === "EMAIL" ? { lastContactedAt: now, contactAttempts: { increment: 1 } } : {}),
      ...(d.type === "FOLLOW_UP_COMPLETED" && !d.nextActionType ? { nextActionType: null, nextActionAt: null, nextActionNote: null } : {}),
      ...(d.nextActionType ? { nextActionType: d.nextActionType, nextActionAt: new Date(d.nextActionAt!), nextActionNote: d.nextActionNote } : {}),
    } });
    return created;
  });
  void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.activity_created", entityType: "AcquisitionProspect", entityId: params.id, ipAddress: ipFromRequest(req), metadata: { type: d.type } });
  return NextResponse.json({ activity }, { status: 201 });
}

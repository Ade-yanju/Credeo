import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS } from "@/lib/acquisition";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(), status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  budgetAmount: z.number().min(0).nullable().optional(), actualSpendAmount: z.number().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const campaign = await prisma.acquisitionCampaign.update({ where: { id: params.id }, data: parsed.data }).catch(() => null);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.campaign_updated", entityType: "AcquisitionCampaign", entityId: campaign.id, ipAddress: ipFromRequest(req) });
  return NextResponse.json({ campaign });
}

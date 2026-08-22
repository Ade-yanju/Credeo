import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ACQUISITION_OPERATORS } from "@/lib/acquisition";
import { qualifyAcquisitionProspect } from "@/lib/acquisition-qualification";

export async function POST(_req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const prospects = await prisma.acquisitionProspect.findMany({ where: { stage: "IDENTIFIED", activities: { none: { outcome: "AI qualification completed" } } }, select: { id: true }, orderBy: { createdAt: "asc" }, take: 25 });
  let qualified = 0; let unavailable = 0;
  for (const prospect of prospects) {
    const result = await qualifyAcquisitionProspect(prospect.id, session.id === "__super__" ? null : session.id);
    if (result === "qualified") qualified += 1;
    if (result === "unavailable") unavailable += 1;
  }
  return NextResponse.json({ processed: prospects.length, qualified, unavailable, message: unavailable ? "AI scoring is unavailable. Add ANTHROPIC_API_KEY to enable it." : "AI scores are advisory; verify contacts before outreach." });
}

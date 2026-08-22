import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { qualifyAcquisitionProspect } from "@/lib/acquisition-qualification";

/**
 * Nightly AI qualification queue. Configure cron-job.org to call this route
 * with `Authorization: Bearer <CRON_SECRET>`. It scores at most 25 new public
 * listings per run and never sends outreach or creates claim links.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prospects = await prisma.acquisitionProspect.findMany({
    where: { stage: "IDENTIFIED", activities: { none: { outcome: "AI qualification completed" } } },
    select: { id: true }, orderBy: { createdAt: "asc" }, take: 25,
  });
  let qualified = 0; let unavailable = 0;
  for (const prospect of prospects) {
    const result = await qualifyAcquisitionProspect(prospect.id);
    if (result === "qualified") qualified += 1;
    if (result === "unavailable") unavailable += 1;
  }
  return NextResponse.json({ ok: true, processed: prospects.length, qualified, unavailable });
}

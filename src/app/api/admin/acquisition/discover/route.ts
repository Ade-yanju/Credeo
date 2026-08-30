import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ACQUISITION_OPERATORS } from "@/lib/acquisition";
import { discoverBusinesses } from "@/lib/acquisition-discovery";
import { normalisePhone } from "@/lib/utils";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { findPublicEmail } from "@/lib/acquisition-email";

const schema = z.object({
  query: z.string().trim().min(3).max(180),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional().nullable(),
  limit: z.coerce.number().int().min(10).max(60),
});

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid discovery request" }, { status: 400 });

  try {
    const discovered = await discoverBusinesses(parsed.data);
    // Enrich in small batches so one slow website cannot create an unbounded
    // burst of outbound requests in a production function.
    const businesses: Array<(typeof discovered)[number] & { email: string | null }> = [];
    for (let index = 0; index < discovered.length; index += 10) {
      const batch = discovered.slice(index, index + 10);
      businesses.push(...await Promise.all(batch.map(async (business) => ({ ...business, email: await findPublicEmail(business.sourceDetail) }))));
    }
    let imported = 0;
    let skipped = 0;
    for (const business of businesses) {
      const phone = business.phone ? normalisePhone(business.phone) : null;
      // Do not create duplicate work for the team. Name + location is the
      // fallback identity when a public listing has no phone number.
      const existing = await prisma.acquisitionProspect.findFirst({
        where: phone ? { phone } : { businessName: business.businessName, locationText: business.locationText },
        select: { id: true },
      });
      const vendor = phone ? await prisma.vendor.findUnique({ where: { phone }, select: { id: true } }) : null;
      if (existing || vendor) { skipped += 1; continue; }
      await prisma.acquisitionProspect.create({
        data: {
          ...business,
          phone,
          source: "GOOGLE_BUSINESS",
          stage: "IDENTIFIED",
          fit: "MEDIUM",
          priority: "NORMAL",
          capturedByAdminId: session.id === "__super__" ? null : session.id,
        },
      });
      imported += 1;
    }
    void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.web_discovery", entityType: "AcquisitionProspect", entityId: null, ipAddress: ipFromRequest(req), metadata: { query: parsed.data.query, requested: parsed.data.limit, found: businesses.length, imported, skipped } });
    return NextResponse.json({ found: businesses.length, imported, skipped, message: "Google listings were added as identified prospects. Google Places provides public phone numbers and websites, but not business email addresses; emails are never guessed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Web discovery failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

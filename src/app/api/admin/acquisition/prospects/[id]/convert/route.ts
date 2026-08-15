import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS, acquisitionRegistrationUrl, linkProspectToVendor, syncProspectLifecycleForVendor } from "@/lib/acquisition";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const schema = z.object({ vendorId: z.string().cuid().optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const prospect = await prisma.acquisitionProspect.findUnique({ where: { id: params.id } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  if (!parsed.data.vendorId) return NextResponse.json({ registrationUrl: acquisitionRegistrationUrl(params.id) });
  const vendor = await prisma.vendor.findUnique({ where: { id: parsed.data.vendorId }, select: { id: true } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  try {
    await linkProspectToVendor(params.id, vendor.id, session.id === "__super__" ? null : session.id);
    await syncProspectLifecycleForVendor(vendor.id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not link vendor" }, { status: 409 });
  }
  void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.vendor_linked", entityType: "AcquisitionProspect", entityId: params.id, ipAddress: ipFromRequest(req), metadata: { vendorId: vendor.id } });
  return NextResponse.json({ ok: true });
}

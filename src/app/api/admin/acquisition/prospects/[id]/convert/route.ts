import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS, acquisitionRegistrationUrl, issueAcquisitionRegistrationToken, linkProspectToVendor, syncProspectLifecycleForVendor } from "@/lib/acquisition";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import crypto from "crypto";

const schema = z.object({ vendorId: z.string().cuid().optional(), claimable: z.boolean().optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const prospect = await prisma.acquisitionProspect.findUnique({ where: { id: params.id } });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  if (parsed.data.claimable) {
    if (prospect.stage === "LOST" || prospect.stage === "UNQUALIFIED") {
      return NextResponse.json({ error: "Re-qualify this prospect before creating a claimable account." }, { status: 409 });
    }
    if (!prospect.phone || !prospect.email) {
      return NextResponse.json({ error: "A verified phone number and email are required before a claimable account can be created." }, { status: 400 });
    }
    const existingVendor = await prisma.vendor.findFirst({ where: { OR: [{ phone: prospect.phone }, { email: prospect.email }] }, select: { id: true } });
    if (existingVendor) return NextResponse.json({ error: "This contact already belongs to a vendor. Use Confirm match instead." }, { status: 409 });
    const existingInvite = await prisma.vendorProspect.findFirst({ where: { OR: [{ phone: prospect.phone }, { email: prospect.email }], claimedAt: null }, select: { id: true } });
    if (existingInvite) return NextResponse.json({ error: "An unclaimed account link already exists for this contact." }, { status: 409 });
    const claimToken = crypto.randomBytes(32).toString("hex");
    await prisma.vendorProspect.create({ data: {
      ownerName: prospect.contactName ?? prospect.businessName,
      businessName: prospect.businessName, phone: prospect.phone, email: prospect.email,
      claimToken, claimTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByAdminId: session.id === "__super__" ? null : session.id,
    } });
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    void writeAudit({ actorType: "admin", actorId: session.id, action: "acquisition.claim_link_created", entityType: "AcquisitionProspect", entityId: prospect.id, ipAddress: ipFromRequest(req) });
    return NextResponse.json({ claimUrl: `${base}/claim/${claimToken}` });
  }
  if (!parsed.data.vendorId) {
    if (!prospect.phone && !prospect.email) {
      return NextResponse.json({ error: "A prospect needs a verified phone or email before issuing a registration link." }, { status: 400 });
    }
    const token = await issueAcquisitionRegistrationToken(prospect.id);
    return NextResponse.json({ registrationUrl: acquisitionRegistrationUrl(token) });
  }
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

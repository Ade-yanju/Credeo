import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearVendorSession, getSessionPhone } from "@/lib/session";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { scheduleVendorDeletion } from "@/lib/account-deletion";
import { entitlementDenied } from "@/lib/entitlement-guard";

export async function GET() {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({
    where: { phone },
    include: { subscription: true, community: true, organization: true, branch: true, memberships: true },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  return NextResponse.json(vendor);
}

const patchSchema = z.object({
  businessName:   z.string().min(2).max(100).optional(),
  ownerName:      z.string().min(2).max(100).optional(),
  location:       z.string().min(3).max(200).optional(),
  email:          z.string().trim().email().toLowerCase().optional(),
});

export async function PATCH(req: NextRequest) {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { phone }, include: { subscription: true } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const denied = entitlementDenied(vendor.subscription, "tenant.write");
  if (denied) return denied;

  const json = await req.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.email && parsed.data.email !== vendor.email) {
    const existing = await prisma.vendor.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing && existing.id !== vendor.id) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        ...(parsed.data.businessName   && { businessName: parsed.data.businessName }),
        ...(parsed.data.ownerName      && { ownerName: parsed.data.ownerName }),
        ...(parsed.data.location && { location: parsed.data.location }),
        ...(parsed.data.email && { email: parsed.data.email }),
      },
      include: { subscription: true, community: true, organization: true, branch: true, memberships: true },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }
    console.error("[vendor/me]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// DELETE /api/vendor/me — disable the account now and retain its records for 90 days
const deletionSchema = z.object({ confirm: z.literal(true) });

export async function DELETE(req: NextRequest) {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { phone }, select: { id: true } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const parsed = deletionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm account deletion to continue." }, { status: 400 });
  }

  const deletion = await scheduleVendorDeletion(vendor.id);
  if (!deletion) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  await writeAudit({
    actorType: "vendor",
    actorId: vendor.id,
    action: "account.deletion_requested",
    entityType: "Vendor",
    entityId: vendor.id,
    metadata: { retentionUntil: deletion.retentionUntil.toISOString() },
    ipAddress: ipFromRequest(req),
  });

  clearVendorSession();
  return NextResponse.json({
    ok: true,
    retentionUntil: deletion.retentionUntil.toISOString(),
    message: "Your account has been closed. Your records will be securely retained for 90 days for fraud and legal review, then purged.",
  });
}

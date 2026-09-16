import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import type { VendorStatus } from "@prisma/client";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { scheduleVendorDeletion } from "@/lib/account-deletion";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
});

// PATCH /api/admin/vendors/[id] — suspend / reactivate
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Defence in depth: middleware already gates /api/admin/vendors, but a
    // handler that suspends a vendor must not rely on that alone.
    const session = getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPER_ADMIN", "CUSTOMER_CARE"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    if (vendor.deletionRequestedAt) {
      return NextResponse.json({ error: "This account is closed and pending retention purge." }, { status: 410 });
    }

    const updated = await prisma.vendor.update({
      where: { id: params.id },
      data:  { status: parsed.data.status as VendorStatus },
      select: { id: true, status: true, businessName: true },
    });

    return NextResponse.json({ ok: true, vendor: updated });
  } catch (err) {
    console.error("[admin/vendors/patch]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// DELETE /api/admin/vendors/[id] — close now, retain for 90 days, then purge
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPER_ADMIN", "CUSTOMER_CARE"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true },
    });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const deletion = await scheduleVendorDeletion(vendor.id);
    if (!deletion) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    await writeAudit({
      actorType: "admin",
      actorId: session.id,
      action: "account.deletion_requested",
      entityType: "Vendor",
      entityId: vendor.id,
      metadata: { retentionUntil: deletion.retentionUntil.toISOString(), businessName: vendor.businessName },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({
      ok: true,
      closed: vendor.businessName,
      retentionUntil: deletion.retentionUntil.toISOString(),
    });
  } catch (err) {
    console.error("[admin/vendors/delete]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

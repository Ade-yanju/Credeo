import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVendorSession } from "@/lib/session";
import { entitlementDenied } from "@/lib/entitlement-guard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const vendor = await getVendorSession();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = entitlementDenied(vendor.subscription, "tenant.write");
  if (denied) return denied;

  try {
    const notification = await prisma.notification.update({
      where: { id: params.id, vendorId: vendor.id },
      data: { read: true },
    });
    return NextResponse.json(notification);
  } catch {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const vendor = await getVendorSession();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = entitlementDenied(vendor.subscription, "tenant.write");
  if (denied) return denied;

  try {
    await prisma.notification.delete({
      where: { id: params.id, vendorId: vendor.id },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
}

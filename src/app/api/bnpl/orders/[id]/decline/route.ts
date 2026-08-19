import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canApproveCredit, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import { sendWhatsAppMessage } from "@/lib/whatsapp/outbound";

// POST /api/bnpl/orders/[id]/decline — reject a customer-submitted DRAFT order.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "bnpl.order.decide");
  if (denied) return denied;
  if (!canApproveCredit(ctx)) {
    return NextResponse.json({ error: "Only a manager, finance or owner can act on this." }, { status: 403 });
  }

  const order = await prisma.bnplOrder.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId! },
    include: { student: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "DRAFT") {
    return NextResponse.json({ error: "Only pending orders can be declined." }, { status: 400 });
  }

  await prisma.bnplOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "bnpl.order_declined",
    entityType: "BnplOrder",
    entityId: order.id,
    metadata: { organizationId: ctx.organizationId, orderNumber: order.orderNumber },
    ipAddress: ipFromRequest(req),
  });

  const creds = await getOrgChannelCredentials(ctx.organizationId);
  sendWhatsAppMessage(
    order.student.phone,
    `Hi ${order.student.fullName}, unfortunately ${ctx.organization?.name ?? "the store"} could not approve your order ${order.orderNumber} at this time. Please contact the store for details.`,
    creds ?? undefined
  ).catch((err) => console.error("[bnpl/decline] notify failed:", err));

  return NextResponse.json({ ok: true });
}

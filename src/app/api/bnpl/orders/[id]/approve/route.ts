import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessBranch, canApproveCredit, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { signOrderToken } from "@/lib/bnpl-token";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import { sendWhatsAppMessage } from "@/lib/whatsapp/outbound";

const schema = z.object({
  branchId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  downPayment: z.number().min(0).optional(),
});

// POST /api/bnpl/orders/[id]/approve — turn a customer-submitted DRAFT order
// into an active BNPL credit with a repayment schedule.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "bnpl.order.decide");
  if (denied) return denied;
  if (!canApproveCredit(ctx)) {
    return NextResponse.json({ error: "Only a manager, finance or owner can approve credit." }, { status: 403 });
  }

  const order = await prisma.bnplOrder.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId! },
    include: { student: true, items: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "DRAFT") {
    return NextResponse.json({ error: "Only pending orders can be approved." }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const branchId = parsed.data.branchId ?? ctx.branchId ?? ctx.organization?.branches[0]?.id ?? null;
  if (branchId && !canAccessBranch(ctx, branchId)) {
    return NextResponse.json({ error: "You cannot approve orders for this branch." }, { status: 403 });
  }

  const total = Number(order.totalAmount);
  const downPayment = Math.min(parsed.data.downPayment ?? 0, total);
  const financed = Math.max(0, total - downPayment);
  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : order.dueDate;

  const result = await prisma.$transaction(async (tx) => {
    const credit = await tx.credit.create({
      data: {
        vendorId: ctx.vendor.id,
        organizationId: ctx.organizationId,
        branchId,
        studentId: order.studentId,
        amount: total,
        amountRepaid: downPayment,
        description: `BNPL order ${order.orderNumber}`,
        dueDate,
        status: downPayment > 0 ? "PARTIALLY_PAID" : "OUTSTANDING",
      },
    });

    const updated = await tx.bnplOrder.update({
      where: { id: order.id },
      data: {
        status: "ACTIVE",
        branchId,
        creditId: credit.id,
        downPayment,
        dueDate,
        schedules: financed > 0 ? { create: [{ dueAt: dueDate, amount: financed }] } : undefined,
      },
    });

    await tx.creditScoreEvent.create({
      data: {
        studentId: order.studentId,
        vendorId: ctx.vendor.id,
        creditId: credit.id,
        eventType: "CREDIT_EXTENDED",
        amount: financed,
        scoreDelta: 0,
      },
    });

    await tx.walletLedgerEntry.create({
      data: {
        organizationId: ctx.organizationId!,
        branchId,
        vendorId: ctx.vendor.id,
        entryType: "BNPL_ISSUED",
        direction: "DEBIT",
        amount: financed,
        sourceType: "BnplOrder",
        sourceId: order.id,
        description: `BNPL approved for ${order.student.fullName}`,
      },
    });

    return updated;
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "bnpl.order_approved",
    entityType: "BnplOrder",
    entityId: order.id,
    metadata: { organizationId: ctx.organizationId, orderNumber: order.orderNumber, total, branchId },
    ipAddress: ipFromRequest(req),
  });

  // Notify the customer with their receipt link.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const receipt = `${appUrl}/bnpl/${signOrderToken(order.id)}`;
  const creds = await getOrgChannelCredentials(ctx.organizationId);
  sendWhatsAppMessage(
    order.student.phone,
    `Good news ${order.student.fullName}! ${ctx.organization?.name ?? "Your store"} approved your order ${order.orderNumber}. View it and your repayment plan here: ${receipt}`,
    creds ?? undefined
  ).catch((err) => console.error("[bnpl/approve] notify failed:", err));

  return NextResponse.json({ ok: true, order: result });
}

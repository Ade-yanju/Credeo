import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessBranch, hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import type { ScoreEventType } from "@prisma/client";

const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "POS", "USSD", "MOBILE_MONEY", "OTHER"]).default("CASH"),
  notes: z.string().max(300).optional(),
});

// POST /api/bnpl/orders/[id]/repayments — record a manual repayment against a BNPL order.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "bnpl.repayment.create");
  if (denied) return denied;
  if (!hasTenantWriteAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Organization is not ready for repayments." }, { status: 400 });
  }

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const order = await prisma.bnplOrder.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { credit: true, schedules: { orderBy: { dueAt: "asc" } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.branchId && !canAccessBranch(ctx, order.branchId)) {
    return NextResponse.json({ error: "You cannot record payments for this branch." }, { status: 403 });
  }
  if (!order.creditId || !order.credit) {
    return NextResponse.json({ error: "This order has no outstanding balance." }, { status: 400 });
  }
  if (["PAID", "CANCELLED", "WRITTEN_OFF"].includes(order.status)) {
    return NextResponse.json({ error: `Order is already ${order.status.toLowerCase()}.` }, { status: 400 });
  }

  const credit = order.credit;
  const amount = parsed.data.amount;
  const outstanding = Number(credit.amount) - Number(credit.amountRepaid);
  if (amount > outstanding + 0.5) {
    return NextResponse.json(
      { error: `Payment exceeds the ₦${outstanding.toLocaleString()} outstanding on this order.` },
      { status: 400 }
    );
  }

  const totalRepaid = Number(credit.amountRepaid) + amount;
  const isPaidFull = totalRepaid >= Number(credit.amount) - 0.5;
  const now = new Date();
  const isLate = now > new Date(credit.dueDate);

  const scoreEventType: ScoreEventType = isPaidFull
    ? (isLate ? "PAID_LATE" : "PAID_ON_TIME")
    : "PAID_PARTIAL";
  const scoreDelta = isPaidFull ? (isLate ? -15 : 25) : 5;

  const result = await prisma.$transaction(async (tx) => {
    const repayment = await tx.repayment.create({
      data: {
        creditId: credit.id,
        amount,
        method: parsed.data.method,
        notes: parsed.data.notes ?? null,
        recordedBy: ctx.vendor.id,
      },
    });

    await tx.credit.update({
      where: { id: credit.id },
      data: {
        amountRepaid: totalRepaid,
        status: isPaidFull ? "PAID" : "PARTIALLY_PAID",
        ...(isPaidFull ? { closedAt: now } : {}),
      },
    });

    // Apply the payment across pending schedule rows, oldest first.
    let remaining = amount;
    for (const entry of order.schedules) {
      if (remaining <= 0.5) break;
      if (entry.status === "PAID") continue;
      if (remaining + 0.5 >= Number(entry.amount)) {
        await tx.repaymentSchedule.update({
          where: { id: entry.id },
          data: { status: "PAID", paidAt: now },
        });
        remaining -= Number(entry.amount);
      }
    }

    const updatedOrder = await tx.bnplOrder.update({
      where: { id: order.id },
      data: { status: isPaidFull ? "PAID" : "PARTIALLY_PAID" },
      include: { student: true, schedules: { orderBy: { dueAt: "asc" } }, items: true },
    });

    await tx.creditScoreEvent.create({
      data: {
        studentId: credit.studentId,
        vendorId: ctx.vendor.id,
        creditId: credit.id,
        eventType: scoreEventType,
        amount,
        scoreDelta,
      },
    });

    const student = await tx.student.findUnique({ where: { id: credit.studentId } });
    if (student) {
      await tx.student.update({
        where: { id: student.id },
        data: {
          vodiumScore: Math.max(0, Math.min(1000, student.vodiumScore + scoreDelta)),
          scoreUpdatedAt: now,
        },
      });
    }

    await tx.walletLedgerEntry.create({
      data: {
        organizationId: ctx.organizationId!,
        branchId: order.branchId,
        vendorId: ctx.vendor.id,
        entryType: "PAYMENT_RECEIVED",
        direction: "CREDIT",
        amount,
        sourceType: "BnplOrder",
        sourceId: order.id,
        description: `Repayment for ${order.orderNumber}`,
      },
    });

    return { repayment, order: updatedOrder };
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "bnpl.repayment_recorded",
    entityType: "BnplOrder",
    entityId: order.id,
    metadata: {
      organizationId: ctx.organizationId,
      branchId: order.branchId,
      orderNumber: order.orderNumber,
      amount,
      method: parsed.data.method,
      fullyPaid: isPaidFull,
    },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}

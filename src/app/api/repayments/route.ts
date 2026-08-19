import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardVendorWrite } from "@/lib/entitlement-guard";
import type { RepaymentMethod } from "@prisma/client";

const schema = z.object({
  creditId: z.string().cuid(),
  amount:   z.number().positive(),
  method:   z.string().optional(),
  notes:    z.string().max(300).optional(),
});

// POST /api/repayments — shortcut to PATCH /api/credits/[id] for simple payment recording
export async function POST(req: NextRequest) {
  // Recording money a customer actually paid stays allowed even after the
  // trial lapses (see ALLOWED_WHEN_LOCKED in lib/entitlement.ts). Blocking it
  // would push the vendor back to paper and cost us the repayment history
  // that is the whole point of Phase 1.
  const guard = await guardVendorWrite("repayment.create");
  if (!guard.ok) return guard.response;
  const { vendor } = guard;

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { creditId, amount, method, notes } = parsed.data;

  const credit = await prisma.credit.findFirst({
    where: { id: creditId, vendorId: vendor.id },
  });
  if (!credit) return NextResponse.json({ error: "Credit not found" }, { status: 404 });

  const repayment = await prisma.repayment.create({
    data: {
      creditId,
      amount,
      method: (method as RepaymentMethod) ?? "CASH",
      notes: notes ?? null,
    },
  });

  const totalRepaid = Number(credit.amountRepaid) + amount;
  const isPaidFull = totalRepaid >= Number(credit.amount);

  await prisma.credit.update({
    where: { id: creditId },
    data: {
      amountRepaid: totalRepaid,
      status: isPaidFull ? "PAID" : "PARTIALLY_PAID",
      ...(isPaidFull ? { closedAt: new Date() } : {}),
    },
  });

  // Notify vendor on web dashboard
  await prisma.notification.create({
    data: {
      vendorId: vendor.id,
      title: isPaidFull ? "Payment Received" : "Partial Payment",
      message: `₦${amount.toLocaleString()} recorded for credit #${creditId.slice(-4)}.`,
      type: "SUCCESS",
    },
  });

  return NextResponse.json({ ok: true, repayment }, { status: 201 });
}

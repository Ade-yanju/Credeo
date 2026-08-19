import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { roundMoney } from "@/lib/bnpl";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "POS", "USSD", "MOBILE_MONEY", "OTHER"]).default("CASH"),
});

// POST /api/invoices/[id]/payments — record a payment against an invoice.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  if (!hasTenantWriteAccess(ctx) || !ctx.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Logging a payment received against an invoice is the same event as a
  // repayment, so it stays allowed after the trial lapses. The call is kept
  // rather than omitted so the policy table stays the single source of truth —
  // flip it there and this route obeys without being touched.
  const denied = entitlementDenied(ctx.vendor.subscription, "invoice.payment");
  if (denied) return denied;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { student: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (["PAID", "CANCELLED"].includes(invoice.status)) {
    return NextResponse.json({ error: `This invoice is already ${invoice.status.toLowerCase()}.` }, { status: 400 });
  }

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const outstanding = roundMoney(Number(invoice.total) - Number(invoice.amountPaid));
  const amount = parsed.data.amount;
  if (amount > outstanding + 0.5) {
    return NextResponse.json(
      { error: `Payment exceeds the ₦${outstanding.toLocaleString()} outstanding on this invoice.` },
      { status: 400 }
    );
  }

  const newPaid = roundMoney(Number(invoice.amountPaid) + amount);
  const fullyPaid = newPaid >= Number(invoice.total) - 0.5;
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newPaid,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        ...(fullyPaid ? { paidAt: now } : {}),
      },
    });

    await tx.walletLedgerEntry.create({
      data: {
        organizationId: ctx.organizationId!,
        branchId: invoice.branchId,
        vendorId: ctx.vendor.id,
        entryType: "PAYMENT_RECEIVED",
        direction: "CREDIT",
        amount,
        sourceType: "Invoice",
        sourceId: invoice.id,
        description: `Invoice payment — ${invoice.invoiceNumber}`,
      },
    });

    return inv;
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "invoice.payment_recorded",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: {
      organizationId: ctx.organizationId,
      invoiceNumber: invoice.invoiceNumber,
      amount,
      method: parsed.data.method,
      fullyPaid,
    },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, invoice: updated });
}

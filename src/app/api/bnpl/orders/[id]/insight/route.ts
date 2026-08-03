import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant-context";
import { explainCustomerRisk } from "@/lib/bnpl-risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * On-demand AI reading of a customer's repayment behaviour for one BNPL order.
 *
 * Deliberately on-demand rather than computed with the orders list: the list
 * renders up to 100 rows, and calling a model per row would be slow and costly
 * for information the vendor only wants on the order they are actually judging.
 *
 * ADVISORY ONLY. This endpoint cannot approve, decline, or change a limit — the
 * deterministic gate in assessBnplRisk owns that decision.
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }

  const order = await prisma.bnplOrder.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    select: { studentId: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const insight = await explainCustomerRisk({
    organizationId: ctx.organizationId,
    studentId: order.studentId,
  });

  if (!insight) {
    return NextResponse.json({
      available: false,
      detail: "Not enough repayment history, or AI insight is not configured.",
    });
  }

  return NextResponse.json({ available: true, ...insight });
}

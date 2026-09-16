import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPhone } from "@/lib/session";
import { markOverdueCredits } from "@/lib/credit-lifecycle";
import { getEntitlement } from "@/lib/entitlement";

// GET /api/customers — customers who have at least one credit with this vendor
export async function GET() {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { phone }, include: { subscription: true } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  if (getEntitlement(vendor.subscription).canWrite) {
    await markOverdueCredits({ vendorId: vendor.id });
  }

  const students = await prisma.student.findMany({
    where: { credits: { some: { vendorId: vendor.id } } },
    include: {
      credits: {
        where: { vendorId: vendor.id },
        select: { id: true, amount: true, amountRepaid: true, status: true, dueDate: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute per-student aggregates
  const rows = students.map((s) => {
    const credits = s.credits;
    const totalOwed = credits
      .filter((c) => !["PAID", "WRITTEN_OFF"].includes(c.status))
      .reduce((sum, c) => sum + Number(c.amount) - Number(c.amountRepaid), 0);
    const totalPaid = credits
      .filter((c) => c.status === "PAID")
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const hasOverdue = credits.some((c) => c.status === "OVERDUE");
    const hasDueSoon = credits.some((c) => c.status === "DUE_SOON");

    const status =
      hasOverdue ? "overdue"
      : totalOwed > 0 && hasDueSoon ? "due_soon"
      : totalOwed > 0 ? "owing"
      : "settled";

    return {
      id: s.id,
      fullName: s.fullName,
      matricNumber: s.matricNumber,
      phone: s.phone.startsWith("pending:") ? null : s.phone,
      vodiumScore: s.vodiumScore,
      creditCount: credits.length,
      totalOwed,
      totalPaid,
      status,
    };
  });

  return NextResponse.json(rows);
}

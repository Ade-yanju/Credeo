import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant-context";
import { signOrderToken } from "@/lib/bnpl-token";
import { BnplOrdersClient, type BnplOrderRow } from "@/components/ui/bnpl-orders-client";

export const dynamic = "force-dynamic";

export default async function BnplOrdersPage() {
  const ctx = await requireTenantContext();
  const where = ctx.organizationId
    ? ctx.canSeeAllBranches
      ? { organizationId: ctx.organizationId }
      : { organizationId: ctx.organizationId, branchId: ctx.branchId }
    : { vendorId: ctx.vendor.id };

  const orders = ctx.organizationId
    ? await prisma.bnplOrder.findMany({
        where,
        include: { branch: true, student: true, credit: true, schedules: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const rows: BnplOrderRow[] = orders.map((order) => {
    const outstanding = order.credit
      ? Number(order.credit.amount) - Number(order.credit.amountRepaid)
      : 0;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      studentName: order.student.fullName,
      branchName: order.branch?.name ?? "Unassigned",
      status: order.status,
      totalAmount: Number(order.totalAmount),
      outstanding: Math.max(0, outstanding),
      dueDate: order.dueDate.toISOString(),
      scheduleCount: order.schedules.length,
      canRepay: Boolean(order.creditId) && outstanding > 0,
      consentAccepted: Boolean(order.termsAcceptedAt),
      consentPath: `/bnpl/${signOrderToken(order.id)}`,
      customerScore: order.student.vodiumScore,
    };
  });

  const branches = ctx.organization?.branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
  })) ?? [];

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <BnplOrdersClient
        orders={rows}
        branches={branches}
        canWrite={ctx.canWrite && Boolean(ctx.organizationId)}
        canSeeAllBranches={ctx.canSeeAllBranches}
        defaultBranchId={ctx.branchId}
      />
    </div>
  );
}

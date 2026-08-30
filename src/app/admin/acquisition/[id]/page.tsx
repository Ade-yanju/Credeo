import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { AcquisitionDetailClient } from "@/components/admin/acquisition-detail-client";

export const dynamic = "force-dynamic";
export default async function AcquisitionDetailPage({ params }: { params: { id: string } }) {
  const [prospect, session, admins] = await Promise.all([
    prisma.acquisitionProspect.findUnique({ where: { id: params.id }, include: {
      community: true, campaign: true, ambassador: true, assignedTo: { select: { id: true, name: true } },
      convertedVendor: { include: { subscription: true, _count: { select: { credits: true } } } },
      activities: { include: { createdBy: { select: { name: true } } }, orderBy: { occurredAt: "desc" } },
    } }),
    Promise.resolve(getAdminSession()),
    prisma.adminUser.findMany({ where: { activatedAt: { not: null }, role: { in: ["SUPER_ADMIN", "MARKETING", "CUSTOMER_CARE"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!prospect) notFound();
  return <AcquisitionDetailClient prospect={JSON.parse(JSON.stringify(prospect))} admins={admins} canWrite={session?.role === "SUPER_ADMIN" || session?.role === "MARKETING" || session?.role === "CUSTOMER_CARE"} />;
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { AcquisitionDetailClient } from "@/components/admin/acquisition-detail-client";

export const dynamic = "force-dynamic";
export default async function AcquisitionDetailPage({ params }: { params: { id: string } }) {
  const [prospect, session, vendors] = await Promise.all([
    prisma.acquisitionProspect.findUnique({ where: { id: params.id }, include: {
      community: true, campaign: true, ambassador: true, assignedTo: { select: { id: true, name: true } },
      convertedVendor: { include: { subscription: true, _count: { select: { credits: true } } } },
      activities: { include: { createdBy: { select: { name: true } } }, orderBy: { occurredAt: "desc" } },
    } }),
    Promise.resolve(getAdminSession()),
    prisma.vendor.findMany({ select: { id: true, businessName: true, phone: true, email: true }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  if (!prospect) notFound();
  return <AcquisitionDetailClient prospect={JSON.parse(JSON.stringify(prospect))} vendors={vendors} canWrite={session?.role === "SUPER_ADMIN" || session?.role === "MARKETING"} />;
}

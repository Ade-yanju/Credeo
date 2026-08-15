import { getAdminSession } from "@/lib/session";
import { getAcquisitionDashboard } from "@/lib/admin/acquisition";
import { AcquisitionClient } from "@/components/admin/acquisition-client";

export const dynamic = "force-dynamic";
export default async function AcquisitionPage() {
  const [data, session] = await Promise.all([getAcquisitionDashboard(), Promise.resolve(getAdminSession())]);
  return <AcquisitionClient data={data} canWrite={session?.role === "SUPER_ADMIN" || session?.role === "MARKETING"} />;
}

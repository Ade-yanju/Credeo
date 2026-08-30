import { redirect } from "next/navigation";
import { getFinance } from "@/lib/admin/finance";
import { FinanceClient } from "@/components/admin/finance-client";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const session = getAdminSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "CFO")) redirect("/admin");
  const data = await getFinance();

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-vodium-gold">Finance</p>
        <h1 className="font-serif text-2xl md:text-3xl text-vodium-cream mt-1">Revenue</h1>
        <p className="text-sm text-vodium-cream/45 mt-1">
          Subscription revenue, trial conversion and the accounts at risk this week. Live — refreshes on load.
        </p>
      </div>

      <FinanceClient data={data} />
    </div>
  );
}

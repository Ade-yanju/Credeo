import { getOverview } from "@/lib/admin/overview";
import { OverviewClient } from "@/components/admin/overview-client";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = getAdminSession();
  const canViewFinance = session?.role === "SUPER_ADMIN" || session?.role === "CFO";
  const data = await getOverview({ includeFinance: canViewFinance });

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-vodium-gold">Vodium Ledger</p>
        <h1 className="font-serif text-2xl md:text-3xl text-vodium-cream mt-1">Platform overview</h1>
        <p className="text-sm text-vodium-cream/45 mt-1">
          Where the platform stands, and what needs a human this week.
        </p>
      </div>

      <OverviewClient data={data} canViewFinance={canViewFinance} />
    </div>
  );
}

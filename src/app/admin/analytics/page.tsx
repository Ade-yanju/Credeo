import { getAnalytics } from "@/lib/admin/analytics";
import { AnalyticsClient } from "@/components/admin/analytics-client";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const data = await getAnalytics();

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-vodium-gold">Platform analytics</p>
        <h1 className="font-serif text-2xl md:text-3xl text-vodium-cream mt-1">Analytics</h1>
        <p className="text-sm text-vodium-cream/45 mt-1">
          Credit, invoice adoption, vendor activity, and repayment behaviour across every vendor and customer. Live — refreshes on load.
        </p>
      </div>

      <AnalyticsClient data={data} />
    </div>
  );
}

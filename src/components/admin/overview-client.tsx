"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, ChevronRight,
  Store, Banknote, Activity, CheckCircle2, MapPin,
} from "lucide-react";
import { formatNaira } from "@/lib/utils";
import type { OverviewData } from "@/lib/admin/overview";
import { SERIES, SectionHeading, ChartCard, StatTile, TrendArea, DataTable } from "./viz";

const SEVERITY = {
  critical: { ring: "border-[#d03b3b]/30 bg-[#d03b3b]/[0.07]", text: "text-[#d03b3b]" },
  warning:  { ring: "border-[#fab219]/30 bg-[#fab219]/[0.07]", text: "text-[#fab219]" },
  info:     { ring: "border-white/[0.1] bg-white/[0.03]",       text: "text-vodium-cream/60" },
} as const;

export function OverviewClient({ data, canViewFinance }: { data: OverviewData; canViewFinance: boolean }) {
  const k = data.kpi;

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className={`grid grid-cols-2 ${canViewFinance ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-3`}>
        {canViewFinance && <><StatTile hero label="Tracked to date" value={formatNaira(k.tracked)} sub={`${k.totalCredits.toLocaleString()} credits logged`} /><StatTile hero label="Recovered" value={formatNaira(k.recovered)} sub={`${k.recoveryRate}% of value extended`} tone={k.recoveryRate >= 70 ? "good" : "warning"} /><StatTile hero label="MRR" value={formatNaira(k.mrr)} sub="Active subscriptions" /></>}
        <StatTile hero label="Vendors" value={String(k.totalVendors)} sub={`${k.activeVendors} active · ${k.totalCustomers.toLocaleString()} customers`} />
      </div>

      {/* Needs attention — the point of an overview */}
      <section>
        <SectionHeading title="Needs attention" sub="Ranked by urgency — each links to where you act" />
        {data.attention.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#0ca30c]/25 bg-[#0ca30c]/[0.07] px-4 py-3.5 text-sm text-[#0ca30c]">
            <CheckCircle2 size={16} /> Nothing needs attention right now — no disputes, failed payments, quiet vendors or lapsing trials.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.attention.map((a) => {
              const s = SEVERITY[a.severity];
              return (
                <Link
                  key={a.id}
                  href={a.href}
                  className={`group rounded-xl border px-4 py-3.5 transition-colors hover:border-vodium-gold/40 ${s.ring}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-serif text-2xl tabular-nums ${s.text}`}>{a.count}</p>
                      <p className="text-sm text-vodium-cream mt-0.5">{a.label}</p>
                      <p className="text-[11px] text-vodium-cream/35 mt-1 leading-snug">{a.detail}</p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-vodium-cream/25 group-hover:text-vodium-gold transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Momentum */}
      <section>
        <SectionHeading title="Momentum" sub="Is the platform being used more this week than last?" />
        <div className={`grid grid-cols-2 ${canViewFinance ? "lg:grid-cols-4" : "lg:grid-cols-1"} gap-3 mb-4`}>
          <WeekTile count={k.creditsThisWeek} change={k.wowChange} />
          {canViewFinance && <><StatTile label="Still owed" value={formatNaira(k.outstanding)} sub="Extended minus recovered" tone="warning" /><StatTile label="Default rate" value={`${k.defaultRate}%`} sub="Written off" tone={k.defaultRate <= 5 ? "good" : "critical"} /><StatTile label="Overdue credits" value={String(k.overdueCredits)} sub="Past due, unpaid" tone={k.overdueCredits === 0 ? "good" : "warning"} /></>}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Vendor signups"
            sub="New vendors per month"
            table={{ head: ["Month", "Vendors"], rows: data.signupTrend.map((s) => [s.month, s.vendors]) }}
          >
            <TrendArea
              data={data.signupTrend}
              xKey="month"
              series={[{ key: "vendors", name: "Vendors joined", color: SERIES.gold }]}
            />
          </ChartCard>

          <ChartCard
            title="Campuses"
            sub="Where the vendors and customers are"
            table={{ head: ["Campus", "Vendors", "Customers"], rows: data.communities.map((c) => [c.name, c.vendors, c.customers]) }}
          >
            {data.communities.length === 0 ? (
              <p className="py-10 text-center text-sm text-vodium-cream/20">No campuses yet</p>
            ) : (
              <div className="space-y-2.5">
                {data.communities.map((c) => (
                  <div key={c.name} className="flex items-center gap-3 text-sm">
                    <MapPin size={13} className="text-vodium-gold/60 shrink-0" />
                    <span className="text-vodium-cream/80 truncate flex-1">{c.name}</span>
                    <span className="text-vodium-cream/40 text-xs tabular-nums shrink-0">
                      {c.vendors} vendor{c.vendors === 1 ? "" : "s"} · {c.customers} customer{c.customers === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </section>

      {/* Churn watch + audit */}
      <section>
        <SectionHeading title="Churn watch" sub="A vendor who stops logging has stopped using Vodium" />
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Vendors gone quiet" sub="Logged credit before, nothing in 14+ days">
            {data.quietVendors.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#0ca30c]">Every active vendor has logged recently.</p>
            ) : (
              <DataTable
                head={["Vendor", "Credits logged", "Quiet for"]}
                rows={data.quietVendors.map((v) => [v.name, v.total, `${v.daysQuiet} days`])}
              />
            )}
          </ChartCard>

          <ChartCard title="Recent activity" sub="Latest audited actions">
            {data.recentActivity.length === 0 ? (
              <p className="py-10 text-center text-sm text-vodium-cream/20">No activity recorded yet</p>
            ) : (
              <div className="space-y-2">
                {data.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 text-xs">
                    <Activity size={12} className="text-vodium-gold/50 shrink-0" />
                    <span className="text-vodium-cream/75">{a.action}</span>
                    <span className="text-vodium-cream/30">{a.entityType}</span>
                    <span className="ml-auto text-vodium-cream/25 shrink-0">
                      {new Date(a.at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </section>

      {/* Jump-off */}
      <section>
        <SectionHeading title="Jump to" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(canViewFinance ? [
            { href: "/admin/vendors",   label: "Vendors",   icon: Store,   sub: `${data.kpi.totalVendors} registered` },
            { href: "/admin/finance",   label: "Finance",   icon: Banknote, sub: formatNaira(data.kpi.mrr) + " MRR" },
            { href: "/admin/analytics", label: "Analytics", icon: Activity, sub: "Logging & repayment" },
            { href: "/admin/disputes",  label: "Disputes",  icon: AlertTriangle, sub: `${data.kpi.openDisputes} open` },
          ] : [
            { href: "/admin/vendors", label: "Vendors", icon: Store, sub: `${data.kpi.totalVendors} registered` },
            { href: "/admin/analytics", label: "Analytics", icon: Activity, sub: "Logging & repayment" },
            { href: "/admin/disputes", label: "Disputes", icon: AlertTriangle, sub: `${data.kpi.openDisputes} open` },
          ]).map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href}
                className="group rounded-xl border border-white/[0.06] bg-vodium-charcoal px-4 py-3.5 hover:border-vodium-gold/30 transition-colors">
                <Icon size={15} className="text-vodium-gold/70" />
                <p className="text-sm text-vodium-cream mt-2 group-hover:text-vodium-gold transition-colors">{l.label}</p>
                <p className="text-[11px] text-vodium-cream/30 mt-0.5">{l.sub}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Week-over-week tile — a single number plus its direction. */
function WeekTile({ count, change }: { count: number; change: number }) {
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const tone = change > 0 ? "text-[#0ca30c]" : change < 0 ? "text-[#d03b3b]" : "text-vodium-cream/40";
  return (
    <div className="rounded-xl border border-white/[0.06] bg-vodium-charcoal px-4 py-3.5">
      <p className="text-[11px] text-vodium-cream/40">Credits this week</p>
      <p className="font-serif text-2xl tabular-nums mt-1 text-vodium-gold">{count}</p>
      <p className={`text-[11px] mt-1 inline-flex items-center gap-1 ${tone}`}>
        <Icon size={11} /> {change === 0 ? "same as last week" : `${Math.abs(change)}% vs last week`}
      </p>
    </div>
  );
}

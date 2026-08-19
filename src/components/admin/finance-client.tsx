"use client";

import { useState } from "react";
import { Banknote, TrendingUp, AlertTriangle, Users, Info } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import type { FinanceData } from "@/lib/admin/finance";
import {
  SERIES, STATUS, SEQUENTIAL, SectionHeading, ChartCard, StatTile,
  TrendArea, BarsH, BreakdownBars, DataTable,
} from "./viz";

const TABS = [
  { id: "revenue",       label: "Revenue",       icon: Banknote },
  { id: "conversion",    label: "Conversion",    icon: TrendingUp },
  { id: "risk",          label: "Risk & renewals", icon: AlertTriangle },
  { id: "subscriptions", label: "Subscriptions", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];
const naira = (v: number) => formatNaira(v);

export function FinanceClient({ data, initialTab = "revenue" }: { data: FinanceData; initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const k = data.kpi;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile hero label="MRR" value={formatNaira(k.mrr)} sub={`${k.activeCount} paying vendors`} />
        <StatTile hero label="ARR" value={formatNaira(k.arr)} sub="Annualised run rate" />
        <StatTile hero label="Trial → paid" value={k.conversionDecided > 0 ? `${k.conversionRate}%` : "—"} sub={k.conversionDecided > 0 ? `${k.conversionConverted} of ${k.conversionDecided} decided · ${k.trialCount} undecided` : `No outcomes yet · ${k.trialCount} on trial`} tone={k.conversionDecided < 5 ? "neutral" : k.conversionRate >= 40 ? "good" : "warning"} />
        <StatTile hero label="Revenue at risk" value={formatNaira(k.revenueAtRisk)} sub={`${k.pastDueCount} past-due accounts`} tone={k.revenueAtRisk > 0 ? "critical" : "good"} />
      </div>

      <div className="flex gap-1 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                on ? "border-vodium-gold text-vodium-cream" : "border-transparent text-vodium-cream/40 hover:text-vodium-cream/70"
              }`}
            >
              <Icon size={14} className={on ? "text-vodium-gold" : ""} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "revenue"       && <RevenueTab data={data} />}
      {tab === "conversion"    && <ConversionTab data={data} />}
      {tab === "risk"          && <RiskTab data={data} />}
      {tab === "subscriptions" && <SubscriptionsTab data={data} />}
    </div>
  );
}

function RevenueTab({ data }: { data: FinanceData }) {
  const k = data.kpi;
  const planTotal = data.planMix.reduce((s, p) => s + p.active, 0);

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Recurring revenue" sub="Where the subscription book stands today" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="ARPU" value={formatNaira(k.arpu)} sub="Average revenue per paying vendor" />
          <StatTile label="On trial" value={String(k.trialCount)} sub={`${formatNaira(k.trialMrrPotential)}/mo if all convert`} tone="warning" />
          <StatTile label="Churned (30d)" value={String(k.churnedThisMonth)} sub={`${k.churnRate}% monthly churn`} tone={k.churnedThisMonth === 0 ? "good" : "critical"} />
          <StatTile label="Renewals due (7d)" value={String(k.renewalsDue7d)} sub="Periods ending this week" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="MRR over time"
            sub={
              data.mrrSeries.some((m) => m.reconstructed)
                ? "Who was actually paying at each month end · early months reconstructed from backfilled history"
                : "Who was actually paying at each month end"
            }
            table={{
              head: ["Month", "MRR", "Net change", "Paying vendors"],
              rows: data.mrrSeries.map((m) => [
                m.reconstructed ? `${m.month} *` : m.month,
                formatNaira(m.mrr),
                `${m.netChange >= 0 ? "+" : "−"}${formatNaira(Math.abs(m.netChange))}`,
                m.payingVendors,
              ]),
            }}
          >
            <TrendArea
              data={data.mrrSeries}
              xKey="month"
              fmt={naira}
              series={[
                { key: "mrr",       name: "MRR",        color: SERIES.blue },
                { key: "netChange", name: "Net change", color: SERIES.gold },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Plan mix"
            sub={`${planTotal} paying vendors by plan`}
            table={{
              head: ["Plan", "Paying", "On trial", "MRR"],
              rows: data.planMix.map((p) => [p.label, p.active, p.trial, formatNaira(p.contribution)]),
            }}
          >
            {/* Plans are an ordered price ladder → ordinal ramp. */}
            <BarsH
              data={data.planMix.map((p) => ({ label: p.label, contribution: p.contribution }))}
              xKey="label"
              dataKey="contribution"
              colors={[SEQUENTIAL[1], SEQUENTIAL[2], SEQUENTIAL[3]]}
              fmt={naira}
            />
          </ChartCard>
        </div>

        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs text-vodium-cream/45 leading-relaxed">
          <Info size={14} className="shrink-0 mt-0.5 text-vodium-gold/70" />
          <p>
            A subscription row stores only its <em>current</em> status, so a true month-by-month MRR history
            (who was paying in March) can&rsquo;t be reconstructed — past churn is invisible. The chart above is
            honest about what it shows: new MRR by start month, and how it accumulated. A real MRR series needs a
            subscription-events log.
          </p>
        </div>
      </section>
    </div>
  );
}

function ConversionTab({ data }: { data: FinanceData }) {
  const k = data.kpi;
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Is the free trial working?" sub="Every vendor starts on trial — this is whether they stay" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="Trial → paid" value={k.conversionDecided > 0 ? `${k.conversionRate}%` : "—"} sub={`${k.conversionConverted} of ${k.conversionDecided} decided`} tone={k.conversionDecided < 5 ? "neutral" : k.conversionRate >= 40 ? "good" : "warning"} />
          <StatTile label="New trials (30d)" value={String(k.newTrialsThisMonth)} sub="Signed up this month" />
          <StatTile label="Still on trial" value={String(k.trialCount)} sub="Outcome undecided" tone="warning" />
          <StatTile label="Lost" value={String(k.cancelled + k.expired)} sub="Cancelled or expired" tone={k.cancelled + k.expired === 0 ? "good" : "critical"} />
        </div>

        <ChartCard
          title="Cohort conversion by signup month"
          sub="Of the vendors who joined each month, how many are paying now"
          table={{
            head: ["Cohort", "Joined", "Paying", "Still trial", "Lost", "Rate"],
            rows: data.cohortRows.map((c) => [c.month, c.joined, c.converted, c.stillTrial, c.lost, `${c.rate}%`]),
          }}
        >
          <DataTable
            head={["Cohort", "Joined", "Paying", "Still trial", "Lost", "Rate"]}
            rows={data.cohortRows.map((c) => [c.month, c.joined, c.converted, c.stillTrial, c.lost, `${c.rate}%`])}
          />
        </ChartCard>
      </section>
    </div>
  );
}

function RiskTab({ data }: { data: FinanceData }) {
  const k = data.kpi;
  const trials = data.expiringTrials;
  const atRiskValue = trials.reduce((s, t) => s + t.monthlyAmount, 0);

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Money to save this week" sub="Accounts that need a call, not a chart" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="Past due" value={String(k.pastDueCount)} sub={formatNaira(k.revenueAtRisk)} tone={k.pastDueCount === 0 ? "good" : "critical"} />
          <StatTile label="Trials ending (7d)" value={String(trials.length)} sub={`${formatNaira(atRiskValue)}/mo at stake`} tone={trials.length === 0 ? "neutral" : "warning"} />
          <StatTile label="Renewals due (7d)" value={String(k.renewalsDue7d)} sub="Active periods ending" />
          <StatTile label="Monthly churn" value={`${k.churnRate}%`} sub={`${k.churnedThisMonth} lost in 30 days`} tone={k.churnRate <= 5 ? "good" : "critical"} />
        </div>

        <ChartCard title="Trials ending within 7 days" sub="Ordered by urgency — call the top of this list first">
          {trials.length === 0 ? (
            <p className="py-8 text-center text-sm text-vodium-cream/25">No trials ending this week.</p>
          ) : (
            <DataTable
              head={["Vendor", "Owner", "Phone", "Plan", "Days left", "MRR at stake"]}
              rows={trials.map((t) => [
                t.businessName, t.ownerName, t.phone ?? "—", t.plan,
                t.daysLeft === null ? "—" : `${t.daysLeft}d`, formatNaira(t.monthlyAmount),
              ])}
            />
          )}
        </ChartCard>
      </section>

      <section>
        <SectionHeading
          title="Trials that have already ended"
          sub="Who lapsed, when, and what is still on their book"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile
            label="In grace"
            value={String(k.inGraceCount)}
            sub="Still full access — call these first"
            tone={k.inGraceCount === 0 ? "neutral" : "warning"}
          />
          <StatTile
            label="Locked out"
            value={String(k.lockedOutCount)}
            sub="Read-only until they renew"
            tone={k.lockedOutCount === 0 ? "good" : "critical"}
          />
          <StatTile
            label="MRR stopped"
            value={formatNaira(k.mrrLostToExpiry)}
            sub="Recurring revenue actually lost"
            tone={k.mrrLostToExpiry === 0 ? "good" : "critical"}
          />
          <StatTile
            label="Avg days to convert"
            value={k.avgDaysToConvert === null ? "—" : `${k.avgDaysToConvert}d`}
            sub={k.avgDaysToConvert === null ? "No conversions recorded yet" : "Trial start → first payment"}
          />
        </div>

        <ChartCard
          title="Lapsed accounts"
          sub={
            data.lapsedVendors.length === 0
              ? "Nothing lapsed"
              : `${data.lapsedVendors.length} account${data.lapsedVendors.length === 1 ? "" : "s"} — grace first, then longest expired`
          }
        >
          {data.lapsedVendors.length === 0 ? (
            <p className="py-8 text-center text-sm text-vodium-cream/25">No lapsed accounts. Everyone is current.</p>
          ) : (
            <DataTable
              head={["Vendor", "Owner", "Phone", "State", "Ended", "Days", "MRR", "Owed to them"]}
              rows={[...data.lapsedVendors]
                // Grace before locked (still saveable), then longest-lapsed first.
                .sort((a, b) => {
                  if (a.state !== b.state) return a.state === "GRACE" ? -1 : 1;
                  return (b.daysExpired ?? 0) - (a.daysExpired ?? 0);
                })
                .map((v) => [
                  v.businessName,
                  v.ownerName,
                  v.phone ?? "—",
                  v.state === "GRACE"
                    ? `Grace · ${v.daysUntilLockout ?? 0}d left`
                    : "Locked",
                  v.lapsedAt ? new Date(v.lapsedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—",
                  v.daysExpired === null ? "—" : `${v.daysExpired}d`,
                  formatNaira(v.monthlyAmount),
                  `${formatNaira(v.outstanding)} (${v.creditCount})`,
                ])}
            />
          )}
        </ChartCard>
      </section>

      <section>
        <SectionHeading title="Subscription states" sub="The whole book at a glance" />
        <ChartCard
          title="Where every subscription sits"
          sub={`${k.totalSubs} subscriptions`}
          table={{ head: ["State", "Count"], rows: data.statusMix.map((s) => [s.label, s.count]) }}
        >
          <BreakdownBars
            total={k.totalSubs}
            rows={[
              { label: "Active (paying)", count: data.statusMix[0].count, color: STATUS.good },
              { label: "On trial",        count: data.statusMix[1].count, color: STATUS.warning },
              { label: "Past due",        count: data.statusMix[2].count, color: STATUS.critical },
              { label: "Cancelled",       count: data.statusMix[3].count, color: STATUS.serious },
              { label: "Expired",         count: data.statusMix[4].count, color: SERIES.blue },
            ]}
          />
        </ChartCard>
      </section>
    </div>
  );
}

function SubscriptionsTab({ data }: { data: FinanceData }) {
  const [filter, setFilter] = useState<string>("ALL");
  const states = ["ALL", "ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED", "EXPIRED"];
  const rows = data.subscriptions.filter((s) => filter === "ALL" || s.status === filter);

  return (
    <div className="space-y-4">
      <SectionHeading title="All subscriptions" sub={`${data.subscriptions.length} total`} />
      <div className="flex flex-wrap gap-2">
        {states.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              filter === s
                ? "border-vodium-gold/40 bg-vodium-gold/10 text-vodium-gold"
                : "border-white/[0.08] text-vodium-cream/45 hover:text-vodium-cream/80"
            }`}
          >
            {s === "ALL" ? "All" : s.replace("_", " ")}
            <span className="ml-1.5 opacity-50">
              {s === "ALL" ? data.subscriptions.length : data.subscriptions.filter((x) => x.status === s).length}
            </span>
          </button>
        ))}
      </div>

      <ChartCard title={filter === "ALL" ? "Every subscription" : `${filter.replace("_", " ")} subscriptions`} sub={`${rows.length} shown`}>
        <DataTable
          head={["Vendor", "Owner", "Plan", "Status", "MRR", "Since"]}
          rows={rows.map((s) => [
            s.businessName,
            s.ownerName,
            s.plan,
            s.status.replace("_", " "),
            s.status === "ACTIVE" ? formatNaira(s.monthlyAmount) : "—",
            new Date(s.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "2-digit" }),
          ])}
        />
      </ChartCard>
    </div>
  );
}

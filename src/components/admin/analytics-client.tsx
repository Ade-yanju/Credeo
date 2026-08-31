"use client";

import { useState } from "react";
import { Activity, Banknote, Clock, Users, Store, FileText, UserCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import type { AnalyticsData } from "@/lib/admin/analytics";
import {
  SERIES, STATUS, SEQUENTIAL, SectionHeading, ChartCard, StatTile, TrendArea, TrendLine,
  BarsH, Heatmap, BreakdownBars, DataTable, compact,
} from "./viz";

const TABS = [
  { id: "overview",  label: "Overview",   icon: Activity },
  { id: "logging",   label: "Credit logging", icon: Store },
  { id: "repayment", label: "Repayment",  icon: Clock },
  { id: "customers", label: "Customers",  icon: Users },
  { id: "usage",     label: "Usage & activity", icon: UserCheck },
] as const;

type TabId = (typeof TABS)[number]["id"];

const naira = (v: number) => formatNaira(v);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function AnalyticsClient({ data, initialTab = "overview" }: { data: AnalyticsData; initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const h = data.headline;

  return (
    <div className="space-y-6">
      {/* Headline KPI row — stat tiles, not charts: these are single numbers. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile hero label="Total tracked" value={formatNaira(h.totalTracked)} sub={`${h.totalCredits.toLocaleString()} credits ever logged`} />
        <StatTile hero label="Recovered" value={formatNaira(h.totalRecovered)} sub={`${h.recoveryRate}% of value extended`} tone={h.recoveryRate >= 70 ? "good" : "warning"} />
        <StatTile hero label="Paid on time" value={`${h.onTimeShare}%`} sub={`of ${data.settledTotal.toLocaleString()} settled credits`} tone={h.onTimeShare >= 70 ? "good" : h.onTimeShare >= 40 ? "warning" : "critical"} />
        <StatTile hero label="Vendors logging weekly" value={String(h.activeVendors7d)} sub={`${h.activeVendors30d} in 30 days · ${h.totalVendors} total`} tone={h.activeVendors7d > 0 ? "good" : "warning"} />
      </div>

      {/* Tabs */}
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

      {tab === "overview"  && <OverviewTab data={data} />}
      {tab === "logging"   && <LoggingTab data={data} />}
      {tab === "repayment" && <RepaymentTab data={data} />}
      {tab === "customers" && <CustomersTab data={data} />}
      {tab === "usage"     && <UsageTab data={data} />}
    </div>
  );
}

// ── Product usage and vendor activity ───────────────────────────────────────

function UsageTab({ data }: { data: AnalyticsData }) {
  const h = data.headline;
  const invoiceRows = data.invoiceSources.map((row) => [
    row.source === "WHATSAPP" ? "WhatsApp" : "Web dashboard",
    row.count,
    formatNaira(row.total),
    formatNaira(row.paid),
  ] as (string | number)[]);

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Solution adoption" sub="Invoices issued by the product surface vendors use" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="Invoices issued" value={String(h.totalInvoices)} sub="Web + WhatsApp" />
          <StatTile label="Web invoices" value={String(h.webInvoices)} sub="Created in dashboard" />
          <StatTile label="WhatsApp invoices" value={String(h.whatsappInvoices)} sub="Created in WhatsApp" />
          <StatTile label="Active vendors" value={String(h.activeVendorsInteracting30d)} sub="Any interaction in 30 days" tone={h.activeVendorsInteracting30d > 0 ? "good" : "warning"} />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Invoice channel mix"
            sub="Count and value of all invoices issued"
            table={{ head: ["Channel", "Invoices", "Value", "Paid"], rows: invoiceRows }}
          >
            <BarsH
              data={data.invoiceSources.map((row) => ({ ...row, label: row.source === "WHATSAPP" ? "WhatsApp" : "Web dashboard" }))}
              xKey="label"
              dataKey="count"
              colors={[SERIES.gold, SERIES.blue]}
            />
          </ChartCard>
          <div className="rounded-2xl border border-vodium-gold/15 bg-vodium-gold/[0.04] p-5 md:p-6 text-sm text-vodium-cream/55 leading-relaxed">
            <FileText size={17} className="text-vodium-gold mb-3" />
            <p className="text-vodium-cream/80 font-medium mb-2">What this tells us</p>
            <p>Invoice source is recorded at creation, so the team can see which solution vendors are choosing—not just whether an invoice was eventually sent.</p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="Vendor activeness" sub="Any meaningful product interaction in the last 30 days—not credit logging alone" />
        <ChartCard title="Most engaged vendors" sub="Credits, invoices, and audited web/WhatsApp actions combined">
          <DataTable
            head={["Vendor", "Community", "Interactions", "Credits", "Invoices", "Last active"]}
            rows={data.vendorEngagement.slice(0, 12).map((v) => [
              v.name,
              v.community,
              v.interactions30d,
              v.credits30d,
              v.invoices30d,
              v.lastInteractedAt ? new Date(v.lastInteractedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Never",
            ])}
          />
        </ChartCard>
      </section>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AnalyticsData }) {
  const h = data.headline;
  const health = data.health;

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Money movement" sub="What was extended and how much came back" />
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Extended vs recovered"
            sub="Last 6 months, by month"
            table={{
              head: ["Month", "Extended", "Recovered"],
              rows: data.monthly.map((m) => [m.month, formatNaira(m.extended), formatNaira(m.recovered)]),
            }}
          >
            <TrendArea
              data={data.monthly}
              xKey="month"
              fmt={naira}
              series={[
                { key: "extended",  name: "Extended",  color: SERIES.gold },
                { key: "recovered", name: "Recovered", color: SERIES.blue },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Credit health"
            sub={`${health.totalCredits.toLocaleString()} credits by current state`}
            table={{
              head: ["State", "Credits"],
              rows: [
                ["Paid", health.paidCredits], ["Outstanding", health.outstanding],
                ["Partially paid", health.partial], ["Overdue", health.overdue], ["Written off", health.writtenOff],
              ],
            }}
          >
            <BreakdownBars
              total={health.totalCredits}
              rows={[
                { label: "Paid",           count: health.paidCredits, color: STATUS.good },
                { label: "Outstanding",    count: health.outstanding, color: SERIES.blue },
                { label: "Partially paid", count: health.partial,     color: STATUS.warning },
                { label: "Overdue",        count: health.overdue,     color: STATUS.serious },
                { label: "Written off",    count: health.writtenOff,  color: STATUS.critical },
              ]}
            />
          </ChartCard>
        </div>
      </section>

      <section>
        <SectionHeading title="Business" sub="Subscription revenue and book size" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="MRR" value={formatNaira(h.mrr)} sub="Active subscriptions" />
          <StatTile label="ARR" value={formatNaira(h.arr)} sub="Annualised run rate" />
          <StatTile label="Still owed" value={formatNaira(h.outstandingValue)} sub="Extended minus recovered" tone="warning" />
          <StatTile label="Default rate" value={`${h.defaultRate}%`} sub="Written off" tone={h.defaultRate <= 5 ? "good" : "critical"} />
        </div>
      </section>
    </div>
  );
}

// ── Credit logging patterns ───────────────────────────────────────────────────

function LoggingTab({ data }: { data: AnalyticsData }) {
  const h = data.headline;
  const engagementPct = h.totalVendors > 0 ? Math.round((h.activeVendors30d / h.totalVendors) * 100) : 0;

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Are vendors actually using it?" sub="Logging frequency is the single best churn predictor" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="Logged this week" value={String(h.activeVendors7d)} sub="Distinct vendors" tone={h.activeVendors7d > 0 ? "good" : "critical"} />
          <StatTile label="Logged this month" value={String(h.activeVendors30d)} sub={`${engagementPct}% of all vendors`} tone={engagementPct >= 60 ? "good" : "warning"} />
          <StatTile label="Have ever logged" value={String(h.vendorsEverLogged)} sub={`of ${h.totalVendors} registered`} />
          <StatTile label="Avg credit size" value={formatNaira(h.avgCredit)} sub="Across all credits" />
        </div>

        <ChartCard
          title="When credits get logged"
          sub="Day of week × hour of day, last 90 days — shows when shops are busiest"
        >
          <Heatmap
            cells={data.hourCells}
            days={data.days}
            hours={HOURS}
            fmtLabel={(d, hr, v) => `${d} ${hr}:00–${hr}:59 — ${v} credit${v === 1 ? "" : "s"} logged`}
          />
        </ChartCard>
      </section>

      <section>
        <SectionHeading title="Volume" sub="How many credits, and how big" />
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Credits logged per month"
            sub="Count of new credits"
            table={{ head: ["Month", "Credits"], rows: data.monthly.map((m) => [m.month, m.credits]) }}
          >
            <TrendArea
              data={data.monthly}
              xKey="month"
              series={[{ key: "credits", name: "Credits logged", color: SERIES.gold }]}
            />
          </ChartCard>

          <ChartCard
            title="Typical credit size"
            sub="Where the book's risk actually sits"
            table={{ head: ["Size", "Credits"], rows: data.sizeBuckets.map((b) => [b.bucket, b.count]) }}
          >
            {/* Ordered size bands → ordinal ramp, so the order reads in the colour. */}
            <BarsH data={data.sizeBuckets} xKey="bucket" dataKey="count" colors={[...SEQUENTIAL]} />
          </ChartCard>
        </div>
      </section>

      <section>
        <SectionHeading title="Vendor leaderboard" sub="Ranked by credits logged — with how much each actually recovers" />
        <ChartCard title="Top vendors" sub="Volume is not the same as collection">
          <DataTable
            head={["Vendor", "Campus", "Credits", "Recovered", "Recovery"]}
            rows={data.topVendors.map((v) => [v.name, v.community, v.credits, formatNaira(v.recovered), `${v.recoveryRate}%`])}
          />
        </ChartCard>
      </section>
    </div>
  );
}

// ── Repayment patterns ────────────────────────────────────────────────────────

function RepaymentTab({ data }: { data: AnalyticsData }) {
  const h = data.headline;
  const t = data.timingBuckets;
  const lateCount = t.slice(1).reduce((s, b) => s + b.count, 0);
  const veryLate = t[4]?.count ?? 0;

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Do customers pay on time?" sub="Measured against each credit's own due date" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="On time or early" value={`${h.onTimeShare}%`} sub={`${t[0]?.count ?? 0} credit${(t[0]?.count ?? 0) === 1 ? "" : "s"}`} tone={h.onTimeShare >= 70 ? "good" : "warning"} />
          <StatTile label="Paid late" value={String(lateCount)} sub="Settled after the due date" tone={lateCount === 0 ? "good" : "warning"} />
          <StatTile label="Over 30 days late" value={String(veryLate)} sub="Deep delinquency" tone={veryLate === 0 ? "good" : "critical"} />
          <StatTile label="Value recovered" value={`${h.recoveryRate}%`} sub={formatNaira(h.totalRecovered)} tone={h.recoveryRate >= 70 ? "good" : "warning"} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="How late, when they pay"
            sub={`${data.settledTotal.toLocaleString()} settled credits by lateness`}
            table={{ head: ["Lateness", "Credits"], rows: t.map((b) => [b.bucket, b.count]) }}
          >
            {/* good → critical scale: status colours, always with text labels. */}
            <BreakdownBars
              total={data.settledTotal}
              rows={[
                { label: t[0].bucket, count: t[0].count, color: STATUS.good },
                { label: t[1].bucket, count: t[1].count, color: STATUS.warning },
                { label: t[2].bucket, count: t[2].count, color: STATUS.warning },
                { label: t[3].bucket, count: t[3].count, color: STATUS.serious },
                { label: t[4].bucket, count: t[4].count, color: STATUS.critical },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="On-time rate over time"
            sub="Share of credits settled by their due date, by month closed"
            table={{ head: ["Month", "On-time %", "Settled"], rows: data.onTime.map((r) => [r.month, `${r.onTimeRate}%`, r.settled]) }}
          >
            <TrendLine data={data.onTime} xKey="month" dataKey="onTimeRate" name="On-time rate" fmt={(v) => `${v}%`} />
          </ChartCard>
        </div>
      </section>

      <section>
        <SectionHeading title="Recovery" sub="Money back versus money out" />
        <ChartCard
          title="Recovered against extended"
          sub="Last 6 months — the gap is what's still owed"
          table={{
            head: ["Month", "Extended", "Recovered", "Gap"],
            rows: data.monthly.map((m) => [m.month, formatNaira(m.extended), formatNaira(m.recovered), formatNaira(Math.max(m.extended - m.recovered, 0))]),
          }}
        >
          <TrendArea
            data={data.monthly}
            xKey="month"
            fmt={naira}
            height={220}
            series={[
              { key: "extended",  name: "Extended",  color: SERIES.gold },
              { key: "recovered", name: "Recovered", color: SERIES.blue },
            ]}
          />
        </ChartCard>

        {h.defaultRate > 5 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#d03b3b]/25 bg-[#d03b3b]/[0.08] px-4 py-3 text-sm text-[#d03b3b]">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <p>Default rate is {h.defaultRate}% — above the 5% healthy ceiling. Check the vendors with the lowest recovery rates on the Credit logging tab.</p>
          </div>
        )}
        {h.defaultRate <= 5 && data.settledTotal > 0 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#0ca30c]/25 bg-[#0ca30c]/[0.08] px-4 py-3 text-sm text-[#0ca30c]">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <p>Default rate is {h.defaultRate}%, inside the 5% healthy ceiling.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────────────────────

function CustomersTab({ data }: { data: AnalyticsData }) {
  const h = data.headline;
  const scoreLabels: Record<string, { label: string; color: string }> = {
    excellent: { label: "Excellent (750–1000)", color: STATUS.good },
    good:      { label: "Good (650–749)",       color: SERIES.blue },
    fair:      { label: "Fair (450–649)",       color: STATUS.warning },
    poor:      { label: "Poor (0–449)",         color: STATUS.critical },
  };
  const scoredTotal = data.scoreDist.reduce((s, r) => s + r.count, 0);
  const repeatTotal = data.repeatCustomers.reduce((s, r) => s + r.count, 0);
  const repeaters = data.repeatCustomers.slice(1).reduce((s, r) => s + r.count, 0);
  const repeatRate = repeatTotal ? Math.round((repeaters / repeatTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="The credit graph" sub="Who's on the book and how reliable they are" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile label="Customers tracked" value={h.totalCustomers.toLocaleString()} sub="Unique people on the ledger" />
          <StatTile label="Came back for more" value={`${repeatRate}%`} sub="Took credit more than once" tone={repeatRate >= 40 ? "good" : "warning"} />
          <StatTile label="Avg credit size" value={formatNaira(h.avgCredit)} sub="Per credit extended" />
          <StatTile label="Good or excellent" value={String((data.scoreDist[0]?.count ?? 0) + (data.scoreDist[1]?.count ?? 0))} sub={`of ${scoredTotal.toLocaleString()} scored`} tone="good" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Vodium score distribution"
            sub={`${scoredTotal.toLocaleString()} customers scored across all shops`}
            table={{ head: ["Tier", "Customers"], rows: data.scoreDist.map((r) => [scoreLabels[r.tier].label, r.count]) }}
          >
            <BreakdownBars
              total={scoredTotal}
              rows={data.scoreDist.map((r) => ({ label: scoreLabels[r.tier].label, count: r.count, color: scoreLabels[r.tier].color }))}
            />
          </ChartCard>

          <ChartCard
            title="Repeat borrowing"
            sub="Credits taken per customer — retention, not just acquisition"
            table={{ head: ["Credits taken", "Customers"], rows: data.repeatCustomers.map((r) => [r.bucket, r.count]) }}
          >
            {/* Ordered bands → ordinal ramp. */}
            <BarsH data={data.repeatCustomers} xKey="bucket" dataKey="count" colors={[...SEQUENTIAL]} />
          </ChartCard>
        </div>
      </section>

      <section>
        <SectionHeading title="Why this matters" />
        <div className="rounded-2xl border border-vodium-gold/15 bg-vodium-gold/[0.04] p-5 text-sm text-vodium-cream/55 leading-relaxed">
          <Banknote size={15} className="text-vodium-gold inline mr-1.5 -mt-0.5" />
          Every settled credit here adds a repayment event to the shared Vodium score — the proprietary
          data asset. {compact(h.totalCredits)} credits across {h.totalCustomers.toLocaleString()} customers
          and {h.totalVendors} vendors is what Year-2 underwriting will be built on.
        </div>
      </section>
    </div>
  );
}

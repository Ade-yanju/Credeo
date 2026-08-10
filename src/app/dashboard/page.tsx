import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  MessageCircle,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { getVendorSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/utils";
import { markOverdueCredits } from "@/lib/credit-lifecycle";
import { StatCard } from "@/components/ui/stat-card";
import { GlowBadge } from "@/components/ui/glow-badge";
import { RevenueChart } from "@/components/ui/revenue-chart";
import { BulkRemindButton } from "@/components/ui/bulk-remind-button";
import {
  PortfolioHealth,
  type PortfolioCustomer,
} from "@/components/ui/portfolio-health";

export default async function DashboardPage() {
  const vendor = await getVendorSession();
  if (!vendor) redirect("/login");

  await markOverdueCredits({ vendorId: vendor.id });

  const credits = await prisma.credit.findMany({
    where: { vendorId: vendor.id },
    include: { student: true },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── Computed stats ──────────────────────────────────────────
  const outstanding = credits.filter(
    (c) => !["PAID", "WRITTEN_OFF"].includes(c.status),
  );
  const totalOwed = outstanding.reduce(
    (s, c) => s + Number(c.amount) - Number(c.amountRepaid),
    0,
  );
  const paidCredits = credits.filter((c) => c.status === "PAID");
  const paidThisMonth = paidCredits
    .filter((c) => c.closedAt && c.closedAt >= startOfMonth)
    .reduce((s, c) => s + Number(c.amount), 0);
  const overdueAll = credits.filter((c) => c.status === "OVERDUE");
  const overdueList = overdueAll.slice(0, 5);
  const dueSoonList = credits.filter((c) => c.status === "DUE_SOON").slice(0, 5);
  const totalCustomers = new Set(credits.map((c) => c.studentId)).size;
  const creditsOwing = outstanding.filter(
    (c) => Number(c.amount) - Number(c.amountRepaid) > 0,
  ).length;
  const avgCredit = credits.length
    ? credits.reduce((s, c) => s + Number(c.amount), 0) / credits.length
    : 0;
  const creditsThisMonth = credits.filter(
    (c) => c.createdAt >= startOfMonth,
  ).length;
  const recoveryRate =
    paidCredits.length && credits.length
      ? Math.round((paidCredits.length / credits.length) * 100)
      : 0;

  // ── Portfolio credit health ─────────────────────────────────
  // Roll credits up per customer so the panel can weight each student's score
  // by how much they still owe *this* vendor.
  const byCustomer = new Map<string, PortfolioCustomer>();
  for (const c of credits) {
    const owed = Math.max(0, Number(c.amount) - Number(c.amountRepaid));
    const settled = c.status === "PAID" || c.status === "WRITTEN_OFF";
    const existing = byCustomer.get(c.studentId);
    if (existing) {
      existing.owed += settled ? 0 : owed;
    } else {
      byCustomer.set(c.studentId, {
        id: c.studentId,
        fullName: c.student.fullName,
        score: c.student.vodiumScore,
        owed: settled ? 0 : owed,
      });
    }
  }
  const portfolioCustomers = [...byCustomer.values()];

  // ── Monthly volume (last 6 months) ────────────────────────
  const monthlyVolume = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthCredits = credits.filter(
      (c) => c.createdAt >= d && c.createdAt < next,
    );
    return {
      month: d.toLocaleString("en-NG", { month: "short" }).slice(0, 3),
      extended: monthCredits.reduce((s, c) => s + Number(c.amount), 0),
      recovered: monthCredits
        .filter((c) => c.status === "PAID")
        .reduce((s, c) => s + Number(c.amount), 0),
    };
  });

  // ── Activity feed (8 most recent events) ──────────────────
  const activity = credits.slice(0, 8).map((c) => ({
    id: c.id,
    type:
      c.status === "PAID"
        ? "paid"
        : c.status === "OVERDUE"
          ? "overdue"
          : "credit",
    text:
      c.status === "PAID"
        ? `${c.student.fullName} paid ${formatNaira(Number(c.amount))}`
        : c.status === "OVERDUE"
          ? `${c.student.fullName} is overdue — ${formatNaira(Number(c.amount) - Number(c.amountRepaid))} owed`
          : `Credit of ${formatNaira(Number(c.amount))} recorded for ${c.student.fullName}`,
    subtext: c.description ?? "",
    at: c.createdAt.toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
    }),
  }));

  const thisMonthExtended = monthlyVolume[5]?.extended ?? 0;

  // Figures are computed per request; say when so the numbers feel accountable.
  const asOf = `As of ${now.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  })}`;

  return (
    <div className="min-h-full bg-[color:var(--surface-0)] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[26px] leading-tight text-[color:var(--text-primary)]">
              {vendor.businessName}
            </h1>
            <p className="mt-0.5 text-[13px] text-[color:var(--text-tertiary)]">
              {vendor.location ??
                vendor.community?.shortName ??
                vendor.community?.name ??
                "Community"}
            </p>
          </div>
          {/* Plan chip and "Add credit" live in the sticky top bar — repeating
              them here put two identical gold buttons 90px apart. */}
          <p className="shrink-0 text-[12px] text-[color:var(--text-quaternary)]">
            {asOf}
          </p>
        </header>

        {/* ── KPIs ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Owed to you"
            value={formatNaira(totalOwed)}
            sub={`Across ${creditsOwing} open ${creditsOwing === 1 ? "credit" : "credits"}`}
            icon={<TrendingUp size={15} />}
          />
          <StatCard
            label="Paid this month"
            value={formatNaira(paidThisMonth)}
            sub="Recovered from customers"
            tone={paidThisMonth > 0 ? "positive" : "neutral"}
            icon={<CheckCircle2 size={15} />}
          />
          <StatCard
            label="Customers owing"
            value={String(creditsOwing)}
            sub={`Of ${totalCustomers} total ${totalCustomers === 1 ? "customer" : "customers"}`}
            icon={<Users size={15} />}
          />
          <StatCard
            label="Recovery rate"
            value={`${recoveryRate}%`}
            sub="Paid vs issued, all time"
            tone={recoveryRate >= 70 ? "positive" : recoveryRate >= 40 ? "caution" : "negative"}
            icon={<BarChart3 size={15} />}
            trend={recoveryRate >= 70 ? "Healthy" : "Needs attention"}
            trendUp={recoveryRate >= 70}
          />
        </div>

        {/* ── Portfolio credit health ────────────────────── */}
        <PortfolioHealth customers={portfolioCustomers} />

        {/* ── Volume + side rail ─────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="surface-card p-5 lg:col-span-2">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[13px] font-medium text-[color:var(--text-primary)]">
                  Credit volume
                </h2>
                <p className="mt-0.5 text-[12px] text-[color:var(--text-tertiary)]">
                  Extended against recovered, last 6 months
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11px] text-[color:var(--text-tertiary)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8A8F98]" aria-hidden />
                  Extended
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3FB950]" aria-hidden />
                  Recovered
                </span>
              </div>
            </div>

            <RevenueChart data={monthlyVolume} />

            <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-[color:var(--hairline)] pt-4">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
                  Extended
                </dt>
                <dd className="tnum mt-1 text-[15px] text-[color:var(--text-primary)]">
                  {formatNaira(thisMonthExtended)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
                  Recovered
                </dt>
                <dd className="tnum mt-1 text-[15px] text-[#56C963]">
                  {formatNaira(paidThisMonth)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
                  Outstanding
                </dt>
                <dd className="tnum mt-1 text-[15px] text-[color:var(--text-primary)]">
                  {formatNaira(Math.max(0, thisMonthExtended - paidThisMonth))}
                </dd>
              </div>
            </dl>
          </section>

          <div className="space-y-4">
            <section className="surface-card p-4">
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.07em] text-[color:var(--text-tertiary)]">
                Quick actions
              </h2>
              <div className="space-y-1">
                {[
                  { href: "/dashboard/credit/new", icon: Plus, label: "Add a credit", external: false },
                  { href: "/dashboard/credits", icon: BarChart3, label: "View all credits", external: false },
                  { href: "https://wa.me/2347019575717?text=LIST", icon: MessageCircle, label: "WhatsApp bot", external: true },
                ].map(({ href, icon: Icon, label, external }) => {
                  const inner = (
                    <>
                      <span className="flex items-center gap-2.5 text-[13px] text-[color:var(--text-secondary)] transition-colors group-hover:text-[color:var(--text-primary)]">
                        <Icon size={15} className="text-[color:var(--text-quaternary)] transition-colors group-hover:text-vodium-gold" />
                        {label}
                      </span>
                      <ArrowRight
                        size={13}
                        className="text-[color:var(--text-quaternary)] transition-transform group-hover:translate-x-0.5 group-hover:text-vodium-gold"
                      />
                    </>
                  );
                  const cls =
                    "group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[color:var(--surface-2)]";
                  return external ? (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={label} href={href} className={cls}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="surface-card grid grid-cols-2 gap-4 p-4">
              {[
                { label: "Customers", value: String(totalCustomers) },
                { label: "Avg credit", value: formatNaira(Math.round(avgCredit)) },
                { label: "This month", value: String(creditsThisMonth), note: "issued" },
                { label: "All time", value: String(credits.length), note: "logged" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[11px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
                    {s.label}
                  </p>
                  <p className="tnum mt-1 text-[17px] text-[color:var(--text-primary)]">
                    {s.value}
                  </p>
                  {s.note && (
                    <p className="text-[11px] text-[color:var(--text-quaternary)]">{s.note}</p>
                  )}
                </div>
              ))}
            </section>
          </div>
        </div>

        {/* ── Overdue ────────────────────────────────────── */}
        <section className="surface-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[color:var(--hairline)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <h2 className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--text-primary)]">
              <AlertCircle size={15} className="text-[#F0736B]" />
              Overdue credits
              {overdueAll.length > 0 && (
                <GlowBadge color="red">{overdueAll.length}</GlowBadge>
              )}
            </h2>
            {overdueAll.length > 0 && <BulkRemindButton overdueCount={overdueAll.length} />}
          </div>

          {overdueList.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 size={18} className="mx-auto text-[#3FB950]/50" />
              <p className="mt-2 text-[13px] text-[color:var(--text-tertiary)]">
                Nothing overdue. Every credit is on schedule.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--hairline)]">
              {overdueList.map((c) => {
                const daysOver = Math.floor(
                  (now.getTime() - new Date(c.dueDate).getTime()) / 86_400_000,
                );
                return (
                  <li
                    key={c.id}
                    className="row-interactive flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5534B]" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-[color:var(--text-primary)]">
                          {c.student.fullName}
                        </p>
                        <p className="tnum mt-0.5 text-[11px] text-[color:var(--text-tertiary)]">
                          {c.student.matricNumber ?? "No matric"} · {daysOver} day
                          {daysOver !== 1 ? "s" : ""} overdue
                        </p>
                      </div>
                    </div>
                    <p className="tnum shrink-0 text-[14px] text-[#F0736B]">
                      {formatNaira(Number(c.amount) - Number(c.amountRepaid))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {overdueAll.length > 0 && (
            <div className="border-t border-[color:var(--hairline)] px-4 py-2.5 sm:px-5">
              <Link
                href="/dashboard/credits"
                className="group inline-flex items-center gap-1 text-[12px] text-[color:var(--text-tertiary)] transition-colors hover:text-vodium-gold"
              >
                View all overdue
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </section>

        {/* ── Due soon ───────────────────────────────────── */}
        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--hairline)] px-4 py-3.5 sm:px-5">
            <h2 className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--text-primary)]">
              <Clock size={15} className="text-[#DFB569]" />
              Due soon
              {dueSoonList.length > 0 && (
                <GlowBadge color="amber">{dueSoonList.length}</GlowBadge>
              )}
            </h2>
          </div>
          {dueSoonList.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[color:var(--text-tertiary)]">
              Nothing falling due in the next 2 days.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--hairline)]">
              {dueSoonList.map((c) => {
                const daysUntil = Math.ceil(
                  (new Date(c.dueDate).getTime() - now.getTime()) / 86_400_000,
                );
                return (
                  <li
                    key={c.id}
                    className="row-interactive flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D2A24C]" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-[color:var(--text-primary)]">
                          {c.student.fullName}
                        </p>
                        <p className="tnum mt-0.5 text-[11px] text-[color:var(--text-tertiary)]">
                          Due{" "}
                          {new Date(c.dueDate).toLocaleDateString("en-NG", {
                            month: "short",
                            day: "numeric",
                          })}
                          {" · "}in {Math.max(0, daysUntil)} day
                          {daysUntil !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="tnum shrink-0 text-[14px] text-[color:var(--text-primary)]">
                      {formatNaira(Number(c.amount) - Number(c.amountRepaid))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Activity ───────────────────────────────────── */}
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[color:var(--hairline)] px-4 py-3.5 sm:px-5">
            <h2 className="text-[13px] font-medium text-[color:var(--text-primary)]">
              Recent activity
            </h2>
          </div>
          {activity.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[13px] text-[color:var(--text-tertiary)]">
                No activity yet.
              </p>
              <Link
                href="/dashboard/credit/new"
                className="btn-gold mt-4 inline-flex rounded-lg px-4 py-2 text-[13px]"
              >
                Record your first credit
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--hairline)]">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      a.type === "paid"
                        ? "bg-[#3FB950]"
                        : a.type === "overdue"
                          ? "bg-[#E5534B]"
                          : "bg-[color:var(--text-quaternary)]"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-[color:var(--text-secondary)]">
                      {a.text}
                    </p>
                    {a.subtext && (
                      <p className="mt-0.5 truncate text-[11px] text-[color:var(--text-quaternary)]">
                        {a.subtext}
                      </p>
                    )}
                  </div>
                  <span className="tnum shrink-0 text-[11px] text-[color:var(--text-quaternary)]">
                    {a.at}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { SCORE_BANDS, scoreBand, type ScoreBandId } from "@/lib/credit-score/bands";
import { formatNaira } from "@/lib/utils";

/**
 * Portfolio credit health.
 *
 * A vendor has no score of their own — their customers do. The number that
 * actually changes a vendor's behaviour is not an average, it's *where the
 * money is*: ₦X of what you're owed sits with customers who have defaulted
 * before. So the headline gauge is exposure-weighted rather than a plain mean,
 * and the breakdown is denominated in Naira, not customer counts.
 */

export interface PortfolioCustomer {
  id: string;
  fullName: string;
  score: number;
  /** Naira still owed to this vendor by this customer. */
  owed: number;
}

interface BandRow {
  id: ScoreBandId;
  label: string;
  hex: string;
  chip: string;
  guidance: string;
  customers: number;
  owed: number;
  share: number;
}

export function PortfolioHealth({
  customers,
}: {
  customers: PortfolioCustomer[];
}) {
  const totalOwed = customers.reduce((s, c) => s + c.owed, 0);

  // Exposure-weighted score. One customer owing ₦50k should move this far more
  // than five owing ₦200 each. Falls back to an unweighted mean when nothing is
  // outstanding, so the gauge still reads sensibly on a fully-settled ledger.
  const weighted =
    totalOwed > 0
      ? customers.reduce((s, c) => s + c.score * c.owed, 0) / totalOwed
      : customers.length
        ? customers.reduce((s, c) => s + c.score, 0) / customers.length
        : 500;

  const portfolioScore = Math.round(weighted);
  const band = scoreBand(portfolioScore);

  // With nothing outstanding there is no exposure to weight, so the panel
  // switches denomination: bar segments and band figures count customers
  // instead of naira. Otherwise every band reads ₦0 behind an empty bar, which
  // looks broken rather than settled.
  const settled = totalOwed === 0;

  const rows: BandRow[] = SCORE_BANDS.map((b) => {
    const inBand = customers.filter((c) => scoreBand(c.score).id === b.id);
    const owed = inBand.reduce((s, c) => s + c.owed, 0);
    return {
      id: b.id,
      label: b.label,
      hex: b.hex,
      chip: b.chip,
      guidance: b.guidance,
      customers: inBand.length,
      owed,
      share: settled
        ? (customers.length ? inBand.length / customers.length : 0)
        : owed / totalOwed,
    };
  });

  // "At risk" = money with customers who have a demonstrated repayment problem.
  const atRisk = rows
    .filter((r) => r.id === "poor" || r.id === "fair")
    .reduce((s, r) => s + r.owed, 0);
  const atRiskShare = totalOwed > 0 ? Math.round((atRisk / totalOwed) * 100) : 0;

  const weakCount = rows
    .filter((r) => r.id === "poor" || r.id === "fair")
    .reduce((s, r) => s + r.customers, 0);

  if (customers.length === 0) {
    return (
      <section className="surface-card p-5">
        <h2 className="text-[13px] font-medium text-[color:var(--text-primary)]">
          Portfolio credit health
        </h2>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[color:var(--text-tertiary)]">
          Once you record credits, we score each customer on repayment history
          and show you how much of what you&apos;re owed sits with risky payers.
        </p>
        <Link
          href="/dashboard/credit/new"
          className="btn-gold mt-4 inline-flex rounded-lg px-4 py-2 text-[13px]"
        >
          Record a credit
        </Link>
      </section>
    );
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="flex shrink-0 flex-col items-center">
          <ScoreRing score={portfolioScore} label="Portfolio credit health" />
          <span
            className={`mt-2.5 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${band.chip}`}
          >
            {band.label}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] font-medium text-[color:var(--text-primary)]">
              Portfolio credit health
            </h2>
            <Link
              href="/dashboard/customers"
              className="group inline-flex shrink-0 items-center gap-1 text-[12px] text-[color:var(--text-tertiary)] transition-colors hover:text-vodium-gold"
            >
              Customers
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--text-tertiary)]">
            {settled
              ? `Nothing outstanding. Repayment history across ${customers.length} ${customers.length === 1 ? "customer" : "customers"}.`
              : `Weighted by what each customer owes you, across ${customers.length} ${customers.length === 1 ? "customer" : "customers"}.`}
          </p>

          {/* Segmented by share of exposure — or of customers once settled.
              When settled, the bar is dimmed: it describes past behaviour, not
              money currently at stake, and a full-width red bar next to a ₦0
              balance overstates the situation. */}
          <div
            className={`mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[color:var(--surface-2)] ${
              settled ? "opacity-45" : ""
            }`}
            role="img"
            aria-label={
              rows
                .filter((r) => (settled ? r.customers > 0 : r.owed > 0))
                .map((r) =>
                  settled
                    ? `${r.label}: ${r.customers} ${r.customers === 1 ? "customer" : "customers"}`
                    : `${r.label}: ${formatNaira(r.owed)}`,
                )
                .join("; ") || "Nothing outstanding"
            }
          >
            {rows
              .filter((r) => r.share > 0)
              .map((r) => (
                <div
                  key={r.id}
                  style={{ width: `${Math.max(r.share * 100, 1.5)}%`, background: r.hex }}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                />
              ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {rows.map((r) => (
              <div key={r.id}>
                <dt className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: r.hex }}
                    aria-hidden
                  />
                  <span className="text-[11px] text-[color:var(--text-tertiary)]">
                    {r.label}
                  </span>
                </dt>
                {settled ? (
                  <dd className="tnum mt-1 text-[15px] text-[color:var(--text-primary)]">
                    {r.customers}
                    <span className="ml-1 text-[11px] text-[color:var(--text-quaternary)]">
                      {r.customers === 1 ? "customer" : "customers"}
                    </span>
                  </dd>
                ) : (
                  <>
                    <dd className="tnum mt-1 text-[15px] text-[color:var(--text-primary)]">
                      {formatNaira(r.owed)}
                    </dd>
                    <dd className="tnum text-[11px] text-[color:var(--text-quaternary)]">
                      {r.customers} {r.customers === 1 ? "customer" : "customers"}
                    </dd>
                  </>
                )}
              </div>
            ))}
          </dl>
        </div>
      </div>

      {settled ? (
        weakCount > 0 && (
          <div className="border-t border-[color:var(--hairline)] bg-[color:var(--surface-2)]/60 px-5 py-3">
            <p className="text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
              All settled up — but{" "}
              <span className="tnum font-medium text-[color:var(--text-primary)]">
                {weakCount}
              </span>{" "}
              of your {customers.length}{" "}
              {customers.length === 1 ? "customer" : "customers"} rated Fair or
              Poor on repayment history. Keep amounts modest next time.
            </p>
          </div>
        )
      ) : (
        atRisk > 0 && (
          <div className="border-t border-[color:var(--hairline)] bg-[color:var(--surface-2)]/60 px-5 py-3">
            <p className="text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
              <span className="tnum font-medium text-[color:var(--text-primary)]">
                {formatNaira(atRisk)}
              </span>{" "}
              <span className="tnum">({atRiskShare}%)</span> of what you&apos;re
              owed sits with customers rated Fair or Poor.{" "}
              <Link
                href="/dashboard/credits"
                className="text-vodium-gold underline decoration-vodium-gold/30 underline-offset-2 transition-colors hover:decoration-vodium-gold"
              >
                Review those credits
              </Link>
            </p>
          </div>
        )
      )}
    </section>
  );
}

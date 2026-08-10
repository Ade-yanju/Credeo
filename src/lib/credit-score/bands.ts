/**
 * Score bands — the single source of truth for how a 0–1000 Vodium Score is
 * labelled and coloured in the UI.
 *
 * This previously lived inline in the customer profile page while the CSS
 * carried a fourth set of `.score-*` classes, so the same score could read
 * "Fair" in one place and "Building" in another. Import from here instead.
 *
 * Note: `computeScore()`'s own `summary` string in ./score.ts still uses a
 * five-tier wording (Excellent / Good / Building / Risky / High risk) because
 * that text ships to customers over WhatsApp. Changing bot copy is a separate
 * decision from changing dashboard labels, so the two are intentionally not
 * unified here.
 */

export type ScoreBandId = "excellent" | "good" | "fair" | "poor";

export interface ScoreBand {
  id: ScoreBandId;
  label: string;
  /** Inclusive lower bound on the 0–1000 scale. */
  min: number;
  /** Resolved hex — needed for inline SVG stroke and chart fills. */
  hex: string;
  /** Tailwind text colour. */
  text: string;
  /** Tailwind background tint + border for badges and legend swatches. */
  chip: string;
  /** One line a vendor can act on. */
  guidance: string;
}

/** Ordered strongest → weakest. */
export const SCORE_BANDS: readonly ScoreBand[] = [
  {
    id: "excellent",
    label: "Excellent",
    min: 750,
    hex: "#3FB950",
    text: "text-[#56C963]",
    chip: "bg-[#3FB950]/10 text-[#56C963] border-[#3FB950]/25",
    guidance: "Reliable payers. Safe to extend more credit.",
  },
  {
    id: "good",
    label: "Good",
    min: 650,
    hex: "#C9A961",
    text: "text-vodium-gold",
    chip: "bg-vodium-gold/10 text-vodium-gold border-vodium-gold/25",
    guidance: "Solid history. Normal credit limits apply.",
  },
  {
    id: "fair",
    label: "Fair",
    min: 450,
    hex: "#D2A24C",
    text: "text-[#DFB569]",
    chip: "bg-[#D2A24C]/10 text-[#DFB569] border-[#D2A24C]/25",
    guidance: "Thin or mixed history. Keep amounts modest.",
  },
  {
    id: "poor",
    label: "Poor",
    min: 0,
    hex: "#E5534B",
    text: "text-[#F0736B]",
    chip: "bg-[#E5534B]/10 text-[#F0736B] border-[#E5534B]/25",
    guidance: "Has defaulted or paid late repeatedly. Prefer cash.",
  },
] as const;

export const SCORE_MAX = 1000;

/** Resolve a raw score to its band. Always returns a band. */
export function scoreBand(score: number): ScoreBand {
  return (
    SCORE_BANDS.find((b) => score >= b.min) ??
    SCORE_BANDS[SCORE_BANDS.length - 1]
  );
}

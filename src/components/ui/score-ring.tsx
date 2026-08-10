import { scoreBand, SCORE_BANDS, SCORE_MAX } from "@/lib/credit-score/bands";
import { cn } from "@/lib/utils";

/**
 * Vodium Score gauge — a 270° arc, open at the bottom.
 *
 * An arc rather than a full ring because a credit score has a floor and a
 * ceiling, and the open gap makes "how far along the range am I" legible at a
 * glance. Band thresholds are marked on the track so the number has context
 * without needing a legend.
 *
 * Pure SVG and no client JS, so this renders inside a Server Component.
 */

const START_ANGLE = 135; // lower-left, degrees clockwise from 3 o'clock
const SWEEP = 270;

/** Point on the gauge track at progress `f` (0–1). */
function pointAt(f: number, cx: number, cy: number, r: number) {
  const rad = ((START_ANGLE + f * SWEEP) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function ScoreRing({
  score,
  size = 148,
  strokeWidth = 8,
  label = "Vodium Score",
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  /** Screen-reader context. Also used to disambiguate multiple gauges. */
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(SCORE_MAX, Math.round(score)));
  const band = scoreBand(clamped);

  const box = 120;
  const c = box / 2;
  const r = c - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * (SWEEP / 360);
  const progress = clamped / SCORE_MAX;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${box} ${box}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`${label}: ${clamped} out of ${SCORE_MAX}, rated ${band.label}`}
      >
        <g transform={`rotate(${START_ANGLE} ${c} ${c})`}>
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={band.hex}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength * progress} ${circumference}`}
          />
        </g>

        {/* Band thresholds, notched into the track. */}
        {SCORE_BANDS.filter((b) => b.min > 0).map((b) => {
          const f = b.min / SCORE_MAX;
          const inner = pointAt(f, c, c, r - strokeWidth / 2 - 0.5);
          const outer = pointAt(f, c, c, r + strokeWidth / 2 + 0.5);
          return (
            <line
              key={b.id}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--surface-1)"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      <div className="relative text-center">
        <p className={cn("tnum text-[30px] font-medium leading-none", band.text)}>
          {clamped}
        </p>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-quaternary)]">
          of {SCORE_MAX}
        </p>
      </div>
    </div>
  );
}

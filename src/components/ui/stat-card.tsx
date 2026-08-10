"use client";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Metric tile.
 *
 * Deliberately quiet: the number carries the emphasis through size and tabular
 * figures, not through colour. Gold is reserved for interactive affordances, so
 * a tile only takes on a semantic hue when the value genuinely signals state
 * (`tone`), rather than every metric rendering gold.
 *
 * Motion is a single short fade with no per-card stagger — a debt dashboard
 * should be readable the instant it paints.
 *
 * Reduce Motion is honoured globally by MotionProvider, not by branching
 * `initial` here — that branch renders different markup on server and client
 * and breaks hydration. See src/components/motion-provider.tsx.
 */

type Tone = "neutral" | "positive" | "caution" | "negative";

const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-[color:var(--text-primary)]",
  positive: "text-[#56C963]",
  caution: "text-[#DFB569]",
  negative: "text-[#F0736B]",
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
  trendUp,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  tone?: Tone;
  className?: string;
}) {
  const TrendIcon = trendUp ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "surface-card flex flex-col p-4 transition-colors duration-150",
        "hover:border-[color:var(--hairline-strong)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.07em] leading-tight text-[color:var(--text-tertiary)]">
          {label}
        </p>
        {icon && (
          <span className="shrink-0 text-[color:var(--text-quaternary)]" aria-hidden>
            {icon}
          </span>
        )}
      </div>

      <p className={cn("tnum mt-3 text-[26px] font-medium leading-none", TONE_VALUE[tone])}>
        {value}
      </p>

      {sub && (
        <p className="mt-1.5 text-[12px] leading-snug text-[color:var(--text-tertiary)]">
          {sub}
        </p>
      )}

      {trend && (
        <div
          className={cn(
            "mt-auto flex items-center gap-1 pt-3 text-[12px]",
            trendUp ? "text-[#56C963]" : "text-[#F0736B]",
          )}
        >
          <TrendIcon size={13} aria-hidden />
          <span>{trend}</span>
        </div>
      )}
    </motion.div>
  );
}

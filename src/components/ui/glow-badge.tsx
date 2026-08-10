import { cn } from "@/lib/utils";

/**
 * Status pill.
 *
 * Named GlowBadge for continuity with its call sites (8 files), but the glow is
 * gone: a coloured box-shadow on every status made routine information read as
 * an alert. Flat tint plus a hairline is enough to separate states, and it
 * keeps overdue — where we *do* want the eye to land — actually distinct.
 */
export function GlowBadge({
  children,
  color = "gold",
  className,
}: {
  children: React.ReactNode;
  color?: "gold" | "green" | "red" | "amber" | "blue" | "neutral";
  className?: string;
}) {
  const colors = {
    gold: "bg-vodium-gold/10 text-vodium-gold border-vodium-gold/25",
    green: "bg-[#3FB950]/10 text-[#56C963] border-[#3FB950]/25",
    red: "bg-[#E5534B]/10 text-[#F0736B] border-[#E5534B]/25",
    amber: "bg-[#D2A24C]/10 text-[#DFB569] border-[#D2A24C]/25",
    blue: "bg-[#4C8EDA]/10 text-[#79B0EC] border-[#4C8EDA]/25",
    neutral: "bg-[#6E7681]/12 text-[#9BA3AE] border-[#6E7681]/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

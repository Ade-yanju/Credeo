import { cn } from "@/lib/utils";

/**
 * Content card on the marketing surface.
 *
 * The cursor-following radial gradient is gone. It was a per-card mousemove
 * listener driving a React state update on every pointer event — a measurable
 * cost across a grid of nine cards, spent on an effect that says "look what
 * this page can do" rather than making anything easier to read.
 *
 * Now a static surface with a hairline that warms slightly on hover, matching
 * the dashboard's `.surface-card`. Dropping the mousemove handler also lets
 * this be a server component: the "use client" directive and the useState /
 * useRef / useCallback imports are no longer needed.
 *
 * `gradientColor` is retained as an accepted-and-ignored prop so the existing
 * call sites in about/blog/careers keep type-checking.
 */
export function MagicCard({
  children,
  className,
  gradientColor: _gradientColor,
}: {
  children: React.ReactNode;
  className?: string;
  gradientColor?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-1)]",
        "transition-colors duration-150 hover:border-[color:var(--hairline-strong)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * Emphasised card — used for the pricing tier a vendor should pick and for the
 * highlighted panel in dashboard settings.
 *
 * The gold gradient that bloomed around the edge on hover has been replaced by
 * a persistent gold-tinted hairline. Emphasis that only appears on hover is
 * invisible on touch, where most vendors are, so the card that matters now
 * looks different at rest instead of rewarding a mouse.
 */
export function AnimatedBorder({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <div className={cn("relative", containerClassName)}>
      <div
        className={cn(
          "relative rounded-xl border border-vodium-gold/25 bg-[color:var(--surface-1)]",
          "transition-colors duration-150 hover:border-vodium-gold/40",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

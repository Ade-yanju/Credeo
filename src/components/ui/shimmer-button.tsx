"use client";
import { cn } from "@/lib/utils";

/**
 * Primary call-to-action.
 *
 * Kept the name for continuity with its call sites, but the shimmer sweep and
 * the 30px gold bloom are gone — a sweep animation on the button that starts a
 * credit application reads as promotional, not dependable. What's left is a
 * solid gold button with a brightness shift and a small press.
 *
 * `disabled` is a real attribute rather than the `opacity-40 pointer-events-none`
 * the register wizard was using: that pattern still exposes the button to
 * keyboard focus and Enter, so a disabled "Continue" could be activated by
 * tabbing to it and skip a validation gate.
 */
export function ShimmerButton({
  children,
  className,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-lg px-6 text-[14px] font-semibold",
        "bg-vodium-gold text-vodium-black",
        "transition-[filter,transform] duration-100",
        "hover:brightness-[1.06] active:scale-[0.99]",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

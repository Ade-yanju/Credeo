"use client";

import { MotionConfig } from "framer-motion";

/**
 * Applies the reader's Reduce Motion preference to every `motion` component.
 *
 * This has to be a provider rather than a `useReducedMotion()` check inside
 * each component. That hook returns `null` on the server, but on the client it
 * reads `matchMedia("(prefers-reduced-motion)")` synchronously during the first
 * render — so branching rendered markup on it, as in
 * `initial={reduce ? false : { opacity: 0, y: 8 }}`, emits one tree on the
 * server and a different one on the client for anyone with Reduce Motion
 * enabled. React reports that as a hydration failure.
 *
 * `reducedMotion="user"` resolves the preference when the animation actually
 * runs, which is after mount: positional keys (x/y) snap straight to their
 * target while opacity still fades. The server and client render identical
 * HTML, so hydration matches for everyone.
 *
 * It lives at the root so any future `motion` component inherits the behaviour
 * instead of having to re-derive it — and re-introduce the same bug.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

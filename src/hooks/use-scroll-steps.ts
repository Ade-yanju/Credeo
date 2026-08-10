"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Tracks which of a vertical run of blocks is currently at the middle of the
 * viewport, so a sticky companion element can follow along as the reader
 * scrolls.
 *
 * Uses a **zero-height** intersection band (`-50%` top and bottom collapses the
 * root to a line across the viewport's middle) rather than a thick band. With a
 * thick band several blocks can intersect at once and you have to guess which
 * one the reader means; ranking them by `intersectionRatio` gets it backwards,
 * because that ratio is a fraction of the *target*, so a short block sitting
 * fully inside the band outranks the tall block the reader is actually looking
 * at. A line can only be crossed by one block at a time, so there is nothing to
 * rank and nothing to flicker between.
 *
 * In the gaps between blocks nothing intersects and no callback fires, so the
 * last crossed block stays active — which is what you want: the companion holds
 * its content until the next block actually arrives.
 *
 * Scroll position is sampled by the browser rather than by a scroll handler, so
 * there is no per-frame work on the main thread. That matters on the mid-range
 * Android hardware this product targets.
 */
export function useScrollSteps(count: number) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Stays false until the observer is actually wired up, so a browser without
  // IntersectionObserver renders every step at full strength instead of
  // permanently dimming all but the first.
  const [enabled, setEnabled] = useState(false);

  const nodesRef = useRef<(HTMLElement | null)[]>([]);

  // One stable callback per index. Inlining `(el) => …` in the JSX would hand
  // React a new function identity on every render, making it detach and
  // reattach every ref each time state changes — and this hook changes state
  // on scroll.
  const refCallbacks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => (el: HTMLElement | null) => {
        nodesRef.current[i] = el;
      }),
    [count],
  );

  const registerStep = useCallback(
    (index: number) => refCallbacks[index],
    [refCallbacks],
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    setEnabled(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = nodesRef.current.indexOf(entry.target as HTMLElement);
          if (index !== -1) setActiveIndex(index);
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );

    const nodes = nodesRef.current.filter(Boolean) as HTMLElement[];
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [count]);

  return { activeIndex, registerStep, enabled };
}

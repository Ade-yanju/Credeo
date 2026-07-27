"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Gold progress bar shown during page-to-page navigation.
 * Listens for link clicks to start, and resets when the pathname changes.
 */
export function NavProgress() {
  const [visible, setVisible] = useState(false);
  const [pct,     setPct]     = useState(0);
  const pathname   = usePathname();
  const prevPath   = useRef(pathname);
  const ticker     = useRef<ReturnType<typeof setInterval>>();

  function start() {
    clearInterval(ticker.current);
    setVisible(true);
    setPct(8);
    let w = 8;
    ticker.current = setInterval(() => {
      w = Math.min(w + (Math.random() * 6 + 1), 88);
      setPct(w);
    }, 250);
  }

  function finish() {
    clearInterval(ticker.current);
    setPct(100);
    setTimeout(() => { setVisible(false); setPct(0); }, 350);
  }

  // Start on any same-origin link click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as Element).closest("a");
      if (!a) return;
      try {
        const url = new URL(a.href, location.href);
        if (url.origin === location.origin && url.pathname !== location.pathname && !a.target) {
          start();
        }
      } catch {}
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Finish when pathname changes (page finished loading)
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      finish();
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 z-[200] h-[2.5px] transition-[width] duration-300 ease-out pointer-events-none"
      style={{
        top: "env(safe-area-inset-top, 0px)",
        width: `${pct}%`,
        background: "linear-gradient(90deg, #C9A961 0%, #E8C97A 60%, #C9A961 100%)",
        boxShadow: "0 0 10px rgba(201,169,97,0.6), 0 0 4px rgba(201,169,97,0.4)",
      }}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/**
 * Marketing site navigation.
 *
 * Previously hand-rolled in seven places (the landing page plus about, blog,
 * careers, whatsapp, privacy, terms), which had already drifted: the four
 * content pages used a fixed dark bar at h-16, while privacy and terms used a
 * sticky white bar at h-14 with a different logo size. One component now backs
 * all of them.
 *
 * Section links (#how-it-works etc.) only resolve on the landing page, so they
 * are rendered as absolute "/#id" hrefs and can be suppressed entirely with
 * `sections={false}` on pages where jumping home mid-read would be jarring.
 */

const SECTIONS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
];

export function SiteNav({ sections = true }: { sections?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The bar is transparent over the hero and gains a hairline once you scroll,
  // so the top of the page reads as one surface rather than a stack of bands.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer on Escape — it traps nothing, but leaving it open after a
  // route change or a stray tap is the kind of small breakage that reads cheap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 px-safe pt-safe transition-colors duration-200 ${
        scrolled
          ? "border-b border-[color:var(--hairline)] bg-[color:var(--surface-0)]/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-vodium-gold/30 bg-[color:var(--surface-2)]">
            <span className="font-serif text-[15px] leading-none text-vodium-gold">V</span>
          </span>
          <span className="font-serif text-[13px] tracking-[0.16em] text-[color:var(--text-primary)]">
            VODIUM LEDGER
          </span>
        </Link>

        {sections && (
          <div className="hidden items-center gap-7 text-[13px] md:flex">
            {SECTIONS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                className="text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
              >
                {s.label}
              </a>
            ))}
          </div>
        )}

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            className="text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
          >
            Sign in
          </Link>
          <Link href="/register" className="btn-gold rounded-lg px-4 py-2 text-[13px]">
            Get started
          </Link>
        </div>

        <button
          className="-mr-1 p-2 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Plain conditional render rather than an animated height collapse —
          a nav that takes 220ms to reveal three links is slower than useful. */}
      {open && (
        <div className="border-t border-[color:var(--hairline)] bg-[color:var(--surface-0)] md:hidden">
          <div className="flex flex-col px-6 py-4 text-[14px]">
            {sections &&
              SECTIONS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="py-2.5 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                >
                  {s.label}
                </a>
              ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-[color:var(--hairline)] pt-4">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="btn-gold rounded-lg px-5 py-2.5 text-center text-[14px]"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

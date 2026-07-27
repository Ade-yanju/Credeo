"use client";

/**
 * Install prompt banner — "for easy accessibility, install".
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`; we stash the event and show
 * our own branded banner with a real Install button. iOS never fires it, so
 * Safari users get a one-line Add-to-Home-Screen hint instead. Dismissing
 * either variant is remembered for 14 days — a banner that reappears on every
 * visit trains people to ignore it.
 */

import { useEffect, useState } from "react";
import Image from "next/image";

const DISMISSED_KEY = "vodium-install-dismissed-at";
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
    return Date.now() - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — offer the manual path.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = isIos ? window.setTimeout(() => setShowIosHint(true), 4000) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const visible = Boolean(installEvent) || showIosHint;
  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* private mode — banner just won't be remembered */
    }
    setInstallEvent(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "dismissed") dismiss();
    else setInstallEvent(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Install Vodium Ledger"
      className="fixed z-[90] inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm rounded-2xl border border-vodium-gold/30 bg-vodium-black text-vodium-cream shadow-2xl p-4 flex items-center gap-3"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <Image
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="rounded-xl shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm leading-snug">
          For easy access, install Vodium Ledger
        </p>
        <p className="text-xs text-vodium-cream/60 mt-0.5 leading-snug">
          {installEvent
            ? "Opens in one tap from your home screen — no app store needed."
            : "Tap the Share button, then “Add to Home Screen”."}
        </p>
      </div>
      {installEvent && (
        <button
          onClick={install}
          className="shrink-0 rounded-lg bg-vodium-gold text-vodium-black text-sm font-semibold px-3.5 py-2 hover:opacity-90 transition"
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 -mr-1 p-1.5 text-vodium-cream/50 hover:text-vodium-cream transition"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

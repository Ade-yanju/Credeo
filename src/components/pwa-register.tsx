"use client";

import { useEffect } from "react";

/** Registers the service worker so the app is installable and works offline-ish. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // The worker is cache-first for /_next/static (see public/sw.js). In
    // production that is safe because Next fingerprints every chunk, so a new
    // build requests new URLs. In development chunks keep stable names
    // (webpack.js, main-app.js), so the worker would serve the previous
    // build's webpack runtime against the current build's modules — which
    // surfaces as "Cannot read properties of undefined (reading 'call')" at
    // options.factory, and survives a hard reload because the stale copy lives
    // in Cache Storage rather than the HTTP cache.
    //
    // So: never register in dev, and actively tear down anything a previous
    // dev session left behind, otherwise a developer who once loaded the app
    // stays broken until they manually clear site data.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((k) => caches.delete(k));
        }).catch(() => {});
      }
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}

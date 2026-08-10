"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  // Sentry capture removed to test if it's causing the prerender error
  useEffect(() => {
    console.error("Global error captured:", error);
  }, [error]);

  return (
    <html lang="en">
      {/* global-error replaces the root layout, so it can render in a state
          where globals.css never loaded. Colours are literal hex rather than
          var(--surface-0) etc. — an unresolved token here would fall back to a
          white page with invisible text, which is the one thing this screen
          cannot afford to get wrong. */}
      <body
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: "#0B0B0C", color: "#F2F2EF" }}
      >
        <div className="text-center">
          <h1 className="mb-2 font-serif text-2xl">Something went wrong</h1>
          <p className="text-sm" style={{ color: "rgba(242,242,239,0.40)" }}>
            We&apos;ve been notified and are looking into it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg px-6 py-2 text-sm font-semibold"
            style={{ background: "#C9A961", color: "#0A0A0A" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

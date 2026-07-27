"use client";

import { useState, useEffect } from "react";
import { X, Star } from "lucide-react";

const SHOW_AFTER_MS = 60_000; // show 1 minute after dashboard mount

export function NpsWidget() {
  const [visible,   setVisible]   = useState(false);
  const [score,     setScore]     = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [comment,   setComment]   = useState("");
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    // Ask the server whether we should show the widget.
    // Dismiss state lives in a httpOnly cookie — not localStorage.
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch("/api/user/nps-status", { credentials: "same-origin" });
        if (!res.ok) return;
        const { show } = await res.json() as { show: boolean };
        if (!show || cancelled) return;

        const timer = setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, SHOW_AFTER_MS);

        return () => clearTimeout(timer);
      } catch {
        // Network error — silently skip the widget
      }
    }

    const cleanup = checkStatus();
    return () => {
      cancelled = true;
      cleanup?.then((fn) => fn?.());
    };
  }, []);

  async function dismiss() {
    setVisible(false);
    try {
      await fetch("/api/user/nps-dismiss", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({}),
      });
    } catch { /* fire-and-forget — server sets cookie, nothing to do on error */ }
  }

  async function handleSubmit() {
    if (score === null || loading) return;
    setLoading(true);
    try {
      await fetch("/api/user/nps-dismiss", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ score, comment: comment.trim() || undefined }),
      });
      setSubmitted(true);
      setTimeout(() => setVisible(false), 3000);
    } catch {
      // Submit failed — just close the widget gracefully
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)] bg-vodium-charcoal border border-white/[0.10] rounded-2xl shadow-2xl shadow-black/60 p-5 animate-fade-up"
      style={{ bottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))" }}
    >
      <button
        onClick={dismiss}
        className="absolute top-3.5 right-3.5 text-vodium-cream/30 hover:text-vodium-cream/70 transition-colors"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>

      {submitted ? (
        <div className="text-center py-3">
          <Star size={28} className="text-vodium-gold mx-auto mb-3 fill-vodium-gold" />
          <p className="font-serif text-lg text-vodium-cream mb-1">Thank you!</p>
          <p className="text-xs text-vodium-cream/40">Your feedback helps us improve Vodium Ledger.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-vodium-gold font-semibold tracking-widest uppercase mb-1">Quick feedback</p>
          <p className="text-sm text-vodium-cream font-medium mb-1">How likely are you to recommend Vodium to another vendor?</p>
          <p className="text-[11px] text-vodium-cream/35 mb-4">0 = not at all, 10 = definitely</p>

          {/* Score selector */}
          <div className="flex gap-1 mb-4 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                  score === i
                    ? "bg-vodium-gold border-vodium-gold text-vodium-black"
                    : "border-white/[0.10] text-vodium-cream/40 hover:border-vodium-gold/40 hover:text-vodium-cream/70"
                }`}
              >
                {i}
              </button>
            ))}
          </div>

          {/* Optional comment */}
          {score !== null && (
            <textarea
              placeholder="What could we do better? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={300}
              className="w-full bg-black/20 border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-vodium-cream placeholder:text-vodium-cream/25 resize-none outline-none focus:border-vodium-gold/30 mb-3"
            />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={score === null || loading}
              className="flex-1 btn-gold py-2.5 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Sending…" : "Submit"}
            </button>
            <button
              onClick={dismiss}
              className="text-xs text-vodium-cream/30 hover:text-vodium-cream/60 transition-colors"
            >
              Skip
            </button>
          </div>
        </>
      )}
    </div>
  );
}

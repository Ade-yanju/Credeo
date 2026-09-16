"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal, Eye, Ban, CheckCircle2, Trash2,
  Loader2, AlertTriangle, X,
} from "lucide-react";
import type { VendorStatus } from "@prisma/client";

interface Props {
  vendorId:      string;
  businessName:  string;
  currentStatus: VendorStatus;
}

export function VendorRowMenu({ vendorId, businessName, currentStatus }: Props) {
  const router = useRouter();
  const [open,       setOpen]       = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [loading,    setLoading]    = useState<"suspend" | "reactivate" | "delete" | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSuspended = currentStatus === "SUSPENDED";

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleStatus(newStatus: "SUSPENDED" | "ACTIVE") {
    const action = newStatus === "SUSPENDED" ? "suspend" : "reactivate";
    setOpen(false);
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.refresh();
      setShowDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={loading !== null}
          className="w-7 h-7 rounded-lg border border-white/[0.06] flex items-center justify-center text-vodium-cream/30 hover:text-vodium-gold hover:border-vodium-gold/30 transition-colors disabled:opacity-40"
        >
          {loading !== null ? <Loader2 size={13} className="animate-spin" /> : <MoreHorizontal size={14} />}
        </button>

        {open && (
          <div className="absolute right-0 top-9 z-50 w-44 bg-vodium-charcoal border border-white/[0.10] rounded-xl shadow-2xl overflow-hidden">
            {/* View details */}
            <a
              href={`/admin/vendors/${vendorId}`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-vodium-cream/70 hover:text-vodium-cream hover:bg-white/[0.04] transition-colors"
              onClick={() => setOpen(false)}
            >
              <Eye size={13} className="text-vodium-gold" /> View details
            </a>

            <div className="border-t border-white/[0.06] my-1" />

            {/* Suspend / Reactivate */}
            {isSuspended ? (
              <button
                onClick={() => handleStatus("ACTIVE")}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/[0.08] transition-colors"
              >
                <CheckCircle2 size={13} /> Reactivate
              </button>
            ) : (
              <button
                onClick={() => handleStatus("SUSPENDED")}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-500/[0.08] transition-colors"
              >
                <Ban size={13} /> Suspend
              </button>
            )}

            <div className="border-t border-white/[0.06] my-1" />

            {/* Delete */}
            <button
              onClick={() => { setOpen(false); setShowDelete(true); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/[0.08] transition-colors"
            >
              <Trash2 size={13} /> Close account
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="fixed bottom-4 right-4 z-50 bg-rose-900/90 text-rose-200 text-xs px-4 py-2.5 rounded-xl border border-rose-500/30 shadow-lg max-w-xs">
          {error}
        </p>
      )}

      {/* Delete confirmation modal */}
      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && loading !== "delete") setShowDelete(false); }}
        >
          <div className="w-full max-w-sm bg-vodium-charcoal border border-white/[0.08] rounded-2xl shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-rose-400" />
                </div>
                <div>
                  <p className="font-serif text-vodium-cream text-base">Close vendor account</p>
                  <p className="text-vodium-cream/45 text-sm mt-1 leading-relaxed">
                    This closes{" "}
                    <span className="text-vodium-cream font-semibold">{businessName}</span> and all
                    access immediately. Records are retained for 90 days for fraud, financial, or legal review, then securely purged.
                  </p>
                </div>
                <button
                  onClick={() => { if (loading !== "delete") setShowDelete(false); }}
                  className="text-vodium-cream/30 hover:text-vodium-cream/70 flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 mb-4">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDelete(false)}
                  disabled={loading === "delete"}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-white/[0.08] text-vodium-cream/50 hover:text-vodium-cream/80 hover:border-white/[0.15] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading === "delete"}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === "delete"
                    ? <><Loader2 size={14} className="animate-spin" /> Closing…</>
                    : <><Trash2 size={14} /> Close account</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

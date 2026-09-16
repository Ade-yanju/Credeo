"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import type { VendorStatus } from "@prisma/client";

interface Props {
  vendorId:     string;
  currentStatus: VendorStatus;
  businessName: string;
}

export function VendorStatusActions({ vendorId, currentStatus, businessName }: Props) {
  const router = useRouter();
  const [loading,   setLoading]   = useState<"suspend" | "reactivate" | "delete" | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const isSuspended = currentStatus === "SUSPENDED";

  async function handleStatus(newStatus: "SUSPENDED" | "ACTIVE") {
    const action = newStatus === "SUSPENDED" ? "suspend" : "reactivate";
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
      router.push("/admin/vendors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Suspend / Reactivate */}
        {isSuspended ? (
          <button
            onClick={() => handleStatus("ACTIVE")}
            disabled={loading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {loading === "reactivate" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Reactivate
          </button>
        ) : (
          <button
            onClick={() => handleStatus("SUSPENDED")}
            disabled={loading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            {loading === "suspend" ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            Suspend
          </button>
        )}

        {/* Close account */}
        <button
          onClick={() => setShowDelete(true)}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} /> Close account
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-400 mt-2 text-right">{error}</p>
      )}

      {/* Delete confirmation modal */}
      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDelete(false); }}
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
                    This closes <span className="text-vodium-cream font-semibold">{businessName}</span> immediately. Their records are retained for 90 days for fraud, financial, or legal review, then securely purged.
                  </p>
                </div>
                <button onClick={() => setShowDelete(false)} className="text-vodium-cream/30 hover:text-vodium-cream/70 flex-shrink-0">
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
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-white/[0.08] text-vodium-cream/50 hover:text-vodium-cream/80 hover:border-white/[0.15] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading === "delete"}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Close account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

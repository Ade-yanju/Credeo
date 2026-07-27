"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Building2,
  Loader2,
  ExternalLink,
  RefreshCw,
  BellRing,
} from "lucide-react";

interface VendorRow {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  status: string;
  vendorType: string;
  createdAt: string;
  community: { name: string; shortName: string | null };
  subscription: { status: string; plan: string } | null;
  _count: { credits: number };
  overdueCount: number;
  totalOwed: number;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  SUSPENDED: "text-rose-400    bg-rose-500/10    border-rose-500/20",
  INACTIVE: "text-vodium-cream/30 bg-white/[0.04] border-white/[0.07]",
};

const SUB_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export default function SupportPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "issues" | "suspended" | "recent"
  >("all");
  const [stats, setStats] = useState({
    total: 0,
    suspended: 0,
    withOverdue: 0,
    newThisWeek: 0,
  });

  const [blasting, setBlasting] = useState(false);
  const [blastResult, setBlastResult] = useState<string | null>(null);

  // Customer care's manual lever: re-send WhatsApp reminders to every overdue
  // customer right now, ignoring the 3-day repeat interval.
  const blastReminders = async () => {
    if (blasting) return;
    if (!window.confirm("Send a WhatsApp reminder to EVERY customer with an overdue credit now?")) return;
    setBlasting(true);
    setBlastResult(null);
    try {
      const res = await fetch("/api/admin/blast-reminders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBlastResult(data.error ?? "Blast failed — try again shortly.");
      } else {
        setBlastResult(
          `Sent ${data.sent} reminder${data.sent === 1 ? "" : "s"}` +
          (data.failed ? `, ${data.failed} failed` : "") +
          (data.skipped ? `, ${data.skipped} skipped (vendor opted out)` : "") +
          (data.sent === 0 && !data.failed ? " — no overdue customers to remind" : "") + ".",
        );
      }
    } catch {
      setBlastResult("Network error — the blast may not have gone out.");
    } finally {
      setBlasting(false);
      setTimeout(() => setBlastResult(null), 12000);
    }
  };

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/support/vendors");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      v.businessName.toLowerCase().includes(q) ||
      v.ownerName.toLowerCase().includes(q) ||
      v.phone.includes(q) ||
      v.email.toLowerCase().includes(q) ||
      (v.community.shortName ?? v.community.name).toLowerCase().includes(q);

    const matchFilter =
      filter === "all"
        ? true
        : filter === "issues"
          ? v.overdueCount > 0 || v.status !== "ACTIVE"
          : filter === "suspended"
            ? v.status === "SUSPENDED"
            : filter === "recent"
              ? new Date(v.createdAt) > new Date(Date.now() - 7 * 86400000)
              : true;

    return matchSearch && matchFilter;
  });

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-vodium-gold text-xs tracking-[0.35em] uppercase mb-1.5">
            Customer Care
          </p>
          <h1 className="font-serif text-2xl md:text-3xl text-vodium-cream">
            Support Centre
          </h1>
          <p className="text-vodium-cream/35 text-sm mt-1">
            Search and assist vendors across all communities
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={blastReminders}
            disabled={blasting}
            className="flex items-center gap-2 rounded-lg bg-vodium-gold/15 border border-vodium-gold/30 text-vodium-gold text-xs font-semibold px-3 py-2 hover:bg-vodium-gold/25 transition disabled:opacity-50"
            title="Re-send WhatsApp reminders to all overdue customers now"
          >
            {blasting ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
            <span className="hidden sm:inline">{blasting ? "Sending…" : "Remind all overdue"}</span>
          </button>
          <button
            onClick={loadVendors}
            className="text-vodium-cream/30 hover:text-vodium-cream/70 transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {blastResult && (
        <div className="rounded-lg px-3 py-2 text-xs bg-vodium-gold/10 border border-vodium-gold/25 text-vodium-gold">
          {blastResult}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total vendors",
            value: stats.total,
            color: "text-vodium-gold",
          },
          {
            label: "Suspended",
            value: stats.suspended,
            color:
              stats.suspended > 0 ? "text-rose-400" : "text-vodium-cream/30",
          },
          {
            label: "With overdue",
            value: stats.withOverdue,
            color:
              stats.withOverdue > 0 ? "text-amber-400" : "text-vodium-cream/30",
          },
          {
            label: "New this week",
            value: stats.newThisWeek,
            color: "text-emerald-400",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-vodium-charcoal border border-white/[0.06] rounded-xl p-4"
          >
            <p className="text-vodium-cream/40 text-xs">{k.label}</p>
            <p className={`font-serif text-2xl mt-1.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="bg-vodium-charcoal border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-vodium-cream/30 pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, community..."
              className="w-full bg-black/30 border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-vodium-cream placeholder:text-vodium-cream/20 focus:outline-none focus:border-vodium-gold/40 transition"
            />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {(["all", "issues", "suspended", "recent"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? "bg-vodium-gold/15 text-vodium-gold border border-vodium-gold/25" : "border border-white/[0.08] text-vodium-cream/40 hover:text-vodium-cream/70"}`}
              >
                {f === "issues" ? "⚠ Issues" : f}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="hidden lg:grid grid-cols-12 px-5 py-2.5 bg-black/20 text-[10px] font-medium text-vodium-cream/25 uppercase tracking-wider">
          <span className="col-span-3">Vendor</span>
          <span className="col-span-2">Contact</span>
          <span className="col-span-2">Community</span>
          <span className="col-span-1 text-center">Credits</span>
          <span className="col-span-1 text-center">Overdue</span>
          <span className="col-span-1 text-center">Status</span>
          <span className="col-span-1 text-center">Sub</span>
          <span className="col-span-1 text-center">Details</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="text-vodium-gold animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-vodium-cream/25 text-sm">
            {search || filter !== "all"
              ? "No vendors match your search."
              : "No vendors registered yet."}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filtered.map((v) => {
              const isIssue = v.overdueCount > 0 || v.status !== "ACTIVE";
              return (
                <div
                  key={v.id}
                  className={`lg:grid grid-cols-12 items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${isIssue ? "bg-rose-500/[0.02]" : ""}`}
                >
                  {/* Vendor */}
                  <div className="col-span-3 flex items-center gap-2.5 mb-2 lg:mb-0">
                    <div className="w-8 h-8 rounded-lg bg-vodium-gold/10 border border-vodium-gold/15 flex items-center justify-center flex-shrink-0">
                      <span className="font-serif text-vodium-gold text-sm">
                        {v.businessName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-vodium-cream truncate">
                        {v.businessName}
                      </p>
                      <p className="text-xs text-vodium-cream/35 mt-0.5">
                        {v.ownerName}
                      </p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="col-span-2 space-y-1 mb-1 lg:mb-0">
                    <a
                      href={`tel:${v.phone}`}
                      className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      <Phone size={10} /> {v.phone}
                    </a>
                    <a
                      href={`mailto:${v.email}`}
                      className="flex items-center gap-1.5 text-xs text-vodium-cream/40 hover:text-vodium-cream/70 transition-colors truncate"
                    >
                      <Mail size={10} />{" "}
                      <span className="truncate">{v.email}</span>
                    </a>
                  </div>

                  {/* Community */}
                  <div className="col-span-2 mb-1 lg:mb-0">
                    <div className="flex items-center gap-1.5 text-xs text-vodium-cream/50">
                      <Building2 size={11} className="flex-shrink-0" />
                      <span className="truncate">
                        {v.community.shortName ??
                          v.community.name.split(" ").slice(0, 2).join(" ")}
                      </span>
                    </div>
                    <p className="text-[10px] text-vodium-cream/25 mt-0.5 ml-4">
                      {new Date(v.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Credits */}
                  <div className="col-span-1 text-center">
                    <p className="text-sm text-vodium-cream/60">
                      {v._count.credits}
                    </p>
                  </div>

                  {/* Overdue */}
                  <div className="col-span-1 text-center">
                    {v.overdueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-400">
                        <AlertCircle size={11} /> {v.overdueCount}
                      </span>
                    ) : (
                      <CheckCircle2
                        size={13}
                        className="text-vodium-cream/20 mx-auto"
                      />
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-1 flex justify-center">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[v.status] ?? ""}`}
                    >
                      {v.status}
                    </span>
                  </div>

                  {/* Sub */}
                  <div className="col-span-1 flex justify-center">
                    {v.subscription ? (
                      <span
                        className={`text-[10px] ${v.subscription.status === "ACTIVE" ? "text-emerald-400" : v.subscription.status === "TRIAL" ? "text-amber-400" : "text-vodium-cream/30"}`}
                      >
                        {SUB_LABELS[v.subscription.status] ??
                          v.subscription.status}
                      </span>
                    ) : (
                      <span className="text-vodium-cream/20 text-[10px]">
                        :
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-center gap-2">
                    <a
                      href={`/admin/vendors/${v.id}`}
                      className="w-7 h-7 rounded-lg border border-white/[0.06] flex items-center justify-center text-vodium-cream/30 hover:text-vodium-gold hover:border-vodium-gold/30 transition-colors"
                      title="View details"
                    >
                      <ExternalLink size={12} />
                    </a>
                    <a
                      href={`tel:${v.phone}`}
                      className="w-7 h-7 rounded-lg border border-white/[0.06] flex items-center justify-center text-vodium-cream/30 hover:text-sky-400 hover:border-sky-400/30 transition-colors"
                      title="Call vendor"
                    >
                      <Phone size={12} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && (
          <div className="px-5 py-3 border-t border-white/[0.05] text-xs text-vodium-cream/25">
            Showing {filtered.length} of {vendors.length} vendors
            {search && <span> · filtered by &ldquo;{search}&rdquo;</span>}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type OutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";
type OutboxKind = "TEMPLATE" | "DOCUMENT_TEMPLATE";

interface OutboxMessage {
  id: string;
  recipient: string;
  kind: OutboxKind;
  templateName: string | null;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  availableAt: string;
  createdAt: string;
  sentAt: string | null;
}

interface OutboxResponse {
  counts: Record<Lowercase<OutboxStatus>, number>;
  recent: OutboxMessage[];
}

const STATUS_META: Record<OutboxStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
  PROCESSING: { label: "Processing", className: "text-sky-300 bg-sky-400/10 border-sky-400/20" },
  SENT: { label: "Sent", className: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
  FAILED: { label: "Failed", className: "text-rose-300 bg-rose-400/10 border-rose-400/20" },
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function maskRecipient(value: string): string {
  if (value.length <= 4) return value;
  return `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function StatusPill({ status }: { status: OutboxStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-vodium-charcoal/60 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-vodium-cream/40">{label}</p>
        <Icon size={16} className={tone} />
      </div>
      <p className="mt-3 text-2xl font-semibold text-vodium-cream">{value.toLocaleString()}</p>
    </div>
  );
}

export function WhatsAppOutboxPanel() {
  const [data, setData] = useState<OutboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/whatsapp-outbox", { cache: "no-store" });
      const body = (await response.json()) as OutboxResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load WhatsApp outbox");
      setData(body);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load WhatsApp outbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function retry(id: string) {
    setRetryingId(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/whatsapp-outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok || !body.ok) throw new Error(body.error || "Retry failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  const counts = data?.counts ?? { pending: 0, processing: 0, sent: 0, failed: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-vodium-cream/35">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Refreshes every 30 seconds{updatedAt ? ` · updated ${formatDate(updatedAt.toISOString())}` : ""}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.10] px-3 py-2 text-sm text-vodium-cream/70 transition hover:border-vodium-gold/30 hover:text-vodium-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Pending" value={counts.pending} icon={Clock3} tone="text-amber-300" />
        <MetricCard label="Processing" value={counts.processing} icon={Loader2} tone="text-sky-300" />
        <MetricCard label="Sent" value={counts.sent} icon={CheckCircle2} tone="text-emerald-300" />
        <MetricCard label="Failed" value={counts.failed} icon={AlertTriangle} tone="text-rose-300" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-vodium-charcoal/40">
        <div className="flex flex-col gap-2 border-b border-white/[0.06] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-vodium-cream">
              <MessageSquare size={16} className="text-vodium-gold" /> Recent WhatsApp messages
            </h2>
            <p className="mt-1 text-xs text-vodium-cream/35">The latest 50 queued template and document-template deliveries.</p>
          </div>
          <span className="text-xs text-vodium-cream/35">Failures can be retried after checking the error.</span>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-vodium-cream/45">
            <Loader2 size={16} className="animate-spin" /> Loading outbox…
          </div>
        ) : data?.recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.14em] text-vodium-cream/30">
                <tr>
                  <th className="px-5 py-3 font-medium">Message</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Attempts</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.recent.map((message) => (
                  <tr key={message.id} className="align-top hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="font-medium text-vodium-cream/85">{message.templateName || "WhatsApp template"}</div>
                      <div className="mt-1 text-xs text-vodium-cream/35">
                        {maskRecipient(message.recipient)} · {message.kind === "DOCUMENT_TEMPLATE" ? "Document template" : "Template"}
                      </div>
                      {message.lastError && (
                        <div className="mt-2 max-w-[420px] truncate text-xs text-rose-300/75" title={message.lastError}>
                          {message.lastError}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4"><StatusPill status={message.status} /></td>
                    <td className="px-5 py-4 text-vodium-cream/60">{message.attempts}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-vodium-cream/45">{formatDate(message.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      {message.status === "FAILED" ? (
                        <button
                          type="button"
                          onClick={() => void retry(message.id)}
                          disabled={retryingId === message.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-vodium-gold/25 px-2.5 py-1.5 text-xs font-medium text-vodium-gold transition hover:bg-vodium-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {retryingId === message.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          Retry
                        </button>
                      ) : (
                        <span className="text-xs text-vodium-cream/25">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <Send size={22} className="text-vodium-gold/60" />
            <p className="mt-3 text-sm text-vodium-cream/65">No WhatsApp messages in the outbox yet.</p>
            <p className="mt-1 text-xs text-vodium-cream/35">Scheduled template deliveries will appear here when they are queued.</p>
          </div>
        )}
      </section>
    </div>
  );
}

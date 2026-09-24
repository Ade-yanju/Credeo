"use client";

import { Fragment, useMemo, useState } from "react";
import { Check, Copy, Download, Loader2, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { formatNaira } from "@/lib/utils";

export type BnplBranch = { id: string; name: string; code: string };

export type BnplOrderRow = {
  id: string;
  orderNumber: string;
  studentName: string;
  branchName: string;
  status: string;
  totalAmount: number;
  outstanding: number;
  dueDate: string;
  scheduleCount: number;
  canRepay: boolean;
  consentAccepted: boolean;
  consentPath: string;
  customerScore?: number;
};

type ItemDraft = { name: string; quantity: number; unitPrice: number };
type ScheduleDraft = { dueAt: string; amount: number };

const OPEN_STATUSES = ["ACTIVE", "PARTIALLY_PAID", "OVERDUE"];

export function BnplOrdersClient({
  orders,
  branches,
  canWrite,
  canSeeAllBranches,
  defaultBranchId,
}: {
  orders: BnplOrderRow[];
  branches: BnplBranch[];
  canWrite: boolean;
  canSeeAllBranches: boolean;
  defaultBranchId: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [repayFor, setRepayFor] = useState<string | null>(null);
  const pending = orders.filter((o) => o.status === "DRAFT");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-vodium-gold">BNPL</p>
          <h1 className="font-serif text-2xl md:text-3xl text-vodium-cream mt-1">Orders</h1>
          <p className="text-sm text-vodium-cream/45 mt-1">Create instalment orders and record customer repayments.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {orders.length > 0 && (
            <a
              href="/api/bnpl/orders/export"
              className="px-4 py-2 rounded-lg text-sm border border-white/10 text-vodium-cream/70 hover:text-vodium-gold hover:border-vodium-gold/30 inline-flex items-center gap-2"
            >
              <Download size={15} /> Export
            </a>
          )}
          {canWrite && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="btn-gold px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2"
            >
              {showForm ? <X size={15} /> : <Plus size={15} />}
              {showForm ? "Close" : "New order"}
            </button>
          )}
        </div>
      </div>

      {showForm && canWrite && (
        <NewOrderForm
          branches={branches}
          canSeeAllBranches={canSeeAllBranches}
          defaultBranchId={defaultBranchId}
          onClose={() => setShowForm(false)}
        />
      )}

      {canWrite && pending.length > 0 && (
        <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-300/15 flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-200">Pending approval</span>
            <span className="text-xs text-amber-200/50">{pending.length} customer request{pending.length === 1 ? "" : "s"} from your store page</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {pending.map((order) => (
              <PendingRow key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-white/[0.06] bg-vodium-charcoal overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <ReceiptText size={16} className="text-vodium-gold" />
          <h2 className="text-sm font-semibold text-vodium-cream">Recent BNPL orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-vodium-cream/35">
              <tr>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Consent</th>
                <th className="px-5 py-3">Outstanding</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {orders.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-8 text-center text-vodium-cream/35">No BNPL orders yet.</td></tr>
              ) : orders.map((order) => (
                <Fragment key={order.id}>
                  <tr className="text-vodium-cream/70">
                    <td className="px-5 py-3 text-vodium-cream">{order.orderNumber}</td>
                    <td className="px-5 py-3">{order.studentName}</td>
                    <td className="px-5 py-3">{order.branchName}</td>
                    <td className="px-5 py-3">{order.status}</td>
                    <td className="px-5 py-3">
                      <ConsentCell accepted={order.consentAccepted} path={order.consentPath} />
                    </td>
                    <td className="px-5 py-3">{formatNaira(order.outstanding)}</td>
                    <td className="px-5 py-3 text-vodium-gold">{formatNaira(order.totalAmount)}</td>
                    <td className="px-5 py-3">{order.scheduleCount > 1 ? `${order.scheduleCount} instalments` : new Date(order.dueDate).toLocaleDateString("en-NG")}</td>
                    <td className="px-5 py-3 text-right">
                      {canWrite && order.canRepay && OPEN_STATUSES.includes(order.status) && (
                        <button
                          onClick={() => setRepayFor(repayFor === order.id ? null : order.id)}
                          className="text-xs text-vodium-gold hover:underline"
                        >
                          {repayFor === order.id ? "Cancel" : "Record payment"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {repayFor === order.id && (
                    <tr>
                      <td colSpan={9} className="px-5 py-3 bg-black/20">
                        <RepayForm order={order} onClose={() => setRepayFor(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NewOrderForm({
  branches,
  canSeeAllBranches,
  defaultBranchId,
  onClose,
}: {
  branches: BnplBranch[];
  canSeeAllBranches: boolean;
  defaultBranchId: string | null;
  onClose: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [downPayment, setDownPayment] = useState(0);
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleDraft[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ name: "", quantity: 1, unitPrice: 0 }]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items]
  );
  const financed = Math.max(0, subtotal - downPayment);
  const scheduleTotal = schedule.reduce((sum, entry) => sum + entry.amount, 0);

  function defaultSchedule(total: number): ScheduleDraft[] {
    const first = new Date();
    first.setDate(first.getDate() + 7);
    const second = new Date(first);
    second.setDate(second.getDate() + 7);
    const firstAmount = Math.round((total / 2) * 100) / 100;
    return [
      { dueAt: first.toISOString().slice(0, 10), amount: firstAmount },
      { dueAt: second.toISOString().slice(0, 10), amount: Math.round((total - firstAmount) * 100) / 100 },
    ];
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateSchedule(index: number, patch: Partial<ScheduleDraft>) {
    setSchedule((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  async function submit() {
    setError(null);
    const cleanItems = items
      .filter((item) => item.name.trim() && item.unitPrice > 0)
      .map((item) => ({ name: item.name.trim(), quantity: item.quantity, unitPrice: item.unitPrice }));
    if (cleanItems.length === 0) return setError("Add at least one item with a price.");
    if (!customerName.trim() || !customerPhone.trim()) return setError("Enter the customer's name and phone.");
    if (!branchId) return setError("Select a branch.");
    if (!consent) return setError("Confirm the customer accepted the BNPL terms.");
    if (installmentsEnabled) {
      if (schedule.length < 2) return setError("Add at least two instalments, or turn instalments off.");
      if (schedule.some((entry) => !entry.dueAt || entry.amount <= 0)) return setError("Every instalment needs a date and amount.");
      if (Math.abs(scheduleTotal - financed) > 0.01) {
        return setError(`Instalments must add up to ${formatNaira(financed)}.`);
      }
    }

    setSaving(true);
    const res = await fetch("/api/bnpl/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        dueDate: new Date(installmentsEnabled ? schedule[schedule.length - 1].dueAt : dueDate).toISOString(),
        downPayment,
        repaymentSchedule: installmentsEnabled
          ? schedule.map((entry) => ({ dueAt: new Date(entry.dueAt).toISOString(), amount: entry.amount }))
          : undefined,
        couponCode: couponCode.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cleanItems,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Could not create the order.");
    onClose();
    window.location.reload();
  }

  return (
    <div className="rounded-xl border border-vodium-gold/20 bg-vodium-gold/[0.04] p-5 space-y-4">
      <h3 className="text-sm font-semibold text-vodium-cream">New BNPL order</h3>

      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Customer name">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Customer phone">
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0803... or +234..." className={inputClass} />
        </Field>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {canSeeAllBranches && branches.length > 0 ? (
          <Field label="Branch">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Due date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Down payment (₦)">
          <input type="number" min={0} value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className={inputClass} />
        </Field>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-vodium-cream">Installment plan</p>
            <p className="text-xs text-vodium-cream/40">Choose how many payments and the exact dates and amounts.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const enabled = !installmentsEnabled;
              setInstallmentsEnabled(enabled);
              if (enabled && schedule.length === 0) setSchedule(defaultSchedule(financed));
            }}
            className={`px-3 py-1.5 rounded-lg text-xs border ${installmentsEnabled ? "border-vodium-gold text-vodium-gold bg-vodium-gold/10" : "border-white/10 text-vodium-cream/50"}`}
          >
            {installmentsEnabled ? "Enabled" : "Use instalments"}
          </button>
        </div>
        {installmentsEnabled && (
          <div className="space-y-2">
            {schedule.map((entry, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label={`Payment ${index + 1} date`}>
                  <input type="date" value={entry.dueAt} onChange={(e) => updateSchedule(index, { dueAt: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Amount (₦)">
                  <input type="number" min={0} step="0.01" value={entry.amount} onChange={(e) => updateSchedule(index, { amount: Number(e.target.value) })} className={inputClass} />
                </Field>
                <button type="button" onClick={() => setSchedule((current) => current.filter((_, i) => i !== index))} disabled={schedule.length <= 2} className="h-9 px-2 text-vodium-cream/40 hover:text-rose-300 disabled:opacity-30">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { const last = schedule[schedule.length - 1]; const next = new Date(last?.dueAt || new Date().toISOString().slice(0, 10)); next.setDate(next.getDate() + 7); setSchedule((current) => [...current, { dueAt: next.toISOString().slice(0, 10), amount: 0 }]); }} className="text-vodium-gold hover:underline inline-flex items-center gap-1"><Plus size={12} /> Add payment</button>
              <span className={Math.abs(scheduleTotal - financed) <= 0.01 ? "text-emerald-300" : "text-amber-200"}>Total {formatNaira(scheduleTotal)} / {formatNaira(financed)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-vodium-cream/40">Items</p>
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2">
            <input
              value={item.name}
              onChange={(e) => updateItem(index, { name: e.target.value })}
              placeholder="Item name"
              className={`col-span-6 ${inputClass}`}
            />
            <input
              type="number" min={1}
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: Math.max(1, Number(e.target.value)) })}
              placeholder="Qty"
              className={`col-span-2 ${inputClass}`}
            />
            <input
              type="number" min={0}
              value={item.unitPrice}
              onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
              placeholder="Unit ₦"
              className={`col-span-3 ${inputClass}`}
            />
            <button
              onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
              disabled={items.length === 1}
              className="col-span-1 flex items-center justify-center text-vodium-cream/40 hover:text-rose-300 disabled:opacity-30"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => setItems((c) => [...c, { name: "", quantity: 1, unitPrice: 0 }])}
          className="text-xs text-vodium-gold hover:underline inline-flex items-center gap-1"
        >
          <Plus size={12} /> Add item
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Coupon code (optional)">
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className={`${inputClass} uppercase`} />
        </Field>
        <Field label="Notes (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-vodium-cream/45">Subtotal</span>
        <span className="text-vodium-gold font-semibold">{formatNaira(subtotal)}</span>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg bg-black/20 border border-white/[0.06] p-3 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-vodium-gold" />
        <span className="text-xs text-vodium-cream/55">
          The customer has reviewed and accepted this store&apos;s Buy-Now-Pay-Later repayment terms, including the
          due date and instalment schedule. This consent is recorded with the order.
        </span>
      </label>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-xs text-vodium-cream/60 hover:text-vodium-cream">
          Cancel
        </button>
        <button
          disabled={saving}
          onClick={submit}
          className="px-4 py-2 rounded-lg bg-vodium-gold text-vodium-black text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Create order
        </button>
      </div>
    </div>
  );
}

function scoreTone(score: number): string {
  if (score >= 600) return "bg-emerald-300/15 text-emerald-300";
  if (score >= 450) return "bg-amber-300/15 text-amber-200";
  return "bg-rose-300/15 text-rose-300";
}

function PendingRow({ order }: { order: BnplOrderRow }) {
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "approve" | "decline") {
    if (kind === "decline" && !confirm(`Decline order ${order.orderNumber}?`)) return;
    setError(null);
    setBusy(kind);
    const res = await fetch(`/api/bnpl/orders/${order.id}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? `Could not ${kind} the order.`);
    window.location.reload();
  }

  return (
    <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-vodium-cream">
          {order.studentName} <span className="text-vodium-cream/35">· {order.orderNumber}</span>
          {typeof order.customerScore === "number" && (
            <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreTone(order.customerScore)}`}>
              score {order.customerScore}
            </span>
          )}
        </p>
        <p className="text-xs text-vodium-cream/40">{formatNaira(order.totalAmount)} · requested online</p>
        {error && <p className="text-xs text-rose-300 mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => act("decline")} disabled={busy !== null} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-rose-300 hover:border-rose-300/30 disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy === "decline" && <Loader2 size={12} className="animate-spin" />} Decline
        </button>
        <button onClick={() => act("approve")} disabled={busy !== null} className="px-3 py-1.5 rounded-lg bg-vodium-gold text-vodium-black text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy === "approve" && <Loader2 size={12} className="animate-spin" />} Approve
        </button>
      </div>
    </div>
  );
}

function RepayForm({ order, onClose }: { order: BnplOrderRow; onClose: () => void }) {
  const [amount, setAmount] = useState(order.outstanding);
  const [method, setMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (amount <= 0) return setError("Enter an amount greater than zero.");
    setSaving(true);
    const res = await fetch(`/api/bnpl/orders/${order.id}/repayments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Could not record the payment.");
    onClose();
    window.location.reload();
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
      <Field label={`Amount (outstanding ${formatNaira(order.outstanding)})`}>
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
      </Field>
      <Field label="Method">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
          {["CASH", "BANK_TRANSFER", "POS", "USSD", "MOBILE_MONEY", "OTHER"].map((m) => (
            <option key={m} value={m}>{m.replace("_", " ")}</option>
          ))}
        </select>
      </Field>
      <button
        disabled={saving}
        onClick={submit}
        className="px-4 py-2 rounded-lg bg-vodium-gold text-vodium-black text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2 h-9"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Record
      </button>
      {error && <p className="text-sm text-rose-300 self-center">{error}</p>}
    </div>
  );
}

function ConsentCell({ accepted, path }: { accepted: boolean; path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy the customer link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="inline-flex items-center gap-2">
      {accepted ? (
        <span className="text-emerald-300 text-xs inline-flex items-center gap-1"><Check size={12} /> Accepted</span>
      ) : (
        <span className="text-amber-300 text-xs">Pending</span>
      )}
      <button onClick={copy} title="Copy customer link" className="text-vodium-cream/40 hover:text-vodium-gold">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}

const inputClass =
  "w-full bg-black/25 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-vodium-cream focus:outline-none focus:border-vodium-gold/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block flex-1">
      <span className="text-xs text-vodium-cream/40">{label}</span>
      {children}
    </label>
  );
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

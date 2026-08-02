"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Loader2, Check, AlertTriangle, ImageUp, KeyRound } from "lucide-react";

interface LiveProfile {
  about?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
}

interface OtpTemplateState {
  configured: boolean;
  resolvedName: string;
  wabaId?: string;
  active?: { name: string; status: string; language: string };
  reminder?: { name: string; status?: string };
  invoice?: { name: string; status?: string; detail?: string };
  detail?: string;
}

function isTemplateUsable(status?: string): boolean {
  return status === "APPROVED" || status === "ACTIVE";
}

/**
 * One-click setup for the Meta OTP template — without it, verification codes
 * only reach customers who have already messaged the bot (Meta's 24h rule).
 */
export function OtpTemplatePanel() {
  const [state, setState] = useState<OtpTemplateState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch("/api/admin/whatsapp-otp-template")
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/whatsapp-otp-template", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the template");
      setState(data);
      const reminderNote = data.reminder?.created
        ? ` Reminder template "${data.reminder.name}" submitted too.`
        : data.reminder?.detail
          ? ` Reminder template: ${data.reminder.detail}`
          : "";
      const invoiceNote = data.invoice?.created
        ? ` Invoice PDF template "${data.invoice.name}" submitted too.`
        : data.invoice?.detail
          ? ` Invoice PDF template: ${data.invoice.detail}`
          : "";
      setMsg({
        ok: true,
        text:
          (data.created
            ? `Template "${data.resolvedName}" submitted — Meta usually approves it within minutes. OTP delivery starts automatically once approved.`
            : `Template "${data.active?.name}" already exists (${data.active?.status}).`) + reminderNote + invoiceNote,
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  const status = state?.active?.status;
  const reminderStatus = state?.reminder?.status;
  const invoiceStatus = state?.invoice?.status;
  const reminderBadge =
    isTemplateUsable(reminderStatus) ? { cls: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300", label: "Approved — reminders reach customers even without an open chat" }
    : reminderStatus === "PENDING" ? { cls: "bg-amber-500/10 border-amber-500/25 text-amber-300", label: "Reminder template pending Meta approval" }
    : reminderStatus ? { cls: "bg-rose-500/10 border-rose-500/25 text-rose-300", label: `Reminder template: ${reminderStatus}` }
    : { cls: "bg-rose-500/10 border-rose-500/25 text-rose-300", label: "Reminder template not created — out-of-chat customers miss reminders" };
  const badge =
    isTemplateUsable(status) ? { cls: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300", label: "Approved — OTP delivery is live" }
    : status === "PENDING" ? { cls: "bg-amber-500/10 border-amber-500/25 text-amber-300", label: "Pending Meta approval (usually minutes)" }
    : status ? { cls: "bg-rose-500/10 border-rose-500/25 text-rose-300", label: `Status: ${status}` }
    : { cls: "bg-rose-500/10 border-rose-500/25 text-rose-300", label: "Not created — first-time customers can't receive codes" };
  const invoiceBadge =
    isTemplateUsable(invoiceStatus) ? { cls: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300", label: "Approved — invoice PDFs reach customers without an open chat" }
    : invoiceStatus === "PENDING" ? { cls: "bg-amber-500/10 border-amber-500/25 text-amber-300", label: "Invoice PDF template pending Meta approval" }
    : invoiceStatus ? { cls: "bg-rose-500/10 border-rose-500/25 text-rose-300", label: `Invoice PDF template: ${invoiceStatus}` }
    : { cls: "bg-rose-500/10 border-rose-500/25 text-rose-300", label: "Invoice PDF template not created — out-of-chat customers get a link fallback" };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-vodium-charcoal p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-vodium-gold" />
        <h3 className="text-sm font-semibold text-vodium-cream">WhatsApp delivery templates</h3>
      </div>
      <p className="text-xs text-vodium-cream/40 mb-4">
        Meta requires approved templates to deliver verification codes, reminders, and invoice PDFs
        to customers who have never messaged the bot.
        {state?.wabaId ? <span className="block mt-1">Connected WABA: <code className="text-vodium-gold/80">{state.wabaId}</code></span> : null}
      </p>

      <div className={`rounded-lg border px-3 py-2 mb-2 text-xs ${badge.cls}`}>
        {badge.label}
        {state?.resolvedName ? <span className="opacity-60"> · using &ldquo;{state.resolvedName}&rdquo;</span> : null}
      </div>

      <div className={`rounded-lg border px-3 py-2 mb-4 text-xs ${reminderBadge.cls}`}>
        {reminderBadge.label}
        {state?.reminder?.name ? <span className="opacity-60"> · using &ldquo;{state.reminder.name}&rdquo;</span> : null}
      </div>

      <div className={`rounded-lg border px-3 py-2 mb-4 text-xs ${invoiceBadge.cls}`}>
        {invoiceBadge.label}
        {state?.invoice?.name ? <span className="opacity-60"> · using &ldquo;{state.invoice.name}&rdquo;</span> : null}
      </div>

      {state?.invoice?.detail && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 mb-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{state.invoice.detail}</span>
        </div>
      )}

      {state?.detail && !state.active && state.detail !== msg?.text && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 mb-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{state.detail}</span>
        </div>
      )}

      {state?.detail?.includes("whatsapp_business_management") && (
        <div className="rounded-lg px-3 py-2 mb-3 text-xs bg-black/25 border border-white/[0.08] text-vodium-cream/55 leading-relaxed">
          <strong className="text-vodium-cream/80">Fix:</strong> in Meta{" "}
          <strong className="text-vodium-cream/80">Business Settings → Users → System users</strong>, pick the
          system user behind your token, click <strong className="text-vodium-cream/80">Generate new token</strong>,
          tick <strong className="text-vodium-cream/80">whatsapp_business_messaging</strong> AND{" "}
          <strong className="text-vodium-cream/80">whatsapp_business_management</strong>, then update{" "}
          <code className="text-vodium-gold/80">WHATSAPP_ACCESS_TOKEN</code> in Vercel and redeploy. Come back and
          click the button again.
        </div>
      )}

      {msg && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-3 text-xs ${msg.ok ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-rose-500/10 border border-rose-500/20 text-rose-300"}`}>
          {msg.ok ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {(!isTemplateUsable(status) || !isTemplateUsable(reminderStatus) || !isTemplateUsable(invoiceStatus)) && (
        <button
          onClick={create}
          disabled={busy || !state?.configured}
          className="btn-gold inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
          {status === "PENDING" || reminderStatus === "PENDING" || invoiceStatus === "PENDING" ? "Refresh status" : "Create templates"}
        </button>
      )}
    </div>
  );
}

/**
 * Super-admin control for the WhatsApp bot's public identity — the logo
 * customers see and the profile text. One "Apply" applies Vodium's branding;
 * paste a PNG/JPEG URL to set the logo.
 */
export function BotProfilePanel() {
  const [profile, setProfile] = useState<LiveProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/whatsapp-profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile ?? null))
      .catch(() => {});
  }, []);

  async function apply() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/whatsapp-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update the profile");
      const notes = (data.skipped ?? []) as string[];
      setMsg({
        ok: true,
        text: data.photoSet
          ? "Logo and profile updated on WhatsApp."
          : notes[0] ?? "Profile text updated. Set the logo below or in WhatsApp Manager.",
      });
      fetch("/api/admin/whatsapp-profile").then((r) => r.json()).then((d) => setProfile(d.profile ?? null));
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-vodium-charcoal p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle size={16} className="text-vodium-gold" />
        <h3 className="text-sm font-semibold text-vodium-cream">WhatsApp bot profile</h3>
      </div>
      <p className="text-xs text-vodium-cream/40 mb-5">
        The logo and details customers see when they open the bot chat.
      </p>

      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/[0.08] bg-black/30 flex items-center justify-center shrink-0">
          {profile?.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profile_picture_url} alt="Bot logo" className="w-full h-full object-cover" />
          ) : (
            <ImageUp size={18} className="text-vodium-cream/25" />
          )}
        </div>
        <div className="min-w-0 text-xs">
          <p className="text-vodium-cream/70 truncate">{profile?.about ?? "No profile set yet"}</p>
          <p className="text-vodium-cream/35 truncate">{profile?.email ?? "—"}</p>
        </div>
      </div>

      <label className="block text-xs text-vodium-cream/45 mb-1.5">Logo URL (PNG or JPEG, square)</label>
      <input
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
        placeholder="https://vodiumledger.com/logo.png"
        className="w-full bg-black/25 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-vodium-cream placeholder:text-vodium-cream/25 focus:outline-none focus:border-vodium-gold/40 mb-3"
      />

      {msg && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-3 text-xs ${msg.ok ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-rose-500/10 border border-rose-500/20 text-rose-300"}`}>
          {msg.ok ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <button
        onClick={apply}
        disabled={busy}
        className="btn-gold inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
        {logoUrl.trim() ? "Apply logo & branding" : "Apply Vodium branding"}
      </button>
    </div>
  );
}

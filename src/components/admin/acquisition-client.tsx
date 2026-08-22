"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Target, AlertTriangle, CalendarClock, Users, Search } from "lucide-react";
import type { AcquisitionDashboardData } from "@/lib/admin/acquisition";

const SOURCE_LABEL: Record<string, string> = {
  GOOGLE_BUSINESS: "Google Business", SOCIAL_MEDIA: "Social media", AMBASSADOR_REFERRAL: "Ambassador/referral",
  DIRECT_OUTBOUND: "Direct outbound", EVENT_COMMUNITY: "Event/community", PARTNERSHIP: "Partnership", MANUAL_ENTRY: "Manual entry", OTHER: "Other",
};
const STAGES = ["IDENTIFIED", "CONTACTED", "RESPONDED", "QUALIFIED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "ONBOARDING", "ACTIVATED", "WON", "LOST", "UNQUALIFIED"];
const sourceValues = Object.keys(SOURCE_LABEL);

export function AcquisitionClient({ data, canWrite }: { data: AcquisitionDashboardData; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showCampaignCreate, setShowCampaignCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; reload?: boolean } | null>(null);
  const visible = useMemo(() => data.prospects.filter((p) =>
    (!stage || p.stage === stage) && (!query || [p.businessName, p.contactName, p.phone, p.email].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()))
  ), [data.prospects, query, stage]);
  async function create(form: HTMLFormElement) {
    setBusy(true);
    const fd = new FormData(form);
    const body: Record<string, unknown> = Object.fromEntries(fd.entries());
    for (const [key, value] of Object.entries(body)) if (value === "") delete body[key];
    if (typeof body.nextActionAt === "string") body.nextActionAt = new Date(body.nextActionAt).toISOString();
    const res = await fetch("/api/admin/acquisition/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    if (res.status === 409 && json.duplicateWarning) {
      if (!window.confirm("A matching prospect or vendor exists. Create a separate prospect anyway?")) return;
      body.forceCreate = true;
      const retry = await fetch("/api/admin/acquisition/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!retry.ok) return setNotice({ title: "Could not create prospect", message: (await retry.json()).error ?? "Please review the details and try again." });
      window.location.reload(); return;
    }
    if (!res.ok) return setNotice({ title: "Could not create prospect", message: json.error ?? "Please review the details and try again." });
    window.location.reload();
  }
  async function createCampaign(form: HTMLFormElement) {
    setBusy(true);
    const body: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
    for (const [key, value] of Object.entries(body)) if (value === "") delete body[key];
    for (const key of ["startAt", "endAt"]) if (typeof body[key] === "string") body[key] = new Date(body[key] as string).toISOString();
    for (const key of ["budgetAmount", "actualSpendAmount"]) if (typeof body[key] === "string") body[key] = Number(body[key]);
    const res = await fetch("/api/admin/acquisition/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setNotice({ title: "Could not create campaign", message: (await res.json()).error ?? "Please review the details and try again." });
    window.location.reload();
  }
  async function discover(form: HTMLFormElement) {
    setBusy(true);
    const body = Object.fromEntries(new FormData(form).entries());
    const res = await fetch("/api/admin/acquisition/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setNotice({ title: "Business search could not run", message: json.error ?? "Please try again with a narrower city search." });
    setShowDiscovery(false);
    setNotice({ title: "Business search complete", message: `Found ${json.found} listings. Added ${json.imported}; skipped ${json.skipped} duplicates. ${json.message}`, reload: true });
  }
  async function qualifyNewProspects() {
    setBusy(true);
    const res = await fetch("/api/admin/acquisition/qualify", { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setNotice({ title: "AI review could not run", message: json.error ?? "Please try again." });
    setNotice({ title: "AI review complete", message: `AI reviewed ${json.qualified} of ${json.processed} new prospects. ${json.message}`, reload: true });
  }
  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.2em] text-vodium-gold">Merchant acquisition</p><h1 className="font-serif text-2xl md:text-3xl text-vodium-cream mt-1">Prospects and conversion</h1><p className="text-sm text-vodium-cream/45 mt-1">A focused operating queue for turning merchant leads into active Vodium vendors.</p></div>
        {canWrite && <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={qualifyNewProspects} disabled={busy} className="inline-flex h-10 items-center justify-center rounded-lg border border-sky-400/40 px-4 text-sm font-semibold text-sky-300 transition-colors hover:bg-sky-400/10 disabled:opacity-50"><Target size={16} className="mr-2" /> {busy ? "Reviewing…" : "AI review new leads"}</button><button type="button" onClick={() => setShowDiscovery(true)} className="inline-flex h-10 items-center justify-center rounded-lg border border-vodium-gold/45 px-4 text-sm font-semibold text-vodium-gold transition-colors hover:bg-vodium-gold/10 focus:outline-none focus:ring-2 focus:ring-vodium-gold/50"><Search size={16} className="mr-2" /> Find Nigerian businesses</button><button type="button" onClick={() => setShowCreate(true)} className="btn-gold inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-vodium-gold/60"><Plus size={16} className="mr-2" /> Add prospect</button></div>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Leads generated" value={String(data.kpi.identified)} sub={rate(data.kpi.contactRate, "contact rate")} />
        <Tile label="Qualified" value={String(data.kpi.qualified)} sub={rate(data.kpi.qualificationRate, "of responses")} />
        <Tile label="Activated" value={String(data.kpi.activated)} sub={rate(data.kpi.activationRate, "of qualified")} />
        <Tile label="Won" value={String(data.kpi.won)} sub={rate(data.kpi.winRate, "of activated")} />
      </div>

      <section className="grid lg:grid-cols-5 gap-3">
        <Queue title="Overdue follow-ups" count={data.queue.overdue.length} icon={<AlertTriangle size={14} />} tone="rose" />
        <Queue title="Due today" count={data.queue.today.length} icon={<CalendarClock size={14} />} tone="gold" />
        <Queue title="Qualified, no action" count={data.queue.qualifiedNoAction.length} icon={<Target size={14} />} tone="gold" />
        <Queue title="Upcoming demos" count={data.queue.upcomingDemos.length} icon={<Users size={14} />} tone="blue" />
        <Queue title="Onboarding, not active" count={data.queue.onboarding.length} icon={<Target size={14} />} tone="blue" />
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        <Panel title="First-touch sources">
          {data.sourceRows.length ? data.sourceRows.map((r) => <div key={r.source} className="flex justify-between py-2 border-b border-white/[0.05] text-sm"><span className="text-vodium-cream/65">{SOURCE_LABEL[r.source]}</span><span className="text-vodium-cream/45">{r.leads} leads · {r.activated} active · {r.won} won</span></div>) : <Empty />}
        </Panel>
        <Panel title="Campaigns">
          {canWrite && <button onClick={() => setShowCampaignCreate(true)} className="text-xs text-vodium-gold mb-2">+ New campaign</button>}
          {data.campaigns.length ? data.campaigns.slice(0, 5).map((c) => <div key={c.id} className="flex justify-between py-2 border-b border-white/[0.05] text-sm"><span className="text-vodium-cream/65">{c.name}</span><span className="text-vodium-cream/45">{c._count.prospects} prospects · {c.status}</span></div>) : <Empty />}
        </Panel>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="p-4 border-b border-[color:var(--hairline)] flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-sm font-semibold text-vodium-cream">Prospect pipeline</h2>
          <div className="flex gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchants" className="input-dark rounded-lg px-3 py-1.5 text-sm" /><select value={stage} onChange={(e) => setStage(e.target.value)} className="input-dark rounded-lg px-2 py-1.5 text-sm"><option value="">All stages</option>{STAGES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-[10px] uppercase tracking-wider text-vodium-cream/35"><tr><th className="p-4">Merchant</th><th className="p-4">Fit / stage</th><th className="p-4">Source</th><th className="p-4">Owner</th><th className="p-4">Next action</th></tr></thead><tbody>
          {visible.map((p) => <tr key={p.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]"><td className="p-4"><Link href={"/admin/acquisition/" + p.id} className="font-medium text-vodium-cream hover:text-vodium-gold">{p.businessName}</Link><p className="text-xs text-vodium-cream/35 mt-1">{p.community?.shortName ?? p.locationText ?? p.contactName ?? "No location"}</p></td><td className="p-4"><span className="text-xs text-vodium-gold">{p.fit}</span><p className="text-xs text-vodium-cream/45 mt-1">{label(p.stage)}</p></td><td className="p-4 text-vodium-cream/55">{SOURCE_LABEL[p.source]}</td><td className="p-4 text-vodium-cream/55">{p.assignedTo?.name ?? "Unassigned"}</td><td className="p-4 text-vodium-cream/55">{p.nextActionAt ? <><span>{p.nextActionType}</span><p className="text-xs text-vodium-cream/35 mt-1">{new Date(p.nextActionAt).toLocaleString("en-NG")}</p></> : "None"}</td></tr>)}
          {!visible.length && <tr><td colSpan={5} className="p-10 text-center text-vodium-cream/35">No prospects match this view.</td></tr>}
        </tbody></table></div>
      </section>
      {showCreate && <CreateModal data={data} busy={busy} close={() => setShowCreate(false)} submit={create} />}
      {showDiscovery && <DiscoveryModal busy={busy} close={() => setShowDiscovery(false)} submit={discover} />}
      {showCampaignCreate && <CampaignModal data={data} busy={busy} close={() => setShowCampaignCreate(false)} submit={createCampaign} />}
      {notice && <NoticeModal title={notice.title} message={notice.message} close={() => { const reload = notice.reload; setNotice(null); if (reload) window.location.reload(); }} />}
    </div>
  );
}
function DiscoveryModal({ busy, close, submit }: { busy: boolean; close: () => void; submit: (form: HTMLFormElement) => void }) {
  return <div className="fixed inset-0 z-50 bg-black/70 p-4 overflow-auto"><form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="max-w-xl mx-auto my-8 bg-vodium-charcoal rounded-2xl border border-white/[0.1] p-6 space-y-4"><div className="flex justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-vodium-gold">Nigeria only · no paid API</p><h2 className="font-serif text-xl">Find public business listings</h2><p className="text-xs text-vodium-cream/45 mt-1">Searches free OpenStreetMap listings in Nigeria and adds unique businesses as identified prospects.</p></div><button type="button" onClick={close} className="rounded-md px-2 py-1 text-sm text-vodium-cream/50 transition-colors hover:bg-white/5 hover:text-vodium-cream focus:outline-none focus:ring-2 focus:ring-vodium-gold/50">Close</button></div><div className="grid md:grid-cols-2 gap-3"><div className="md:col-span-2"><Field name="query" label="Business search" required /><p className="text-[11px] text-vodium-cream/35 mt-1">Example: provision stores or campus laundry</p></div><Field name="city" label="Nigerian city" required /><Field name="state" label="Nigerian state (optional)" /><label className="text-xs text-vodium-cream/50">Listings to look for<select name="limit" defaultValue="50" className="input-dark w-full rounded-lg px-3 py-2 mt-1"><option value="50">50</option><option value="100">100</option><option value="250">250</option><option value="500">500</option></select></label></div><p className="rounded-lg border border-vodium-gold/20 bg-vodium-gold/5 p-3 text-xs text-vodium-cream/55">A city is required so the free search stays fast and reliable. Only publicly listed details are imported; verify them before outreach or sending a claim link.</p><div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4"><button type="button" onClick={close} disabled={busy} className="h-10 rounded-lg px-4 text-sm font-semibold text-vodium-cream/60 transition-colors hover:bg-white/5 hover:text-vodium-cream disabled:opacity-50">Cancel</button><button disabled={busy} className="btn-gold inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Searching Nigeria…" : "Find and add prospects"}</button></div></form></div>;
}
function NoticeModal({ title, message, close }: { title: string; message: string; close: () => void }) { return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-vodium-charcoal p-6 shadow-2xl"><h2 className="font-serif text-xl text-vodium-cream">{title}</h2><p className="mt-3 text-sm leading-6 text-vodium-cream/65">{message}</p><div className="mt-6 flex justify-end"><button type="button" onClick={close} className="btn-gold inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold">Done</button></div></div></div>; }
function CampaignModal({ data, busy, close, submit }: { data: AcquisitionDashboardData; busy: boolean; close: () => void; submit: (form: HTMLFormElement) => void }) {
  return <div className="fixed inset-0 z-50 bg-black/70 p-4 overflow-auto"><form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="max-w-xl mx-auto my-8 bg-vodium-charcoal rounded-2xl border border-white/[0.1] p-6 space-y-4"><div className="flex justify-between"><h2 className="font-serif text-xl">New acquisition campaign</h2><button type="button" onClick={close} className="text-vodium-cream/50">Close</button></div><div className="grid md:grid-cols-2 gap-3"><Field name="name" label="Campaign name" required /><Select name="source" label="Primary source" values={sourceValues} labels={SOURCE_LABEL} required /><Select name="ownerAdminId" label="Owner" values={data.admins.map((a) => a.id)} labels={Object.fromEntries(data.admins.map((a) => [a.id, a.name]))} /><Select name="status" label="Status" values={["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]} /><Field name="budgetAmount" label="Budget (₦)" type="number" /><label className="text-xs text-vodium-cream/50">Start date<input name="startAt" type="datetime-local" className="input-dark w-full rounded-lg px-3 py-2 mt-1" /></label></div><label className="text-xs text-vodium-cream/50 block">Notes<textarea name="notes" className="input-dark w-full rounded-lg px-3 py-2 mt-1 min-h-20" /></label><button disabled={busy} className="btn-gold rounded-lg px-4 py-2 text-sm">{busy ? "Saving…" : "Create campaign"}</button></form></div>;
}
function CreateModal({ data, busy, close, submit }: { data: AcquisitionDashboardData; busy: boolean; close: () => void; submit: (form: HTMLFormElement) => void }) {
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000); const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <div className="fixed inset-0 z-50 bg-black/70 p-4 overflow-auto"><form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="max-w-2xl mx-auto my-8 bg-vodium-charcoal rounded-2xl border border-white/[0.1] p-6 space-y-4"><div className="flex justify-between"><h2 className="font-serif text-xl">Add merchant prospect</h2><button type="button" onClick={close} className="text-vodium-cream/50">Close</button></div><div className="grid md:grid-cols-2 gap-3"><Field name="businessName" label="Business name" required /><Field name="contactName" label="Contact name" /><Field name="phone" label="Phone" /><Field name="email" label="Email" /><Select name="source" label="Source" values={sourceValues} labels={SOURCE_LABEL} /><Select name="assignedToAdminId" label="Owner" values={data.admins.map((a) => a.id)} labels={Object.fromEntries(data.admins.map((a) => [a.id, a.name]))} required /><Select name="priority" label="Priority" values={["LOW", "NORMAL", "HIGH"]} /><Select name="nextActionType" label="Next action" values={["CALL", "WHATSAPP", "EMAIL", "MEETING", "DEMO", "VISIT", "RESEARCH", "OTHER"]} required /><label className="text-xs text-vodium-cream/50">Next action time<input name="nextActionAt" type="datetime-local" defaultValue={local} required className="input-dark w-full rounded-lg px-3 py-2 mt-1" /></label><Select name="fit" label="Fit" values={["HIGH", "MEDIUM", "LOW"]} /></div><label className="text-xs text-vodium-cream/50 block">Next action note<textarea name="nextActionNote" required className="input-dark w-full rounded-lg px-3 py-2 mt-1 min-h-20" /></label><button disabled={busy} className="btn-gold rounded-lg px-4 py-2 text-sm">{busy ? "Saving…" : "Create prospect"}</button></form></div>;
}
function Field({ name, label, required = false, type = "text" }: { name: string; label: string; required?: boolean; type?: string }) { return <label className="text-xs text-vodium-cream/50">{label}<input name={name} type={type} required={required} className="input-dark w-full rounded-lg px-3 py-2 mt-1" /></label>; }
function Select({ name, label: caption, values, labels = {}, required = false }: { name: string; label: string; values: string[]; labels?: Record<string, string>; required?: boolean }) { return <label className="text-xs text-vodium-cream/50">{caption}<select name={name} required={required} defaultValue={required ? "" : values.includes("NORMAL") ? "NORMAL" : values.includes("MEDIUM") ? "MEDIUM" : values[0]} className="input-dark w-full rounded-lg px-3 py-2 mt-1">{required && <option value="">Select…</option>}{values.map((v) => <option key={v} value={v}>{labels[v] ?? label(v)}</option>)}</select></label>; }
function label(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function rate(value: number | null, labelText: string) { return value === null ? "Need 5+ records" : value + "% " + labelText; }
function Tile({ label: title, value, sub }: { label: string; value: string; sub: string }) { return <div className="surface-card p-4"><p className="text-xs text-vodium-cream/40">{title}</p><p className="font-serif text-3xl text-vodium-gold mt-2">{value}</p><p className="text-[11px] text-vodium-cream/30 mt-1">{sub}</p></div>; }
function Queue({ title, count, icon, tone }: { title: string; count: number; icon: React.ReactNode; tone: string }) { return <div className="surface-card p-4"><div className={tone === "rose" ? "text-rose-400" : tone === "blue" ? "text-sky-400" : "text-vodium-gold"}>{icon}</div><p className="font-serif text-2xl mt-2">{count}</p><p className="text-xs text-vodium-cream/40 mt-1">{title}</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="surface-card p-5"><h2 className="text-sm font-semibold text-vodium-cream mb-2">{title}</h2>{children}</div>; }
function Empty() { return <p className="text-sm text-vodium-cream/35 py-4">No acquisition data yet.</p>; }

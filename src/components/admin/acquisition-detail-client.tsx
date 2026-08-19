"use client";

import Link from "next/link";
import { useState } from "react";

type VendorOption = { id: string; businessName: string; phone: string; email: string };
type AdminOption = { id: string; name: string };

// The prospect arrives JSON-serialised from the server page, so every DateTime
// on the Prisma row reaches us as a string and enums as their string values.
type ProspectActivity = {
  id: string;
  type: string;
  outcome: string | null;
  body: string | null;
  occurredAt: string;
  createdBy: { name: string } | null;
};

type ProspectDetail = {
  id: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  vendorType: string | null;
  fit: string;
  source: string;
  stage: string;
  assignedToAdminId: string | null;
  nextActionAt: string | null;
  lossReason: string | null;
  unqualifiedReason: string | null;
  convertedVendorId: string | null;
  campaign: { name: string } | null;
  assignedTo: { id: string; name: string } | null;
  convertedVendor: {
    id: string;
    businessName: string;
    subscription: { status: string } | null;
    _count: { credits: number };
  } | null;
  activities: ProspectActivity[];
};

export function AcquisitionDetailClient({ prospect, admins, canWrite }: { prospect: ProspectDetail; admins: AdminOption[]; canWrite: boolean }) {
  const [busy, setBusy] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorQuery, setVendorQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const closed = prospect.stage === "LOST" || prospect.stage === "UNQUALIFIED" || prospect.stage === "WON";

  async function request(path: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/admin/acquisition/prospects/${prospect.id}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    return res;
  }
  async function addActivity(form: HTMLFormElement) {
    const body: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
    for (const [key, value] of Object.entries(body)) if (value === "") delete body[key];
    if (typeof body.nextActionAt === "string") body.nextActionAt = new Date(body.nextActionAt).toISOString();
    const res = await request("/activities", body);
    if (!res.ok) return window.alert((await res.json()).error ?? "Could not save");
    window.location.reload();
  }
  async function updatePipeline(form: HTMLFormElement) {
    const body: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
    for (const [key, value] of Object.entries(body)) if (value === "") delete body[key];
    if (body.reopen === "true") body.reopen = true;
    if (typeof body.nextActionAt === "string") body.nextActionAt = new Date(body.nextActionAt).toISOString();
    setBusy(true);
    const res = await fetch(`/api/admin/acquisition/prospects/${prospect.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return window.alert((await res.json()).error ?? "Could not update pipeline");
    window.location.reload();
  }
  async function registrationLink() {
    const res = await request("/convert"); const data = await res.json();
    if (!res.ok) return window.alert(data.error ?? "Could not create link");
    await navigator.clipboard.writeText(data.registrationUrl); window.alert("Registration link copied.");
  }
  async function searchVendors() {
    const params = new URLSearchParams();
    if (prospect.phone) params.set("phone", prospect.phone);
    if (prospect.email) params.set("email", prospect.email);
    if (vendorQuery.trim()) params.set("query", vendorQuery.trim());
    setBusy(true); setSearchMessage("");
    const res = await fetch(`/api/admin/acquisition/vendors/search?${params}`);
    const data = await res.json(); setBusy(false);
    if (!res.ok) return setSearchMessage(data.error ?? "Could not search vendors");
    setVendors(data.vendors); setSearchMessage(data.vendors.length ? "" : "No matching vendor found.");
  }
  async function match(vendorId: string) {
    if (!vendorId || !window.confirm("Link this existing vendor? Accounts will not be merged or changed.")) return;
    const res = await request("/convert", { vendorId });
    if (!res.ok) return window.alert((await res.json()).error ?? "Could not link");
    window.location.reload();
  }

  return <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-6">
    <Link href="/admin/acquisition" className="text-sm text-vodium-gold">← Acquisition</Link>
    <div className="flex justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] text-vodium-gold">{label(prospect.stage)}</p><h1 className="font-serif text-3xl mt-1">{prospect.businessName}</h1><p className="text-sm text-vodium-cream/45 mt-1">{prospect.contactName ?? "No named contact"} · {prospect.phone ?? prospect.email ?? "No contact details"}</p></div>{prospect.convertedVendor && <Link href={`/admin/vendors/${prospect.convertedVendor.id}`} className="btn-ghost rounded-lg px-3 py-2 text-sm">View linked vendor</Link>}</div>
    <div className="grid md:grid-cols-3 gap-4"><Card title="Acquisition" text={label(prospect.source) + (prospect.campaign ? ` · ${prospect.campaign.name}` : "")} /><Card title="Owner / next action" text={`${prospect.assignedTo?.name ?? "Unassigned"}${prospect.nextActionAt ? ` · ${new Date(prospect.nextActionAt).toLocaleString("en-NG")}` : ""}`} /><Card title="Fit / segment" text={`${prospect.fit} · ${label(prospect.vendorType ?? "Unclassified")}`} /></div>
    {canWrite && (prospect.stage === "LOST" || prospect.stage === "UNQUALIFIED") ? <ReopenForm admins={admins} busy={busy} submit={updatePipeline} /> : canWrite && <PipelineForm prospect={prospect} admins={admins} busy={busy} submit={updatePipeline} />}
    {canWrite && <section className="surface-card p-5 space-y-3"><h2 className="font-semibold">Conversion</h2>{prospect.convertedVendor ? <p className="text-sm text-emerald-400">Linked to {prospect.convertedVendor.businessName}. Credits: {prospect.convertedVendor._count.credits}; subscription: {prospect.convertedVendor.subscription?.status ?? "none"}.</p> : <><button onClick={registrationLink} disabled={busy} className="btn-gold rounded-lg px-3 py-2 text-sm">Copy prospect registration link</button><div className="flex gap-2"><input value={vendorQuery} onChange={(event) => setVendorQuery(event.target.value)} placeholder="Business name if no exact contact match" className="input-dark rounded-lg px-3 py-2 text-sm flex-1" /><button onClick={searchVendors} disabled={busy} className="btn-ghost rounded-lg px-3 text-sm">Search vendors</button></div>{searchMessage && <p className="text-xs text-vodium-cream/45">{searchMessage}</p>}{vendors.length > 0 && <div className="flex gap-2"><select id="vendor-match" className="input-dark rounded-lg px-3 py-2 text-sm flex-1"><option value="">Confirm a matching vendor…</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.businessName} · {vendor.phone}</option>)}</select><button onClick={() => match((document.getElementById("vendor-match") as HTMLSelectElement).value)} className="btn-ghost rounded-lg px-3 text-sm">Confirm match</button></div>}</>}</section>}
    <section className="grid lg:grid-cols-2 gap-5"><div className="surface-card p-5"><h2 className="font-semibold mb-4">Activity timeline</h2>{prospect.activities.length ? prospect.activities.map((activity: ProspectActivity) => <div key={activity.id} className="border-l border-vodium-gold/30 pl-3 pb-4"><p className="text-sm text-vodium-cream">{label(activity.type)} {activity.outcome && `· ${activity.outcome}`}</p>{activity.body && <p className="text-xs text-vodium-cream/45 mt-1">{activity.body}</p>}<p className="text-[10px] text-vodium-cream/30 mt-1">{new Date(activity.occurredAt).toLocaleString("en-NG")} · {activity.createdBy?.name ?? "System"}</p></div>) : <p className="text-sm text-vodium-cream/35">No activity yet.</p>}</div>{canWrite && <ActivityForm closed={closed} busy={busy} submit={addActivity} />}</section>
  </div>;
}

function PipelineForm({ prospect, admins, busy, submit }: { prospect: ProspectDetail; admins: AdminOption[]; busy: boolean; submit: (form: HTMLFormElement) => void }) {
  const stages = [prospect.stage, ...nextStages(prospect)].filter((stage, index, list) => list.indexOf(stage) === index);
  return <section className="surface-card p-5 space-y-3"><h2 className="font-semibold">Pipeline control</h2><form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }} className="grid md:grid-cols-2 gap-3"><label className="text-xs text-vodium-cream/50">Stage<select name="stage" defaultValue={prospect.stage} className="input-dark w-full rounded-lg p-2 mt-1">{stages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label><OwnerSelect admins={admins} value={prospect.assignedToAdminId} /><label className="text-xs text-vodium-cream/50">Loss reason<input name="lossReason" defaultValue={prospect.lossReason ?? ""} className="input-dark w-full rounded-lg p-2 mt-1" /></label><label className="text-xs text-vodium-cream/50">Unqualified reason<input name="unqualifiedReason" defaultValue={prospect.unqualifiedReason ?? ""} className="input-dark w-full rounded-lg p-2 mt-1" /></label><button disabled={busy} className="btn-ghost rounded-lg px-3 py-2 text-sm w-fit">{busy ? "Saving…" : "Save pipeline"}</button></form></section>;
}

function ReopenForm({ admins, busy, submit }: { admins: AdminOption[]; busy: boolean; submit: (form: HTMLFormElement) => void }) {
  return <section className="surface-card p-5 space-y-3"><h2 className="font-semibold">Reopen prospect</h2><p className="text-xs text-vodium-cream/45">This explicit action restarts the prospect at Identified and requires a new accountable follow-up.</p><form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }} className="grid md:grid-cols-2 gap-3"><input type="hidden" name="stage" value="IDENTIFIED" /><input type="hidden" name="reopen" value="true" /><OwnerSelect admins={admins} /><label className="text-xs text-vodium-cream/50">Reopen reason<input name="reopenReason" required className="input-dark w-full rounded-lg p-2 mt-1" /></label><ActionSelect required /><label className="text-xs text-vodium-cream/50">Next action time<input name="nextActionAt" type="datetime-local" required className="input-dark w-full rounded-lg p-2 mt-1" /></label><label className="text-xs text-vodium-cream/50">Next action note<input name="nextActionNote" required className="input-dark w-full rounded-lg p-2 mt-1" /></label><button disabled={busy} className="btn-gold rounded-lg px-3 py-2 text-sm w-fit">{busy ? "Saving…" : "Reopen prospect"}</button></form></section>;
}

function ActivityForm({ closed, busy, submit }: { closed: boolean; busy: boolean; submit: (form: HTMLFormElement) => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }} className="surface-card p-5 space-y-3"><h2 className="font-semibold">Log follow-up</h2><select name="type" className="input-dark w-full rounded-lg p-2"><option value="CALL">Call</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="MEETING">Meeting</option><option value="DEMO">Demo</option><option value="NOTE">Note</option><option value="FOLLOW_UP_COMPLETED">Follow-up completed</option></select><input name="outcome" placeholder="Outcome" className="input-dark w-full rounded-lg p-2" /><textarea name="body" placeholder="What happened?" className="input-dark w-full rounded-lg p-2 min-h-24" />{!closed && <><ActionSelect /><input name="nextActionAt" type="datetime-local" className="input-dark w-full rounded-lg p-2" /><input name="nextActionNote" placeholder="Next action note" className="input-dark w-full rounded-lg p-2" /></>}<button disabled={busy} className="btn-gold rounded-lg px-3 py-2 text-sm">{busy ? "Saving…" : "Save activity"}</button></form>;
}

function OwnerSelect({ admins, value }: { admins: AdminOption[]; value?: string | null }) { return <label className="text-xs text-vodium-cream/50">Owner<select name="assignedToAdminId" defaultValue={value ?? ""} required className="input-dark w-full rounded-lg p-2 mt-1"><option value="">Select owner…</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label>; }
function ActionSelect({ required = false }: { required?: boolean }) { return <label className="text-xs text-vodium-cream/50">Next action<select name="nextActionType" required={required} className="input-dark w-full rounded-lg p-2 mt-1"><option value="">No new next action</option><option value="CALL">Call</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="MEETING">Meeting</option><option value="DEMO">Demo</option><option value="VISIT">Visit</option></select></label>; }
function nextStages(prospect: Pick<ProspectDetail, "stage" | "convertedVendorId">) { const next: Record<string, string | undefined> = { IDENTIFIED: "CONTACTED", CONTACTED: "RESPONDED", RESPONDED: "QUALIFIED", QUALIFIED: "DEMO_SCHEDULED", DEMO_SCHEDULED: "DEMO_COMPLETED", DEMO_COMPLETED: prospect.convertedVendorId ? "ONBOARDING" : undefined }; return [next[prospect.stage], "LOST", "UNQUALIFIED"].filter((stage): stage is string => Boolean(stage)); }
function label(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function Card({ title, text }: { title: string; text: string }) { return <div className="surface-card p-4"><p className="text-xs text-vodium-cream/35">{title}</p><p className="text-sm text-vodium-cream/70 mt-2">{text}</p></div>; }

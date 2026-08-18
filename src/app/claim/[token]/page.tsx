"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const TYPES = [["PROVISION_SHOP", "Provision shop"], ["FOOD_CANTEEN", "Food canteen"], ["LAUNDRY", "Laundry"], ["PRINTING", "Printing"], ["BARBING_SALON", "Barbing salon"], ["HAIR_SALON", "Hair salon"], ["PHARMACY", "Pharmacy"], ["MINI_MART", "Mini mart"], ["OTHER", "Other"]];

export default function ClaimVendorPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [prospect, setProspect] = useState<{ ownerName: string; businessName: string; phone: string; email: string } | null>(null);
  const [form, setForm] = useState({ vendorType: "", location: "", community: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch(`/api/vendor/claim/${params.token}`).then(async (res) => {
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setProspect(data.prospect);
    }).catch((err) => setError(err.message ?? "This claim link is unavailable.")).finally(() => setLoading(false));
  }, [params.token]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/vendor/claim/${params.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      router.replace("/dashboard"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not complete onboarding."); } finally { setSaving(false); }
  }
  if (loading) return <main className="min-h-screen bg-vodium-black grid place-items-center text-vodium-cream/50">Loading your invite…</main>;
  if (!prospect) return <main className="min-h-screen bg-vodium-black grid place-items-center p-6 text-center text-vodium-cream"><div><h1 className="font-serif text-2xl">Invite unavailable</h1><p className="mt-2 text-sm text-vodium-cream/50">{error ?? "This link has expired or has already been used."}</p></div></main>;
  return <main className="min-h-screen bg-vodium-black px-4 py-10"><form onSubmit={submit} className="mx-auto max-w-xl rounded-2xl border border-white/[0.1] bg-vodium-charcoal p-6 space-y-5"><div><p className="text-xs tracking-[.25em] uppercase text-vodium-gold">Vodium Ledger</p><h1 className="font-serif text-2xl text-vodium-cream mt-2">Claim your account</h1><p className="text-sm text-vodium-cream/50 mt-2">Welcome, {prospect.ownerName}. Complete setup to start your trial.</p></div><div className="grid sm:grid-cols-2 gap-3 text-sm"><p className="rounded-lg bg-black/20 p-3 text-vodium-cream/70"><span className="block text-xs text-vodium-cream/35">Business</span>{prospect.businessName}</p><p className="rounded-lg bg-black/20 p-3 text-vodium-cream/70"><span className="block text-xs text-vodium-cream/35">Contact</span>{prospect.phone}<br />{prospect.email}</p></div><select required value={form.vendorType} onChange={(e) => update("vendorType", e.target.value)} className="w-full rounded-lg bg-black/30 border border-white/[0.1] px-3 py-2.5 text-sm text-vodium-cream"><option value="">Select business type</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input required value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Shop location" className="w-full rounded-lg bg-black/30 border border-white/[0.1] px-3 py-2.5 text-sm text-vodium-cream" /><input required value={form.community} onChange={(e) => update("community", e.target.value)} placeholder="University or community" className="w-full rounded-lg bg-black/30 border border-white/[0.1] px-3 py-2.5 text-sm text-vodium-cream" /><input required minLength={8} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Create a password (8+ characters)" className="w-full rounded-lg bg-black/30 border border-white/[0.1] px-3 py-2.5 text-sm text-vodium-cream" />{error && <p className="text-sm text-rose-300">{error}</p>}<button disabled={saving} className="w-full rounded-lg bg-vodium-gold py-3 text-sm font-bold text-vodium-black disabled:opacity-50">{saving ? "Setting up your account…" : "Claim account and start trial"}</button></form></main>;
}

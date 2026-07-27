"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ReminderSettings } from "@/components/ui/reminder-settings";
import {
  CheckCircle,
  Store,
  Mail,
  MapPin,
  Bell,
  Shield,
  CreditCard,
  Lock,
  X,
} from "lucide-react";
import { GlowBadge } from "@/components/ui/glow-badge";
import { AnimatedBorder } from "@/components/ui/animated-border";
import { SubscriptionActions } from "@/components/ui/subscription-actions";
import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

type Vendor = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string | null;
  location: string | null;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    trialEndsAt?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
  } | null;
};

export default function SettingsPage() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/vendor/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setVendor(data));
  }, []);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    setSaving(true);
    setError(null);
    const fd = new FormData(formRef.current);
    try {
      const res = await fetch("/api/vendor/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: fd.get("businessName") as string,
          ownerName: fd.get("ownerName") as string,
          location: fd.get("location") as string,
          email: fd.get("email") as string,
        }),
      });
      if (!res.ok) throw new Error("Could not save changes");
      const updated = await res.json();
      setVendor(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const v = vendor;

  const planLabel =
    v?.subscription?.plan === "STARTER"
      ? "Starter"
      : v?.subscription?.plan === "GROWTH"
        ? "Growth"
        : v?.subscription?.plan === "PRO"
          ? "Business Pro"
          : "Starter";

  const planPrice =
    v?.subscription?.plan === "STARTER"
      ? "₦2,000 / month"
      : v?.subscription?.plan === "GROWTH"
        ? "₦5,000 / month"
        : v?.subscription?.plan === "PRO"
          ? "₦10,000 / month"
          : "₦2,000 / month";

  const planDesc =
    v?.subscription?.plan === "STARTER"
      ? "Up to 50 customers"
      : v?.subscription?.plan === "GROWTH"
        ? "Up to 200 customers"
        : v?.subscription?.plan === "PRO"
          ? "Unlimited customers"
          : "Up to 50 customers";

  const subStatus = v?.subscription?.status ?? "TRIAL";

  return (
    <div className="min-h-screen bg-[#0F0F0F] p-6 md:p-8">
      {/* Toast notification */}
      {(saved || error) && (
        <div
          style={{ top: "max(1.5rem, calc(env(safe-area-inset-top) + 0.75rem))" }}
          className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-xl text-sm font-medium transition-all ${
            saved
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/25 text-rose-400"
          }`}
        >
          {saved ? (
            <>
              <CheckCircle size={15} />
              Changes saved successfully
            </>
          ) : (
            <>
              <X size={15} />
              {error}
            </>
          )}
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Page header */}
        <div>
          <h1 className="font-serif text-2xl md:text-3xl text-vodium-cream">
            Settings
          </h1>
          <p className="text-vodium-cream/40 text-sm mt-1">
            Manage your shop profile, notifications, and subscription.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* ── Left column ─────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Business profile card */}
            <AnimatedBorder>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
                    <Store size={16} className="text-vodium-gold" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-vodium-cream text-sm">
                      Business profile
                    </h2>
                    <p className="text-xs text-vodium-cream/35">
                      How your shop appears to customers
                    </p>
                  </div>
                </div>

                <form ref={formRef} onSubmit={handleSave} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <DarkField label="Business name">
                      <input
                        name="businessName"
                        type="text"
                        defaultValue={v?.businessName ?? ""}
                        className="input-dark"
                      />
                    </DarkField>
                    <DarkField label="Owner name">
                      <input
                        name="ownerName"
                        type="text"
                        defaultValue={v?.ownerName ?? ""}
                        className="input-dark"
                      />
                    </DarkField>
                  </div>

                  <DarkField label="Business location">
                    <div className="relative">
                      <MapPin
                        size={15}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-vodium-cream/30 pointer-events-none"
                      />
                      <input
                        name="location"
                        type="text"
                        defaultValue={v?.location ?? ""}
                        className="input-dark pl-9"
                      />
                    </div>
                  </DarkField>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <DarkField label="Phone number">
                      <div className="relative">
                        <Lock
                          size={14}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-vodium-cream/30 pointer-events-none"
                        />
                        <input
                          type="tel"
                          value={v?.phone ?? ""}
                          readOnly
                          className="input-dark pl-9 opacity-50 cursor-not-allowed"
                        />
                      </div>
                      <p className="text-[11px] text-vodium-cream/25 mt-1.5">
                        Phone cannot be changed it&rsquo;s your login
                      </p>
                    </DarkField>
                    <DarkField label="Email address">
                      <div className="relative">
                        <Mail
                          size={15}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-vodium-cream/30 pointer-events-none"
                        />
                        <input
                          name="email"
                          type="email"
                          defaultValue={v?.email ?? ""}
                          className="input-dark pl-9"
                        />
                      </div>
                    </DarkField>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-gold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              </div>
            </AnimatedBorder>

            {/* Notifications card */}
            <div className="bg-vodium-charcoal rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
                  <Bell size={16} className="text-vodium-gold" />
                </div>
                <div>
                  <h2 className="font-semibold text-vodium-cream text-sm">
                    Notifications
                  </h2>
                  <p className="text-xs text-vodium-cream/35">
                    WhatsApp and SMS alert preferences
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {[
                  {
                    label: "Auto-reminders to customers",
                    sub: "Adaptive timing before the due date or time",
                    defaultOn: true,
                  },
                  {
                    label: "Overdue alerts to you",
                    sub: "When a credit passes its due date",
                    defaultOn: true,
                  },
                  {
                    label: "Payment confirmations",
                    sub: "When a customer marks credit paid",
                    defaultOn: true,
                  },
                  {
                    label: "Weekly summary report",
                    sub: "Every Monday, overview of your book",
                    defaultOn: false,
                  },
                ].map((n) => (
                  <Toggle
                    key={n.label}
                    label={n.label}
                    sub={n.sub}
                    defaultChecked={n.defaultOn}
                  />
                ))}
              </div>
            </div>

            {/* Security card */}
            <div className="bg-vodium-charcoal rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
                  <Shield size={16} className="text-vodium-gold" />
                </div>
                <div>
                  <h2 className="font-semibold text-vodium-cream text-sm">
                    Security & privacy
                  </h2>
                  <p className="text-xs text-vodium-cream/35">
                    Account protection settings
                  </p>
                </div>
              </div>
              <div className="space-y-0">
                {[
                  {
                    label: "Phone verification",
                    sub: v?.phone ?? "—",
                    badge: "Verified",
                    color: "green" as const,
                  },
                  {
                    label: "Data isolation",
                    sub: "Other vendors cannot see your customers",
                    badge: "Enabled",
                    color: "green" as const,
                  },
                  {
                    label: "NDPR compliance",
                    sub: "Nigeria Data Protection Regulation",
                    badge: "Compliant",
                    color: "green" as const,
                  },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? "border-b border-white/[0.06]" : ""}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-vodium-cream">
                        {row.label}
                      </p>
                      <p className="text-xs text-vodium-cream/35 mt-0.5">
                        {row.sub}
                      </p>
                    </div>
                    <GlowBadge color={row.color}>{row.badge}</GlowBadge>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="border border-rose-500/20 rounded-2xl p-6">
              <h2 className="font-semibold text-rose-400 mb-2 text-sm">
                Danger zone
              </h2>
              <p className="text-sm text-vodium-cream/35 mb-4 leading-relaxed">
                Deleting your account will permanently remove all your credit
                records and customer data. This cannot be undone.
              </p>
              <button className="text-sm text-rose-400 border border-rose-500/25 px-4 py-2 rounded-lg hover:bg-rose-500/5 transition-colors">
                Request account deletion
              </button>
            </div>
          </div>

          {/* ── Right column — subscription card ────────────────────── */}
          <div className="space-y-4">
            <div className="bg-vodium-charcoal rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
                  <CreditCard size={16} className="text-vodium-gold" />
                </div>
                <div>
                  <h2 className="font-semibold text-vodium-cream text-sm">
                    Subscription
                  </h2>
                  <p className="text-xs text-vodium-cream/35">
                    Your current plan & billing
                  </p>
                </div>
              </div>

              {/* Plan badge + status */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <GlowBadge color="gold" className="mb-3">
                    {planLabel} Plan
                  </GlowBadge>
                  <p className="font-serif text-xl text-vodium-cream mt-2">
                    {planPrice}
                  </p>
                  <p className="text-xs text-vodium-cream/40 mt-0.5">
                    {planDesc}
                  </p>
                </div>
                <GlowBadge
                  color={
                    subStatus === "ACTIVE"
                      ? "green"
                      : subStatus === "PAST_DUE" || subStatus === "CANCELLED"
                        ? "red"
                        : "blue"
                  }
                >
                  {subStatus === "ACTIVE"
                    ? "Active"
                    : subStatus === "PAST_DUE"
                      ? "Past due"
                      : subStatus === "CANCELLED"
                        ? "Cancelled"
                        : "Trial"}
                </GlowBadge>
              </div>

              {/* Dates */}
              <div className="space-y-2 mb-6">
                {v?.subscription?.trialEndsAt && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-vodium-cream/40">Trial ends</span>
                    <span className="text-vodium-cream/70 font-medium">
                      {new Date(v.subscription.trialEndsAt).toLocaleDateString(
                        "en-NG",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>
                )}
                {v?.subscription?.currentPeriodStart && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-vodium-cream/40">Period start</span>
                    <span className="text-vodium-cream/70 font-medium">
                      {new Date(
                        v.subscription.currentPeriodStart,
                      ).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {v?.subscription?.currentPeriodEnd && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-vodium-cream/40">Next billing</span>
                    <span className="text-vodium-cream/70 font-medium">
                      {new Date(
                        v.subscription.currentPeriodEnd,
                      ).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {!v?.subscription && (
                  <p className="text-xs text-vodium-cream/35">
                    60-day free trial • No card required
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.06] mb-6" />

              {/* Upgrade / manage billing */}
              <div className="space-y-3">
                <Link
                  href="/dashboard/upgrade"
                  className="btn-gold w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  View all plans
                </Link>
                <SubscriptionActions
                  currentPlan={v?.subscription?.plan ?? "STARTER"}
                  currentStatus={v?.subscription?.status ?? "TRIAL"}
                />
              </div>
            </div>

            {/* Customer reminder preferences */}
            <ReminderSettings />

            {/* Vodium tip */}
            <div className="glass-gold rounded-2xl p-5">
              <p className="text-xs font-semibold text-vodium-gold mb-2">
                Pro tip
              </p>
              <p className="text-xs text-vodium-cream/50 leading-relaxed">
                Business Pro vendors recover up to 3× more credit. Unlimited
                customers, priority WhatsApp delivery, and weekly recovery
                reports.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-vodium-cream/70 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  sub,
  defaultChecked,
}: {
  label: string;
  sub: string;
  defaultChecked: boolean;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/[0.06] last:border-0">
      <div>
        <p className="text-sm font-medium text-vodium-cream">{label}</p>
        <p className="text-xs text-vodium-cream/35 mt-0.5">{sub}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${
          on ? "bg-vodium-gold" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

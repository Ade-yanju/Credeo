"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  MessageCircle,
  CreditCard,
  TrendingUp,
  Bell,
  BarChart3,
  Shield,
  CheckCircle,
  ChevronRight,
  Zap,
  Users,
  Star,
  Smartphone,
  Globe,
  Menu,
  X,
} from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";
import { MagicCard } from "@/components/ui/magic-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { GlowBadge } from "@/components/ui/glow-badge";
import { AnimatedBorder } from "@/components/ui/animated-border";

// ── Fade-up animation variant ────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay, ease: "easeOut" as const },
});

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="bg-vodium-black text-vodium-cream overflow-x-hidden">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass-dark border-b border-white/[0.06] pt-safe px-safe">
        <div className="max-w-6xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-vodium-charcoal border border-vodium-gold/40 flex items-center justify-center">
              <span className="font-serif text-vodium-gold text-lg leading-none">
                V
              </span>
            </div>
            <span className="font-serif tracking-[0.18em] text-vodium-gold text-sm">
              VODIUM LEDGER
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-vodium-cream/55">
            <a
              href="#how-it-works"
              className="hover:text-vodium-gold transition-colors duration-150"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hover:text-vodium-gold transition-colors duration-150"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="hover:text-vodium-gold transition-colors duration-150"
            >
              Pricing
            </a>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-vodium-cream/55 hover:text-vodium-gold transition-colors duration-150"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="btn-gold px-5 py-2.5 rounded-lg text-sm"
            >
              Get started free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-vodium-cream/70 hover:text-vodium-gold transition-colors p-1"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="md:hidden overflow-hidden border-t border-white/[0.06] bg-vodium-black/95 backdrop-blur-xl"
            >
              <div className="px-6 py-5 flex flex-col gap-4 text-sm">
                <a
                  href="#how-it-works"
                  onClick={() => setMobileOpen(false)}
                  className="text-vodium-cream/60 hover:text-vodium-gold transition-colors"
                >
                  How it works
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileOpen(false)}
                  className="text-vodium-cream/60 hover:text-vodium-gold transition-colors"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  onClick={() => setMobileOpen(false)}
                  className="text-vodium-cream/60 hover:text-vodium-gold transition-colors"
                >
                  Pricing
                </a>
                <div className="border-t border-white/[0.07] pt-4 flex flex-col gap-3">
                  <Link
                    href="/login"
                    className="text-vodium-cream/60 hover:text-vodium-gold transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="btn-gold px-5 py-3 rounded-lg text-sm text-center"
                  >
                    Get started free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center mesh-bg bg-dots overflow-hidden pt-16">
        <Spotlight className="-top-40 -left-20 opacity-30" />

        {/* Radial glow blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-vodium-gold/[0.04] rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-vodium-gold/[0.03] rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-24 md:py-36">
          <motion.div {...fadeUp(0)} className="mb-6">
            <GlowBadge color="gold">
              <Smartphone size={11} />
              WhatsApp-first credit tracking
            </GlowBadge>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="font-serif text-5xl md:text-7xl lg:text-[82px] leading-[1.02] mb-7 max-w-4xl"
          >
            Stop losing money
            <br />
            to credit{" "}
            <em className="text-gradient-gold not-italic">defaults.</em>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            className="text-lg md:text-xl text-vodium-cream/60 max-w-2xl leading-relaxed mb-10"
          >
            Vodium Ledger is the WhatsApp-first credit ledger built for Nigerian
            vendors. Record a credit in 15 seconds. Auto-remind customers.
            Track every naira you&rsquo;re owed from your phone, not an app.
          </motion.p>

          <motion.div
            {...fadeUp(0.28)}
            className="flex flex-col sm:flex-row gap-4 mb-16"
          >
            <Link href="/register">
              <ShimmerButton className="h-20 px-8 gap-2 text-base">
                Start free trial <ArrowRight size={17} />
              </ShimmerButton>
            </Link>
            <a
              href="#how-it-works"
              className="btn-ghost inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base"
            >
              See how it works <ChevronRight size={16} />
            </a>
          </motion.div>

          {/* Stat strip */}
          <motion.div
            {...fadeUp(0.36)}
            className="grid grid-cols-3 gap-4 max-w-lg"
          >
            {[
              { value: "₦0", label: "to start" },
              { value: "15 sec", label: "to log a credit" },
              { value: "60 days", label: "free trial" },
            ].map((s) => (
              <div
                key={s.label}
                className="glass-gold rounded-xl px-4 py-3 text-center"
              >
                <p className="font-serif text-xl md:text-2xl text-vodium-gold leading-none mb-1">
                  {s.value}
                </p>
                <p className="text-vodium-cream/45 text-[11px] uppercase tracking-wider">
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Platform numbers ticker ──────────────────────────────────── */}
      <div className="border-y border-white/[0.06] py-8 px-6 md:px-12 bg-vodium-charcoal/40">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "127+", label: "Active vendors" },
              { value: "₦47M+", label: "Credit tracked" },
              { value: "4,800+", label: "Customers with history" },
              { value: "73%", label: "Repayment rate" },
            ].map((s) => (
              <div key={s.label}>
                <p className="font-serif text-3xl md:text-4xl text-vodium-gold mb-1">
                  {s.value}
                </p>
                <p className="text-vodium-cream/45 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Product visualization ───────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(201,169,97,0.05),transparent)] pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <p className="text-vodium-gold text-xs tracking-[0.35em] uppercase mb-4">
              The platform
            </p>
            <h2 className="font-serif text-4xl md:text-5xl max-w-2xl mx-auto leading-tight">
              See everything.
              <br />
              <span className="text-gradient-gold">From anywhere.</span>
            </h2>
            <p className="text-vodium-cream/50 mt-5 max-w-lg mx-auto text-sm leading-relaxed">
              Your full credit book live on any browser. Add from WhatsApp.
              Review on web. Send reminders with one tap.
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.12)} className="relative">
            {/* Glow border wrapper */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-vodium-gold/20 via-vodium-gold/5 to-transparent pointer-events-none z-10" />
            <div className="relative bg-[#0D0D0D] rounded-2xl border border-white/[0.06] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)]">
              {/* Mock browser bar */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-[#111111] border-b border-white/[0.05]">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                </div>
                <div className="flex-1 mx-3 bg-[#1A1A1A] rounded-md h-6 flex items-center px-3 gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-white/[0.12] flex-shrink-0" />
                  <span className="text-[11px] text-vodium-cream/20">
                    vodiumledger.com/dashboard
                  </span>
                </div>
              </div>

              {/* Mock dashboard */}
              <div className="flex min-h-[420px]">
                {/* Sidebar */}
                <div className="w-14 xl:w-[180px] bg-[#080808] border-r border-white/[0.04] flex flex-col p-2 flex-shrink-0">
                  {/* Logo */}
                  <div className="h-10 flex items-center justify-center xl:justify-start xl:px-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-vodium-charcoal border border-vodium-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="font-serif text-vodium-gold text-xs">
                        V
                      </span>
                    </div>
                    <span className="hidden xl:block ml-2 font-serif text-[10px] tracking-[0.2em] text-vodium-gold">
                      VODIUM
                    </span>
                  </div>
                  {/* Nav items */}
                  {[
                    { label: "Overview", active: true },
                    { label: "Credits", active: false },
                    { label: "Customers", active: false },
                    { label: "Settings", active: false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`h-8 rounded-md mb-1 flex items-center gap-2.5 px-2 transition-colors ${item.active ? "bg-vodium-gold/10 border-l-2 border-vodium-gold" : "opacity-40"}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.active ? "bg-vodium-gold" : "bg-vodium-cream/30"}`}
                      />
                      <span
                        className={`hidden xl:block text-[11px] font-medium ${item.active ? "text-vodium-gold" : "text-vodium-cream/40"}`}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Main content */}
                <div className="flex-1 p-4 md:p-6 space-y-4 overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-serif text-sm text-vodium-cream">
                        Mama Taiwo&apos;s Provisions
                      </p>
                      <p className="text-[10px] text-vodium-cream/30 mt-0.5">
                        UNILAG Campus
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] font-medium text-emerald-400">
                          ● Growth Plan
                        </span>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
                        <span className="text-vodium-gold text-xs font-bold font-serif">
                          M
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {[
                      {
                        label: "Total owed",
                        value: "₦142,500",
                        color: "text-vodium-cream",
                        ring: "ring-white/[0.06]",
                      },
                      {
                        label: "Paid this month",
                        value: "₦38,000",
                        color: "text-emerald-400",
                        ring: "ring-emerald-500/15",
                      },
                      {
                        label: "Overdue",
                        value: "7 credits",
                        color: "text-rose-400",
                        ring: "ring-rose-500/15",
                      },
                      {
                        label: "Recovery rate",
                        value: "71%",
                        color: "text-vodium-gold",
                        ring: "ring-vodium-gold/15",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={`bg-vodium-charcoal/60 rounded-xl p-3 ring-1 ${s.ring}`}
                      >
                        <p className="text-[9px] text-vodium-cream/35 uppercase tracking-wider mb-1">
                          {s.label}
                        </p>
                        <p
                          className={`font-serif text-base leading-none ${s.color}`}
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div className="bg-vodium-charcoal/40 rounded-xl border border-white/[0.05] overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/[0.04]">
                      <p className="text-[11px] font-semibold text-vodium-cream/50 uppercase tracking-wider">
                        Overdue credits
                      </p>
                    </div>
                    {[
                      {
                        name: "Tunde Adesanya",
                        matric: "100L/ECO/23",
                        amount: "₦4,500",
                        days: "5 days",
                      },
                      {
                        name: "Bimpe Olawale",
                        matric: "200L/LAW/22",
                        amount: "₦2,000",
                        days: "3 days",
                      },
                      {
                        name: "Emeka Chukwu",
                        matric: "300L/MED/21",
                        amount: "₦8,750",
                        days: "12 days",
                      },
                    ].map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] last:border-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-rose-400 text-[10px] font-bold">
                              {row.name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-vodium-cream">
                              {row.name}
                            </p>
                            <p className="text-[9px] text-vodium-cream/30">
                              {row.matric}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-rose-400/70">
                            {row.days} overdue
                          </span>
                          <span className="font-serif text-sm text-rose-400">
                            {row.amount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom fade overlay */}
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-vodium-black to-transparent pointer-events-none rounded-b-2xl" />
          </motion.div>

          {/* Caption row */}
          <motion.div
            {...fadeUp(0.2)}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-10 text-sm text-vodium-cream/40"
          >
            {[
              "Live repayment data",
              "Auto-reminder delivery",
              "Zero manual chasing",
            ].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-vodium-gold/60" />{" "}
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()}>
            <p className="text-vodium-gold text-xs tracking-[0.35em] uppercase mb-4">
              Simple by design
            </p>
            <h2 className="font-serif text-4xl md:text-5xl mb-16 max-w-xl leading-tight">
              Three steps.
              <br />
              Zero confusion.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                number: "01",
                icon: <MessageCircle size={22} />,
                title: "Record credit on WhatsApp",
                body: "Send ADD to your Vodium number on WhatsApp. We guide you through it. Name, amount, due date, done in 15 seconds. No app to download.",
              },
              {
                number: "02",
                icon: <Bell size={22} />,
                title: "Auto-reminders to customers",
                body: "Before repayment is due, a respectful WhatsApp message goes to the customer at the right time. No chasing from you. Dignity intact for them.",
              },
              {
                number: "03",
                icon: <BarChart3 size={22} />,
                title: "Track on your dashboard",
                body: "Log in from any browser to see who owes, who&rsquo;s paid, and what&rsquo;s overdue. Mark payments with a tap. Know your cash position.",
              },
            ].map((step, i) => (
              <motion.div key={step.number} {...fadeUp(i * 0.1)}>
                <AnimatedBorder className="p-7 h-full">
                  <div className="flex items-start justify-between mb-6">
                    <p className="font-serif text-5xl text-vodium-gold/20 leading-none">
                      {step.number}
                    </p>
                    <div className="w-10 h-10 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center text-vodium-gold">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="font-serif text-2xl mb-3 text-vodium-cream">
                    {step.title}
                  </h3>
                  <p className="text-vodium-cream/55 leading-relaxed text-sm">
                    {step.body}
                  </p>
                </AnimatedBorder>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="brand-divider mx-6 md:mx-12" />

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()}>
            <p className="text-vodium-gold text-xs tracking-[0.35em] uppercase mb-4">
              Everything you need
            </p>
            <h2 className="font-serif text-4xl md:text-5xl mb-16 leading-tight">
              Built for the vendor.
              <br />
              <span className="text-gradient-gold">Nothing extra.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <MessageCircle size={20} />,
                title: "WhatsApp bot",
                body: "Every core action add credit, mark paid, view who owes works from the chat app you already use every day.",
                delay: 0,
              },
              {
                icon: <CreditCard size={20} />,
                title: "Credit tracking",
                body: "Record any credit in 15 seconds. Set due dates, track amounts, and never lose track of a transaction again.",
                delay: 0.05,
              },
              {
                icon: <TrendingUp size={20} />,
                title: "Credit scores",
                body: "See how reliably any customer pays across the Vodium vendor network before you extend credit.",
                delay: 0.1,
              },
              {
                icon: <Bell size={20} />,
                title: "Smart reminders",
                body: "Respectful WhatsApp reminders go out automatically. Students pay before the date. You recover without a single phone call.",
                delay: 0.15,
              },
              {
                icon: <BarChart3 size={20} />,
                title: "Analytics dashboard",
                body: "Monthly credit volume, recovery rate, top customers, overdue trends your whole book at a glance on any device.",
                delay: 0.2,
              },
              {
                icon: <Shield size={20} />,
                title: "Privacy & NDPR",
                body: "Your customer data is encrypted and isolated. No other vendor can see your book. Fully compliant with Nigeria&rsquo;s NDPR.",
                delay: 0.25,
              },
            ].map((f) => (
              <motion.div key={f.title} {...fadeUp(f.delay)}>
                <MagicCard className="p-7 h-full">
                  <div className="w-10 h-10 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center text-vodium-gold mb-5">
                    {f.icon}
                  </div>
                  <h3 className="font-serif text-xl mb-3 text-vodium-cream">
                    {f.title}
                  </h3>
                  <p className="text-vodium-cream/50 leading-relaxed text-sm">
                    {f.body}
                  </p>
                </MagicCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof / trust strip ───────────────────────────────── */}
      <div className="bg-vodium-charcoal/60 border-y border-white/[0.06] py-10 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {["M", "T", "B", "W", "A"].map((initial) => (
                  <div
                    key={initial}
                    className="w-9 h-9 rounded-full bg-vodium-charcoal border-2 border-vodium-black flex items-center justify-center"
                  >
                    <span className="font-serif text-vodium-gold text-xs">
                      {initial}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-vodium-cream text-sm font-medium">
                  127 vendors trust Vodium Ledger
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={11}
                      className="text-vodium-gold fill-vodium-gold"
                    />
                  ))}
                  <span className="text-vodium-cream/40 text-xs ml-1">
                    4.9 / 5 from pilot vendors
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <GlowBadge color="green">
                <Globe size={10} />
                Built for Nigerian vendors
              </GlowBadge>
              <GlowBadge color="gold">
                <Zap size={10} />
                WhatsApp-native
              </GlowBadge>
            </div>
          </div>
        </div>
      </div>

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()}>
            <p className="text-vodium-gold text-xs tracking-[0.35em] uppercase mb-4 text-center">
              What vendors say
            </p>
            <h2 className="font-serif text-4xl md:text-5xl mb-14 text-center">
              Real results.
              <br />
              Real vendors.
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                quote:
                  "Vodium saved me ₦45,000 last semester. Three customers I would have written off paid because of the reminders.",
                name: "Mama Taiwo",
                role: "Provisions vendor, UNILAG, 63 customers tracked",
                delay: 0,
              },
              {
                quote:
                  "I check every customer's Vodium score before I give credit now. One customer had a score of 320, I said no. Turned out she owed 4 other shops. Game changer.",
                name: "Baba Wale",
                role: "Food Canteen, OAU, 89 customers tracked",
                delay: 0.1,
              },
            ].map((t) => (
              <motion.div key={t.name} {...fadeUp(t.delay)}>
                <AnimatedBorder className="p-8 h-full">
                  <div className="flex gap-1 mb-5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className="text-vodium-gold fill-vodium-gold"
                      />
                    ))}
                  </div>
                  <p className="text-vodium-cream/80 leading-relaxed mb-6 text-base italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-medium text-vodium-cream text-sm">
                      {t.name}
                    </p>
                    <p className="text-vodium-cream/40 text-xs mt-0.5">
                      {t.role}
                    </p>
                  </div>
                </AnimatedBorder>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="brand-divider mx-6 md:mx-12" />

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()}>
            <p className="text-vodium-gold text-xs tracking-[0.35em] uppercase mb-4 text-center">
              Pricing
            </p>
            <h2 className="font-serif text-4xl md:text-5xl mb-4 text-center">
              Simple. Honest. Naira.
            </h2>
            <p className="text-vodium-cream/55 text-center mb-14 max-w-lg mx-auto">
              All plans include 60 days free. No credit card required. No hidden
              fees. Cancel any time.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                plan: "Starter",
                price: "₦2,000",
                sub: "/month after trial",
                description: "Up to 50 customers. Perfect to get started.",
                features: [
                  "WhatsApp bot access",
                  "Credit tracking",
                  "Auto-reminders",
                  "Web dashboard",
                  "Up to 50 customers",
                ],
                popular: false,
                delay: 0,
              },
              {
                plan: "Growth",
                price: "₦5,000",
                sub: "/month after trial",
                description: "Up to 200 customers + cross-vendor credit scores.",
                features: [
                  "Everything in Starter",
                  "Cross-vendor credit scores",
                  "Dashboard analytics",
                  "Up to 200 customers",
                  "CSV export",
                ],
                popular: true,
                delay: 0.08,
              },
              {
                plan: "Business Pro",
                price: "₦10,000",
                sub: "/month after trial",
                description:
                  "Unlimited customers. Full analytics. Priority support.",
                features: [
                  "Everything in Growth",
                  "Unlimited customers",
                  "Priority WhatsApp support",
                  "Monthly report PDF",
                  "API access (beta)",
                ],
                popular: false,
                delay: 0.16,
              },
            ].map((tier) => (
              <motion.div
                key={tier.plan}
                {...fadeUp(tier.delay)}
                className="relative"
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-vodium-gold text-vodium-black text-xs font-bold px-4 py-1.5 rounded-full tracking-wide">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div
                  className={`relative rounded-2xl p-7 h-full flex flex-col ${
                    tier.popular
                      ? "bg-vodium-charcoal border-2 border-vodium-gold shadow-[0_0_40px_rgba(201,169,97,0.12)]"
                      : "bg-vodium-charcoal/60 border border-white/[0.07]"
                  }`}
                >
                  <p className="text-vodium-cream/45 text-xs font-semibold tracking-widest uppercase mb-4">
                    {tier.plan}
                  </p>
                  <p className="font-serif text-4xl text-vodium-cream mb-0.5">
                    {tier.price}
                  </p>
                  <p className="text-xs text-vodium-cream/35 mb-4">
                    {tier.sub}
                  </p>
                  <p className="text-vodium-cream/60 text-sm mb-7 leading-relaxed">
                    {tier.description}
                  </p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-sm text-vodium-cream/70"
                      >
                        <CheckCircle
                          size={14}
                          className="text-vodium-gold flex-shrink-0 mt-0.5"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`w-full py-3.5 rounded-xl text-sm font-semibold text-center transition-all inline-block ${
                      tier.popular
                        ? "btn-gold"
                        : "border border-white/[0.12] text-vodium-cream hover:border-vodium-gold hover:text-vodium-gold"
                    }`}
                  >
                    Start free trial
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="mesh-bg py-24 md:py-36 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-dots opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(201,169,97,0.06),transparent)] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp()}>
            <GlowBadge color="gold" className="mb-7 inline-flex">
              <Users size={11} />
              Join 127 vendors already using Vodium
            </GlowBadge>
          </motion.div>
          <motion.h2
            {...fadeUp(0.08)}
            className="font-serif text-4xl md:text-6xl mb-6 leading-tight"
          >
            Built for the vendor.
            <br />
            <em className="text-gradient-gold not-italic">Owned by Africa.</em>
          </motion.h2>
          <motion.p
            {...fadeUp(0.16)}
            className="text-vodium-cream/55 mb-10 text-lg leading-relaxed"
          >
            Vodium Ledger is the first step in Africa&rsquo;s premium credit
            ecosystem. Every credit you track builds the graph that makes
            lending smarter for everyone.
          </motion.p>
          <motion.div {...fadeUp(0.22)}>
            <Link href="/register">
              <ShimmerButton className="h-20 px-10 gap-2 text-base">
                Sign your shop up it&rsquo;s free <ArrowRight size={18} />
              </ShimmerButton>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-14 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-vodium-charcoal border border-vodium-gold/40 flex items-center justify-center">
                  <span className="font-serif text-vodium-gold text-sm">V</span>
                </div>
                <span className="font-serif tracking-[0.15em] text-vodium-gold text-xs">
                  VODIUM LEDGER
                </span>
              </div>
              <p className="text-vodium-cream/35 text-sm leading-relaxed">
                Africa&rsquo;s credit infrastructure layer. Starting with
                Nigerian vendors.
              </p>
            </div>

            {/* Product */}
            <FooterLinks
              title="Product"
              links={[
                { label: "How it works", href: "#how-it-works" },
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "WhatsApp bot", href: "/whatsapp" },
              ]}
            />

            {/* Company */}
            <FooterLinks
              title="Company"
              links={[
                { label: "About", href: "/about" },
                { label: "Blog", href: "/blog" },
                { label: "Careers", href: "/careers" },
              ]}
            />

            {/* Legal */}
            <FooterLinks
              title="Legal"
              links={[
                { label: "Privacy policy", href: "/privacy" },
                { label: "Terms of service", href: "/terms" },
                { label: "NDPR compliance", href: "/privacy#your-rights-ndpr" },
              ]}
            />
          </div>

          <div className="brand-divider mb-8" />
          <div className="flex flex-col md:flex-row justify-between gap-4 text-vodium-cream/30 text-xs">
            <p>© 2026 Vodium. Lagos, Nigeria. All rights reserved.<br />Vodium Ledger is operated by VODIUMX TECHNOLOGIES LTD (RC: 8976921).</p>
            {/* <p>hello@vodiumledger.com</p> */}
          </div>
        </div>
      </footer>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-vodium-cream text-xs font-semibold tracking-widest uppercase mb-4">
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-vodium-cream/35 hover:text-vodium-gold text-sm transition-colors duration-150"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

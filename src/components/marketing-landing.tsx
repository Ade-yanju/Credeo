"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Receipt,
  Settings,
  Shield,
  Smartphone,
  Store,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { WhatsAppChat } from "@/components/ui/whatsapp-chat";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { useScrollSteps } from "@/hooks/use-scroll-steps";
import {
  ADD_CONVERSATION,
  REMINDER_CONVERSATION,
} from "@/lib/whatsapp-demo-data";

/**
 * Marketing landing page.
 *
 * Motion budget: one entrance on the hero, and a single short reveal per
 * section as it scrolls in. Previously every card, heading and stat carried its
 * own staggered fade-up with delays up to 0.36s, which meant a vendor on a
 * mid-range Android watched content arrive in pieces for about a second before
 * they could read the page.
 */

// One reveal, reused. `once` so scrolling back up doesn't replay it.
const reveal = {
  initial: { opacity: 0, y: 8 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
};

/** Alt text for the hero card fan, which renders as a single `role="img"`. */
const HERO_VISUAL_LABEL =
  "A fan of Vodium Ledger cards: a prepaid card showing a ₦660,388 balance, a gold Vodium ledger card, a black debit card, a vendor card ending 1234, and a store card.";

/**
 * Chip and contactless glyphs for the hero card fan.
 *
 * Inline SVG rather than an icon-set import: these are card furniture drawn to
 * a specific size, and lucide has no chip.
 */
function CardChip({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 26" className={className} aria-hidden>
      <rect
        x="0.6"
        y="0.6"
        width="32.8"
        height="24.8"
        rx="4"
        fill="#D8C79B"
        stroke="#A78F5C"
        strokeWidth="1.2"
      />
      <path
        d="M11 0.6v6.4H0.6M23 0.6v6.4h10.4M11 25.4v-6.4H0.6M23 25.4v-6.4h10.4M11 9.5h12v7H11z"
        fill="none"
        stroke="#A78F5C"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function Contactless({ className = "" }: { className?: string }) {
  // Three arcs of growing radius struck from the same centre, all bulging
  // right — the standard contactless mark.
  return (
    <svg viewBox="0 0 14 20" className={className} fill="none" aria-hidden>
      {[4, 7, 10].map((r, i) => (
        <path
          key={r}
          d={`M2 ${10 - r} A ${r} ${r} 0 0 1 2 ${10 + r}`}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={1 - i * 0.22}
        />
      ))}
    </svg>
  );
}

/**
 * Hero card fan.
 *
 * Five cards on a fixed 620×400 stage, absolutely positioned and then scaled as
 * a whole by breakpoint. Scaling one stage keeps every rotation and overlap
 * exactly as composed at any width — positioning the cards in percentages
 * instead makes them slide over each other into an unreadable pile on a phone.
 * `transform` does not affect layout, so the stage is absolutely centred inside
 * a responsive wrapper and never widens the page.
 *
 * Tops trace a shallow arc with the black card highest, so the group reads as a
 * fan rather than a stack.
 */
function HeroCardFan() {
  return (
    <div
      role="img"
      aria-label={HERO_VISUAL_LABEL}
      className="relative h-[260px] w-full overflow-hidden sm:h-[330px] md:h-[400px]"
    >
      <div className="absolute left-1/2 top-1/2 h-[400px] w-[620px] -translate-x-1/2 -translate-y-1/2 scale-[0.5] sm:scale-[0.66] md:scale-[0.8] lg:scale-[0.92] xl:scale-100">
        {/* 1 — prepaid, cream, vertical balance */}
        <div className="absolute left-0 top-[112px] h-[228px] w-[150px] -rotate-[14deg] rounded-2xl bg-[#EFEDE5] p-4 shadow-[0_18px_40px_rgba(0,0,0,.28)]">
          <div className="flex h-full flex-col justify-between">
            <p className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-wide text-black/45">
              Prepaid · ₦660,388 balance
            </p>
            <CardChip className="h-[26px] w-[34px]" />
          </div>
        </div>

        {/* 2 — gold, the Vodium card */}
        <div className="absolute left-[114px] top-[74px] h-[228px] w-[150px] -rotate-[7deg] overflow-hidden rounded-2xl bg-[linear-gradient(150deg,#E3CB8E,#C9A961_42%,#8A6A2A)] p-4 shadow-[0_20px_44px_rgba(0,0,0,.32)]">
          <div
            aria-hidden
            className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-black/10 bg-white/10"
          />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-serif text-[13px] leading-none text-black/70">
                VODIUM
              </span>
              <Contactless className="h-4 w-4 text-black/50" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-black/50">
                Ledger
              </p>
              <p className="tnum mt-1 text-[15px] font-semibold text-black/80">
                ₦142,500
              </p>
            </div>
          </div>
        </div>

        {/* 3 — black debit, highest point of the arc */}
        <div className="absolute left-[228px] top-[26px] h-[228px] w-[150px] rotate-[11deg] rounded-2xl bg-[#121212] p-4 shadow-[0_22px_48px_rgba(0,0,0,.42)]">
          <div className="flex h-full flex-col justify-between">
            <p className="self-end [writing-mode:vertical-rl] text-[11px] tracking-wide text-white/40">
              debit
            </p>
            <div className="flex items-end justify-between">
              <CardChip className="h-[26px] w-[34px]" />
              <span aria-hidden className="relative block h-7 w-11">
                <span className="absolute left-0 top-0 h-7 w-7 rounded-full bg-vodium-gold/90" />
                <span className="absolute right-0 top-0 h-7 w-7 rounded-full bg-[#E3CB8E]/70" />
              </span>
            </div>
          </div>
        </div>

        {/* 4 — white vendor card, front of the fan */}
        <div className="absolute left-[338px] top-[94px] z-10 h-[228px] w-[150px] -rotate-[3deg] overflow-hidden rounded-2xl bg-white p-4 shadow-[0_24px_52px_rgba(0,0,0,.34)]">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <CardChip className="h-[26px] w-[34px]" />
              <Contactless className="h-4 w-3 text-black/35" />
            </div>
            <p className="tnum text-[13px] tracking-[0.08em] text-black/55">
              •••• •••• 1234
            </p>
            <div>
              <div
                aria-hidden
                className="-mx-4 mb-3 h-5 bg-[linear-gradient(90deg,#C9A961,#8A6A2A_58%,#0A0A0A)]"
              />
              <div className="flex items-end justify-between">
                <p className="tnum text-[11px] font-medium text-black/70">
                  Vendor 1234
                </p>
                <p className="font-serif text-[11px] text-black/45">VODIUM</p>
              </div>
            </div>
          </div>
        </div>

        {/* 5 — split black/gold, tail of the fan */}
        <div className="absolute left-[462px] top-[60px] h-[228px] w-[150px] rotate-[15deg] overflow-hidden rounded-2xl bg-[#141414] shadow-[0_18px_40px_rgba(0,0,0,.36)]">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-[42%] bg-[linear-gradient(180deg,#D8BE85,#9A7530)]"
          />
          <div className="relative flex h-full flex-col justify-between p-4">
            <CardChip className="h-[26px] w-[34px]" />
            <div>
              <p className="tnum text-[11px] font-medium text-white/80">
                Vendor 1234
              </p>
              <p className="tnum text-[10px] text-white/45">02/28</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    icon: MessageCircle,
    meta: "About 15 seconds",
    title: "Record credit on WhatsApp",
    body: "Send ADD to your Vodium number. We guide you through it — name, amount, due date. Done in 15 seconds, with no app to download.",
  },
  {
    n: "02",
    icon: Bell,
    meta: "Runs on its own",
    title: "Auto-reminders to customers",
    body: "Before repayment is due, a respectful WhatsApp message goes to the customer at the right time. No chasing from you, dignity intact for them.",
  },
  {
    n: "03",
    icon: BarChart3,
    meta: "Any browser",
    title: "Track on your dashboard",
    body: "Log in from any browser to see who owes, who has paid, and what is overdue. Mark payments with a tap and know your cash position.",
  },
];

/**
 * The two panel rows in the features section.
 *
 * Both rows render through the same `PanelCard`: a flat gold field with a white
 * product mockup bleeding off its edges, then a gold heading and one line of
 * body copy beneath.
 *
 * The trust row used to be three hairline cells with a 17px icon in the corner.
 * Sitting directly under the gold row it read as a footnote to the section
 * rather than part of it — which put the least design on the page behind the
 * promise a vendor most needs to believe before handing over their whole
 * customer book. Trust signals before features.
 *
 * `art` keys into `PanelArt`. Every mockup is a different idea rather than a
 * recolour of its neighbour, so six gold panels in a column still read as six
 * things.
 */
const FEATURE_PANELS = [
  {
    title: "Credit intelligence",
    body: "See every open balance, due date and repayment in one place.",
    art: "ledger",
  },
  {
    title: "Customer history",
    body: "Understand payment behaviour before you extend another credit.",
    art: "network",
  },
  {
    title: "Smart reminders",
    body: "Send polished, timely reminders without chasing customers yourself.",
    art: "invoice",
  },
] as const;

const TRUST_PANELS = [
  {
    title: "NDPR compliant",
    body: "Customer records are encrypted and handled under Nigeria's data protection rules.",
    art: "encrypted",
  },
  {
    title: "Your book stays yours",
    body: "Each vendor's data is isolated. No other shop can see your customers or balances.",
    art: "isolated",
  },
  {
    title: "Works on any phone",
    body: "No app to download and no storage to spare — if WhatsApp runs, Vodium runs.",
    art: "anyphone",
  },
] as const;

type PanelArtKey =
  | (typeof FEATURE_PANELS)[number]["art"]
  | (typeof TRUST_PANELS)[number]["art"];

const TIERS = [
  {
    plan: "Starter",
    icon: Store,
    audience: "For small shops",
    price: "₦2,000",
    sub: "after your free trial",
    description: "Up to 50 customers. Everything you need to get started.",
    features: [
      "WhatsApp bot access",
      "Credit tracking",
      "Auto-reminders",
      "Web dashboard",
      "Up to 50 customers",
    ],
    notIncluded: [
      "Cross-vendor credit scores",
      "Dashboard analytics",
      "CSV export",
    ],
    popular: false,
  },
  {
    plan: "Growth",
    icon: Users,
    audience: "For growing shops",
    price: "₦5,000",
    sub: "after your free trial",
    description: "Up to 200 customers, plus cross-vendor credit scores.",
    features: [
      "Everything in Starter",
      "Cross-vendor credit scores",
      "Dashboard analytics",
      "Up to 200 customers",
      "CSV export",
    ],
    notIncluded: [
      "Unlimited customers",
      "Priority WhatsApp support",
      "API access (beta)",
    ],
    popular: true,
  },
  {
    plan: "Business Pro",
    icon: Building2,
    audience: "For multi-branch",
    price: "₦10,000",
    sub: "after your free trial",
    description: "Unlimited customers, full analytics and priority support.",
    features: [
      "Everything in Growth",
      "Unlimited customers",
      "Priority WhatsApp support",
      "Monthly report PDF",
      "API access (beta)",
    ],
    // Top tier — nothing is held back, so the card omits the excluded block
    // rather than inventing a limitation to fill the space.
    notIncluded: [],
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Vodium saved me ₦45,000 last semester. Three customers I would have written off paid because of the reminders.",
    name: "Mama Taiwo",
    role: "Provisions vendor · 63 customers tracked",
  },
  {
    quote:
      "I check every customer's Vodium score before I give credit now. One customer had a score of 320, so I said no. Turned out she owed four other shops.",
    name: "Baba Wale",
    role: "Food canteen · 89 customers tracked",
  },
];

export default function LandingPage() {
  // Reduce Motion is applied globally by MotionProvider. Deriving it here with
  // useReducedMotion() and switching `initial` on it renders a different tree
  // on the server than on the client, which breaks hydration for anyone who
  // has the preference enabled. See src/components/motion-provider.tsx.
  const anim = reveal;

  return (
    // `overflow-x-clip`, not `-hidden`: `hidden` makes this element a scroll
    // container, which retargets every descendant `position: sticky` from the
    // viewport to this box — the step sequence's companion panel then sticks to
    // the top of the page instead of holding below the fixed nav. `clip` does
    // the same overflow trimming without creating the scroll container.
    <main className="marketing-page overflow-x-clip">
      <SiteNav />

      {/* ── Hero ───────────────────────────────────────────────────────
          The light band starts *below* the nav rather than running to the top
          of the page. SiteNav is shared by seven pages and its links are cream,
          transparent until you scroll 8px — over a light hero those links would
          be invisible at rest, and recolouring the nav would change every other
          page too. The dark strip behind it keeps them legible.

          `band-light` on the inner panel, not the section: the strip above has
          to stay black for exactly that reason. */}
      <section className="bg-[color:var(--surface-0)] pt-16">
        <div className="band-light relative overflow-hidden bg-[color:var(--surface-2)] px-4 pb-14 pt-10 md:px-10">
          {/* Blueprint grid, the one piece of atmosphere in the band. Two 1px
              gradients on a 96px tile. The reference's rules are dashed, but a
              dash needs colour bounded on both axes and a linear gradient can
              only bound one — sizing a repeating gradient to the cell repeats
              the dash inside every cell and collapses into dense hatching. At
              this opacity a hairline reads the same. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(10,10,10,.11)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,.11)_1px,transparent_1px)] [background-size:96px_96px]"
          />

          <p className="relative mb-8 text-center text-[11px] text-[color:var(--text-tertiary)]">
            Credit infrastructure for ambitious Nigerian vendors.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto grid max-w-6xl items-center border-y border-[color:var(--hairline)] md:grid-cols-[.85fr_1.15fr]"
          >
            <div className="border-b border-[color:var(--hairline)] py-12 pr-4 md:border-b-0 md:border-r md:py-16 md:pr-10">
              <span className="mb-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--hairline)] bg-[color:var(--surface-0)] px-3 py-1.5 text-[11px] font-semibold shadow-sm">
                <Zap size={12} className="text-vodium-gold" aria-hidden />
                Credit control in seconds
              </span>

              <h1 className="max-w-md font-serif text-[40px] leading-[1.04] tracking-[-0.035em] sm:text-[50px]">
                Know who owes you. Get paid sooner.
              </h1>

              <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
                Credit tracking for vendors that just works — record a credit on
                WhatsApp, and Vodium chases it for you.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-vodium-black px-5 text-[13px] font-semibold text-vodium-cream shadow-[0_8px_20px_rgba(0,0,0,.18)] transition-colors hover:bg-vodium-charcoal"
                >
                  Get Started <ChevronRight size={15} />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[color:var(--hairline-strong)] bg-[color:var(--surface-0)] px-5 text-[13px] font-semibold text-[color:var(--text-primary)] shadow-sm transition-colors hover:border-[color:var(--text-tertiary)]"
                >
                  See how it works <ChevronRight size={15} />
                </a>
              </div>
            </div>

            <HeroCardFan />
          </motion.div>
        </div>
      </section>

      {/* ── Platform numbers ─────────────────────────────────────────
          Stays on the light band so the hero reads as one white opening block
          before the page drops to black for the product shot. */}
      <section className="band-light border-y border-[color:var(--hairline)] px-6 py-10 md:px-12">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "127+", label: "Active vendors" },
            { value: "₦47M+", label: "Credit tracked" },
            { value: "4,800+", label: "Customers with history" },
            { value: "73%", label: "Repayment rate" },
          ].map((s) => (
            <div key={s.label}>
              <dd className="tnum text-[28px] leading-none text-[color:var(--text-primary)] md:text-[32px]">
                {s.value}
              </dd>
              <dt className="mt-2 text-[13px] text-[color:var(--text-tertiary)]">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Platform ───────────────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-12 md:py-28">
        <motion.div {...anim} className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl">
            <p className="eyebrow mb-4">The platform</p>
            <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
              Your whole credit book, live.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
              Add from WhatsApp, review on the web, send reminders with one tap.
            </p>
          </div>

          <DashboardMockup />
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────
          Light band. Both step visuals — a dark WhatsApp mockup and a pale
          ledger table — carry more weight against white than they did floating
          on near-black, where the mockup's own dark chrome had nothing to push
          against. */}
      <section
        id="how-it-works"
        className="band-light scroll-mt-20 px-6 py-20 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div {...anim} className="mb-14">
            <div className="max-w-xl">
              <p className="eyebrow mb-4">Simple by design</p>
              <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
                Your ledger lives in WhatsApp.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
                Nothing to download and nothing to learn. You already know how
                to send a message — that is the whole product.
              </p>
            </div>

            {/* The three questions a vendor is actually weighing before they
                read a single step: do I have to install something, do I have to
                learn something, and how long does this take me each time. */}
            <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-[color:var(--hairline)] pt-6">
              {[
                { icon: Smartphone, label: "No app to download" },
                { icon: HelpCircle, label: "No training needed" },
                { icon: Zap, label: "15 seconds per credit" },
              ].map((fact) => (
                <li
                  key={fact.label}
                  className="flex items-center gap-2 text-[13px] text-[color:var(--text-secondary)]"
                >
                  <fact.icon
                    size={14}
                    className="text-[color:var(--gold-ink)]"
                    aria-hidden
                  />
                  {fact.label}
                </li>
              ))}
            </ul>
          </motion.div>

          <StepSequence />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────
          Stays on the black band. The gold panels are the loudest thing on the
          page and they need the dark ground to land — on white, a gold field
          carrying white mockups collapses into one pale mass. */}
      <section
        id="features"
        className="scroll-mt-20 px-6 py-20 md:px-12 md:py-28"
      >
        <motion.div {...anim} className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <p className="eyebrow mb-4">Everything you need</p>
            <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
              Built for the vendor. Nothing extra.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
              Everything you need to record, track and recover vendor credit —
              securely, and from the phone already in your hand.
            </p>
          </div>

          {/* Two rows of three, same treatment, same gap: capability on top,
              the trust promise underneath, reading as one six-panel grid. */}
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURE_PANELS.map((panel) => (
              <PanelCard key={panel.title} {...panel} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {TRUST_PANELS.map((panel) => (
              <PanelCard key={panel.title} {...panel} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────
          Light band. A vendor's own words carry further on white than as pale
          cream text on black, and it breaks up the run of dark sections between
          the features and the price. */}
      <section className="band-light border-t border-[color:var(--hairline)] px-6 py-20 md:px-12 md:py-28">
        <motion.div {...anim} className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-[34px] leading-tight tracking-[-0.02em] md:text-[46px]">
            {/* Explicit space: JSX drops whitespace that spans a newline, so
                without it the two halves render as one word. */}
            <span className="text-[color:var(--text-quaternary)]">Vendor</span>{" "}
            <span className="text-[color:var(--gold-ink)]">Voices</span>
          </h2>
          <VendorVoices />
        </motion.div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="scroll-mt-20 px-6 py-20 md:px-12 md:py-28"
      >
        <motion.div {...anim} className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl">
            <p className="eyebrow mb-4">Pricing</p>
            <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
              Simple. Honest. Naira.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
              All plans include 60 days free. No card required, no hidden fees,
              cancel any time.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.plan}
                className={`flex h-full flex-col rounded-2xl border p-3 ${
                  tier.popular
                    ? "border-vodium-gold/30 bg-[color:var(--surface-1)]"
                    : "border-[color:var(--hairline)] bg-[color:var(--surface-1)]"
                }`}
              >
                {/* Raised head: plan, audience, price and the call to action.
                    Everything a vendor needs to choose sits above the fold of
                    the card; the feature lists below are for confirming. */}
                <div className="rounded-xl border border-[color:var(--hairline)] bg-[linear-gradient(180deg,var(--surface-2),var(--surface-1))] p-5">
                  <div className="flex min-h-[24px] items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--text-primary)]">
                      <tier.icon
                        size={15}
                        className="text-[color:var(--text-tertiary)]"
                        aria-hidden
                      />
                      {tier.plan}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                        tier.popular
                          ? "border-vodium-gold/30 bg-vodium-gold/10 text-vodium-gold"
                          : "border-[color:var(--hairline-strong)] text-[color:var(--text-tertiary)]"
                      }`}
                    >
                      {tier.popular ? "Most popular" : tier.audience}
                    </span>
                  </div>

                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="tnum text-[34px] font-semibold leading-none text-[color:var(--text-primary)]">
                      {tier.price}
                    </span>
                    <span className="text-[13px] text-[color:var(--text-tertiary)]">
                      / month
                    </span>
                  </p>
                  <p className="mt-2 text-[11px] text-[color:var(--text-quaternary)]">
                    {tier.sub}
                  </p>

                  {/* `btn-gold`, the same class the nav's register CTA uses.
                      This button carried a hardcoded orange gradient that
                      appeared nowhere else in the codebase and is not a brand
                      token — the highest-intent button on the page was the one
                      thing on it that wasn't Vodium. */}
                  <Link
                    href="/register"
                    className="btn-gold mt-5 w-full rounded-lg py-3 text-center text-[14px]"
                  >
                    Get started
                  </Link>
                </div>

                <div className="flex flex-1 flex-col px-3 pb-2 pt-6">
                  <p className="mb-5 text-[12px] leading-relaxed text-[color:var(--text-tertiary)]">
                    {tier.description}
                  </p>

                  <ul className="space-y-3">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-[13px] text-[color:var(--text-secondary)]"
                      >
                        <CheckCircle2
                          size={15}
                          className="mt-px shrink-0 text-[#3FB950]"
                          aria-hidden
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Top tier holds nothing back, so it shows no excluded list
                      rather than inventing a limitation to fill the space. */}
                  {tier.notIncluded.length > 0 && (
                    <>
                      <p className="my-6 flex items-center gap-3 text-[11px] text-[color:var(--text-quaternary)]">
                        <span
                          aria-hidden
                          className="h-px flex-1 bg-[color:var(--hairline)]"
                        />
                        Not in this plan
                        <span
                          aria-hidden
                          className="h-px flex-1 bg-[color:var(--hairline)]"
                        />
                      </p>

                      <ul className="space-y-3">
                        {tier.notIncluded.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2.5 text-[13px] text-[color:var(--text-quaternary)]"
                          >
                            <XCircle
                              size={15}
                              className="mt-px shrink-0 text-[#E5534B]/70"
                              aria-hidden
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────
          The gold band. Gold is the third colour in the palette and spends the
          rest of the page as an accent — a hairline, a heading, a panel field —
          so it gets one full-bleed moment at the close.

          The button is black rather than the shared gold `ShimmerButton`: gold
          on gold is invisible. Inverting it also makes this the only black
          button on a gold ground anywhere on the page, which is what you want
          from the last thing a vendor sees. */}
      <section className="band-gold px-6 py-20 md:px-12 md:py-28">
        <motion.div {...anim} className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
            Built for the vendor. Owned by Africa.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
            Vodium Ledger is the first step in Africa&rsquo;s credit ecosystem.
            Every credit you track builds the graph that makes lending smarter
            for everyone.
          </p>
          <Link
            href="/register"
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-lg bg-vodium-black px-8 text-[14px] font-semibold text-vodium-cream shadow-[0_10px_30px_rgba(10,10,10,.24)] transition-[background-color,transform] duration-100 hover:bg-vodium-charcoal active:scale-[0.99]"
          >
            Sign your shop up — it&rsquo;s free <ArrowRight size={16} />
          </Link>
        </motion.div>
      </section>

      <SiteFooter />
    </main>
  );
}

/* ── How-it-works step sequence ──────────────────────────────────────────
 *
 * The three steps read as a column while a companion panel, pinned beside
 * them, shows what each step actually looks like on a phone. The panel is
 * `sticky` and the page scrolls at its own rate — nothing is pinned or
 * scrubbed. Scroll-jacking would be the wrong trade here: a vendor skimming
 * for the price should be able to skim straight past.
 *
 * A gold rail runs down the left, connecting the three numbered nodes, and
 * fills in behind the reader as they descend. Before this the steps were three
 * hairline rows with an icon at the far right, which left them looking like
 * three unrelated features rather than one sequence you move through — the
 * numbering was the only thing saying otherwise. Each step also carries the
 * fact a vendor is actually weighing about it (how long, who does it, where),
 * rather than making them infer that from the prose.
 *
 * Below `lg` the two columns cannot sit side by side, so each step carries its
 * own visual inline and the sticky machinery is skipped entirely.
 */

/** The mockups are `role="img"`; these are their alt text. */
const STEP_VISUAL_LABELS = [
  "WhatsApp conversation: the vendor sends ADD, the bot asks for the customer's name, amount and due date, then confirms the credit was saved.",
  "WhatsApp conversation: the bot reminds Tunde that ₦3,500 is due tomorrow; Tunde replies PAID and the bot confirms.",
  "The Vodium Ledger dashboard, showing ₦142,500 owed, ₦38,000 paid this month, and who is overdue.",
];

function StepVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <WhatsAppChat
        messages={ADD_CONVERSATION}
        label={STEP_VISUAL_LABELS[0]}
        className="mx-auto w-full max-w-sm"
      />
    );
  }
  if (index === 1) {
    return (
      <WhatsAppChat
        messages={REMINDER_CONVERSATION}
        label={STEP_VISUAL_LABELS[1]}
        minHeight={300}
        className="mx-auto w-full max-w-sm"
      />
    );
  }
  return <LedgerVisual />;
}

/**
 * Step 03's visual. Deliberately *not* the full product shot from the section
 * above — repeating that block verbatim two screens apart reads as a mistake.
 * Same data, narrowed to the one question this step asks: who owes me, and how
 * late are they.
 */
function LedgerVisual() {
  const rows = [
    { name: "Tunde Adesanya", amount: "₦4,500", days: 5, paid: false },
    { name: "Bimpe Olawale", amount: "₦2,000", days: 3, paid: false },
    { name: "Emeka Chukwu", amount: "₦8,750", days: 12, paid: false },
    { name: "Ngozi Eze", amount: "₦1,200", days: 0, paid: true },
  ];

  return (
    <div
      role="img"
      aria-label={STEP_VISUAL_LABELS[2]}
      className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-1)]"
    >
      <div className="border-b border-[color:var(--hairline)] px-4 py-2.5">
        <span className="text-[11px] text-[color:var(--text-quaternary)]">
          vodiumledger.com/dashboard
        </span>
      </div>

      <div className="p-4">
        <dl className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface-2)] p-3">
            <dt className="mb-1.5 text-[10px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
              Owed to you
            </dt>
            <dd className="tnum text-[16px] leading-none text-[color:var(--text-primary)]">
              ₦142,500
            </dd>
          </div>
          <div className="rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface-2)] p-3">
            <dt className="mb-1.5 text-[10px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
              Paid this month
            </dt>
            <dd className="tnum text-[16px] leading-none text-[color:var(--ink-positive)]">
              ₦38,000
            </dd>
          </div>
        </dl>

        <div className="overflow-hidden rounded-lg border border-[color:var(--hairline)]">
          <p className="border-b border-[color:var(--hairline)] px-3.5 py-2 text-[11px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
            Who owes you
          </p>
          {rows.map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between gap-3 border-b border-[color:var(--hairline)] px-3.5 py-2.5 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    row.paid
                      ? "bg-[color:var(--ink-positive)]"
                      : "bg-[color:var(--ink-negative)]"
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-[color:var(--text-primary)]">
                    {row.name}
                  </p>
                  <p className="tnum text-[10px] text-[color:var(--text-quaternary)]">
                    {row.paid ? "Paid in full" : `${row.days} days overdue`}
                  </p>
                </div>
              </div>
              <span
                className={`tnum shrink-0 text-[13px] ${
                  row.paid
                    ? "text-[color:var(--text-quaternary)] line-through"
                    : "text-[color:var(--ink-negative)]"
                }`}
              >
                {row.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepSequence() {
  const { activeIndex, registerStep, enabled } = useScrollSteps(STEPS.length);

  return (
    <div className="grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <ol className="min-w-0">
        {STEPS.map((step, i) => {
          const active = enabled && i === activeIndex;
          const done = enabled && i < activeIndex;
          const last = i === STEPS.length - 1;

          // Dimming and the raised card only earn their place next to the
          // sticky panel, where they show which step the panel is answering.
          // Below lg each step carries its own visual and is read straight
          // through, so greying out the one you are halfway through would only
          // make it harder to read. The rail nodes light up at every width —
          // they report progress rather than emphasis.
          const dim = enabled && !active ? "lg:opacity-45" : "lg:opacity-100";

          return (
            <li
              key={step.n}
              ref={registerStep(i)}
              aria-current={active ? "step" : undefined}
              className="flex gap-4 sm:gap-5"
            >
              {/* Rail: a node, then a connector that stretches to the next one.
                  The li is a flex row, so this column stretches to the full
                  height of the step beside it and `flex-1` on the connector
                  takes whatever vertical space the node leaves. */}
              <div className="flex flex-col items-center">
                <span
                  className={`tnum grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[12px] transition-colors duration-300 ${
                    active
                      ? "border-transparent bg-vodium-gold text-vodium-black"
                      : done
                        ? "border-vodium-gold/45 text-[color:var(--gold-ink)]"
                        : "border-[color:var(--hairline-strong)] text-[color:var(--text-quaternary)]"
                  }`}
                >
                  {step.n}
                </span>
                {!last && (
                  <span
                    aria-hidden
                    className={`mt-2 w-px flex-1 transition-colors duration-300 ${
                      done ? "bg-vodium-gold/45" : "bg-[color:var(--hairline)]"
                    }`}
                  />
                )}
              </div>

              {/* Padding is unconditional at each width — only the border and
                  fill switch on `active`. Adding padding on activation instead
                  would shift the text sideways every time the reader scrolls
                  past a node. The last step drops its bottom padding: there is
                  no next node to leave room for, and the section's own py-28
                  was stacking on top of it into a dead half-screen of band. */}
              <div
                className={`min-w-0 flex-1 transition-opacity duration-300 ${dim} ${
                  last ? "" : "pb-12 lg:pb-20"
                }`}
              >
                <div
                  className={`rounded-xl border border-transparent transition-colors duration-300 lg:p-5 ${
                    active
                      ? "lg:border-[color:var(--hairline)] lg:bg-[color:var(--surface-1)]"
                      : ""
                  }`}
                >
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--hairline)] px-2.5 py-1 text-[11px] text-[color:var(--text-tertiary)]">
                    <step.icon
                      size={12}
                      className={active ? "text-[color:var(--gold-ink)]" : ""}
                      aria-hidden
                    />
                    {step.meta}
                  </p>

                  <h3 className="mb-2.5 mt-4 text-[17px] font-medium text-[color:var(--text-primary)] md:text-[19px]">
                    {step.title}
                  </h3>
                  <p className="max-w-md text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
                    {step.body}
                  </p>

                  {/* Inline visual — the sticky column takes over from lg up. */}
                  <div className="mt-6 lg:hidden">
                    <StepVisual index={i} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Companion panel. `top-24` clears the fixed h-16 nav plus breathing
          room. aria-hidden because every visual is already rendered inline
          above — without it a screen reader meets all three twice. */}
      <div className="hidden lg:block" aria-hidden>
        <div className="sticky top-24">
          {/* Keyed so React swaps the subtree and the fade replays per step. */}
          <div key={activeIndex} className="animate-fade-in">
            <StepVisual index={activeIndex} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Feature / trust panels ──────────────────────────────────────────────
 *
 * A flat gold field with a white product mockup bleeding off its edges, so the
 * card reads as a window onto the product rather than a framed screenshot. The
 * heading and body sit outside the field, on the band, which is what lets both
 * rows share one component while still inverting with the section around them.
 */

function PanelCard({
  title,
  body,
  art,
}: {
  title: string;
  body: string;
  art: PanelArtKey;
}) {
  return (
    <article>
      <div className="relative h-56 overflow-hidden rounded-2xl bg-[linear-gradient(158deg,#D9BE7E,#C9A961_46%,#A5823C)]">
        <PanelArt art={art} />
      </div>
      <h3 className="mt-5 text-[17px] font-semibold text-[color:var(--gold-ink)]">
        {title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
        {body}
      </p>
    </article>
  );
}

/**
 * The six mockups.
 *
 * All of them hardcode their colours instead of reading band tokens: they are
 * white product sheets on a gold field, and a white sheet has to stay white
 * whichever band the panel is dropped into. Same reasoning as the hero card fan.
 */
function PanelArt({ art }: { art: PanelArtKey }) {
  if (art === "ledger") {
    return (
      <div className="absolute -right-6 left-6 top-9 rounded-xl bg-white p-4 shadow-[0_14px_34px_rgba(0,0,0,.22)]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black font-serif text-[12px] text-vodium-gold">
            V
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-black">
              New credit logged
            </p>
            <p className="truncate text-[10px] text-black/50">
              Mama Taiwo&apos;s Provisions
            </p>
          </div>
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.07em] text-black/40">
          Amount due
        </p>
        <p className="tnum mt-1 text-[24px] leading-none text-black">₦8,500</p>
        <div aria-hidden className="mt-4 flex gap-1">
          <span className="h-1.5 flex-1 rounded bg-black/80" />
          <span className="h-1.5 w-8 rounded bg-black/15" />
        </div>
      </div>
    );
  }

  if (art === "network") {
    return (
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative h-[168px] w-[220px]">
          <svg
            viewBox="0 0 220 168"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {[
              [28, 40],
              [188, 28],
              [46, 138],
              [178, 140],
            ].map(([x, y]) => (
              <line
                key={`${x}-${y}`}
                x1="110"
                y1="84"
                x2={x}
                y2={y}
                stroke="#fff"
                strokeOpacity=".5"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            ))}
          </svg>

          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-black text-[13px] font-semibold text-vodium-gold shadow-lg">
            500
          </span>

          {[
            { initial: "A", pos: "left-0 top-[22px]" },
            { initial: "T", pos: "right-0 top-[10px]" },
            { initial: "C", pos: "bottom-[8px] left-[18px]" },
            { initial: "N", pos: "bottom-[10px] right-[8px]" },
          ].map((node) => (
            <span
              key={node.initial}
              className={`absolute grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-[#161616] text-[12px] font-medium text-white shadow-md ${node.pos}`}
            >
              {node.initial}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (art === "invoice") {
    return (
      <div className="absolute -bottom-4 -right-5 left-7 rounded-2xl bg-white p-5 shadow-[0_14px_34px_rgba(0,0,0,.22)]">
        <p className="text-[10px] uppercase tracking-[0.07em] text-black/40">
          Payment reminder
        </p>
        <p className="tnum mt-2 text-[24px] leading-none text-black">₦12,000</p>
        <p className="mt-2 text-[10px] text-black/45">
          Due tomorrow · Tunde F.
        </p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-md bg-black px-3 py-1.5 text-[10px] font-medium text-white">
            View balance
          </span>
          <span className="rounded-md border border-black/15 px-3 py-1.5 text-[10px] font-medium text-black">
            I&apos;ve paid
          </span>
        </div>
      </div>
    );
  }

  /* NDPR — a customer record with the identifying fields masked, which is the
     actual shape of the promise: we hold the row, you can't read it off a
     screenshot, and neither can we hand it to anyone else. */
  if (art === "encrypted") {
    return (
      <div className="absolute -right-6 left-6 top-8 rounded-xl bg-white p-4 shadow-[0_14px_34px_rgba(0,0,0,.22)]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black">
            <Lock size={13} className="text-vodium-gold" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-black">
              Encrypted at rest
            </p>
            <p className="truncate text-[10px] text-black/50">NDPR · Nigeria</p>
          </div>
        </div>

        {/* Label and value both sit left, so the panel's right-hand bleed cuts
            empty sheet the way it does on the ledger card. Right-aligning the
            values put them directly under the cut and the whole record read as
            clipped rather than as a card running off the edge. */}
        <dl className="mt-3.5">
          {[
            ["Customer", "Tunde A."],
            ["Phone", "+234 ••• ••17"],
            ["Balance", "₦••,•••"],
          ].map(([key, value]) => (
            <div
              key={key}
              className="flex items-baseline gap-3 border-b border-black/[.07] py-1.5 last:border-0"
            >
              <dt className="w-[52px] shrink-0 text-[9px] uppercase tracking-[0.07em] text-black/40">
                {key}
              </dt>
              <dd className="tnum text-[11px] text-black/70">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  /* Isolation — two books, one of them yours. The locked card behind is what
     every other vendor on the platform sees of your customers. */
  if (art === "isolated") {
    return (
      <div className="absolute inset-0">
        {/* Behind, bleeding off the top-right: all any other vendor on the
            platform gets of your book. The lock sits beside the label instead of
            at the far right, which the bleed would have cut off. */}
        <div className="absolute -right-6 -top-3 left-12 rotate-[3deg] rounded-xl bg-white/90 p-3 pt-4 shadow-[0_10px_24px_rgba(0,0,0,.18)]">
          <div className="flex items-center gap-1.5">
            <Lock size={11} className="shrink-0 text-black/30" aria-hidden />
            <p className="truncate text-[11px] font-medium text-black/35">
              Another vendor · no access
            </p>
          </div>
          <div aria-hidden className="mt-2.5 space-y-1.5">
            <span className="block h-1.5 w-full rounded bg-black/10" />
            <span className="block h-1.5 w-2/3 rounded bg-black/10" />
          </div>
        </div>

        {/* Yours — held fully inside the field. This is the one card in the row
            whose numbers a vendor is meant to read, so nothing about it is cut. */}
        <div className="absolute bottom-5 left-5 right-14 -rotate-[2deg] rounded-xl bg-white p-3.5 shadow-[0_16px_36px_rgba(0,0,0,.26)]">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-semibold text-black">
              Mama Taiwo&apos;s book
            </p>
            <Shield
              size={12}
              className="shrink-0 text-vodium-gold"
              aria-hidden
            />
          </div>
          <p className="tnum mt-2 text-[19px] leading-none text-black">
            ₦142,500
          </p>
          <p className="mt-1.5 text-[9px] uppercase tracking-[0.08em] text-black/40">
            Only you can see this
          </p>
        </div>
      </div>
    );
  }

  /* Any phone — a cheap handset bleeding off the bottom edge, running the one
     app the vendor already has. WhatsApp's *light* bubble colours, because the
     sheet is white; the dark-mode green from the step mockups would read as a
     different app. */
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center">
      <div className="w-[206px] rounded-t-[28px] bg-white px-3.5 pt-3.5 shadow-[0_-8px_36px_rgba(0,0,0,.26)]">
        <span
          aria-hidden
          className="mx-auto block h-1 w-10 rounded-full bg-black/15"
        />
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-[0.08em] text-black/35">
          <Smartphone size={10} aria-hidden /> No install · 0 MB
        </p>
        {/* The thread runs off the bottom edge on purpose — the conversation
            carries on, rather than being a screenshot of a finished one. */}
        <div className="mt-3 space-y-2 border-t border-black/[.07] pt-3">
          <p className="ml-auto w-fit rounded-xl rounded-tr-sm bg-[#D9FDD3] px-2.5 py-1.5 text-[10px] font-medium text-black/75">
            ADD
          </p>
          <p className="w-fit rounded-xl rounded-tl-sm bg-[#F1F0EB] px-2.5 py-1.5 text-[10px] text-black/70">
            Customer name?
          </p>
          <p className="ml-auto w-fit rounded-xl rounded-tr-sm bg-[#D9FDD3] px-2.5 py-1.5 text-[10px] font-medium text-black/75">
            Tunde F.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard mockup ────────────────────────────────────────────────────
 *
 * The product shot for the platform section: a full vendor dashboard rather
 * than the single stat strip that stood here before. Static markup, not a live
 * embed — real numbers, no data fetching on a marketing page.
 *
 * The sidebar is `hidden lg:flex`. Below lg there is no width to spare for
 * chrome that is not the product, and the KPI tiles and panels reflow to one
 * column so the whole thing stays readable on a phone instead of scrolling
 * sideways.
 */

const DASH_NAV = [
  {
    group: "Ledger",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", active: true },
      { icon: Users, label: "Customers", active: false },
      { icon: CreditCard, label: "Credits", active: false },
    ],
  },
  {
    group: "Operations",
    items: [
      { icon: Bell, label: "Reminders", active: false },
      { icon: BarChart3, label: "Analytics", active: false },
      { icon: Receipt, label: "Invoices", active: false },
    ],
  },
  {
    group: "Administration",
    items: [
      { icon: Settings, label: "Settings", active: false },
      { icon: Wallet, label: "Billing", active: false },
    ],
  },
];

const DASH_KPIS = [
  { label: "Owed to you", value: "₦142,500", delta: "3.1%", up: true },
  { label: "Recovered this month", value: "₦38,000", delta: "12.4%", up: true },
  { label: "Recovery rate", value: "71%", delta: "0.4%", up: false },
  { label: "New customers", value: "142", delta: "8.7%", up: true },
];

/** Bar heights as a percentage of the plot area, Mon–Sun. */
const CREDIT_BARS = [
  { day: "Mon", pct: 46 },
  { day: "Tue", pct: 38 },
  { day: "Wed", pct: 62 },
  { day: "Thu", pct: 55 },
  { day: "Fri", pct: 71 },
  { day: "Sat", pct: 64 },
  { day: "Sun", pct: 92 },
];

const DASH_OVERDUE = [
  { name: "Tunde Adesanya", ref: "#C1045", amount: "₦4,500" },
  { name: "Bimpe Olawale", ref: "#C1044", amount: "₦2,000" },
  { name: "Emeka Chukwu", ref: "#C1043", amount: "₦8,750" },
  { name: "Ngozi Eze", ref: "#C1042", amount: "₦1,200" },
];

const DASH_ACTIVITY = [
  {
    icon: Receipt,
    title: "Credit #C1045 marked paid",
    when: "About 2 hours ago",
  },
  {
    icon: UserPlus,
    title: "Chiamaka Obi added as customer",
    when: "This morning",
  },
  { icon: FileText, title: "Weekly summary exported", when: "Yesterday" },
  { icon: Bell, title: "12 reminders delivered", when: "2 days ago" },
];

/** Panel chrome shared by every card in the mockup. */
function DashPanel({
  title,
  subtitle,
  badge,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-[color:var(--surface-1)] p-4 md:p-5 ${className}`}>
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-medium text-[color:var(--text-primary)]">
          {title}
        </p>
        {badge && (
          <span className="tnum inline-flex items-center gap-1 rounded border border-[#3FB950]/25 bg-[#3FB950]/10 px-1.5 py-px text-[10px] text-[#56C963]">
            <TrendingUp size={10} aria-hidden />
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-[color:var(--text-quaternary)]">
        {subtitle}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div
      role="img"
      aria-label="The Vodium Ledger vendor dashboard: ₦142,500 owed, ₦38,000 recovered this month, a 71% recovery rate, charts of credit issued and repayments over the last seven days, a list of overdue credits, reminder health and recent activity."
      className="overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-0)]"
    >
      {/* Browser chrome */}
      <div className="border-b border-[color:var(--hairline)] px-4 py-2.5">
        <span className="text-[11px] text-[color:var(--text-quaternary)]">
          vodiumledger.com/dashboard
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-[168px] shrink-0 flex-col justify-between border-r border-[color:var(--hairline)] p-4 lg:flex">
          <nav className="space-y-5">
            {DASH_NAV.map((section) => (
              <div key={section.group}>
                <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-quaternary)]">
                  {section.group}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <span
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                          item.active
                            ? "bg-[color:var(--surface-2)] text-[color:var(--text-primary)]"
                            : "text-[color:var(--text-tertiary)]"
                        }`}
                      >
                        <item.icon
                          size={12}
                          className={item.active ? "text-vodium-gold" : ""}
                          aria-hidden
                        />
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-6">
            <div className="rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface-1)] p-3">
              <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-quaternary)]">
                Changelog
              </p>
              <p className="mt-1.5 text-[11px] text-[color:var(--text-primary)]">
                Cross-vendor scores
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-[color:var(--text-quaternary)]">
                Now live on Growth and above.
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-center gap-2 text-[11px] text-[color:var(--text-tertiary)]">
                <HelpCircle size={12} aria-hidden /> Help centre
              </li>
              <li className="flex items-center gap-2 text-[11px] text-[color:var(--text-tertiary)]">
                <BookOpen size={12} aria-hidden /> Documentation
              </li>
            </ul>
            <p className="mt-3 text-[10px] text-[color:var(--text-quaternary)]">
              © 2026 Vodium Ledger
            </p>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          {/* KPI row */}
          <dl className="grid grid-cols-2 gap-px bg-[color:var(--hairline)] lg:grid-cols-4">
            {DASH_KPIS.map((kpi) => (
              <div
                key={kpi.label}
                className="bg-[color:var(--surface-1)] p-4 md:p-5"
              >
                <dt className="text-[11px] text-[color:var(--text-tertiary)]">
                  {kpi.label}
                </dt>
                <dd className="tnum mt-2 text-[20px] leading-none text-[color:var(--text-primary)] md:text-[24px]">
                  {kpi.value}
                </dd>
                <dd
                  className={`tnum mt-2.5 flex items-center gap-1 text-[10px] ${
                    kpi.up ? "text-[#56C963]" : "text-[#F0736B]"
                  }`}
                >
                  {kpi.up ? (
                    <TrendingUp size={11} aria-hidden />
                  ) : (
                    <TrendingDown size={11} aria-hidden />
                  )}
                  {kpi.delta}
                  <span className="text-[color:var(--text-quaternary)]">
                    vs last week
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          {/* Charts */}
          <div className="grid gap-px border-t border-[color:var(--hairline)] bg-[color:var(--hairline)] lg:grid-cols-2">
            <DashPanel
              title="Credit issued"
              subtitle="Daily credit logged, last 7 days."
              badge="66.9%"
            >
              {/* The plot area carries an explicit h-[104px] so the bars'
                  percentage heights resolve against a definite height. With
                  `items-end` on a single flex row instead, each column shrinks
                  to its label and every bar computes to zero. */}
              <div className="flex h-[132px] flex-col justify-end">
                <div className="flex h-[104px] items-end gap-2">
                  {CREDIT_BARS.map((bar) => (
                    <div
                      key={bar.day}
                      className="min-w-0 flex-1 rounded-t bg-[linear-gradient(180deg,rgba(201,169,97,.6),rgba(201,169,97,.14))]"
                      style={{ height: `${bar.pct}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  {CREDIT_BARS.map((bar) => (
                    <span
                      key={bar.day}
                      className="min-w-0 flex-1 text-center text-[9px] text-[color:var(--text-quaternary)]"
                    >
                      {bar.day}
                    </span>
                  ))}
                </div>
              </div>
            </DashPanel>

            <DashPanel
              title="Repayments"
              subtitle="Daily repayments count, last 7 days."
              badge="58.3%"
            >
              <div className="h-[132px]">
                <svg
                  viewBox="0 0 300 120"
                  preserveAspectRatio="none"
                  className="h-[108px] w-full"
                  aria-hidden
                >
                  <path
                    d="M0 96 H43 V78 H86 V70 H129 V50 H172 V42 H215 V26 H300"
                    fill="none"
                    stroke="#C9A961"
                    strokeOpacity=".75"
                    strokeWidth="2"
                  />
                  <path
                    d="M0 110 H43 V102 H86 V94 H129 V86 H172 V72 H215 V62 H300"
                    fill="none"
                    stroke="currentColor"
                    className="text-[color:var(--text-quaternary)]"
                    strokeWidth="2"
                  />
                </svg>
                <div className="mt-1 flex justify-between">
                  {[
                    "Apr 7",
                    "Apr 8",
                    "Apr 9",
                    "Apr 10",
                    "Apr 11",
                    "Apr 12",
                    "Apr 13",
                  ].map((d) => (
                    <span
                      key={d}
                      className="text-[9px] text-[color:var(--text-quaternary)]"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </DashPanel>
          </div>

          {/* Bottom row */}
          <div className="grid gap-px border-t border-[color:var(--hairline)] bg-[color:var(--hairline)] lg:grid-cols-3">
            <DashPanel
              title="Overdue credits"
              subtitle="Open amounts and payment status."
            >
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[color:var(--text-quaternary)]">
                    <th scope="col" className="pb-2 text-left font-normal">
                      Customer
                    </th>
                    <th scope="col" className="pb-2 text-left font-normal">
                      Credit
                    </th>
                    <th scope="col" className="pb-2 text-right font-normal">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DASH_OVERDUE.map((row, i) => (
                    <tr
                      key={row.ref}
                      className={`border-t border-[color:var(--hairline)] ${
                        i === DASH_OVERDUE.length - 1 ? "opacity-40" : ""
                      }`}
                    >
                      <td className="truncate py-2 text-[11px] text-[color:var(--text-primary)]">
                        {row.name}
                      </td>
                      <td className="tnum py-2 text-[11px] text-[color:var(--text-quaternary)]">
                        {row.ref}
                      </td>
                      <td className="tnum py-2 text-right text-[11px] text-[color:var(--text-primary)]">
                        {row.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-[color:var(--text-tertiary)]">
                View all <ArrowRight size={11} aria-hidden />
              </p>
            </DashPanel>

            <DashPanel
              title="Reminder health"
              subtitle="Nothing urgent needs your attention."
            >
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle2
                  size={22}
                  className="text-[#56C963]"
                  aria-hidden
                />
                <p className="mt-3 text-[12px] text-[color:var(--text-primary)]">
                  You&rsquo;re all caught up.
                </p>
                <p className="mt-1.5 max-w-[26ch] text-[10px] leading-relaxed text-[color:var(--text-quaternary)]">
                  Every reminder due this week has been delivered.
                </p>
                <p className="mt-3 flex items-center gap-1 text-[11px] text-vodium-gold">
                  Review scheduled reminders{" "}
                  <ArrowRight size={11} aria-hidden />
                </p>
              </div>
            </DashPanel>

            <DashPanel title="Activity" subtitle="Latest updates in your shop.">
              <ul className="space-y-3">
                {DASH_ACTIVITY.map((item) => (
                  <li key={item.title} className="flex items-start gap-2.5">
                    <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color:var(--hairline)] bg-[color:var(--surface-2)]">
                      <item.icon
                        size={11}
                        className="text-[color:var(--text-tertiary)]"
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] leading-snug text-[color:var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[color:var(--text-quaternary)]">
                        {item.when}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </DashPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Vendor voices ───────────────────────────────────────────────────────
 *
 * A row of overlapping vendor avatars; picking one reveals that vendor's quote
 * below. Only the vendors we can actually name appear here — an earlier pass
 * rendered five initials against two quotes, which invented three vendors on
 * the page that asks a vendor to trust us with their whole customer book. Add a
 * real quote to TESTIMONIALS and the row grows on its own.
 */
function VendorVoices() {
  const [active, setActive] = useState(0);
  const current = TESTIMONIALS[active];

  return (
    <div className="mt-12">
      <ul className="flex items-end justify-center -space-x-3">
        {TESTIMONIALS.map((t, i) => {
          const isActive = i === active;
          const initials = t.name
            .split(" ")
            .map((word) => word[0])
            .join("");

          return (
            <li key={t.name} className="relative">
              {/* Name floats above the selected avatar, as in the reference. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] transition-opacity duration-200 ${
                  isActive
                    ? "text-[color:var(--text-tertiary)] opacity-100"
                    : "opacity-0"
                }`}
              >
                {t.name}
              </span>

              <button
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                aria-pressed={isActive}
                className={`grid h-16 w-16 place-items-center rounded-full border-[3px] text-[14px] font-semibold transition-all duration-200 ${
                  isActive
                    ? "z-10 scale-105 border-[color:var(--surface-0)] bg-vodium-gold text-vodium-black"
                    : "border-[color:var(--surface-0)] bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-1)]"
                }`}
              >
                {initials}
                <span className="sr-only">— read {t.name}&rsquo;s quote</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* aria-live so choosing an avatar announces the quote that replaced the
          previous one, instead of silently swapping text below the row. */}
      <figure aria-live="polite" className="mx-auto mt-10 max-w-2xl">
        <blockquote className="font-serif text-[19px] leading-relaxed text-[color:var(--text-primary)] md:text-[22px]">
          &ldquo;{current.quote}&rdquo;
        </blockquote>
        <figcaption className="mt-5 text-[13px] text-[color:var(--text-tertiary)]">
          <span className="font-medium text-[color:var(--gold-ink)]">
            {current.name}
          </span>
          <span className="mx-2 text-[color:var(--text-quaternary)]">·</span>
          {current.role}
        </figcaption>
      </figure>
    </div>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle,
  CreditCard,
  MessageCircle,
  Shield,
  TrendingUp,
} from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AnimatedBorder } from "@/components/ui/animated-border";
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

const STEPS = [
  {
    n: "01",
    icon: MessageCircle,
    title: "Record credit on WhatsApp",
    body: "Send ADD to your Vodium number. We guide you through it — name, amount, due date. Done in 15 seconds, with no app to download.",
  },
  {
    n: "02",
    icon: Bell,
    title: "Auto-reminders to customers",
    body: "Before repayment is due, a respectful WhatsApp message goes to the customer at the right time. No chasing from you, dignity intact for them.",
  },
  {
    n: "03",
    icon: BarChart3,
    title: "Track on your dashboard",
    body: "Log in from any browser to see who owes, who has paid, and what is overdue. Mark payments with a tap and know your cash position.",
  },
];

const FEATURES = [
  {
    icon: MessageCircle,
    title: "WhatsApp bot",
    body: "Every core action — add credit, mark paid, view who owes — works from the chat app you already use every day.",
  },
  {
    icon: CreditCard,
    title: "Credit tracking",
    body: "Record any credit in 15 seconds. Set due dates, track amounts, and never lose track of a transaction again.",
  },
  {
    icon: TrendingUp,
    title: "Credit scores",
    body: "See how reliably a customer pays across the Vodium vendor network before you extend credit to them.",
  },
  {
    icon: Bell,
    title: "Smart reminders",
    body: "Respectful WhatsApp reminders go out automatically. Customers pay before the date, and you recover without a phone call.",
  },
  {
    icon: BarChart3,
    title: "Analytics dashboard",
    body: "Monthly credit volume, recovery rate, top customers and overdue trends — your whole book at a glance on any device.",
  },
  {
    icon: Shield,
    title: "Privacy & NDPR",
    body: "Your customer data is encrypted and isolated. No other vendor can see your book. Fully compliant with Nigeria's NDPR.",
  },
];

const TIERS = [
  {
    plan: "Starter",
    price: "₦2,000",
    sub: "per month after trial",
    description: "Up to 50 customers. Everything you need to get started.",
    features: [
      "WhatsApp bot access",
      "Credit tracking",
      "Auto-reminders",
      "Web dashboard",
      "Up to 50 customers",
    ],
    popular: false,
  },
  {
    plan: "Growth",
    price: "₦5,000",
    sub: "per month after trial",
    description: "Up to 200 customers, plus cross-vendor credit scores.",
    features: [
      "Everything in Starter",
      "Cross-vendor credit scores",
      "Dashboard analytics",
      "Up to 200 customers",
      "CSV export",
    ],
    popular: true,
  },
  {
    plan: "Business Pro",
    price: "₦10,000",
    sub: "per month after trial",
    description: "Unlimited customers, full analytics and priority support.",
    features: [
      "Everything in Growth",
      "Unlimited customers",
      "Priority WhatsApp support",
      "Monthly report PDF",
      "API access (beta)",
    ],
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Vodium saved me ₦45,000 last semester. Three customers I would have written off paid because of the reminders.",
    name: "Mama Taiwo",
    role: "Provisions vendor, UNILAG · 63 customers tracked",
  },
  {
    quote:
      "I check every customer's Vodium score before I give credit now. One customer had a score of 320, so I said no. Turned out she owed four other shops.",
    name: "Baba Wale",
    role: "Food canteen, OAU · 89 customers tracked",
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

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pb-20 pt-32 md:px-12 md:pb-28 md:pt-40">
        {/* The one piece of atmosphere on the page: a single soft gold wash
            behind the headline. The hero previously stacked a Spotlight SVG,
            two blurred blobs, a dot grid and a mesh gradient. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(201,169,97,0.07),transparent)]"
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-6xl"
        >
          <p className="eyebrow mb-5">WhatsApp-first credit tracking</p>

          <h1 className="max-w-3xl font-serif text-[42px] leading-[1.06] tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[56px] md:text-[68px]">
            Stop losing money to credit defaults.
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[color:var(--text-secondary)] md:text-[17px]">
            Vodium Ledger is the WhatsApp-first credit ledger built for Nigerian
            vendors. Record a credit in 15 seconds, remind customers
            automatically, and track every naira you&rsquo;re owed from your
            phone.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register">
              <ShimmerButton className="w-full gap-2 px-7 sm:w-auto">
                Get Started <ArrowRight size={16} />
              </ShimmerButton>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[color:var(--hairline-strong)] px-6 text-[14px] font-medium text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--text-quaternary)] hover:text-[color:var(--text-primary)]"
            >
              See how it works
            </a>
          </div>

          <dl className="mt-14 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-[color:var(--hairline)]">
            {[
              { value: "₦0", label: "to start" },
              { value: "15 sec", label: "to log a credit" },
              { value: "60 days", label: "free trial" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[color:var(--surface-1)] px-4 py-3.5"
              >
                <dt className="sr-only">{s.label}</dt>
                <dd className="tnum text-[19px] leading-none text-[color:var(--text-primary)]">
                  {s.value}
                </dd>
                <dd className="mt-1.5 text-[11px] text-[color:var(--text-tertiary)]">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </section>

      {/* ── Platform numbers ───────────────────────────────────────── */}
      <section className="border-y border-[color:var(--hairline)] px-6 py-10 md:px-12">
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

      {/* ── Product preview ────────────────────────────────────────── */}
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

          {/* Static product shot. Real numbers, plain chrome — the browser
              frame with traffic-light dots was doing decorative work. */}
          <div className="overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-1)]">
            <div className="flex items-center gap-2 border-b border-[color:var(--hairline)] px-4 py-2.5">
              <span className="text-[11px] text-[color:var(--text-quaternary)]">
                vodiumledger.com/dashboard
              </span>
            </div>

            <div className="p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[color:var(--text-primary)]">
                    Mama Taiwo&rsquo;s Provisions
                  </p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--text-quaternary)]">
                    UNILAG Campus
                  </p>
                </div>
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  {
                    label: "Owed to you",
                    value: "₦142,500",
                    tone: "text-[color:var(--text-primary)]",
                  },
                  {
                    label: "Paid this month",
                    value: "₦38,000",
                    tone: "text-[#56C963]",
                  },
                  {
                    label: "Overdue",
                    value: "7 credits",
                    tone: "text-[#F0736B]",
                  },
                  {
                    label: "Recovery rate",
                    value: "71%",
                    tone: "text-[color:var(--text-primary)]",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface-2)] p-3"
                  >
                    <dt className="mb-1.5 text-[10px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
                      {s.label}
                    </dt>
                    <dd className={`tnum text-[16px] leading-none ${s.tone}`}>
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="overflow-hidden rounded-lg border border-[color:var(--hairline)]">
                <p className="border-b border-[color:var(--hairline)] px-4 py-2 text-[11px] uppercase tracking-[0.07em] text-[color:var(--text-quaternary)]">
                  Overdue credits
                </p>
                {[
                  {
                    name: "Tunde Adesanya",
                    matric: "100L/ECO/23",
                    amount: "₦4,500",
                    days: 5,
                  },
                  {
                    name: "Bimpe Olawale",
                    matric: "200L/LAW/22",
                    amount: "₦2,000",
                    days: 3,
                  },
                  {
                    name: "Emeka Chukwu",
                    matric: "300L/MED/21",
                    amount: "₦8,750",
                    days: 12,
                  },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between gap-4 border-b border-[color:var(--hairline)] px-4 py-2.5 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5534B]" />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-[color:var(--text-primary)]">
                          {row.name}
                        </p>
                        <p className="tnum text-[10px] text-[color:var(--text-quaternary)]">
                          {row.matric} · {row.days} days overdue
                        </p>
                      </div>
                    </div>
                    <span className="tnum shrink-0 text-[13px] text-[#F0736B]">
                      {row.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="scroll-mt-20 px-6 py-20 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div {...anim} className="mb-14 max-w-xl">
            <p className="eyebrow mb-4">Simple by design</p>
            <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
              Your ledger lives in WhatsApp.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
              Nothing to download and nothing to learn. You already know how to
              send a message — that is the whole product.
            </p>
          </motion.div>

          <StepSequence />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section
        id="features"
        className="scroll-mt-20 px-6 py-20 md:px-12 md:py-28"
      >
        <motion.div {...anim} className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl">
            <p className="eyebrow mb-4">Everything you need</p>
            <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
              Built for the vendor. Nothing extra.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <MagicCard key={f.title} className="p-6">
                <f.icon size={17} className="text-vodium-gold" />
                <h3 className="mb-2.5 mt-4 text-[15px] font-medium text-[color:var(--text-primary)]">
                  {f.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-[color:var(--text-tertiary)]">
                  {f.body}
                </p>
              </MagicCard>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <section className="border-t border-[color:var(--hairline)] px-6 py-20 md:px-12 md:py-28">
        <motion.div {...anim} className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl">
            <p className="eyebrow mb-4">What vendors say</p>
            <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
              Real results. Real vendors.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-1)] p-6"
              >
                <blockquote className="text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 border-t border-[color:var(--hairline)] pt-4">
                  <p className="text-[13px] font-medium text-[color:var(--text-primary)]">
                    {t.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[color:var(--text-quaternary)]">
                    {t.role}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
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

          <div className="grid gap-4 md:grid-cols-3">
            {TIERS.map((tier) => {
              const body = (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-quaternary)]">
                      {tier.plan}
                    </p>
                    {tier.popular && (
                      <span className="rounded-full border border-vodium-gold/25 bg-vodium-gold/10 px-2 py-0.5 text-[10px] font-medium text-vodium-gold">
                        Most popular
                      </span>
                    )}
                  </div>

                  <p className="tnum mt-4 text-[30px] leading-none text-[color:var(--text-primary)]">
                    {tier.price}
                  </p>
                  <p className="mt-1.5 text-[12px] text-[color:var(--text-quaternary)]">
                    {tier.sub}
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--text-tertiary)]">
                    {tier.description}
                  </p>

                  <ul className="mb-7 mt-6 flex-1 space-y-2.5">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-[13px] text-[color:var(--text-secondary)]"
                      >
                        <CheckCircle
                          size={14}
                          className="mt-0.5 shrink-0 text-vodium-gold"
                          aria-hidden
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/register"
                    className={
                      tier.popular
                        ? "btn-gold w-full rounded-lg py-3 text-center text-[14px]"
                        : "w-full rounded-lg border border-[color:var(--hairline-strong)] py-3 text-center text-[14px] font-medium text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--text-quaternary)] hover:text-[color:var(--text-primary)]"
                    }
                  >
                    Start free trial
                  </Link>
                </>
              );

              // The recommended tier gets the gold-hairline treatment; the rest
              // sit on the standard card surface.
              return tier.popular ? (
                <AnimatedBorder
                  key={tier.plan}
                  className="flex h-full flex-col p-6"
                >
                  {body}
                </AnimatedBorder>
              ) : (
                <div
                  key={tier.plan}
                  className="flex h-full flex-col rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-1)] p-6"
                >
                  {body}
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="border-t border-[color:var(--hairline)] px-6 py-20 md:px-12 md:py-28">
        <motion.div {...anim} className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
            Built for the vendor. Owned by Africa.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
            Vodium Ledger is the first step in Africa&rsquo;s credit ecosystem.
            Every credit you track builds the graph that makes lending smarter
            for everyone.
          </p>
          <Link href="/register" className="mt-9 inline-block">
            <ShimmerButton className="gap-2 px-8">
              Sign your shop up — it&rsquo;s free <ArrowRight size={16} />
            </ShimmerButton>
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
            <dd className="tnum text-[16px] leading-none text-[#56C963]">
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
                    row.paid ? "bg-[#3FB950]" : "bg-[#E5534B]"
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
                    : "text-[#F0736B]"
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
      {/* Steps */}
      <ul className="space-y-12 lg:space-y-32">
        {STEPS.map((step, i) => {
          const active = enabled && i === activeIndex;
          // Dimming only earns its place next to the sticky panel, where it
          // shows which step the panel is answering. On small screens each step
          // carries its own visual and is read in order, so greying out the one
          // you are halfway through would just make it harder to read.
          const dim = enabled && !active ? "lg:opacity-45" : "lg:opacity-100";
          return (
            <li
              key={step.n}
              ref={registerStep(i)}
              aria-current={active ? "step" : undefined}
              className="lg:min-h-[220px]"
            >
              <div
                className={`flex items-center gap-3 transition-opacity duration-300 ${dim}`}
              >
                <span
                  className={`tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] transition-colors duration-300 ${
                    active
                      ? "border-vodium-gold/40 bg-vodium-gold/10 text-vodium-gold"
                      : "border-[color:var(--hairline)] text-[color:var(--text-quaternary)]"
                  }`}
                >
                  {step.n}
                </span>
                <span className="h-px flex-1 bg-[color:var(--hairline)]" />
                <step.icon
                  size={16}
                  className={
                    active
                      ? "text-vodium-gold"
                      : "text-[color:var(--text-quaternary)]"
                  }
                />
              </div>

              <div className={`transition-opacity duration-300 ${dim}`}>
                <h3 className="mb-2.5 mt-5 text-[17px] font-medium text-[color:var(--text-primary)] md:text-[19px]">
                  {step.title}
                </h3>
                <p className="max-w-md text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
                  {step.body}
                </p>
              </div>

              {/* Inline visual — the sticky column takes over from lg up. */}
              <div className="mt-6 lg:hidden">
                <StepVisual index={i} />
              </div>
            </li>
          );
        })}
      </ul>

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

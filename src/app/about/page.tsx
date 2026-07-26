import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Users,
  Shield,
  Zap,
  Mail,
  Target,
  Lightbulb,
} from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedBorder } from "@/components/ui/animated-border";
import { GlowBadge } from "@/components/ui/glow-badge";

export const metadata = {
  title: "About Vodium Ledger",
  description:
    "We're building Africa's credit graph, one campus vendor at a time.",
};

const stats = [
  { value: "127+", label: "Active vendors" },
  { value: "₦47M+", label: "Credit tracked" },
  { value: "4,800+", label: "Students with history" },
  { value: "73%", label: "Repayment rate" },
];

const team = [
  {
    initials: "VK",
    name: "Victor Kalejaye",
    role: "CEO & Founder",
    bio: "Building the credit infrastructure Africa's informal economy has always needed.",
  },
  {
    initials: "FA",
    name: "Folusho Adeyemi",
    role: "Co-founder",
    bio: "Deep roots in Nigerian commerce and campus markets. Knows how vendors actually operate.",
  },
  {
    initials: "OO",
    name: "Olamilekan Ogunyade",
    role: "CTO & Co-founder",
    bio: "Full-stack engineer obsessed with WhatsApp-native product design and reliability.",
  },
  {
    initials: "OA",
    name: "Oluwademilade Akinsipe",
    role: "CPO & Co-founder",
    bio: "Product thinker focused on 15-second vendor flows and customer dignity.",
  },
];

const values = [
  {
    icon: TrendingUp,
    label: "Credit data at scale",
    desc: "Every transaction builds the graph.",
  },
  {
    icon: Users,
    label: "Vendor-first",
    desc: "If vendors don't love it, nothing else matters.",
  },
  {
    icon: Shield,
    label: "Privacy-first",
    desc: "Student data is never shared without consent.",
  },
  {
    icon: Zap,
    label: "Speed is a feature",
    desc: "15 seconds to log a credit. That's the constraint.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-vodium-black text-vodium-cream">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
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
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-vodium-cream/50 hover:text-vodium-gold transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Home
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 btn-gold px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-[0_0_20px_rgba(201,169,97,0.3)] transition-all"
            >
              Get started <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero */}
        <section className="mesh-bg bg-dots relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,169,97,0.06),transparent)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-28 pb-24 relative z-10">
            <div className="max-w-3xl">
              <GlowBadge color="gold" className="mb-7">
                About Vodium
              </GlowBadge>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-vodium-cream leading-[1.05] mb-6">
                We&apos;re building{" "}
                <span className="text-gradient-gold">
                  Africa&apos;s credit graph.
                </span>
              </h1>
              <p className="text-vodium-cream/55 text-xl leading-relaxed max-w-2xl">
                Starting with the 850,000 campus vendors who extend informal
                credit to Nigerian customers every day.
              </p>
            </div>
          </div>
          <div className="brand-divider" />
        </section>

        {/* Mission */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold block mb-5">
                Our mission
              </span>
              <p className="text-vodium-cream/70 text-lg leading-relaxed">
                Africa has 1.4 billion people. Most have no formal credit
                history. We&apos;re building it one campus vendor, one customer,
                one repayment at a time.
              </p>
              <p className="text-vodium-cream/70 text-lg leading-relaxed mt-5">
                Vodium Ledger is the first product in a long-term vision to own
                the consumer credit infrastructure layer for Africa. We start
                where credit data is being created right now in the informal
                economy on Nigerian campuses.
              </p>
              <div className="mt-8">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 btn-gold px-6 py-3 rounded-xl text-sm font-semibold hover:shadow-[0_0_24px_rgba(201,169,97,0.3)] transition-all"
                >
                  Join the mission <ArrowRight size={14} />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {values.map(({ icon: Icon, label, desc }) => (
                <MagicCard key={label} className="rounded-xl">
                  <div className="p-5 h-full flex flex-col gap-3">
                    <div className="w-9 h-9 rounded-lg bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
                      <Icon size={16} className="text-vodium-gold" />
                    </div>
                    <p className="text-vodium-cream/80 text-sm font-semibold leading-tight">
                      {label}
                    </p>
                    <p className="text-vodium-cream/40 text-xs leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </MagicCard>
              ))}
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-y border-white/[0.06] bg-vodium-charcoal/40">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x md:divide-white/[0.06]">
              {stats.map(({ value, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center text-center md:px-8"
                >
                  <span className="font-serif text-4xl md:text-5xl text-gradient-gold font-bold mb-2">
                    {value}
                  </span>
                  <span className="text-vodium-cream/45 text-sm tracking-wide">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="max-w-2xl mx-auto text-center">
            <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold block mb-5">
              The problem
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-vodium-cream mb-8 leading-snug">
              Billions lost to informal credit defaults every year.
            </h2>
            <p className="text-vodium-cream/60 text-lg leading-relaxed">
              Nigerian campus vendors lose billions each year to informal credit
              defaults. They track debtors in torn notebooks. Students pay late
              or disappear. Vendors have no recourse and no data.
            </p>
            <p className="text-vodium-cream/60 text-lg leading-relaxed mt-5">
              Vodium Ledger fixes this a WhatsApp-first tool that takes 15
              seconds to log a credit and auto-reminds customers before they
              default.
            </p>
          </div>
        </section>

        <div className="brand-divider max-w-6xl mx-auto px-6 md:px-12" />

        {/* Team */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="mb-14 text-center">
            <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold block mb-4">
              The team
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-vodium-cream">
              Built by Nigerians, for Nigeria.
            </h2>
            <p className="text-vodium-cream/45 text-sm mt-3 max-w-md mx-auto">
              A small team with deep roots in Nigerian fintech, banking, and
              campus commerce.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {team.map(({ initials, name, role, bio }) => (
              <AnimatedBorder key={name}>
                <div className="p-6 flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-full bg-vodium-charcoal border border-vodium-gold/40 flex items-center justify-center shadow-[0_0_16px_rgba(201,169,97,0.1)]">
                    <span className="font-serif text-vodium-gold text-lg leading-none">
                      {initials}
                    </span>
                  </div>
                  <div>
                    <p className="text-vodium-cream font-semibold text-sm leading-tight">
                      {name}
                    </p>
                    <p className="text-vodium-gold text-xs mt-1 font-medium">
                      {role}
                    </p>
                  </div>
                  <p className="text-vodium-cream/50 text-sm leading-relaxed">
                    {bio}
                  </p>
                </div>
              </AnimatedBorder>
            ))}
          </div>
        </section>

        {/* What's next */}
        <section className="bg-vodium-charcoal/30 border-y border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold block mb-5">
                  What&apos;s next
                </span>
                <h2 className="font-serif text-3xl md:text-4xl text-vodium-cream mb-6 leading-snug">
                  Phase 1 is just the beginning.
                </h2>
                <p className="text-vodium-cream/60 text-base leading-relaxed mb-5">
                  Vodium Ledger (Phase 1) builds the proprietary repayment data
                  that earns us the right to launch Vodium Premium Africa&apos;s
                  first consumer credit card brand in Year 2.
                </p>
                <p className="text-vodium-cream/60 text-base leading-relaxed">
                  Every vendor who subscribes and every credit tracked brings us
                  one step closer to owning the credit infrastructure layer for
                  Africa&apos;s 1.4 billion consumers.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  {
                    icon: Target,
                    label: "Phase 1 : Vodium Ledger",
                    desc: "WhatsApp-first credit ledger for campus vendors. Build the data.",
                  },
                  {
                    icon: Lightbulb,
                    label: "Phase 2 : Vodium Premium",
                    desc: "Africa's first campus-native credit card, powered by our repayment data.",
                  },
                  {
                    icon: TrendingUp,
                    label: "Phase 3 : Vodium Network",
                    desc: "Cross-vendor credit graph. Know who pays before you extend credit.",
                  },
                ].map(({ icon: Icon, label, desc }, i) => (
                  <div
                    key={label}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${i === 0 ? "bg-vodium-gold/15 border border-vodium-gold/30" : "bg-white/[0.04] border border-white/[0.08]"}`}
                    >
                      <Icon
                        size={15}
                        className={
                          i === 0 ? "text-vodium-gold" : "text-vodium-cream/30"
                        }
                      />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-semibold leading-tight ${i === 0 ? "text-vodium-cream" : "text-vodium-cream/45"}`}
                      >
                        {label}
                      </p>
                      <p className="text-vodium-cream/35 text-xs mt-1 leading-relaxed">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 text-center">
          <h2 className="font-serif text-3xl text-vodium-cream mb-4">
            Get in touch.
          </h2>
          <p className="text-vodium-cream/50 mb-8 max-w-md mx-auto">
            Partnerships, press, investors, or just want to learn more about
            what we&apos;re building?
          </p>
          <a
            href="mailto:hello@vodiumledger.com"
            className="inline-flex items-center gap-2.5 btn-gold px-7 py-3.5 rounded-xl text-sm font-semibold hover:shadow-[0_0_28px_rgba(201,169,97,0.35)] transition-all"
          >
            <Mail size={15} />
            hello@vodiumledger.com
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-vodium-cream/30">
          <span className="text-center md:text-left">© 2026 Vodium. Lagos, Nigeria.<br />Vodium Ledger is operated by VODIUMX TECHNOLOGIES LTD (RC: 8976921).</span>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="hover:text-vodium-gold transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-vodium-gold transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/careers"
              className="hover:text-vodium-gold transition-colors"
            >
              Careers
            </Link>
            <Link
              href="/blog"
              className="hover:text-vodium-gold transition-colors"
            >
              Blog
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

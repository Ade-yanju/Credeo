import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  ArrowRight,
  Heart,
  Wifi,
  Shield,
  Zap,
  Globe,
  Users,
} from "lucide-react";
import { AnimatedBorder } from "@/components/ui/animated-border";
import { MagicCard } from "@/components/ui/magic-card";
import { GlowBadge } from "@/components/ui/glow-badge";

export const metadata = {
  title: "Careers : Vodium Ledger",
  description: "Join us in building Africa's credit infrastructure.",
};

const benefits = [
  { icon: Zap, label: "Competitive salary in NGN + ESOP" },
  { icon: Globe, label: "Remote-first culture" },
  { icon: Wifi, label: "Monthly data allowance" },
  { icon: Heart, label: "Health insurance" },
  { icon: Shield, label: "Direct impact on Africa's credit ecosystem" },
  { icon: Users, label: "Team from Paystack, Google, GTBank" },
];

export default function CareersPage() {
  return (
    <div className="marketing-page min-h-screen">
      <SiteNav />

      <main className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-28 pb-24">
            <div className="max-w-3xl">
              <GlowBadge color="gold" className="mb-6">
                Careers at Vodium
              </GlowBadge>
              <h1 className="font-serif text-[38px] leading-[1.08] tracking-[-0.02em] text-[color:var(--text-primary)] md:text-[52px] mb-6">
                Build Africa&apos;s{" "}
                <span className="">financial future.</span>
              </h1>
              <p className="text-[color:var(--text-tertiary)] text-xl leading-relaxed max-w-2xl">
                We&apos;re a small team with an audacious goal. If you want your
                work to matter this is it.
              </p>
            </div>
          </div>
          <div className="brand-divider" />
        </section>

        {/* Open Positions */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="mb-12">
            <span className="eyebrow block mb-3">
              Open roles
            </span>
            <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
              No open positions right now.
            </h2>
          </div>

          <AnimatedBorder>
            <div className="p-6 md:p-8 max-w-2xl">
              <p className="text-[color:var(--text-tertiary)] text-sm md:text-base leading-relaxed">
                We&apos;re not hiring at the moment. The team is heads-down
                building Vodium Ledger with our pilot vendors. When a role
                opens, it will be posted here first.
              </p>
              <p className="text-[color:var(--text-tertiary)] text-sm md:text-base leading-relaxed mt-4">
                Think you&apos;d be a great fit anyway? Introduce yourself —
                we read every email and keep good people in mind.
              </p>
              <a
                href="mailto:careers@vodiumledger.com?subject=Future roles at Vodium"
                className="mt-6 inline-flex items-center gap-2 btn-gold px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              >
                careers@vodiumledger.com <ArrowRight size={14} />
              </a>
            </div>
          </AnimatedBorder>
        </section>

        {/* Benefits */}
        <section className="border-y border-[color:var(--hairline)] bg-[color:var(--surface-1)]">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
            <div className="mb-12 text-center">
              <span className="eyebrow block mb-3">
                Why Vodium
              </span>
              <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
                What you get.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {benefits.map(({ icon: Icon, label }) => (
                <MagicCard key={label} className="rounded-xl">
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-vodium-gold" />
                    </div>
                    <span className="text-[color:var(--text-secondary)] text-sm font-medium">
                      {label}
                    </span>
                  </div>
                </MagicCard>
              ))}
            </div>
          </div>
        </section>

        {/* Culture note */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-serif text-3xl text-[color:var(--text-primary)] mb-5">
              We&apos;re a startup.{" "}
              <span className="">No bureaucracy.</span>
            </h2>
            <p className="text-[color:var(--text-tertiary)] text-lg leading-relaxed">
              We move fast. You&apos;ll own your work from day one. No long
              hiring pipelines if you&apos;re good, we move in days.
            </p>
            <div className="brand-divider my-10" />
            <p className="text-[color:var(--text-tertiary)] text-sm mb-4">
              Questions? Reach us at
            </p>
            <a
              href="mailto:careers@vodiumledger.com"
              className="text-vodium-gold hover:text-vodium-gold/80 transition-colors font-medium"
            >
              careers@vodiumledger.com
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}

import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy : Vodium Ledger",
  description:
    "How Vodium Ledger collects, uses, and protects your data. NDPR compliant.",
};

export default function PrivacyPage() {
  const EFFECTIVE = "1 June 2026";
  const EMAIL = "privacy@vodiumledger.com";

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section className="mb-10">
      <h2 className="font-serif text-xl text-vodium-black mb-3">{title}</h2>
      <div className="text-vodium-black/65 text-[15px] leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-vodium-cream">
      {/* Nav */}
      <nav className="border-b border-black/[0.06] bg-white/80 backdrop-blur-md sticky top-0 z-20 pt-safe px-safe">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-vodium-black border border-vodium-gold/40 flex items-center justify-center">
              <span className="font-serif text-vodium-gold text-sm leading-none">
                V
              </span>
            </div>
            <span className="font-serif tracking-[0.18em] text-vodium-black text-xs">
              VODIUM LEDGER
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-vodium-black/50 hover:text-vodium-black transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
              <Shield size={18} className="text-vodium-gold" />
            </div>
            <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold">
              Legal
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-vodium-black mb-4 leading-tight">
            Privacy Policy
          </h1>
          <p className="text-vodium-black/40 text-sm">
            Effective:{" "}
            <strong className="text-vodium-black/60">{EFFECTIVE}</strong>
            &nbsp;·&nbsp;Governed by Nigerian law (NDPR 2019)
          </p>
        </div>

        <div className="brand-divider mb-10" />

        <Section title="Who we are">
          <p>
            Vodium Ledger is operated by VODIUMX TECHNOLOGIES LTD (RC: 8976921) (&quot;Vodium&quot;,
            &quot;we&quot;, &quot;us&quot;), a Nigerian company building credit intelligence
            infrastructure for campus vendors. This policy explains how we
            handle personal data collected through our web platform at{" "}
            <strong>vodiumledger.com</strong> and our WhatsApp bot service.
          </p>
          <p>
            We are a data controller under Nigeria&apos;s National Information
            Technology Development Agency (NITDA) regulations. Questions? Email{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-vodium-gold hover:underline"
            >
              {EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="Data we collect">
          <p>
            <strong className="text-vodium-black">
              Vendor data (you, the shop owner):
            </strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Business name, owner name, vendor type, campus location</li>
            <li>
              Email address and WhatsApp phone number (used as your login
              identity)
            </li>
            <li>Password (stored as a bcrypt hash never in plaintext)</li>
            <li>Subscription and payment history (via Paystack)</li>
          </ul>
          <p className="mt-3">
            <strong className="text-vodium-black">
              Student data (your customers):
            </strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Full name, matric number, and WhatsApp number (if provided)</li>
            <li>Credit records: amount, due date, repayment status</li>
            <li>
              Vodium Score a proprietary credit quality index (0–1000) derived
              from repayment behaviour across the network
            </li>
          </ul>
          <p className="mt-3">
            <strong className="text-vodium-black">Usage data:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Browser type, IP address, pages visited, feature usage (via
              PostHog)
            </li>
            <li>Error logs (via Sentry anonymised where possible)</li>
            <li>WhatsApp message content related to credit operations</li>
          </ul>
        </Section>

        <Section title="How we use your data">
          <p>
            We process data only for the purposes below, with the indicated
            legal basis:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse mt-2">
              <thead>
                <tr className="border-b border-black/[0.08]">
                  <th className="text-left py-2 pr-4 font-semibold text-vodium-black">
                    Purpose
                  </th>
                  <th className="text-left py-2 font-semibold text-vodium-black">
                    Legal basis
                  </th>
                </tr>
              </thead>
              <tbody className="text-vodium-black/60">
                {[
                  [
                    "Providing credit tracking and dashboard services",
                    "Contract performance",
                  ],
                  ["Sending OTP verification emails", "Contract performance"],
                  [
                    "Sending student payment reminders via WhatsApp",
                    "Legitimate interest",
                  ],
                  [
                    "Computing Vodium Score for students",
                    "Legitimate interest",
                  ],
                  [
                    "Subscription billing through Paystack",
                    "Contract performance",
                  ],
                  [
                    "Product analytics and improvement (PostHog)",
                    "Legitimate interest",
                  ],
                  ["Error monitoring (Sentry)", "Legitimate interest"],
                  [
                    "Compliance with NDPR and applicable Nigerian law",
                    "Legal obligation",
                  ],
                ].map(([purpose, basis]) => (
                  <tr key={purpose} className="border-b border-black/[0.05]">
                    <td className="py-2.5 pr-4">{purpose}</td>
                    <td className="py-2.5 text-vodium-gold/80">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Data sharing">
          <p>
            We do <strong>not</strong> sell your personal data. We share data
            only as follows:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-vodium-black">
                Cross-vendor credit scores:
              </strong>{" "}
              If you are on Growth or Campus Pro, you can view a student&apos;s
              Vodium Score. This score is derived from the student&apos;s
              aggregate repayment history across the network, but you never see
              which other vendors they owe or details of those transactions.
            </li>
            <li>
              <strong className="text-vodium-black">
                Payment processor (Paystack):
              </strong>{" "}
              Billing information is processed by Paystack in accordance with
              their own privacy policy.
            </li>
            <li>
              <strong className="text-vodium-black">WhatsApp (Meta):</strong>{" "}
              Student reminders are delivered through Meta&apos;s WhatsApp
              Business API. Message content is governed by Meta&apos;s Data
              Policy.
            </li>
            <li>
              <strong className="text-vodium-black">Service providers:</strong>{" "}
              Supabase (database), Vercel (hosting), Resend (email), Upstash
              (caching). All are bound by data processing agreements.
            </li>
            <li>
              <strong className="text-vodium-black">Law enforcement:</strong>{" "}
              Only when required by a valid court order or Nigerian law.
            </li>
          </ul>
        </Section>

        <Section title="Data retention">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Vendor accounts and credit records: retained while your account is
              active and for 3 years after closure (Nigerian accounting
              requirement).
            </li>
            <li>
              Student records: retained as long as there is at least one active
              vendor with records for that student. Anonymised after 5 years of
              inactivity.
            </li>
            <li>
              WhatsApp session data: 90 days of conversation context, then
              purged.
            </li>
            <li>Server logs: 30 days rolling.</li>
          </ul>
        </Section>

        <Section title="Your rights (NDPR)">
          <p>
            Under the Nigeria Data Protection Regulation 2019, you have the
            right to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-vodium-black">Access</strong> : request a
              copy of your personal data
            </li>
            <li>
              <strong className="text-vodium-black">Rectification</strong> :
              correct inaccurate data
            </li>
            <li>
              <strong className="text-vodium-black">Erasure</strong> : request
              deletion of your account and data (subject to legal retention
              requirements)
            </li>
            <li>
              <strong className="text-vodium-black">Restriction</strong> : limit
              how we process your data
            </li>
            <li>
              <strong className="text-vodium-black">Portability</strong> :
              receive your data in a machine-readable format (CSV export
              available in-dashboard)
            </li>
            <li>
              <strong className="text-vodium-black">Object</strong> : object to
              processing based on legitimate interest
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-vodium-gold hover:underline"
            >
              {EMAIL}
            </a>
            . We respond within 30 days.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We take security seriously. Measures in place include: HMAC-SHA256
            signed session tokens, bcrypt password hashing (cost factor 12),
            httpOnly + Secure + SameSite cookies, TLS everywhere, row-level data
            isolation (vendors cannot see each other&apos;s books), IP-based
            rate limiting on all authentication endpoints, and Sentry error
            monitoring with PII scrubbing.
          </p>
          <p>
            We conduct periodic security reviews. If you discover a
            vulnerability, please report it responsibly to{" "}
            <a
              href="mailto:security@vodiumledger.com"
              className="text-vodium-gold hover:underline"
            >
              security@vodiumledger.com
            </a>
            .
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use <strong>strictly necessary cookies only</strong>{" "}
            specifically, an httpOnly session cookie named{" "}
            <code className="text-xs bg-black/[0.06] px-1.5 py-0.5 rounded">
              vodium_sid
            </code>{" "}
            that stores your authenticated session. We do not use advertising
            cookies. PostHog analytics may set a first-party cookie to track
            session continuity.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Vodium Ledger is intended for business owners (vendors). We do not
            knowingly collect data from individuals under 18 years old as
            primary account holders. Student records (which may include students
            of any age) are entered by vendors, who are responsible for
            obtaining any necessary consent from their customers.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We will notify active vendors by email at least 14 days before any
            material changes to this policy. Continued use of the platform after
            the effective date constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            VODIUMX TECHNOLOGIES LTD (RC: 8976921)
            <br />
            Lagos, Nigeria
            <br />
            Email:{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-vodium-gold hover:underline"
            >
              {EMAIL}
            </a>
            <br />
            Data Protection Officer:{" "}
            <a
              href="mailto:dpo@vodiumledger.com"
              className="text-vodium-gold hover:underline"
            >
              dpo@vodiumledger.com
            </a>
          </p>
        </Section>

        <div className="brand-divider mt-12 mb-8" />
        <p className="text-vodium-black/30 text-xs text-center">
          © 2026 VODIUMX TECHNOLOGIES LTD (RC: 8976921) · Lagos, Nigeria · All rights
          reserved
        </p>
      </main>
    </div>
  );
}

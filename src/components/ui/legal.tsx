import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const COMPANY = "Vodium Ledger";
const SUPPORT_EMAIL = "support@vodiumledger.com";

export const LEGAL_DOCS = [
  { slug: "terms", title: "Terms of Service", blurb: "The agreement governing use of the Vodium Ledger platform." },
  { slug: "privacy", title: "Privacy Policy", blurb: "How we collect, use and protect personal data under the NDPA." },
  { slug: "bnpl-terms", title: "BNPL Customer Terms", blurb: "Repayment terms for customers buying on credit at a store." },
  { slug: "refund", title: "Refund & Dispute Policy", blurb: "How refunds, chargebacks and disputes are handled." },
  { slug: "service-agreement", title: "Supermarket Service Agreement", blurb: "Commercial terms for supermarket and enterprise tenants." },
  { slug: "dpa", title: "Data Processing Agreement", blurb: "Vodium's processor obligations for store-controlled customer data." },
  { slug: "payment-authorization", title: "Payment Authorization Terms", blurb: "How a customer authorises payments via a licensed provider." },
  { slug: "cookies", title: "Cookie Policy", blurb: "The cookies Vodium Ledger uses and why." },
];

export function LegalArticle({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="space-y-6">
      <Link
        href="/legal"
        className="inline-flex items-center gap-2 text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-vodium-gold"
      >
        <ArrowLeft size={15} /> All legal documents
      </Link>

      <div className="rounded-lg border border-[#D2A24C]/25 bg-[#D2A24C]/[0.07] px-4 py-3 text-[12px] leading-relaxed text-[#DFB569]">
        Template document. Review and adapt with a qualified Nigerian lawyer
        before relying on it for live customers.
      </div>

      <header>
        <h1 className="font-serif text-[30px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)]">
          {title}
        </h1>
        <p className="mt-2 text-[13px] text-[color:var(--text-tertiary)]">
          Last updated {updated} · {COMPANY}
        </p>
      </header>

      {/* Prose styling is shared with /privacy and /terms via .prose-vodium. */}
      <div className="prose-vodium border-t border-[color:var(--hairline)] pt-6">
        {children}
      </div>

      <footer className="border-t border-[color:var(--hairline)] pt-5 text-[12px] text-[color:var(--text-quaternary)]">
        Questions? Contact{" "}
        <a
          className="text-vodium-gold underline underline-offset-2"
          href={`mailto:${SUPPORT_EMAIL}`}
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </footer>
    </article>
  );
}

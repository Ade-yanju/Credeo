import Link from "next/link";
import { FileText } from "lucide-react";
import { LEGAL_DOCS } from "@/components/ui/legal";

export const metadata = { title: "Legal · Vodium Ledger" };

export default function LegalIndexPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Legal</p>
        <h1 className="mt-2 font-serif text-[30px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)]">
          Policies and agreements
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
          The documents that govern Vodium Ledger and credit purchases made
          through it.
        </p>
      </header>

      <div className="space-y-2.5">
        {LEGAL_DOCS.map((doc) => (
          <Link
            key={doc.slug}
            href={`/legal/${doc.slug}`}
            className="block rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface-1)] p-4 transition-colors hover:border-[color:var(--hairline-strong)]"
          >
            <div className="flex items-start gap-3">
              <FileText size={16} className="mt-0.5 shrink-0 text-vodium-gold" />
              <div>
                <p className="text-[14px] font-medium text-[color:var(--text-primary)]">
                  {doc.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--text-tertiary)]">
                  {doc.blurb}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

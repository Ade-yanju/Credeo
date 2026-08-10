import Link from "next/link";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * Shell for the public legal documents at /privacy and /terms.
 *
 * Both pages used to render light — cream background, white sticky nav — while
 * every other footer destination is dark. Clicking "Privacy policy" from the
 * dark footer flashed white. They also had no footer at all, so the only way
 * out was the browser back button.
 *
 * Note: this is separate from the /legal/* tree, which holds a second,
 * differently-worded set of documents (BNPL terms, DPA, refund policy) reached
 * from the checkout and tenant flows. Those are unchanged here.
 */
export function LegalPage({
  title,
  effective,
  meta,
  children,
}: {
  title: string;
  effective: string;
  /** Short line under the title, e.g. the governing law. */
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-page min-h-screen">
      {/* Section anchors point at the landing page, which is a jarring jump
          out of a document someone is mid-way through reading. */}
      <SiteNav sections={false} />

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-32 md:pt-36">
        <p className="eyebrow mb-4">Legal</p>
        <h1 className="font-serif text-[34px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[42px]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] text-[color:var(--text-tertiary)]">
          Effective {effective}
          {meta ? ` · ${meta}` : ""}
        </p>

        <div className="prose-vodium mt-10 border-t border-[color:var(--hairline)] pt-10">
          {children}
        </div>

        <div className="mt-14 border-t border-[color:var(--hairline)] pt-6">
          <p className="text-[12px] leading-relaxed text-[color:var(--text-quaternary)]">
            © 2026 VODIUMX TECHNOLOGIES LTD (RC: 8976921) · Lagos, Nigeria · All
            rights reserved.
          </p>
          <div className="mt-3 flex gap-4 text-[12px]">
            <Link
              href="/privacy"
              className="text-[color:var(--text-tertiary)] transition-colors hover:text-vodium-gold"
            >
              Privacy policy
            </Link>
            <Link
              href="/terms"
              className="text-[color:var(--text-tertiary)] transition-colors hover:text-vodium-gold"
            >
              Terms of service
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** One titled section of a legal document. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

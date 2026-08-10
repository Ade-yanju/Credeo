import Link from "next/link";

/**
 * Marketing site footer.
 *
 * The landing page, about, blog, careers and whatsapp each carried their own
 * copy of this; privacy and terms had none at all, which made them dead ends —
 * you could reach the privacy policy from any footer but not leave it without
 * the back button. One component now serves all seven.
 *
 * Section hrefs are absolute ("/#pricing") so they resolve from any route, not
 * just the landing page where the anchors actually live.
 */

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "WhatsApp bot", href: "/whatsapp" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "NDPR compliance", href: "/privacy#your-rights-ndpr" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--hairline)] px-6 py-14 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid gap-10 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-vodium-gold/30 bg-[color:var(--surface-2)]">
                <span className="font-serif text-[15px] leading-none text-vodium-gold">V</span>
              </span>
              <span className="font-serif text-[13px] tracking-[0.16em] text-[color:var(--text-primary)]">
                VODIUM LEDGER
              </span>
            </div>
            <p className="max-w-[28ch] text-[13px] leading-relaxed text-[color:var(--text-tertiary)]">
              Africa&rsquo;s credit infrastructure layer. Starting with Nigerian
              vendors.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-quaternary)]">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[color:var(--hairline)] pt-8">
          <p className="text-[12px] leading-relaxed text-[color:var(--text-quaternary)]">
            © 2026 Vodium. Lagos, Nigeria. All rights reserved.
            <br />
            Vodium Ledger is operated by VODIUMX TECHNOLOGIES LTD (RC: 8976921).
          </p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-page min-h-screen">
      <header className="flex h-14 items-center border-b border-[color:var(--hairline)] px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-vodium-gold/25 bg-[color:var(--surface-1)]">
            <span className="font-serif text-sm text-vodium-gold">V</span>
          </div>
          <span className="font-serif text-[11px] tracking-[0.22em] text-vodium-gold">
            VODIUM LEDGER
          </span>
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 md:py-14">{children}</main>
    </div>
  );
}

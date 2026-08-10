"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, Settings, LogOut,
  MessageCircle, Menu, X, Plus, ChevronRight, Zap,
  Building2, ReceiptText, TicketPercent, WalletCards, SlidersHorizontal, Package, FileText,
} from "lucide-react";
import { NpsWidget } from "@/components/ui/nps-widget";
import { NavProgress } from "@/components/ui/nav-progress";
import { NotificationBell } from "@/components/ui/notification-bell";

type VendorInfo = {
  businessName: string;
  ownerName: string;
  location: string | null;
  community: { shortName: string | null; name: string } | null;
  organization: { name: string; type: string; status: string; trialEndsAt: string | null; logoUrl: string | null; brandColor: string | null } | null;
  branch: { name: string; code: string } | null;
  subscription: { 
    plan: string; 
    status: string;
    trialEndsAt: string | null;
  } | null;
};

const NAV_ITEMS = [
  { href: "/dashboard",           icon: LayoutDashboard, label: "Overview",  emoji: "◈" },
  { href: "/dashboard/credits",   icon: CreditCard,      label: "Credits",   emoji: "◉" },
  { href: "/dashboard/invoices",  icon: FileText,        label: "Invoices",  emoji: "◈" },
  { href: "/dashboard/customers", icon: Users,           label: "Customers", emoji: "◎" },
  { href: "/dashboard/settings",  icon: Settings,        label: "Settings",  emoji: "◌" },
];

const ENTERPRISE_NAV_ITEMS = [
  { href: "/dashboard/supermarket", icon: Building2,     label: "HQ" },
  { href: "/dashboard/products",    icon: Package,       label: "Products" },
  { href: "/dashboard/bnpl",        icon: ReceiptText,   label: "BNPL" },
  { href: "/dashboard/coupons",     icon: TicketPercent, label: "Coupons" },
  { href: "/dashboard/ledger",      icon: WalletCards,   label: "Ledger" },
  { href: "/dashboard/supermarket/settings", icon: SlidersHorizontal, label: "Org settings" },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":            "Overview",
  "/dashboard/credits":    "Credits",
  "/dashboard/invoices":   "Invoices",
  "/dashboard/customers":  "Customers",
  "/dashboard/settings":   "Settings",
  "/dashboard/credit/new": "New Credit",
  "/dashboard/supermarket": "Supermarket",
  "/dashboard/supermarket/settings": "Org settings",
  "/dashboard/products":   "Products",
  "/dashboard/bnpl":       "BNPL",
  "/dashboard/coupons":    "Coupons",
  "/dashboard/ledger":     "Ledger",
};

const PLAN_COLORS: Record<string, string> = {
  STARTER:    "text-vodium-cream/60 bg-white/[0.05] border-white/[0.10]",
  GROWTH:     "text-vodium-gold bg-vodium-gold/10 border-vodium-gold/25",
  PRO:        "text-purple-400 bg-purple-400/10 border-purple-400/25",
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter", GROWTH: "Growth", PRO: "Pro",
};

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vendor, setVendor]           = useState<VendorInfo | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/vendor/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setVendor(data));
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    // Full navigation (not router.push) so no authenticated client state or
    // cached view can be restored via the browser back button.
    window.location.replace("/login");
  }

  const businessName = vendor?.businessName ?? "My Shop";
  const isEnterprise = vendor?.organization && vendor.organization.type !== "SOLO_VENDOR";
  const brandColor   = (isEnterprise && vendor?.organization?.brandColor) || null;
  const orgLogo      = isEnterprise ? vendor?.organization?.logoUrl ?? null : null;
  const orgName      = isEnterprise ? vendor?.organization?.name ?? null : null;
  const community    = isEnterprise
    ? vendor?.branch?.name ?? vendor?.organization?.name ?? "Organization"
    : vendor?.community?.shortName ?? vendor?.community?.name ?? vendor?.location ?? "Community";
  const plan         = vendor?.subscription?.plan ?? "STARTER";
  const planLabel    = PLAN_LABELS[plan] ?? plan;
  const planColor    = PLAN_COLORS[plan] ?? PLAN_COLORS.STARTER;
  const sub          = vendor?.subscription;
  const trialEndsAt  = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const isTrial      = sub?.status === "TRIAL" || !sub;
  const isExpired    = sub?.status === "EXPIRED" || (isTrial && trialEndsAt && trialEndsAt < new Date());
  const daysLeft     = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000)) : null;

  const currentTitle =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) => key !== "/dashboard" && pathname.startsWith(key))?.[1] ??
    "Dashboard";

  // Breadcrumb path
  const breadcrumbParts = pathname
    .split("/")
    .filter(Boolean)
    .map((part, i, arr) => ({
      label: PAGE_TITLES["/" + arr.slice(0, i + 1).join("/")] ?? part.charAt(0).toUpperCase() + part.slice(1),
      href:  "/" + arr.slice(0, i + 1).join("/"),
      last:  i === arr.length - 1,
    }));

  function SidebarContent({ onClose, showLogo = true }: { onClose?: () => void; showLogo?: boolean }) {
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        {showLogo && (
          <div className="px-5 py-5 border-b border-white/[0.05] flex-shrink-0">
            <Link href="/" className="flex items-center gap-3 group" onClick={onClose}>
              {orgLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={orgLogo} alt={orgName ?? "Logo"} className="w-9 h-9 rounded-2xl object-cover border" style={{ borderColor: `${brandColor ?? "#C9A961"}4d` }} />
              ) : (
                <div
                  className="w-9 h-9 rounded-2xl bg-vodium-charcoal border flex items-center justify-center transition-all duration-200"
                  style={{ borderColor: `${brandColor ?? "#C9A961"}4d` }}
                >
                  <span className="font-serif text-lg leading-none" style={{ color: brandColor ?? "#C9A961" }}>
                    {orgName ? orgName.trim().charAt(0).toUpperCase() : "V"}
                  </span>
                </div>
              )}
              <div>
                <p className="font-serif text-[11px] tracking-[0.28em] leading-none" style={{ color: brandColor ?? "#C9A961" }}>
                  {orgName ? orgName.toUpperCase().slice(0, 16) : "VODIUM"}
                </p>
                <p className="text-[9px] text-vodium-cream/20 tracking-[0.22em] mt-1.5 uppercase font-medium">
                  {orgName ? "powered by Vodium" : "Ledger"}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-bold tracking-[0.18em] text-vodium-cream/20 uppercase px-3 mb-3">Navigation</p>
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={[
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-vodium-gold/[0.08] text-vodium-gold border border-vodium-gold/15 shadow-[0_1px_8px_rgba(201,169,97,0.06)]"
                    : "text-vodium-cream/40 hover:text-vodium-cream/80 hover:bg-white/[0.04] border border-transparent",
                ].join(" ")}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-vodium-gold/70 flex-shrink-0" />
                )}
              </Link>
            );
          })}
          {isEnterprise && (
            <>
              <p className="text-[9px] font-bold tracking-[0.18em] text-vodium-cream/20 uppercase px-3 pt-5 mb-3">Enterprise</p>
              {ENTERPRISE_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={[
                      "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-vodium-gold/[0.08] text-vodium-gold border border-vodium-gold/15 shadow-[0_1px_8px_rgba(201,169,97,0.06)]"
                        : "text-vodium-cream/40 hover:text-vodium-cream/80 hover:bg-white/[0.04] border border-transparent",
                    ].join(" ")}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-vodium-gold/70 flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* WhatsApp shortcut */}
        <div className="px-3 pb-2">
          <div className="h-px bg-white/[0.05] mb-3" />
          <a
            href="/whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vodium-cream/30 hover:text-vodium-cream/70 hover:bg-white/[0.03] border border-transparent transition-all duration-150"
          >
            <MessageCircle size={16} className="flex-shrink-0 text-[#3FB950]/60" />
            <span className="flex-1">WhatsApp bot</span>
            {/* Static status dot. A permanent pulse reads as an unread alert. */}
            <span className="w-1.5 h-1.5 rounded-full bg-[#3FB950]/70 flex-shrink-0" />
          </a>
        </div>

        {/* Vendor block */}
        <div className="px-3 pb-4 pt-2 space-y-2">
          <div className="h-px bg-white/[0.05] mb-3" />

          {/* Subscription banner */}
          {isExpired ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-500/[0.05] border border-rose-500/20 px-3 py-2.5 mb-2 shadow-[0_2px_10px_rgba(244,63,94,0.05)]">
              <X size={13} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-rose-400 leading-tight">Trial expired</p>
                <Link href="/dashboard/upgrade" className="text-[10px] text-rose-400/60 hover:text-rose-400 transition-colors mt-0.5 block font-medium underline underline-offset-2">
                  Renew subscription →
                </Link>
              </div>
            </div>
          ) : isTrial ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-vodium-gold/[0.05] border border-vodium-gold/15 px-3 py-2.5 mb-2">
              <Zap size={13} className="text-vodium-gold flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-vodium-gold leading-tight">
                  {daysLeft !== null ? `${daysLeft} days left in trial` : "60-day free trial"}
                </p>
                <Link href="/dashboard/upgrade" className="text-[10px] text-vodium-gold/50 hover:text-vodium-gold transition-colors mt-0.5 block">
                  Upgrade plan →
                </Link>
              </div>
            </div>
          ) : null}

          {/* Vendor info */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-3 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center flex-shrink-0">
                <span className="font-serif text-vodium-gold text-sm font-bold leading-none">{initial(businessName)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-vodium-cream truncate leading-tight">{businessName}</p>
                <p className="text-[10px] text-vodium-cream/30 mt-0.5 truncate">{community}</p>
              </div>
            </div>
            <div className="mt-2.5">
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg border ${planColor}`}>
                {planLabel} plan
              </span>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-vodium-cream/25 hover:text-rose-400 hover:bg-rose-500/[0.06] transition-all duration-150 border border-transparent"
          >
            <LogOut size={15} className="flex-shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[color:var(--surface-0)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[color:var(--hairline)] bg-[#08080A] pb-safe pl-safe pt-safe md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#080808] flex flex-col border-r border-white/[0.05] md:hidden transition-transform duration-200 ease-out pt-safe pb-safe ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] flex-shrink-0">
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            {orgLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={orgLogo} alt={orgName ?? "Logo"} className="w-8 h-8 rounded-xl object-cover border" style={{ borderColor: `${brandColor ?? "#C9A961"}4d` }} />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-vodium-charcoal border flex items-center justify-center" style={{ borderColor: `${brandColor ?? "#C9A961"}4d` }}>
                <span className="font-serif text-base leading-none" style={{ color: brandColor ?? "#C9A961" }}>
                  {orgName ? orgName.trim().charAt(0).toUpperCase() : "V"}
                </span>
              </div>
            )}
            <div>
              <p className="font-serif text-[11px] tracking-[0.25em] leading-none" style={{ color: brandColor ?? "#C9A961" }}>
                {orgName ? orgName.toUpperCase().slice(0, 16) : "VODIUM"}
              </p>
              <p className="text-[9px] text-vodium-cream/25 tracking-[0.2em] mt-1 uppercase">{orgName ? "powered by Vodium" : "Ledger"}</p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-vodium-cream/40 hover:text-vodium-cream hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <SidebarContent onClose={() => setSidebarOpen(false)} showLogo={false} />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 md:ml-60 flex flex-col min-h-screen">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 flex min-h-[3.5rem] items-center justify-between border-b border-[color:var(--hairline)] bg-[color:var(--surface-0)]/90 px-5 pt-safe backdrop-blur-xl">
          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-vodium-cream/50 hover:text-vodium-cream hover:bg-white/[0.06] transition-colors"
            >
              <Menu size={18} />
            </button>
            {/* Desktop breadcrumb */}
            <nav className="hidden md:flex items-center gap-1.5 text-[11px]">
              {breadcrumbParts.map((part, i) => (
                <span key={part.href} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight size={11} className="text-vodium-cream/20" />}
                  {part.last ? (
                    <span className="text-vodium-cream/80 font-medium">{part.label}</span>
                  ) : (
                    <Link href={part.href} className="text-vodium-cream/30 hover:text-vodium-gold transition-colors">{part.label}</Link>
                  )}
                </span>
              ))}
            </nav>
            {/* Mobile title */}
            <span className="md:hidden text-sm font-semibold text-vodium-cream/80">{currentTitle}</span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Plan badge — desktop only */}
            <span className={`hidden lg:inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-lg border ${planColor}`}>
              {planLabel}
            </span>
            {/* Notification bell */}
            <NotificationBell />
            {/* Add credit */}
            <Link
              href="/dashboard/credit/new"
              className="btn-gold px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 h-8"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Add credit</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-safe">{children}</main>
      </div>

      <NpsWidget />
      <NavProgress />
    </div>
  );
}

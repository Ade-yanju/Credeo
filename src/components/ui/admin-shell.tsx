"use client";

import { useState } from "react";
import { NavProgress } from "@/components/ui/nav-progress";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Store,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
  Bell,
  TrendingUp,
  Headphones,
  Users,
  ChevronRight,
  Activity,
  Building2,
  ShieldAlert,
  Megaphone,
  Target,
} from "lucide-react";
import type { AdminRole } from "@/lib/session";

interface Props {
  name: string;
  role: AdminRole;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CFO: "CFO",
  CUSTOMER_CARE: "Customer Care",
  ANALYTICS: "Analytics",
  MARKETING: "Marketing",
};

const ROLE_COLORS: Record<AdminRole, string> = {
  SUPER_ADMIN: "text-vodium-gold bg-vodium-gold/10 border-vodium-gold/25",
  CFO: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  CUSTOMER_CARE: "text-sky-400 bg-sky-400/10 border-sky-400/25",
  ANALYTICS: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  MARKETING: "text-pink-400 bg-pink-400/10 border-pink-400/25",
};

const NAV_BY_ROLE: Record<
  AdminRole,
  { href: string; icon: React.ElementType; label: string }[]
> = {
  SUPER_ADMIN: [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/organizations", icon: Building2, label: "Organizations" },
    { href: "/admin/vendors", icon: Store, label: "Vendors" },
    { href: "/admin/finance", icon: TrendingUp, label: "Finance" },
    { href: "/admin/support", icon: Headphones, label: "Support" },
    { href: "/admin/disputes", icon: ShieldAlert, label: "Disputes" },
    { href: "/admin/marketing", icon: Megaphone, label: "Marketing" },
    { href: "/admin/acquisition", icon: Target, label: "Acquisition" },
    { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/admin/team", icon: Users, label: "Team" },
  ],
  CFO: [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/finance", icon: TrendingUp, label: "Finance" },
    { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  ],
  CUSTOMER_CARE: [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/support", icon: Headphones, label: "Support" },
    { href: "/admin/disputes", icon: ShieldAlert, label: "Disputes" },
    { href: "/admin/vendors", icon: Store, label: "Vendors" },
    { href: "/admin/acquisition", icon: Target, label: "Acquisition" },
  ],
  ANALYTICS: [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/admin/acquisition", icon: Target, label: "Acquisition" },
  ],
  MARKETING: [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/marketing", icon: Megaphone, label: "Marketing" },
    { href: "/admin/acquisition", icon: Target, label: "Acquisition" },
  ],
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminShell({ name, role, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const NAV = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.SUPER_ADMIN;

  const currentNav = NAV.find(
    (n) =>
      n.href === pathname ||
      (n.href !== "/admin" && pathname.startsWith(n.href)),
  );
  const breadcrumb = currentNav?.label ?? "Overview";

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/admin/login");
  }

  const avatarText = initials(name);
  const roleColor = ROLE_COLORS[role] ?? ROLE_COLORS.SUPER_ADMIN;
  const roleLabel = ROLE_LABELS[role] ?? role;

  function NavItem({
    href,
    icon: Icon,
    label,
    mobile = false,
  }: {
    href: string;
    icon: React.ElementType;
    label: string;
    mobile?: boolean;
  }) {
    const isActive =
      pathname === href || (href !== "/admin" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        title={label}
        onClick={() => mobile && setOpen(false)}
        className={[
          "group relative flex items-center gap-3 rounded-xl transition-all duration-150",
          mobile
            ? "px-3 py-2.5 text-sm font-medium"
            : "justify-center xl:justify-start h-10 xl:h-auto xl:px-3 xl:py-2.5 w-10 xl:w-auto",
          isActive
            ? "bg-vodium-gold/[0.08] text-vodium-gold border border-vodium-gold/15 shadow-[0_1px_8px_rgba(201,169,97,0.06)]"
            : "text-vodium-cream/35 hover:text-vodium-cream/75 hover:bg-white/[0.04] border border-transparent",
        ].join(" ")}
      >
        <Icon size={16} className="flex-shrink-0" />
        {mobile ? (
          <span>{label}</span>
        ) : (
          <span className="hidden xl:block text-sm font-medium whitespace-nowrap">
            {label}
          </span>
        )}
        {isActive && !mobile && (
          <span className="hidden xl:block ml-auto w-1.5 h-1.5 rounded-full bg-vodium-gold/60 flex-shrink-0" />
        )}
        {/* Desktop tooltip when collapsed */}
        {!mobile && (
          <span className="xl:hidden absolute left-full ml-3 px-2.5 py-1.5 bg-vodium-charcoal border border-white/[0.10] rounded-lg text-xs text-vodium-cream/80 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
            {label}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex">
      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col bg-[#080808] border-r border-white/[0.05] fixed inset-y-0 left-0 z-30 w-14 xl:w-[220px] transition-all duration-300 pt-safe pb-safe pl-safe">
        {/* Logo */}
        <div className="h-14 flex items-center justify-center xl:justify-start xl:px-5 border-b border-white/[0.05] flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-vodium-charcoal border border-vodium-gold/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(201,169,97,0.06)]">
            <span className="font-serif text-vodium-gold text-sm leading-none">
              V
            </span>
          </div>
          <div className="hidden xl:block ml-3 overflow-hidden">
            <p className="font-serif text-[11px] tracking-[0.22em] text-vodium-gold leading-none whitespace-nowrap">
              VODIUM
            </p>
            <p className="text-[9px] text-vodium-cream/20 tracking-wider mt-1 whitespace-nowrap font-medium">
              ADMIN CONSOLE
            </p>
          </div>
        </div>

        {/* Nav group */}
        <div className="px-2 pt-5 pb-1">
          <p className="hidden xl:block text-[9px] font-bold tracking-[0.18em] text-vodium-cream/20 uppercase px-2 mb-2.5">
            Navigation
          </p>
        </div>
        <nav className="flex-1 flex flex-col items-center xl:items-stretch gap-0.5 px-2">
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>

        {/* Live status dot */}
        <div className="hidden xl:flex items-center gap-2.5 px-4 py-2 mx-2 mb-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-[10px] text-emerald-400/70 font-medium">
            All systems live
          </span>
        </div>

        {/* Profile + sign out */}
        <div className="flex flex-col items-center xl:items-stretch gap-0.5 px-2 pb-4 border-t border-white/[0.05] pt-3">
          <div className="group relative flex items-center justify-center xl:justify-start h-10 xl:h-auto xl:px-3 xl:py-2.5 rounded-xl border border-transparent">
            <div className="w-7 h-7 rounded-full bg-vodium-gold/15 border border-vodium-gold/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_rgba(201,169,97,0.12)]">
              <span className="text-vodium-gold text-[10px] font-bold">
                {avatarText}
              </span>
            </div>
            <div className="hidden xl:block ml-2.5 overflow-hidden min-w-0">
              <p className="text-vodium-cream text-[12px] font-semibold leading-none whitespace-nowrap truncate max-w-[120px]">
                {name}
              </p>
              <p
                className={`text-[10px] mt-1 font-bold px-1.5 py-0.5 rounded-md border inline-block ${roleColor}`}
              >
                {roleLabel}
              </p>
            </div>
            {/* Tooltip when collapsed */}
            <span className="xl:hidden absolute left-full ml-3 px-2.5 py-1.5 bg-vodium-charcoal border border-white/[0.10] rounded-lg text-xs text-vodium-cream/80 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
              {name} · {roleLabel}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out"
            className="group relative flex items-center justify-center xl:justify-start h-10 xl:h-auto xl:px-3 xl:py-2 w-10 xl:w-auto rounded-xl text-vodium-cream/25 hover:text-rose-400 hover:bg-rose-500/[0.06] transition-all gap-3 border border-transparent"
          >
            <LogOut size={15} className="flex-shrink-0" />
            <span className="hidden xl:block text-sm font-medium whitespace-nowrap">
              Sign out
            </span>
            <span className="xl:hidden absolute left-full ml-3 px-2.5 py-1.5 bg-vodium-charcoal border border-white/[0.10] rounded-lg text-xs text-vodium-cream/80 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
              Sign out
            </span>
          </button>
        </div>
      </aside>

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#080808] flex flex-col border-r border-white/[0.05] md:hidden transition-transform duration-200 pt-safe pb-safe ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-vodium-charcoal border border-vodium-gold/30 flex items-center justify-center">
              <span className="font-serif text-vodium-gold text-xs leading-none">
                V
              </span>
            </div>
            <div>
              <p className="font-serif text-[11px] tracking-[0.2em] text-vodium-gold leading-none">
                VODIUM
              </p>
              <p className="text-[9px] text-vodium-cream/25 tracking-wider mt-0.5">
                ADMIN CONSOLE
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg text-vodium-cream/40 hover:text-vodium-cream hover:bg-white/[0.06] flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 pt-5 pb-2">
          <p className="text-[9px] font-bold tracking-[0.18em] text-vodium-cream/20 uppercase px-3 mb-2">
            Navigation
          </p>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} mobile />
          ))}
        </nav>
        <div className="px-3 pb-5 border-t border-white/[0.05] pt-4 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-vodium-gold/15 border border-vodium-gold/30 flex items-center justify-center">
              <span className="text-vodium-gold text-[10px] font-bold">
                {avatarText}
              </span>
            </div>
            <div>
              <p className="text-vodium-cream text-xs font-semibold leading-none">
                {name}
              </p>
              <p
                className={`text-[10px] mt-1 font-bold px-1.5 py-0.5 rounded-md border inline-block ${roleColor}`}
              >
                {roleLabel}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm text-vodium-cream/35 hover:text-rose-400 hover:bg-rose-500/[0.06] transition-all border border-transparent"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 md:ml-14 xl:ml-[220px] flex flex-col min-h-screen transition-all duration-300">
        {/* Sticky header */}
        <header className="bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.05] sticky top-0 z-20 px-5 md:px-6 min-h-[3.5rem] pt-safe px-safe flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="md:hidden w-8 h-8 rounded-lg text-vodium-cream/50 hover:text-vodium-cream hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            >
              <Menu size={17} />
            </button>
            {/* Breadcrumb */}
            <nav className="hidden md:flex items-center gap-1.5 text-[11px]">
              <Link
                href="/admin"
                className="text-vodium-cream/25 hover:text-vodium-gold transition-colors flex items-center gap-1"
              >
                <Shield size={11} className="text-vodium-gold/40" /> Admin
                Console
              </Link>
              {breadcrumb !== "Overview" && (
                <>
                  <ChevronRight size={10} className="text-vodium-cream/15" />
                  <span className="text-vodium-cream/70 font-medium">
                    {breadcrumb}
                  </span>
                </>
              )}
            </nav>
            <p className="md:hidden text-sm font-semibold text-vodium-cream/80">
              {breadcrumb}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live indicator */}
            <span className="hidden xl:flex items-center gap-1.5 text-[10px] text-emerald-400/60 font-medium">
              <Activity size={11} className="animate-pulse" />
              Live
            </span>
            {/* Date */}
            <p className="hidden lg:block text-[10px] text-vodium-cream/20 font-medium">
              {new Date().toLocaleDateString("en-NG", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
            {/* Role badge */}
            <span
              className={`hidden md:inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-lg border ${roleColor}`}
            >
              {roleLabel}
            </span>
            {/* Bell */}
            <button className="relative w-8 h-8 rounded-lg border border-white/[0.07] flex items-center justify-center text-vodium-cream/35 hover:text-vodium-gold hover:border-vodium-gold/25 transition-all">
              <Bell size={13} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-vodium-gold rounded-full shadow-[0_0_4px_rgba(201,169,97,0.5)]" />
            </button>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-vodium-gold/15 border border-vodium-gold/30 flex items-center justify-center shadow-[0_0_8px_rgba(201,169,97,0.1)]">
              <span className="text-vodium-gold text-xs font-bold">
                {avatarText}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 text-vodium-cream">{children}</main>
      </div>

      <NavProgress />
    </div>
  );
}

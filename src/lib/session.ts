/**
 * Vodium Ledger — Session management with HMAC-signed tokens.
 *
 * SECURITY MODEL
 * ──────────────
 * Vendor session:  cookie "vodium_sid"  = base64url(phone) + "." + HMAC(secret, "v1:vendor:" + payload)
 * Admin session:   cookie "vodium_asid" = base64url(JSON({id,role,iat})) + "." + HMAC(secret, "v2:admin:" + payload)
 *
 * Admin token carries the role so middleware can enforce per-route permissions without a DB lookup.
 * Super-admin password login uses id="__super__", role="SUPER_ADMIN".
 * All comparisons are constant-time to prevent timing-oracle attacks.
 */

import { cookies } from "next/headers";
import { prisma } from "./prisma";
import crypto from "crypto";
import type { Branch, Community, Organization, OrganizationMembership, Vendor, VendorSubscription } from "@prisma/client";
export { VENDOR_COOKIE, ADMIN_COOKIE, VENDOR_COOKIE_AGE, ADMIN_COOKIE_AGE } from "./session-cookies";
import { VENDOR_COOKIE, ADMIN_COOKIE, VENDOR_COOKIE_AGE, ADMIN_COOKIE_AGE } from "./session-cookies";

export type VendorWithSub = Vendor & {
  subscription: VendorSubscription | null;
  community: Community | null;
  organization: Organization | null;
  branch: Branch | null;
  memberships: OrganizationMembership[];
};

// Keep in sync with the AdminRole enum in prisma/schema.prisma.
export type AdminRole = "SUPER_ADMIN" | "CFO" | "CUSTOMER_CARE" | "ANALYTICS" | "MARKETING";

export interface AdminTokenPayload {
  id:   string;   // DB AdminUser.id, or "__super__" for ADMIN_SECRET login
  role: AdminRole;
  iat:  number;
}

// ── Secret ───────────────────────────────────────────────────────────────────

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[session] SESSION_SECRET env var is required in production");
    }
    console.warn("[session] ⚠ SESSION_SECRET not set — using insecure dev default");
    return "dev-only-secret-change-me-before-production";
  }
  return s;
}

// ── Primitives ────────────────────────────────────────────────────────────────

function hmac(secret: string, input: string): string {
  return crypto.createHmac("sha256", secret).update(input, "utf8").digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const aBuf = Buffer.alloc(maxLen, 0);
  const bBuf = Buffer.alloc(maxLen, 0);
  aBuf.write(a, "utf8");
  bBuf.write(b, "utf8");
  return crypto.timingSafeEqual(aBuf, bBuf) && a.length === b.length;
}

// ══ VENDOR SESSION ═══════════════════════════════════════════════════════════

export function buildSessionToken(phone: string): string {
  const payload = Buffer.from(JSON.stringify({ phone, iat: Date.now() }), "utf8").toString("base64url");
  const sig = hmac(getSecret(), `v2:vendor:${payload}`);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload  = token.slice(0, dot);
    const incoming = token.slice(dot + 1);
    const expected = hmac(getSecret(), `v2:vendor:${payload}`);
    if (!safeEqual(incoming, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { phone?: string; iat?: number };
    if (!data.phone || !data.iat) return null;
    if (Date.now() - data.iat > VENDOR_COOKIE_AGE * 1000) return null; // expired
    if (!/^\+\d{7,15}$/.test(data.phone)) return null;
    return data.phone;
  } catch {
    return null;
  }
}

export function setVendorSession(phone: string): void {
  cookies().set(VENDOR_COOKIE, buildSessionToken(phone), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   VENDOR_COOKIE_AGE,
    path:     "/",
  });
}

export function clearVendorSession(): void {
  cookies().set(VENDOR_COOKIE, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   0,
    path:     "/",
  });
}

export function getSessionPhone(): string | null {
  const raw = cookies().get(VENDOR_COOKIE)?.value;
  if (!raw) return null;
  return verifySessionToken(raw);
}

export async function getVendorSession(): Promise<VendorWithSub | null> {
  const phone = getSessionPhone();
  if (!phone) return null;
  return prisma.vendor.findFirst({
    where: { phone, deletionRequestedAt: null },
    include: { subscription: true, community: true, organization: true, branch: true, memberships: true },
  });
}

// ══ ADMIN SESSION (v2 — role-aware) ══════════════════════════════════════════

/**
 * Build a signed admin token carrying id + role.
 * Format: base64url(JSON({id,role,iat})) + "." + HMAC(secret, "v2:admin:" + payload)
 */
export function buildAdminToken(id: string, role: AdminRole): string {
  const payload = Buffer.from(
    JSON.stringify({ id, role, iat: Date.now() })
  ).toString("base64url");
  const sig = hmac(getSecret(), `v2:admin:${payload}`);
  return `${payload}.${sig}`;
}

/**
 * Verify an admin token.
 * Returns the decoded payload on success (valid sig + within 8 hours), or null.
 */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload  = token.slice(0, dot);
    const incoming = token.slice(dot + 1);
    const expected = hmac(getSecret(), `v2:admin:${payload}`);
    if (!safeEqual(incoming, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminTokenPayload;
    if (!data.id || !data.role || !data.iat) return null;
    if (Date.now() - data.iat > ADMIN_COOKIE_AGE * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

/** Set the admin session cookie after a successful admin login. */
export function setAdminSession(id: string = "__super__", role: AdminRole = "SUPER_ADMIN"): void {
  cookies().set(ADMIN_COOKIE, buildAdminToken(id, role), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    // "lax", not "strict": strict withholds the cookie on cross-site top-level
    // navigation (opening an /admin link from email or WhatsApp), which looks
    // like a random logout. Lax still blocks cross-site POSTs, so CSRF cover
    // is unchanged. Matches the vendor session cookie.
    sameSite: "lax",
    maxAge:   ADMIN_COOKIE_AGE,
    path:     "/",
  });
}

/** Expire the admin session cookie. */
export function clearAdminSession(): void {
  cookies().set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax", // must match setAdminSession or the cookie will not be cleared
    maxAge:   0,
    path:     "/",
  });
}

/** Returns the decoded admin payload from cookie, or null. */
export function getAdminSession(): AdminTokenPayload | null {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

/** Returns true if the current request has a valid admin session. */
export function isAdminSession(): boolean {
  return getAdminSession() !== null;
}

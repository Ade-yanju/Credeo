/**
 * Vodium Ledger — entitlement guard for route handlers.
 *
 * Wraps the four lines every vendor write endpoint already opens with
 * (session → vendor lookup → 401/404) and adds the entitlement check that
 * ~33 of them were missing entirely.
 *
 * Kept separate from entitlement.ts so the policy core stays free of prisma
 * and next/server and can be unit-tested directly.
 */

import { NextResponse } from "next/server";
import type { Vendor, VendorSubscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionPhone } from "@/lib/session";
import {
  getEntitlement,
  lockedMessage,
  permits,
  type Entitlement,
  type EntitledAction,
  type SubscriptionLike,
} from "@/lib/entitlement";

export type VendorWithSubscription = Vendor & { subscription: VendorSubscription | null };

export type GuardResult =
  | { ok: true; vendor: VendorWithSubscription; entitlement: Entitlement }
  | { ok: false; response: NextResponse };

/**
 * Build the 403 for a blocked action. Shared so every refusal — whichever
 * auth pattern the route uses — carries the same body and the same copy.
 */
function deniedResponse(entitlement: Entitlement, action: EntitledAction): NextResponse {
  return NextResponse.json(
    {
      error: lockedMessage(action),
      entitlement: {
        state: entitlement.state,
        graceEndsAt: entitlement.graceEndsAt?.toISOString() ?? null,
        lockedSince: entitlement.lockedSince?.toISOString() ?? null,
      },
      upgradeUrl: "/dashboard/upgrade",
    },
    { status: 403 }
  );
}

/**
 * Entitlement check for routes that already hold a subscription — chiefly the
 * tenant-scoped ones, where requireTenantContext() has loaded it via
 * getVendorSession(). Returns a 403 to return, or null to continue.
 *
 * Exists so those routes do not pay for a second vendor query just to learn
 * something they already know.
 *
 *   const ctx = await requireTenantContext();
 *   const denied = entitlementDenied(ctx.vendor.subscription, "invoice.create");
 *   if (denied) return denied;
 */
export function entitlementDenied(
  subscription: SubscriptionLike,
  action: EntitledAction,
  now?: Date
): NextResponse | null {
  const entitlement = getEntitlement(subscription, now);
  if (permits(entitlement, action)) return null;
  return deniedResponse(entitlement, action);
}

/**
 * Resolve the signed-in vendor and assert they may perform `action`.
 *
 * Returns the vendor WITH its subscription attached, so callers that need the
 * plan (customer limits, upgrade prompts) do not need a second query.
 *
 * Usage:
 *   const guard = await guardVendorWrite("invoice.create");
 *   if (!guard.ok) return guard.response;
 *   const { vendor } = guard;
 */
export async function guardVendorWrite(action: EntitledAction, now?: Date): Promise<GuardResult> {
  const phone = getSessionPhone();
  if (!phone) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const vendor = await prisma.vendor.findUnique({
    where: { phone },
    include: { subscription: true },
  });
  if (!vendor) {
    return { ok: false, response: NextResponse.json({ error: "Vendor not found" }, { status: 404 }) };
  }

  const entitlement = getEntitlement(vendor.subscription, now);

  if (!permits(entitlement, action)) {
    if (!vendor.subscription) {
      // Fail-closed path. The migration backfills a trial row for every
      // vendor, so this means a vendor was created without one — a real bug
      // worth seeing in logs rather than silently granting access.
      console.error(
        `[entitlement] vendor ${vendor.id} has NO subscription row — denying "${action}". Backfill expected this to be impossible.`
      );
    }
    return {
      ok: false,
      response: deniedResponse(entitlement, action),
    };
  }

  return { ok: true, vendor, entitlement };
}

/**
 * Entitlement for an ORGANISATION, resolved through its owner's subscription.
 *
 * For public, customer-facing routes (the storefront) where there is no vendor
 * session — the shopper is not the account holder. Returns null when the org
 * has no resolvable owner, which callers should treat as "not accepting".
 *
 * NEVER surface lockedMessage() to a shopper: that copy talks about "your free
 * trial" and would leak the vendor's billing state to their customer. Use
 * neutral copy at the call site.
 */
export async function getOrganizationEntitlement(
  organizationId: string,
  now?: Date
): Promise<Entitlement | null> {
  const owner =
    (await prisma.organizationMembership.findFirst({
      where: { organizationId, role: "OWNER" },
      select: { vendor: { select: { subscription: true } } },
    })) ??
    (await prisma.organizationMembership.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { vendor: { select: { subscription: true } } },
    }));

  if (!owner) return null;
  return getEntitlement(owner.vendor.subscription, now);
}

/**
 * Entitlement for the signed-in vendor without asserting any action — for
 * read paths and UI that need to render the right state (banners, disabled
 * buttons). Returns null when there is no valid session.
 */
export async function getVendorEntitlement(
  now?: Date
): Promise<{ vendor: VendorWithSubscription; entitlement: Entitlement } | null> {
  const phone = getSessionPhone();
  if (!phone) return null;

  const vendor = await prisma.vendor.findUnique({
    where: { phone },
    include: { subscription: true },
  });
  if (!vendor) return null;

  return { vendor, entitlement: getEntitlement(vendor.subscription, now) };
}

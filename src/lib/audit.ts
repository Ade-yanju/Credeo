/**
 * Vodium Ledger — Audit trail.
 *
 * Writes an immutable record to the AuditLog table for every sensitive action
 * (vendor promotion, BNPL creation, repayment, coupon creation, domain change,
 * WhatsApp channel change, payment mandate). The admin dashboard reads these
 * back as the activity feed.
 *
 * Audit writes must never break the action that triggered them, so failures are
 * swallowed and logged to the server console only.
 */

import { prisma } from "@/lib/prisma";

export type AuditActorType = "vendor" | "admin" | "system";

export type AuditAction =
  // organizations / tenancy
  | "organization.promoted"
  | "organization.branding_updated"
  | "branch.created"
  | "branch.updated"
  | "tenant.domain_added"
  | "tenant.domain_updated"
  | "whatsapp.channel_added"
  | "whatsapp.channel_updated"
  // staff / membership
  | "member.invited"
  | "member.updated"
  | "member.removed"
  | "member.accepted"
  // bnpl / credit
  | "bnpl.order_created"
  | "bnpl.order_submitted"
  | "bnpl.order_approved"
  | "bnpl.order_declined"
  | "bnpl.repayment_recorded"
  // catalog
  | "product.created"
  | "product.updated"
  | "product.deleted"
  // reminders
  | "reminders.settings_updated"
  // invoices
  | "invoice.created"
  | "invoice.sent"
  | "invoice.payment_recorded"
  | "invoice.cancelled"
  | "bnpl.consent_accepted"
  // coupons
  | "coupon.created"
  // payments
  | "payment_mandate.created"
  // merchant acquisition
  | "acquisition.prospect_created"
  | "acquisition.prospect_updated"
  | "acquisition.activity_created"
  | "acquisition.campaign_created"
  | "acquisition.campaign_updated"
  | "acquisition.vendor_linked"
  | "acquisition.web_discovery"
  | "acquisition.claim_link_created";

export interface AuditInput {
  actorType: AuditActorType;
  actorId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/** Pull the best-guess client IP out of a request's headers. */
export function ipFromRequest(req: { headers: Headers }): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

/**
 * Persist an audit entry. Returns nothing and never throws — a failed audit
 * write must not roll back or surface to the caller's primary operation.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? undefined) as object | undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", input.action, err);
  }
}

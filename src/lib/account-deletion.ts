/**
 * Account deletion retention and purge.
 *
 * A vendor deletion request is deliberately two-phase:
 *   1. disable access immediately and retain the account for 90 days;
 *   2. permanently purge the retained account data after the deadline.
 *
 * The retention window protects fraud reviews, payment disputes, and lawful
 * investigations. It is not a licence to keep the data indefinitely.
 */

import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { retentionDeadline } from "@/lib/account-retention-policy";

export { ACCOUNT_RETENTION_DAYS, retentionDeadline } from "@/lib/account-retention-policy";

function tombstoneEmail(vendorId: string): string {
  return `deleted+${vendorId}@deleted.invalid`;
}

function tombstonePhone(vendorId: string): string {
  return `deleted:${vendorId}`;
}

export async function scheduleVendorDeletion(vendorId: string, requestedAt = new Date()) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      phone: true,
      email: true,
      deletionRequestedAt: true,
      dataRetentionUntil: true,
    },
  });

  if (!vendor) return null;
  if (vendor.deletionRequestedAt) {
    return {
      vendorId: vendor.id,
      alreadyRequested: true,
      requestedAt: vendor.deletionRequestedAt,
      retentionUntil: vendor.dataRetentionUntil ?? retentionDeadline(vendor.deletionRequestedAt),
    };
  }

  const retentionUntil = retentionDeadline(requestedAt);

  // Replace the login identifiers and credential immediately. The original
  // values remain in the dedicated retention fields, while old sessions and
  // login attempts can no longer resolve this vendor row.
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      status: "INACTIVE",
      phone: tombstonePhone(vendor.id),
      email: tombstoneEmail(vendor.id),
      passwordHash: `deleted:${crypto.randomBytes(32).toString("hex")}`,
      inviteToken: null,
      inviteTokenExpiresAt: null,
      deletionRequestedAt: requestedAt,
      dataRetentionUntil: retentionUntil,
      deletionOriginalPhone: vendor.phone,
      deletionOriginalEmail: vendor.email,
    },
  });

  // Stop local entitlement immediately. Activation already rejects deleted
  // vendors, and lifecycle webhooks ignore the retained subscription row, so
  // a late provider event cannot reopen access.
  await prisma.vendorSubscription.updateMany({
    where: { vendorId: vendor.id },
    data: { status: "CANCELLED", graceEndsAt: requestedAt },
  });

  return { vendorId: vendor.id, alreadyRequested: false, requestedAt, retentionUntil };
}

export interface PurgeResult {
  checked: number;
  purged: number;
  failed: number;
}

/** Permanently remove accounts whose 90-day retention deadline has passed. */
export async function purgeDeletedVendors(now = new Date()): Promise<PurgeResult> {
  const candidates = await prisma.vendor.findMany({
    where: {
      deletionRequestedAt: { not: null },
      dataRetentionUntil: { lte: now },
    },
    select: { id: true },
  });

  let purged = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      await purgeVendor(candidate.id);
      purged++;
    } catch (err) {
      failed++;
      console.error(`[account-retention] purge failed for vendor ${candidate.id}:`, err);
    }
  }

  return { checked: candidates.length, purged, failed };
}

async function purgeVendor(vendorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, organizationId: true },
    });
    if (!vendor) return;

    const organization = vendor.organizationId
      ? await tx.organization.findUnique({
          where: { id: vendor.organizationId },
          select: { id: true, type: true },
        })
      : null;

    const credits = await tx.credit.findMany({ where: { vendorId }, select: { id: true } });
    const creditIds = credits.map((credit) => credit.id);
    const orders = await tx.bnplOrder.findMany({ where: { vendorId }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    const invoices = await tx.invoice.findMany({ where: { vendorId }, select: { id: true } });
    const invoiceIds = invoices.map((invoice) => invoice.id);

    if (orderIds.length) {
      await tx.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.repaymentSchedule.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.bnplOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.bnplOrder.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (invoiceIds.length) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    if (creditIds.length) {
      await tx.repayment.deleteMany({ where: { creditId: { in: creditIds } } });
      await tx.paymentReceipt.deleteMany({ where: { creditId: { in: creditIds } } });
      await tx.dispute.deleteMany({ where: { creditId: { in: creditIds } } });
      await tx.creditScoreEvent.deleteMany({ where: { creditId: { in: creditIds } } });
    }

    await tx.paymentReceipt.deleteMany({ where: { vendorId } });
    await tx.dispute.deleteMany({ where: { vendorId } });
    await tx.creditScoreEvent.deleteMany({ where: { vendorId } });
    if (creditIds.length) await tx.credit.deleteMany({ where: { id: { in: creditIds } } });

    await tx.notification.deleteMany({ where: { vendorId } });
    await tx.whatsAppSession.deleteMany({ where: { vendorId } });
    await tx.organizationMembership.deleteMany({ where: { vendorId } });
    await tx.walletLedgerEntry.updateMany({ where: { vendorId }, data: { vendorId: null } });
    await tx.vendorSubscription.deleteMany({ where: { vendorId } });
    await tx.vendor.delete({ where: { id: vendorId } });

    // A solo vendor owns its generated organization. Enterprise organizations
    // are shared, so deleting one staff/owner account must not destroy them.
    if (organization?.type === "SOLO_VENDOR") {
      const remainingVendors = await tx.vendor.count({ where: { organizationId: organization.id } });
      if (remainingVendors === 0) await purgeSoloOrganization(tx, organization.id);
    }
  });
}

async function purgeSoloOrganization(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.whatsAppOutboxMessage.deleteMany({ where: { organizationId } });
  await tx.whatsAppSession.deleteMany({ where: { organizationId } });
  await tx.whatsAppChannel.deleteMany({ where: { organizationId } });
  await tx.tenantDomain.deleteMany({ where: { organizationId } });
  await tx.paymentMandate.deleteMany({ where: { organizationId } });
  await tx.product.deleteMany({ where: { organizationId } });
  await tx.couponRedemption.deleteMany({ where: { organizationId } });
  await tx.couponCampaign.deleteMany({ where: { organizationId } });
  await tx.walletLedgerEntry.deleteMany({ where: { organizationId } });
  await tx.organizationMembership.deleteMany({ where: { organizationId } });
  await tx.branch.deleteMany({ where: { organizationId } });
  await tx.organization.delete({ where: { id: organizationId } });
}

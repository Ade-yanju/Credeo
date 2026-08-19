import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  role: z.enum(["HQ_ADMIN", "BRANCH_MANAGER", "BRANCH_STAFF", "FINANCE", "AUDITOR"]).optional(),
  branchId: z.string().nullish(),
});

async function loadMembership(id: string, organizationId: string) {
  return prisma.organizationMembership.findFirst({
    where: { id, organizationId },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const membership = await loadMembership(params.id, ctx.organizationId!);
  if (!membership) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (membership.role === "OWNER") {
    return NextResponse.json({ error: "The owner's role cannot be changed here." }, { status: 400 });
  }

  const json = await req.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: data.branchId, organizationId: ctx.organizationId! } });
    if (!branch) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.organizationMembership.update({
      where: { id: membership.id },
      data: {
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
      },
    });
    // Keep the vendor's primary branch in sync when reassigned.
    if (data.branchId !== undefined) {
      await tx.vendor.update({ where: { id: membership.vendorId }, data: { branchId: data.branchId } });
    }
    return m;
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "member.updated",
    entityType: "OrganizationMembership",
    entityId: membership.id,
    metadata: { organizationId: ctx.organizationId, vendorId: membership.vendorId, changes: data },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, membership: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  // Revoking access stays available on a locked account — see the note on
  // tenant.revoke in lib/entitlement.ts. Never hold a security risk open as
  // billing pressure.
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.revoke");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const membership = await loadMembership(params.id, ctx.organizationId!);
  if (!membership) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (membership.role === "OWNER") {
    return NextResponse.json({ error: "The owner cannot be removed." }, { status: 400 });
  }
  if (membership.vendorId === ctx.vendor.id) {
    return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMembership.delete({ where: { id: membership.id } });
    // Detach the staff account from the organization so they lose tenant access.
    await tx.vendor.updateMany({
      where: { id: membership.vendorId, organizationId: ctx.organizationId! },
      data: { organizationId: null, branchId: null },
    });
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "member.removed",
    entityType: "OrganizationMembership",
    entityId: membership.id,
    metadata: { organizationId: ctx.organizationId, vendorId: membership.vendorId },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true });
}

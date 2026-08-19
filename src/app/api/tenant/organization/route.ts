import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const brandingSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #C9A961").nullish(),
  logoUrl: z.string().url().max(500).nullish(),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId || !ctx.organization) {
    return NextResponse.json({ organization: null });
  }
  return NextResponse.json({
    organization: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      brandColor: ctx.organization.brandColor,
      logoUrl: ctx.organization.logoUrl,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json();
  const parsed = brandingSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const updated = await prisma.organization.update({
    where: { id: ctx.organizationId! },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.brandColor !== undefined ? { brandColor: data.brandColor || null } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl || null } : {}),
    },
    select: { id: true, name: true, brandColor: true, logoUrl: true },
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "organization.branding_updated",
    entityType: "Organization",
    entityId: updated.id,
    metadata: { changes: data },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, organization: updated });
}

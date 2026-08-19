import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { verifyDomainDns } from "@/lib/dns-verify";

const schema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "DISABLED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const domain = await prisma.tenantDomain.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId! },
  });
  if (!domain) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // Only allow VERIFIED once DNS actually points at the platform.
  if (parsed.data.status === "VERIFIED") {
    const dnsCheck = await verifyDomainDns(domain.host);
    if (!dnsCheck.ok) {
      return NextResponse.json({ error: `Domain not verified. ${dnsCheck.detail}` }, { status: 422 });
    }
  }

  const updated = await prisma.tenantDomain.update({
    where: { id: domain.id },
    data: {
      status: parsed.data.status,
      verifiedAt: parsed.data.status === "VERIFIED" ? (domain.verifiedAt ?? new Date()) : null,
    },
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "tenant.domain_updated",
    entityType: "TenantDomain",
    entityId: domain.id,
    metadata: { organizationId: ctx.organizationId, host: domain.host, status: parsed.data.status },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, domain: updated });
}

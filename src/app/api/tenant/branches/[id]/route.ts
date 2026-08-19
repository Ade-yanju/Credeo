import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullish(),
  address: z.string().max(240).nullish(),
  city: z.string().max(80).nullish(),
  state: z.string().max(80).nullish(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branch = await prisma.branch.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId! },
  });
  if (!branch) return NextResponse.json({ error: "Branch not found." }, { status: 404 });

  const json = await req.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updated = await prisma.branch.update({
    where: { id: branch.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
      ...(data.city !== undefined ? { city: data.city?.trim() || null } : {}),
      ...(data.state !== undefined ? { state: data.state?.trim() || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "branch.updated",
    entityType: "Branch",
    entityId: branch.id,
    metadata: { organizationId: ctx.organizationId, changes: data },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, branch: updated });
}

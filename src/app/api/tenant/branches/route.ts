import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const branchSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  phone: z.string().max(30).optional(),
  address: z.string().max(240).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ branches: [] });

  const branches = await prisma.branch.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ branches });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json();
  const parsed = branchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const code = parsed.data.code.trim().toUpperCase();

  try {
    const branch = await prisma.branch.create({
      data: {
        organizationId: ctx.organizationId!,
        name: parsed.data.name.trim(),
        code,
        phone: parsed.data.phone?.trim() || null,
        address: parsed.data.address?.trim() || null,
        city: parsed.data.city?.trim() || null,
        state: parsed.data.state?.trim() || null,
      },
    });

    await writeAudit({
      actorType: "vendor",
      actorId: ctx.vendor.id,
      action: "branch.created",
      entityType: "Branch",
      entityId: branch.id,
      metadata: { organizationId: ctx.organizationId, name: branch.name, code: branch.code },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, branch }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message.includes("Unique")
      ? "A branch with this code already exists in this organization."
      : "Could not create branch.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessBranch, hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const productSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(600).optional(),
  sku: z.string().max(80).optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().max(600).optional(),
  imageUrls: z.array(z.string().url().max(600)).max(6).optional(),
  branchId: z.string().optional(),
  active: z.boolean().optional(),
  bnplEligible: z.boolean().optional(),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(ctx.canSeeAllBranches ? {} : { OR: [{ branchId: null }, { branchId: ctx.branchId }] }),
    },
    include: { branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "product.write");
  if (denied) return denied;
  if (!hasTenantWriteAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Organization is not ready for products." }, { status: 400 });
  }

  const json = await req.json();
  const parsed = productSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.branchId && !canAccessBranch(ctx, data.branchId)) {
    return NextResponse.json({ error: "You cannot add products for this branch." }, { status: 403 });
  }

  const product = await prisma.product.create({
    data: {
      organizationId: ctx.organizationId,
      branchId: data.branchId ?? null,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      sku: data.sku?.trim() || null,
      price: data.price,
      imageUrls: data.imageUrls ?? [],
      imageUrl: data.imageUrls?.[0] ?? data.imageUrl?.trim() ?? null,
      active: data.active ?? true,
      bnplEligible: data.bnplEligible ?? true,
    },
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "product.created",
    entityType: "Product",
    entityId: product.id,
    metadata: { organizationId: ctx.organizationId, name: product.name, price: Number(product.price) },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, product }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessBranch, hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const couponSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(40),
  branchId: z.string().optional(),
  type: z.enum(["FIXED", "PERCENTAGE"]),
  value: z.number().positive(),
  minimumSpend: z.number().positive().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ coupons: [] });

  const coupons = await prisma.couponCampaign.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(ctx.canSeeAllBranches ? {} : { OR: [{ branchId: null }, { branchId: ctx.branchId }] }),
    },
    include: {
      branch: true,
      _count: { select: { redemptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "coupon.write");
  if (denied) return denied;
  if (!hasTenantWriteAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Organization is not ready for coupons." }, { status: 400 });
  }

  const json = await req.json();
  const parsed = couponSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.branchId && !canAccessBranch(ctx, data.branchId)) {
    return NextResponse.json({ error: "You cannot create coupons for this branch." }, { status: 403 });
  }
  if (data.type === "PERCENTAGE" && data.value > 100) {
    return NextResponse.json({ error: "Percentage coupon cannot exceed 100%." }, { status: 400 });
  }

  try {
    const coupon = await prisma.couponCampaign.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: data.branchId ?? null,
        name: data.name,
        code: data.code.trim().toUpperCase(),
        type: data.type,
        value: data.value,
        minimumSpend: data.minimumSpend ?? null,
        maxRedemptions: data.maxRedemptions ?? null,
        perCustomerLimit: data.perCustomerLimit ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : new Date(),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        active: data.active ?? true,
      },
    });

    await writeAudit({
      actorType: "vendor",
      actorId: ctx.vendor.id,
      action: "coupon.created",
      entityType: "CouponCampaign",
      entityId: coupon.id,
      metadata: {
        organizationId: ctx.organizationId,
        branchId: coupon.branchId,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
      },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, coupon }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message.includes("Unique")
      ? "A coupon with this code already exists for this organization."
      : "Could not create coupon.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

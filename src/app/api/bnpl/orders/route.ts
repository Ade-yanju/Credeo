import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateCouponDiscount, calculateItemsTotal, getOrCreateCustomerForVendor, nextOrderNumber } from "@/lib/bnpl";
import { canAccessBranch, hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const itemSchema = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().max(80).optional(),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().positive(),
});

const createOrderSchema = z.object({
  branchId: z.string().optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().min(7).max(30),
  dueDate: z.string().datetime(),
  downPayment: z.number().min(0).default(0),
  couponCode: z.string().max(40).optional(),
  notes: z.string().max(300).optional(),
  items: z.array(itemSchema).min(1).max(50),
  repaymentSchedule: z.array(z.object({
    dueAt: z.string().datetime(),
    amount: z.number().positive(),
  })).max(24).optional(),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ orders: [] });

  const where = ctx.canSeeAllBranches
    ? { organizationId: ctx.organizationId }
    : { organizationId: ctx.organizationId, branchId: ctx.branchId };

  const orders = await prisma.bnplOrder.findMany({
    where,
    include: {
      branch: true,
      student: true,
      items: true,
      schedules: { orderBy: { dueAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "bnpl.order.create");
  if (denied) return denied;
  if (!hasTenantWriteAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Organization is not ready for BNPL orders." }, { status: 400 });
  }

  const json = await req.json();
  const parsed = createOrderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const branchId = data.branchId ?? ctx.branchId;
  if (!branchId) return NextResponse.json({ error: "Select a branch." }, { status: 400 });
  if (!canAccessBranch(ctx, branchId)) {
    return NextResponse.json({ error: "You cannot create orders for this branch." }, { status: 403 });
  }

  const subtotal = calculateItemsTotal(data.items);
  if (data.downPayment > subtotal) {
    return NextResponse.json({ error: "Down payment cannot exceed order total." }, { status: 400 });
  }

  try {
    const customer = await getOrCreateCustomerForVendor({
      vendorId: ctx.vendor.id,
      vendorBusinessName: ctx.vendor.businessName,
      communityId: ctx.vendor.communityId,
      organizationId: ctx.organizationId,
      fullName: data.customerName,
      phone: data.customerPhone,
      actingVendorPhone: ctx.vendor.phone,
    });

    const coupon = data.couponCode
      ? await prisma.couponCampaign.findFirst({
          where: {
            organizationId: ctx.organizationId,
            code: data.couponCode.trim().toUpperCase(),
            active: true,
            AND: [
              { startsAt: { lte: new Date() } },
              { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
              { OR: [{ branchId: null }, { branchId }] },
            ],
          },
        })
      : null;

    let discount = coupon ? calculateCouponDiscount(coupon, subtotal) : 0;
    if (coupon) {
      const [totalRedemptions, customerRedemptions] = await Promise.all([
        prisma.couponRedemption.count({ where: { campaignId: coupon.id } }),
        prisma.couponRedemption.count({ where: { campaignId: coupon.id, studentId: customer.id } }),
      ]);
      if (coupon.maxRedemptions !== null && totalRedemptions >= coupon.maxRedemptions) discount = 0;
      if (coupon.perCustomerLimit !== null && customerRedemptions >= coupon.perCustomerLimit) discount = 0;
    }

    const totalAmount = Math.max(0, subtotal - discount);
    const amountFinanced = Math.max(0, totalAmount - data.downPayment);
    const dueDate = new Date(data.dueDate);
    const orderNumber = nextOrderNumber(ctx.organization.slug.slice(0, 4).toUpperCase());
    const schedule = data.repaymentSchedule?.length
      ? data.repaymentSchedule
      : amountFinanced > 0
        ? [{ dueAt: data.dueDate, amount: amountFinanced }]
        : [];
    const scheduleTotal = schedule.reduce((sum, entry) => sum + entry.amount, 0);
    if (Math.round(scheduleTotal) !== Math.round(amountFinanced)) {
      return NextResponse.json(
        { error: "Repayment schedule total must equal the financed amount." },
        { status: 400 }
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const credit = amountFinanced > 0
        ? await tx.credit.create({
            data: {
              vendorId: ctx.vendor.id,
              organizationId: ctx.organizationId,
              branchId,
              studentId: customer.id,
              amount: totalAmount,
              amountRepaid: data.downPayment,
              description: `BNPL order ${orderNumber}`,
              dueDate,
              status: data.downPayment > 0 ? "PARTIALLY_PAID" : "OUTSTANDING",
            },
          })
        : null;

      const savedOrder = await tx.bnplOrder.create({
        data: {
          organizationId: ctx.organizationId,
          branchId,
          vendorId: ctx.vendor.id,
          studentId: customer.id,
          creditId: credit?.id ?? null,
          orderNumber,
          status: amountFinanced > 0 ? "ACTIVE" : "PAID",
          subtotal,
          discountAmount: discount,
          totalAmount,
          downPayment: data.downPayment,
          dueDate,
          couponCode: coupon?.code ?? null,
          termsAcceptedAt: null, // pending customer acceptance via the shared consent link
          notes: data.notes ?? null,
          items: {
            create: data.items.map((item) => ({
              name: item.name,
              sku: item.sku ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            })),
          },
          schedules: {
            create: schedule.map((entry) => ({
              dueAt: new Date(entry.dueAt),
              amount: entry.amount,
            })),
          },
        },
        include: { items: true, schedules: true, student: true },
      });

      if (credit) {
        await tx.creditScoreEvent.create({
          data: {
            studentId: customer.id,
            vendorId: ctx.vendor.id,
            creditId: credit.id,
            eventType: "CREDIT_EXTENDED",
            amount: amountFinanced,
            scoreDelta: 0,
          },
        });
      }

      if (coupon && discount > 0) {
        await tx.couponRedemption.create({
          data: {
            organizationId: ctx.organizationId,
            campaignId: coupon.id,
            studentId: customer.id,
            orderId: savedOrder.id,
            amount: discount,
          },
        });
      }

      await tx.walletLedgerEntry.create({
        data: {
          organizationId: ctx.organizationId,
          branchId,
          vendorId: ctx.vendor.id,
          entryType: "BNPL_ISSUED",
          direction: "DEBIT",
          amount: amountFinanced,
          sourceType: "BnplOrder",
          sourceId: savedOrder.id,
          description: `BNPL issued for ${customer.fullName}`,
        },
      });

      if (coupon && discount > 0) {
        await tx.walletLedgerEntry.create({
          data: {
            organizationId: ctx.organizationId,
            branchId,
            vendorId: ctx.vendor.id,
            entryType: "COUPON_DISCOUNT",
            direction: "DEBIT",
            amount: discount,
            sourceType: "CouponCampaign",
            sourceId: coupon.id,
            description: `Coupon applied to ${orderNumber}`,
          },
        });
      }

      return savedOrder;
    });

    await writeAudit({
      actorType: "vendor",
      actorId: ctx.vendor.id,
      action: "bnpl.order_created",
      entityType: "BnplOrder",
      entityId: order.id,
      metadata: {
        organizationId: ctx.organizationId,
        branchId,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        studentId: order.studentId,
        couponCode: order.couponCode,
      },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create BNPL order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

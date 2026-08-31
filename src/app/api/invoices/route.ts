import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessBranch, hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { getOrCreateCustomerForVendor, roundMoney } from "@/lib/bnpl";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().positive(),
});

const createSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().min(7).max(30),
  branchId: z.string().optional(),
  dueDate: z.string().datetime(),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  items: z.array(itemSchema).min(1).max(50),
});

function nextInvoiceNumber(prefix: string) {
  return `INV-${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ invoices: [] });

  const where = ctx.canSeeAllBranches
    ? { organizationId: ctx.organizationId }
    : { organizationId: ctx.organizationId, branchId: ctx.branchId };

  const invoices = await prisma.invoice.findMany({
    where,
    include: { student: true, branch: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  if (!hasTenantWriteAccess(ctx) || !ctx.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // requireTenantContext already loaded the subscription via getVendorSession,
  // so this costs no extra query.
  const denied = entitlementDenied(ctx.vendor.subscription, "invoice.create");
  if (denied) return denied;

  const json = await req.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const branchId = data.branchId ?? ctx.branchId ?? null;
  if (branchId && !canAccessBranch(ctx, branchId)) {
    return NextResponse.json({ error: "You cannot invoice for this branch." }, { status: 403 });
  }

  const subtotal = roundMoney(data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount = Math.min(data.discountAmount, subtotal);
  const total = roundMoney(subtotal - discount);
  if (total <= 0) {
    return NextResponse.json({ error: "Invoice total must be greater than zero." }, { status: 400 });
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

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        branchId,
        vendorId: ctx.vendor.id,
        studentId: customer.id,
        invoiceNumber: nextInvoiceNumber((ctx.organization?.slug ?? "VDM").slice(0, 4).toUpperCase()),
        source: "WEB",
        status: "DRAFT",
        subtotal,
        discountAmount: discount,
        total,
        dueDate: new Date(data.dueDate),
        notes: data.notes?.trim() || null,
        items: {
          create: data.items.map((i) => ({
            name: i.name.trim(),
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: roundMoney(i.quantity * i.unitPrice),
          })),
        },
      },
      include: { items: true, student: true },
    });

    await writeAudit({
      actorType: "vendor",
      actorId: ctx.vendor.id,
      action: "invoice.created",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: { organizationId: ctx.organizationId, invoiceNumber: invoice.invoiceNumber, total, source: "WEB" },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, invoice }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create the invoice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

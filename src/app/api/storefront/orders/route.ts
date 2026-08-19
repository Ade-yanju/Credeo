import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantByHost } from "@/lib/tenant-domain";
import { getOrganizationEntitlement } from "@/lib/entitlement-guard";
import { permits } from "@/lib/entitlement";
import { normalisePhone } from "@/lib/utils";
import { rateLimit } from "@/lib/redis";
import { verifyOtpCookie, clearOtpCookie } from "@/lib/otp-cookie";
import { nextOrderNumber, roundMoney } from "@/lib/bnpl";
import { getOrCreateStorefrontCustomer, getOrgOwnerVendorId } from "@/lib/storefront";
import { assessBnplRisk } from "@/lib/bnpl-risk";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const schema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20),
  otp: z.string().length(6).regex(/^\d{6}$/),
  consent: z.literal(true),
  notes: z.string().max(300).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50),
});

const DEFAULT_TERM_DAYS = 14;

// Public: a customer submits a BNPL purchase request from the storefront.
// Creates a DRAFT order (no credit yet) awaiting store approval.
export async function POST(req: NextRequest) {
  const org = await resolveTenantByHost(req.headers.get("host"));
  if (!org || org.type === "SOLO_VENDOR") {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  // A store whose subscription has lapsed cannot approve orders
  // (bnpl.order.decide is blocked), so accepting a request here would leave
  // the shopper waiting on something that can never happen. Copy is
  // deliberately NEUTRAL — a customer must never learn about the vendor's
  // billing state.
  const storeEntitlement = await getOrganizationEntitlement(org.id);
  if (!storeEntitlement || !permits(storeEntitlement, "storefront.order.create")) {
    return NextResponse.json(
      { error: "This store isn't accepting new pay-later orders at the moment. Please contact the store directly." },
      { status: 403 }
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const phone = normalisePhone(data.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  const rl = await rateLimit(`rl:store-order:${phone}`, 5, 600, true);
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 });

  if (!verifyOtpCookie("storefront", phone, data.otp)) {
    return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 401 });
  }

  // Resolve real products + prices from the DB (never trust client prices).
  const ids = [...new Set(data.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, organizationId: org.id, active: true, bnplEligible: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (ids.some((id) => !byId.has(id))) {
    return NextResponse.json({ error: "A selected item is no longer available." }, { status: 400 });
  }
  const lineItems = data.items.map((i) => {
    const p = byId.get(i.productId)!;
    const unitPrice = Number(p.price);
    return { name: p.name, sku: p.sku ?? null, quantity: i.quantity, unitPrice, totalPrice: unitPrice * i.quantity };
  });
  const subtotal = roundMoney(lineItems.reduce((s, l) => s + l.totalPrice, 0));
  if (subtotal <= 0) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

  const ownerVendorId = await getOrgOwnerVendorId(org.id);
  if (!ownerVendorId) return NextResponse.json({ error: "This store cannot accept orders yet." }, { status: 400 });

  try {
    const customer = await getOrCreateStorefrontCustomer({
      organizationId: org.id,
      communityId: org.communityId ?? null,
      fullName: data.fullName,
      phone,
    });

    // Credit-risk guardrail: block oversized/abusive/defaulted requests before
    // they ever reach the store's approval queue.
    const risk = await assessBnplRisk({ organizationId: org.id, studentId: customer.id, amount: subtotal });
    if (!risk.allowed) {
      return NextResponse.json({ error: risk.reason ?? "This request can't be approved online." }, { status: 403 });
    }

    const dueDate = new Date(Date.now() + DEFAULT_TERM_DAYS * 86_400_000);
    const orderNumber = nextOrderNumber(org.slug.slice(0, 4).toUpperCase());

    const order = await prisma.bnplOrder.create({
      data: {
        organizationId: org.id,
        vendorId: ownerVendorId,
        studentId: customer.id,
        orderNumber,
        status: "DRAFT", // awaiting store approval
        subtotal,
        totalAmount: subtotal,
        dueDate,
        termsAcceptedAt: new Date(), // customer accepted BNPL terms at submission
        notes: data.notes?.trim() || null,
        items: { create: lineItems.map((l) => ({ name: l.name, sku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice, totalPrice: l.totalPrice })) },
      },
    });

    clearOtpCookie("storefront");

    await writeAudit({
      actorType: "system",
      action: "bnpl.order_submitted",
      entityType: "BnplOrder",
      entityId: order.id,
      metadata: { organizationId: org.id, orderNumber, studentId: customer.id, subtotal },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, orderNumber }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not submit your request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

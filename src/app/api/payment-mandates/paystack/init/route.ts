import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/utils";
import { hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";

const initSchema = z.object({
  customerPhone: z.string().min(7).max(30),
  amountKobo: z.number().int().min(100).default(10000),
  callbackPath: z.string().startsWith("/").default("/dashboard/settings"),
});

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "mandate.write");
  if (denied) return denied;
  if (!hasTenantWriteAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Organization is not ready for mandates." }, { status: 400 });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Paystack not configured" }, { status: 503 });
  }

  const json = await req.json();
  const parsed = initSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const phone = normalisePhone(parsed.data.customerPhone);
  if (!phone) return NextResponse.json({ error: "Enter a valid customer phone number." }, { status: 400 });

  const customer = await prisma.student.findFirst({
    where: { phone, organizationId: ctx.organizationId },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found in this organization." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const callbackUrl = `${appUrl}${parsed.data.callbackPath}`;
  const pseudoEmail = `${phone.replace(/\D/g, "")}@customers.vodiumledger.com`;

  const mandate = await prisma.paymentMandate.create({
    data: {
      organizationId: ctx.organizationId,
      studentId: customer.id,
      provider: "PAYSTACK",
      status: "PENDING",
      reusable: true,
      customerReference: pseudoEmail,
    },
  });

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: pseudoEmail,
      amount: parsed.data.amountKobo,
      callback_url: callbackUrl,
      metadata: {
        purpose: "payment_mandate",
        organizationId: ctx.organizationId,
        vendorId: ctx.vendor.id,
        studentId: customer.id,
        mandateId: mandate.id,
        custom_fields: [
          { display_name: "Customer", variable_name: "customer", value: customer.fullName },
          { display_name: "Organization", variable_name: "organization", value: ctx.organization?.name ?? "Vodium" },
        ],
      },
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    await prisma.paymentMandate.update({
      where: { id: mandate.id },
      data: { status: "FAILED" },
    });
    console.error("[payment-mandates/paystack/init] Paystack error:", data);
    return NextResponse.json({ error: "Could not initialize Paystack mandate." }, { status: 502 });
  }

  const updated = await prisma.paymentMandate.update({
    where: { id: mandate.id },
    data: {
      mandateReference: data.data.reference,
    },
  });

  return NextResponse.json({
    ok: true,
    mandate: updated,
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  });
}

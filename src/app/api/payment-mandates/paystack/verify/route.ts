import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";

type PaystackVerifyResponse = {
  status?: boolean;
  data?: {
    status?: string;
    reference?: string;
    authorization?: {
      authorization_code?: string;
      reusable?: boolean;
    };
    metadata?: {
      mandateId?: string;
      organizationId?: string;
    };
  };
  message?: string;
};

export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "mandate.write");
  if (denied) return denied;
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Organization is not ready for mandates." }, { status: 400 });
  }

  const reference = req.nextUrl.searchParams.get("reference")?.trim();
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Paystack not configured" }, { status: 503 });

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const result = (await res.json()) as PaystackVerifyResponse;

  if (!res.ok || !result.status || !result.data || result.data.status !== "success") {
    console.error("[payment-mandates/paystack/verify] Paystack error:", result);
    return NextResponse.json({ error: "Mandate payment could not be confirmed" }, { status: 502 });
  }

  const mandateId = result.data.metadata?.mandateId;
  if (!mandateId) return NextResponse.json({ error: "Missing mandate metadata" }, { status: 400 });

  const mandate = await prisma.paymentMandate.findFirst({
    where: { id: mandateId, organizationId: ctx.organizationId },
  });
  if (!mandate) return NextResponse.json({ error: "Mandate not found" }, { status: 404 });

  const updated = await prisma.paymentMandate.update({
    where: { id: mandate.id },
    data: {
      status: "ACTIVE",
      mandateReference: result.data.reference ?? reference,
      authorizationReference: result.data.authorization?.authorization_code ?? null,
      reusable: result.data.authorization?.reusable ?? mandate.reusable,
    },
  });

  return NextResponse.json({ ok: true, mandate: updated });
}

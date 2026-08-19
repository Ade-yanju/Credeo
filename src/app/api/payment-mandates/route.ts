import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/utils";
import { hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const mandateSchema = z.object({
  customerPhone: z.string().min(7).max(30),
  provider: z.enum(["PAYSTACK", "MANUAL"]).default("PAYSTACK"),
  customerReference: z.string().max(120).optional(),
  authorizationReference: z.string().max(160).optional(),
  mandateReference: z.string().max(160).optional(),
  status: z.enum(["PENDING", "ACTIVE", "FAILED", "REVOKED", "EXPIRED"]).default("PENDING"),
  reusable: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ mandates: [] });

  const mandates = await prisma.paymentMandate.findMany({
    where: { organizationId: ctx.organizationId },
    include: { student: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ mandates });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "mandate.write");
  if (denied) return denied;
  if (!hasTenantWriteAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.organizationId) {
    return NextResponse.json({ error: "Organization is not ready for payment mandates." }, { status: 400 });
  }

  const json = await req.json();
  const parsed = mandateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const phone = normalisePhone(data.customerPhone);
  if (!phone) return NextResponse.json({ error: "Enter a valid customer phone number." }, { status: 400 });

  const student = await prisma.student.findFirst({
    where: { phone, organizationId: ctx.organizationId },
  });
  if (!student) {
    return NextResponse.json({ error: "Customer not found in this organization." }, { status: 404 });
  }

  const mandate = await prisma.paymentMandate.create({
    data: {
      organizationId: ctx.organizationId,
      studentId: student.id,
      provider: data.provider,
      status: data.status,
      customerReference: data.customerReference ?? null,
      authorizationReference: data.authorizationReference ?? null,
      mandateReference: data.mandateReference ?? null,
      reusable: data.reusable,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "payment_mandate.created",
    entityType: "PaymentMandate",
    entityId: mandate.id,
    metadata: {
      organizationId: ctx.organizationId,
      studentId: student.id,
      provider: mandate.provider,
      status: mandate.status,
    },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, mandate }, { status: 201 });
}

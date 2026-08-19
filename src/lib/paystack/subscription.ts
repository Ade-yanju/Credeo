import { prisma } from "@/lib/prisma";
import { recordSubscriptionEvent } from "@/lib/subscription-events";
import type { SubscriptionPlan } from "@prisma/client";

export const PLAN_AMOUNTS_KOBO: Record<SubscriptionPlan, number> = {
  STARTER: 200000,
  GROWTH: 500000,
  PRO: 1000000,
};

export const PLAN_AMOUNTS_NAIRA: Record<SubscriptionPlan, number> = {
  STARTER: 2000,
  GROWTH: 5000,
  PRO: 10000,
};

export type PaystackPaymentData = {
  status?: string;
  amount?: number;
  paid_at?: string;
  metadata?: unknown;
  customer?: { id?: number | string };
  subscription?: { subscription_code?: string };
  subscription_code?: string;
  next_payment_date?: string;
};

export async function activateSubscriptionFromPaystackData(
  vendorId: string,
  data: PaystackPaymentData,
): Promise<
  | { ok: true; plan: SubscriptionPlan }
  | { ok: false; error: string; status: number }
> {
  if (data.status !== "success") {
    return { ok: false, error: "Payment was not successful", status: 402 };
  }

  const metadata = parseMetadata(data.metadata);
  if (metadata.vendorId !== vendorId) {
    return { ok: false, error: "Payment reference does not belong to this vendor", status: 403 };
  }

  const plan = parsePlan(metadata.plan);
  if (!plan) {
    return { ok: false, error: "Payment has an invalid plan", status: 400 };
  }

  const expectedAmount = PLAN_AMOUNTS_KOBO[plan];
  if (typeof data.amount === "number" && data.amount < expectedAmount) {
    return { ok: false, error: "Payment amount does not match the selected plan", status: 400 };
  }

  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  const currentPeriodEnd = data.next_payment_date ? new Date(data.next_payment_date) : new Date(paidAt);
  if (!data.next_payment_date) currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  const paystackCustomerId = data.customer?.id?.toString();
  const paystackSubscriptionCode = data.subscription?.subscription_code ?? data.subscription_code;

  // Captured before the upsert so the event can record what it moved FROM.
  const previous = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    select: { id: true, status: true },
  });

  await prisma.vendorSubscription.upsert({
    where: { vendorId },
    update: {
      plan,
      status: "ACTIVE",
      currentPeriodStart: paidAt,
      currentPeriodEnd,
      monthlyAmount: PLAN_AMOUNTS_NAIRA[plan],
      // MUST be cleared on payment. Leaving a stale grace date behind would
      // mean the NEXT lapse reads an already-past graceEndsAt and locks the
      // vendor out instantly instead of giving them their 7 days.
      graceEndsAt: null,
      ...(paystackCustomerId ? { paystackCustomerId } : {}),
      ...(paystackSubscriptionCode ? { paystackSubscriptionCode } : {}),
    },
    create: {
      vendorId,
      plan,
      status: "ACTIVE",
      currentPeriodStart: paidAt,
      currentPeriodEnd,
      monthlyAmount: PLAN_AMOUNTS_NAIRA[plan],
      paystackCustomerId: paystackCustomerId ?? null,
      paystackSubscriptionCode: paystackSubscriptionCode ?? null,
    },
  });

  await recordSubscriptionEvent({
    vendorId,
    subscriptionId: previous?.id ?? null,
    fromStatus: previous?.status ?? null,
    toStatus: "ACTIVE",
    plan,
    monthlyAmount: PLAN_AMOUNTS_NAIRA[plan],
    reason: "paystack_charge_success",
    occurredAt: paidAt,
  });

  await prisma.notification.create({
    data: {
      vendorId,
      title: "Payment Successful",
      message: "Your subscription payment was confirmed and your plan is now active.",
      type: "SUCCESS",
    },
  });

  return { ok: true, plan };
}

export function parseMetadata(raw: unknown): { vendorId?: string; plan?: string } {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { vendorId?: string; plan?: string };
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return raw as { vendorId?: string; plan?: string };
  }
  return {};
}

export function parsePlan(raw: unknown): SubscriptionPlan | null {
  if (raw === "STARTER" || raw === "GROWTH" || raw === "PRO") return raw;
  return null;
}

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  activateSubscriptionFromPaystackData,
  parseMetadata,
  type PaystackPaymentData,
} from "@/lib/paystack/subscription";
import { syncProspectLifecycleForVendor } from "@/lib/acquisition";
import { recordSubscriptionEvent } from "@/lib/subscription-events";
import { GRACE_DAYS } from "@/lib/entitlement";

interface PaystackData extends PaystackPaymentData {
  subscription_code?: string;
  customer?: { id: number | string };
  metadata?: unknown;
  next_payment_date?: string;
  paid_at?: string;
  subscription?: { subscription_code: string };
  reference?: string;
  authorization?: { authorization_code?: string; reusable?: boolean };
}

type MandateMetadata = { purpose?: string; mandateId?: string; organizationId?: string };

interface PaystackEvent {
  event: string;
  data: PaystackData;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // Fail closed — reject all traffic if secret is not configured in production.
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY;
  if (!secret && process.env.NODE_ENV === "production") {
    console.error("[paystack/webhook] Paystack secret not set — rejecting all webhook traffic");
    return new NextResponse("Webhook not configured", { status: 503 });
  }

  // Verify HMAC-SHA512 signature with constant-time compare.
  const hash = crypto.createHmac("sha512", secret ?? "").update(body).digest("hex");

  // Use timingSafeEqual to prevent length-leak and timing-oracle attacks.
  const sigBuf  = Buffer.from(signature, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  const sigValid =
    sigBuf.length === hashBuf.length &&
    sigBuf.length > 0 &&
    crypto.timingSafeEqual(sigBuf, hashBuf);

  if (!sigValid) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const data = event.data || {};

  switch (event.event) {
    case "subscription.create": {
      const paystackCode = data.subscription_code;
      const customerId = data.customer?.id?.toString();
      const metadata = parseMetadata(data.metadata);

      if (paystackCode && customerId && metadata.vendorId) {
        const sub = await prisma.vendorSubscription.findUnique({
          where: { vendorId: metadata.vendorId },
        });
        if (sub) {
          await prisma.vendorSubscription.update({
            where: { id: sub.id },
            data: {
              paystackCustomerId: customerId,
              paystackSubscriptionCode: paystackCode,
            },
          });
        }
      }
      break;
    }

    case "charge.success": {
      const metadata = parseMetadata(data.metadata);
      const mandateMeta = metadata as MandateMetadata;

      // Payment-mandate authorization (customer tokenised a card). Handle this
      // before subscription logic — mandate metadata also carries a vendorId.
      if (mandateMeta.purpose === "payment_mandate") {
        const mandate = mandateMeta.mandateId
          ? await prisma.paymentMandate.findUnique({ where: { id: mandateMeta.mandateId } })
          : data.reference
            ? await prisma.paymentMandate.findFirst({ where: { mandateReference: data.reference } })
            : null;
        if (mandate && mandate.status !== "ACTIVE") {
          await prisma.paymentMandate.update({
            where: { id: mandate.id },
            data: {
              status: "ACTIVE",
              authorizationReference: data.authorization?.authorization_code ?? mandate.authorizationReference,
              reusable: data.authorization?.reusable ?? mandate.reusable,
            },
          });
        }
        break;
      }

      if (metadata.vendorId) {
        const activated = await activateSubscriptionFromPaystackData(metadata.vendorId, {
          ...data,
          status: "success",
        });
        if (!activated.ok) {
          console.error("[paystack/webhook] charge.success not activated:", activated.error);
        } else {
          void syncProspectLifecycleForVendor(metadata.vendorId).catch((err) =>
            console.error("[paystack/webhook] acquisition lifecycle sync failed:", err)
          );
        }
      }
      break;
    }

    case "subscription.disable": {
      const paystackCode = data.subscription_code;
      if (paystackCode) {
        const sub = await prisma.vendorSubscription.findFirst({
          where: { paystackSubscriptionCode: paystackCode },
        });
        if (sub) {
          // A cancelled subscription still keeps whatever period was paid for,
          // then gets the standard grace window on top.
          const lapsesAt = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
            ? sub.currentPeriodEnd
            : new Date();
          await prisma.vendorSubscription.update({
            where: { id: sub.id },
            data: {
              status: "CANCELLED",
              graceEndsAt: new Date(lapsesAt.getTime() + GRACE_DAYS * 86_400_000),
            },
          });
          await recordSubscriptionEvent({
            vendorId: sub.vendorId,
            subscriptionId: sub.id,
            fromStatus: sub.status,
            toStatus: "CANCELLED",
            plan: sub.plan,
            monthlyAmount: sub.monthlyAmount.toString(),
            reason: "paystack_subscription_disabled",
          });
          await prisma.notification.create({
            data: {
              vendorId: sub.vendorId,
              title: "Subscription Cancelled",
              message: "Your subscription has been disabled. You'll lose access to premium features soon.",
              type: "WARNING",
            },
          });
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const paystackCode = data.subscription?.subscription_code;
      if (paystackCode) {
        const sub = await prisma.vendorSubscription.findFirst({
          where: { paystackSubscriptionCode: paystackCode },
        });
        if (sub) {
          await prisma.vendorSubscription.update({
            where: { id: sub.id },
            data: {
              status: "PAST_DUE",
              // Payment failed today, so grace runs from today.
              graceEndsAt: new Date(Date.now() + GRACE_DAYS * 86_400_000),
            },
          });
          await recordSubscriptionEvent({
            vendorId: sub.vendorId,
            subscriptionId: sub.id,
            fromStatus: sub.status,
            toStatus: "PAST_DUE",
            plan: sub.plan,
            monthlyAmount: sub.monthlyAmount.toString(),
            reason: "paystack_payment_failed",
          });
          await prisma.notification.create({
            data: {
              vendorId: sub.vendorId,
              title: "Payment Failed",
              message: "We couldn't process your monthly payment. Please update your billing info.",
              type: "DANGER",
            },
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

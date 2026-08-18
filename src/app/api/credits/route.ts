import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPhone } from "@/lib/session";
import { rateLimit } from "@/lib/redis";
import { normalisePhoneNG } from "@/lib/utils";
import { getStudentLimit, isPlanActive } from "@/lib/plan";
import { nextVendorCustomerId } from "@/lib/customer-id";
import { markOverdueCredits } from "@/lib/credit-lifecycle";
import crypto from "crypto";
import { vendorKnowsCustomer, maskPhone } from "@/lib/customer-verify";
import { sendOtpCode } from "@/lib/otp-delivery";
import { sendCreditLoggedNotification } from "@/lib/whatsapp/credit-notification-delivery";
import { setOtpCookie, verifyOtpCookie, clearOtpCookie } from "@/lib/otp-cookie";
import type { CreditStatus } from "@prisma/client";
import { syncProspectLifecycleForVendor } from "@/lib/acquisition";

const VERIFY_PURPOSE = "credit-verify";

// GET /api/credits?status=OVERDUE&search=emeka&page=1&limit=20
export async function GET(req: NextRequest) {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { phone } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  await markOverdueCredits({ vendorId: vendor.id });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as CreditStatus | null;
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));

  const where = {
    vendorId: vendor.id,
    ...(status ? { status } : {}),
    ...(search
      ? {
          student: {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { matricNumber: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [credits, total] = await Promise.all([
    prisma.credit.findMany({
      where,
      include: { student: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.credit.count({ where }),
  ]);

  return NextResponse.json({ credits, total, page, limit });
}

const createSchema = z.object({
  customerName:   z.string().min(2).max(100),
  customerPhone:  z.string().optional(),
  amount:         z.number().positive(),
  description:    z.string().max(200).optional(),
  dueDate:        z.string().datetime(),
  verificationCode: z.string().trim().min(4).max(8).optional(),
  // Save a BRAND-NEW debtor without their code (never honoured for a number
  // that already belongs to a customer — that record needs its owner's code).
  skipVerification: z.boolean().optional(),
});

// POST /api/credits
export async function POST(req: NextRequest) {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // IP-based rate limit: 60 credits per hour per IP (prevents automated abuse)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { ok: rlOk } = await rateLimit(`rl:credits:${ip}`, 60, 3600);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { phone },
    include: { subscription: true },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  // ── Subscription status check ────────────────────────────────────────────
  const sub = vendor.subscription;

  if (!isPlanActive(sub)) {
    return NextResponse.json(
      { error: "Your subscription has expired. Please renew to continue adding credits." },
      { status: 403 }
    );
  }

  const json = await req.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { customerName, customerPhone, amount, description, dueDate, verificationCode, skipVerification } = parsed.data;

  const normalisedCustomerPhone = customerPhone ? normalisePhoneNG(customerPhone) : null;
  if (customerPhone && !normalisedCustomerPhone) {
    return NextResponse.json({ error: "Enter a valid customer WhatsApp number." }, { status: 400 });
  }
  const customerPhoneKey = normalisedCustomerPhone ?? `pending:${Date.now()}`;

  // Anyone can be a debtor, including another shop's vendor — the shared credit
  // graph is keyed by phone. The only number we refuse is the vendor's own.
  if (normalisedCustomerPhone && normalisedCustomerPhone === normalisePhoneNG(vendor.phone)) {
    return NextResponse.json(
      { error: "You can't log a credit against your own number." },
      { status: 409 }
    );
  }

  const existingStudent = await prisma.student.findUnique({
    where: { phone: customerPhoneKey },
  });
  const generatedCustomerId = await nextVendorCustomerId(vendor.id, vendor.businessName);
  let student = existingStudent;

  if (existingStudent) {
    // A real (non-pending) number that already belongs to a customer this vendor
    // has never served must be verified with a code sent to the customer's own
    // WhatsApp before we attach — this is what lets the same number be used
    // across shops safely. Repeat customers at this shop skip verification.
    const isRealNumber = !!normalisedCustomerPhone;
    const knowsCustomer = await vendorKnowsCustomer(vendor.id, existingStudent.id);

    if (isRealNumber && !knowsCustomer) {
      if (!verificationCode) {
        const rl = await rateLimit(`rl:credit-verify:${customerPhoneKey}`, 4, 600, true);
        if (!rl.ok) {
          return NextResponse.json({ error: "Too many code requests. Please wait a few minutes." }, { status: 429 });
        }
        // Send a code to the CUSTOMER's own WhatsApp and store the challenge in a
        // signed httpOnly cookie keyed to this phone (never the raw code).
        const code = String(crypto.randomInt(100000, 999999));
        setOtpCookie(VERIFY_PURPOSE, customerPhoneKey, code);
        const { channel } = await sendOtpCode({ phone: customerPhoneKey, code, storeName: vendor.businessName });
        const debugCode = process.env.OTP_DEBUG_RETURN === "true" ? code : undefined;
        return NextResponse.json({
          needsVerification: true,
          maskedPhone: maskPhone(customerPhoneKey),
          // Don't let the UI claim "code sent" when nothing was delivered
          // (no OTP template + customer has never messaged the bot).
          delivered: channel === "whatsapp",
          ...(channel !== "whatsapp"
            ? { deliveryHint: "We couldn't reach that number on WhatsApp yet. Ask the customer to send 'hi' to the Vodium Ledger WhatsApp number, then resend the code." }
            : {}),
          ...(debugCode ? { debugCode } : {}),
        });
      }

      const ok = verifyOtpCookie(VERIFY_PURPOSE, customerPhoneKey, verificationCode.trim());
      if (!ok) {
        return NextResponse.json(
          { error: "That code is wrong or has expired. Ask the customer for the latest code.", needsVerification: true, maskedPhone: maskPhone(customerPhoneKey) },
          { status: 400 }
        );
      }
      clearOtpCookie(VERIFY_PURPOSE);
    }

    if (!existingStudent.matricNumber) {
      student = await prisma.student.update({
        where: { id: existingStudent.id },
        data: { matricNumber: generatedCustomerId },
      });
    }
  } else {
    // BRAND-NEW debtor with a real number: send a code to their WhatsApp to
    // prove the number is real and its owner consents — but let the vendor
    // save without it (skipVerification), because verification must never
    // block logging a credit. Numbers we can't verify are still reminded.
    if (normalisedCustomerPhone && !skipVerification) {
      if (!verificationCode) {
        const rl = await rateLimit(`rl:credit-verify:${customerPhoneKey}`, 4, 600, true);
        if (!rl.ok) {
          return NextResponse.json({ error: "Too many code requests. Please wait a few minutes." }, { status: 429 });
        }
        const code = String(crypto.randomInt(100000, 999999));
        setOtpCookie(VERIFY_PURPOSE, customerPhoneKey, code);
        const { channel } = await sendOtpCode({ phone: customerPhoneKey, code, storeName: vendor.businessName });
        const debugCode = process.env.OTP_DEBUG_RETURN === "true" ? code : undefined;
        return NextResponse.json({
          needsVerification: true,
          allowSkip: true, // new debtor — no existing record to protect
          maskedPhone: maskPhone(customerPhoneKey),
          delivered: channel === "whatsapp",
          ...(channel !== "whatsapp"
            ? { deliveryHint: "We couldn't reach that number on WhatsApp yet. Ask the customer to send 'hi' to the Vodium Ledger WhatsApp number and resend the code — or save without verification." }
            : {}),
          ...(debugCode ? { debugCode } : {}),
        });
      }
      const ok = verifyOtpCookie(VERIFY_PURPOSE, customerPhoneKey, verificationCode.trim());
      if (!ok) {
        return NextResponse.json(
          { error: "That code is wrong or has expired. Ask the customer for the latest code.", needsVerification: true, allowSkip: true, maskedPhone: maskPhone(customerPhoneKey) },
          { status: 400 }
        );
      }
      clearOtpCookie(VERIFY_PURPOSE);
    }

    student = await prisma.student.create({
      data: {
        fullName: customerName,
        phone: customerPhoneKey,
        matricNumber: generatedCustomerId,
        communityId: vendor.communityId,
        organizationId: vendor.organizationId,
      },
    });
  }
  if (!student) {
    return NextResponse.json({ error: "Could not create customer" }, { status: 500 });
  }

  // ── Customer count gating (only for new customers) ─────────────────────────
  const plan = vendor.subscription?.plan ?? "STARTER";
  const customerLimit = getStudentLimit(plan);

  if (customerLimit !== null) {
    const alreadyOnBook = await prisma.credit.findFirst({
      where: { vendorId: vendor.id, studentId: student.id },
      select: { id: true },
    });
    if (!alreadyOnBook) {
      const uniqueCustomerCount = await prisma.student.count({
        where: { credits: { some: { vendorId: vendor.id } } },
      });
      if (uniqueCustomerCount >= customerLimit) {
        return NextResponse.json(
          {
            error: `You've reached the ${customerLimit}-customer limit on your ${plan} plan. Upgrade to add more customers.`,
            limitReached: true,
            plan,
            limit: customerLimit,
          },
          { status: 403 }
        );
      }
    }
  }

  const credit = await prisma.credit.create({
    data: {
      vendorId: vendor.id,
      organizationId: vendor.organizationId,
      branchId: vendor.branchId,
      studentId: student.id,
      amount,
      description: description ?? null,
      dueDate: new Date(dueDate),
      status: "OUTSTANDING",
    },
    include: { student: true },
  });

  // Record score event
  await prisma.creditScoreEvent.create({
    data: {
      studentId: student.id,
      vendorId: vendor.id,
      creditId: credit.id,
      eventType: "CREDIT_EXTENDED",
      amount,
      scoreDelta: 0,
    },
  });

  // If this vendor originated from acquisition, their first real ledger entry
  // is the product-defined activation event.
  void syncProspectLifecycleForVendor(vendor.id).catch((err) =>
    console.error("[credits] acquisition lifecycle sync failed:", err)
  );

  return NextResponse.json({ ok: true, credit }, { status: 201 });
  const customerNotification = await sendCreditLoggedNotification({
    organizationId: vendor.organizationId,
    phone: credit.student.phone,
    customerName: credit.student.fullName,
    shopName: vendor.businessName,
    amount,
    description: credit.description,
    loggedAt: credit.createdAt,
    dueDate: credit.dueDate,
  });

  return NextResponse.json({ ok: true, credit, customerNotification }, { status: 201 });
}

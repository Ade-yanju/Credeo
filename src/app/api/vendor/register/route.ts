import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { REFERRAL_COOKIE, normaliseAmbassadorCode } from "@/lib/referral";
import { rateLimit } from "@/lib/redis";
import { normalisePhone } from "@/lib/utils";
import { parseCommunity } from "@/lib/community";
import { sendOtpEmail } from "@/lib/email/otp";
import { setVendorSession } from "@/lib/session";
import { createSoloOrganizationForVendor, trialEndsAt } from "@/lib/tenant";
import { setOtpCookie, verifyOtpCookie, clearOtpCookie } from "@/lib/otp-cookie";
import { linkProspectToVendor, verifyAcquisitionRegistrationToken } from "@/lib/acquisition";

// ─── shared form schema ───────────────────────────────────────────────────────

const VENDOR_TYPES = [
  "PROVISION_SHOP", "FOOD_CANTEEN", "LAUNDRY", "PRINTING",
  "BARBING_SALON", "HAIR_SALON", "PHARMACY", "MINI_MART", "OTHER",
] as const;

const formSchema = z.object({
  businessName:   z.string().min(2).max(100).trim(),
  vendorType:     z.enum(VENDOR_TYPES, { errorMap: () => ({ message: "Invalid vendor type" }) }),
  location:       z.string().min(3).max(200).trim(),
  community:     z.string().min(2).max(200).trim(),
  ownerName:      z.string().min(2).max(100).trim(),
  phone:          z.string().min(7).max(20),
  email:          z.string().trim().email().max(255).toLowerCase(),
  password:       z.string().min(8, "Password must be at least 8 characters").max(128),
  acquisitionToken: z.string().max(2000).optional(),
});

const verifySchema = formSchema.extend({
  otp: z.string().length(6).regex(/^\d{6}$/),
});

// ─── route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    if ("otp" in json) {
      return handleVerify(json);
    }
    return handleRequest(json);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return NextResponse.json(
        { error: "An account with this email or phone already exists. Please log in." },
        { status: 409 }
      );
    }
    console.error("[register]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// ─── step 1: validate form + send OTP ────────────────────────────────────────

async function handleRequest(json: unknown) {
  const parsed = formSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { phone, email, password } = parsed.data;

  const normalisedPhone = normalisePhone(phone);
  if (!normalisedPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const conflict = await findVendorConflict(email, normalisedPhone);
  if (conflict) return duplicateResponse(conflict);

  // Rate-limit: max 3 OTP sends per email per 10 min (best-effort — no-ops if Redis is down).
  const rl = await rateLimit(`rl:register-otp:${email}`, 3, 600, true);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many verification emails sent. Wait 10 minutes and try again." },
      { status: 429 }
    );
  }

  const otp = String(crypto.randomInt(100000, 999999));

  // Store OTP in a signed httpOnly cookie — no Redis dependency.
  setOtpCookie("register", email, otp);

  await sendOtpEmail(email, otp, "register");

  return NextResponse.json({ ok: true, step: "otp" });
}

// ─── step 2: verify OTP + create account ─────────────────────────────────────

async function handleVerify(json: unknown) {
  const parsed = verifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    businessName, vendorType, location, community,
    ownerName, phone, email, password, otp, acquisitionToken,
  } = parsed.data;

  // Rate-limit OTP guesses (best-effort — no-ops if Redis is down).
  const rl = await rateLimit(`rl:register-verify:${email}`, 5, 600, true);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 }
    );
  }

  // Verify OTP against the signed cookie.
  if (!verifyOtpCookie("register", email, otp)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }
  clearOtpCookie("register");

  const normalisedPhone = normalisePhone(phone);
  if (!normalisedPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const conflict = await findVendorConflict(email, normalisedPhone);
  if (conflict) return duplicateResponse(conflict);

  const passwordHash = await bcrypt.hash(password, 12);
  const communityMeta      = parseCommunity(community);

  const communityObj = await prisma.community.upsert({
    where:  { name: communityMeta.name },
    update: {},
    create: {
      name:      communityMeta.name,
      shortName: communityMeta.shortName ?? null,
      city:      communityMeta.city,
      state:     communityMeta.state,
      status:    "PILOT",
    },
  });

  const subscriptionTrialEndsAt = trialEndsAt();

  // Credit the campus ambassador whose /r/<code> link brought this vendor in.
  // Best-effort: an unknown, inactive or expired code must never block a signup.
  const referralCode = normaliseAmbassadorCode(cookies().get(REFERRAL_COOKIE)?.value);
  let referredByAmbassadorId: string | null = null;
  if (referralCode) {
    const ambassador = await prisma.ambassador
      .findUnique({ where: { code: referralCode }, select: { id: true, status: true } })
      .catch((err) => {
        console.error("[register] ambassador lookup failed:", err);
        return null;
      });
    if (ambassador?.status === "ACTIVE") referredByAmbassadorId = ambassador.id;
  }

  const vendor = await prisma.vendor.create({
    data: {
      businessName,
      ownerName,
      phone:         normalisedPhone,
      email,
      passwordHash,
      vendorType,
      communityId:  communityObj.id,
      location,
      status:        "ACTIVE",
      referredByAmbassadorId,
      subscription: {
        create: {
          plan:          "STARTER",
          status:        "TRIAL",
          trialEndsAt:    subscriptionTrialEndsAt,
          monthlyAmount: 2000,
        },
      },
    },
  });

  await createSoloOrganizationForVendor(vendor);

  // This link is deliberately best-effort: a stale acquisition token must never
  // block a legitimate merchant registration, and it can be matched manually.
  const prospectId = verifyAcquisitionRegistrationToken(acquisitionToken);
  if (prospectId) {
    await linkProspectToVendor(prospectId, vendor.id).catch((err) =>
      console.error("[register] acquisition link failed:", err)
    );
  }

  setVendorSession(normalisedPhone);

  return NextResponse.json({ ok: true, vendorId: vendor.id });
}

async function findVendorConflict(email: string, phone: string) {
  const existing = await prisma.vendor.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true, phone: true },
  });
  if (!existing) return null;
  if (existing.email === email) return "email" as const;
  if (existing.phone === phone) return "phone" as const;
  return "account" as const;
}

function duplicateResponse(conflict: "email" | "phone" | "account") {
  const label =
    conflict === "email" ? "email address"
    : conflict === "phone" ? "phone number"
    : "email or phone";

  return NextResponse.json(
    { error: `An account with this ${label} already exists. Please log in.` },
    { status: 409 }
  );
}

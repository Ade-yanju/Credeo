import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/redis";
import { sendOtpEmail } from "@/lib/email/otp";
import { setVendorSession, setAdminSession } from "@/lib/session";
import { setOtpCookie, verifyOtpCookie, clearOtpCookie } from "@/lib/otp-cookie";

const requestSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  email: z.string().email(),
  otp:   z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    if ("otp" in json) return handleVerify(json);
    return handleRequest(json);
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// ─── step 1: verify password, issue OTP ──────────────────────────────────────

async function handleRequest(json: unknown) {
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Rate-limit: max 5 login attempts per 15 min per email (best-effort).
  const rl = await rateLimit(`rl:login:${email}`, 5, 900, true);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 15 minutes and try again." },
      { status: 429 }
    );
  }

  const vendor = await prisma.vendor.findUnique({ where: { email } });

  // Constant-time compare to prevent user enumeration.
  const dummyHash = "$2a$12$invalidhashpadding00000000000000000000000000000000000";
  const match     = await bcrypt.compare(
    password,
    vendor?.deletionRequestedAt ? dummyHash : (vendor?.passwordHash ?? dummyHash),
  );

  if (!vendor || vendor.deletionRequestedAt || !match) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const otp = String(crypto.randomInt(100000, 999999));

  // Store OTP in a signed httpOnly cookie — no Redis dependency.
  setOtpCookie("login", email, otp);

  await sendOtpEmail(email, otp, "login");

  return NextResponse.json({ ok: true, step: "otp" });
}

// ─── step 2: verify OTP, set session ─────────────────────────────────────────

async function handleVerify(json: unknown) {
  const parsed = verifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const { email, otp } = parsed.data;

  // Rate-limit OTP guesses (best-effort).
  const rl = await rateLimit(`rl:otp-verify:${email}`, 5, 600, true);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 }
    );
  }

  // Verify OTP against the signed cookie.
  if (!verifyOtpCookie("login", email, otp)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }
  clearOtpCookie("login");

  const vendor = await prisma.vendor.findUnique({ where: { email } });
  if (!vendor || vendor.deletionRequestedAt) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  setVendorSession(vendor.phone);

  // Grant admin session if phone is in ADMIN_PHONES.
  const adminPhones = (process.env.ADMIN_PHONES ?? "")
    .split(",").map((p) => p.trim()).filter(Boolean);
  if (adminPhones.includes(vendor.phone)) {
    setAdminSession();
  }

  return NextResponse.json({ ok: true });
}

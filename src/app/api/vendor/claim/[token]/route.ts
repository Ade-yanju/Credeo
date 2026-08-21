import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseCommunity } from "@/lib/community";
import { createSoloOrganizationForVendor, trialEndsAt } from "@/lib/tenant";
import { setVendorSession } from "@/lib/session";
import { linkProspectToVendor } from "@/lib/acquisition";

const VENDOR_TYPES = ["PROVISION_SHOP", "FOOD_CANTEEN", "LAUNDRY", "PRINTING", "BARBING_SALON", "HAIR_SALON", "PHARMACY", "MINI_MART", "OTHER"] as const;
const claimSchema = z.object({
  vendorType: z.enum(VENDOR_TYPES),
  location: z.string().trim().min(3).max(200),
  community: z.string().trim().min(2).max(200),
  password: z.string().min(8).max(128),
});

async function findClaim(token: string) {
  return prisma.vendorProspect.findUnique({ where: { claimToken: token } });
}

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const prospect = await findClaim(params.token);
  if (!prospect || prospect.claimedAt || prospect.claimTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "This claim link is invalid, expired, or has already been used." }, { status: 410 });
  }
  return NextResponse.json({
    prospect: { ownerName: prospect.ownerName, businessName: prospect.businessName, phone: prospect.phone, email: prospect.email },
  });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = claimSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid onboarding details." }, { status: 400 });
  const prospect = await findClaim(params.token);
  if (!prospect || prospect.claimedAt || prospect.claimTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "This claim link is invalid, expired, or has already been used." }, { status: 410 });
  }

  const conflict = await prisma.vendor.findFirst({ where: { OR: [{ phone: prospect.phone }, { email: prospect.email }] }, select: { id: true } });
  if (conflict) return NextResponse.json({ error: "An account already exists for this phone number or email. Please sign in." }, { status: 409 });

  const communityMeta = parseCommunity(parsed.data.community);
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const vendor = await prisma.$transaction(async (tx) => {
    const claimed = await tx.vendorProspect.updateMany({
      where: { id: prospect.id, claimedAt: null, claimTokenExpiresAt: { gt: new Date() } },
      data: { claimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("CLAIM_UNAVAILABLE");
    const community = await tx.community.upsert({
      where: { name: communityMeta.name }, update: {},
      create: { name: communityMeta.name, shortName: communityMeta.shortName ?? null, city: communityMeta.city, state: communityMeta.state, status: "PILOT" },
    });
    const vendor = await tx.vendor.create({
      data: {
        businessName: prospect.businessName, ownerName: prospect.ownerName, phone: prospect.phone, email: prospect.email,
        passwordHash, vendorType: parsed.data.vendorType, location: parsed.data.location, communityId: community.id, status: "ACTIVE",
        subscription: { create: { plan: "STARTER", status: "TRIAL", trialEndsAt: trialEndsAt(), monthlyAmount: 2000 } },
      },
    });
    await tx.vendorProspect.update({ where: { id: prospect.id }, data: { claimedVendorId: vendor.id } });
    return vendor;
  }).catch((err) => {
    if (err instanceof Error && err.message === "CLAIM_UNAVAILABLE") return null;
    throw err;
  });
  if (!vendor) return NextResponse.json({ error: "This claim link has already been used or expired." }, { status: 410 });

  await createSoloOrganizationForVendor(vendor);
  // Claim links issued from Acquisition do not carry a public prospect id. Match
  // only on the verified contact data stored in the one-time invite.
  const acquisitionProspect = await prisma.acquisitionProspect.findFirst({
    where: { OR: [{ phone: prospect.phone }, { email: prospect.email }], convertedVendorId: null },
    orderBy: { createdAt: "desc" }, select: { id: true },
  });
  if (acquisitionProspect) {
    await linkProspectToVendor(acquisitionProspect.id, vendor.id).catch((err) =>
      console.error("[vendor-claim] acquisition link failed:", err)
    );
  }
  setVendorSession(vendor.phone);
  return NextResponse.json({ ok: true, vendorId: vendor.id });
}

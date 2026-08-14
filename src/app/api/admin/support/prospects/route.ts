import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/utils";

const schema = z.object({
  ownerName: z.string().trim().min(2).max(100),
  businessName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
});

/** Customer Care creates a claimable prospect; it is not yet a vendor account. */
export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "CUSTOMER_CARE"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid prospect details." }, { status: 400 });
  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  const existing = await prisma.vendor.findFirst({
    where: { OR: [{ phone }, { email: parsed.data.email }] },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "A vendor account already uses this phone number or email." }, { status: 409 });

  const openProspect = await prisma.vendorProspect.findFirst({
    where: { OR: [{ phone }, { email: parsed.data.email }], claimedAt: null },
    select: { claimTokenExpiresAt: true },
  });
  if (openProspect) return NextResponse.json({ error: "An unclaimed invite already exists for this phone number or email." }, { status: 409 });

  const claimToken = crypto.randomBytes(32).toString("hex");
  const prospect = await prisma.vendorProspect.create({
    data: {
      ...parsed.data,
      phone,
      claimToken,
      claimTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdByAdminId: session.id,
    },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vodiumledger.com";
  return NextResponse.json({
    ok: true,
    prospect: { id: prospect.id, claimUrl: `${appUrl}/claim/${claimToken}`, expiresAt: prospect.claimTokenExpiresAt },
  }, { status: 201 });
}

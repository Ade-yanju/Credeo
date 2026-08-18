import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ACQUISITION_OPERATORS } from "@/lib/acquisition";
import { normalisePhone } from "@/lib/utils";

const vendorSelect = { id: true, businessName: true, phone: true, email: true } as const;

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(ACQUISITION_OPERATORS as readonly string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const phoneInput = req.nextUrl.searchParams.get("phone")?.trim();
  const emailInput = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const phone = phoneInput ? normalisePhone(phoneInput) : null;
  if (phoneInput && !phone) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  if (!phone && !emailInput && !query) return NextResponse.json({ error: "Provide a phone number, email address, or business name." }, { status: 400 });

  const exact = phone || emailInput
    ? await prisma.vendor.findMany({
        where: { OR: [...(phone ? [{ phone }] : []), ...(emailInput ? [{ email: emailInput }] : [])] },
        select: vendorSelect,
        take: 10,
      })
    : [];
  if (exact.length || !query) return NextResponse.json({ vendors: exact });

  const vendors = await prisma.vendor.findMany({
    where: { businessName: { contains: query, mode: "insensitive" } },
    select: vendorSelect,
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ vendors });
}

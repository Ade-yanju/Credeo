import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/utils";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { sendStaffInviteEmail } from "@/lib/email/staff-invite";

const INVITE_TTL_MS = 7 * 86_400_000; // 7 days

const inviteSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().trim().email().max(255).toLowerCase(),
  phone: z.string().min(7).max(20),
  branchId: z.string().optional(),
  role: z.enum(["HQ_ADMIN", "BRANCH_MANAGER", "BRANCH_STAFF", "FINANCE", "AUDITOR"]).default("BRANCH_STAFF"),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ members: [] });

  const members = await prisma.organizationMembership.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      vendor: { select: { id: true, ownerName: true, email: true, phone: true, status: true, inviteToken: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      vendorId: m.vendorId,
      name: m.vendor.ownerName,
      email: m.vendor.email,
      phone: m.vendor.phone,
      role: m.role,
      branchId: m.branchId,
      branchName: m.branch?.name ?? null,
      pending: Boolean(m.vendor.inviteToken) || m.vendor.status !== "ACTIVE",
    })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json();
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const organizationId = ctx.organizationId!;
  const phone = normalisePhone(data.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  // Resolve and authorize the target branch.
  const branchId = data.branchId ?? null;
  if (branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId } });
    if (!branch) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const loginUrl = `${appUrl}/login`;
  const orgName = ctx.organization?.name ?? "your organization";
  const branchName = branchId
    ? ctx.organization?.branches.find((b) => b.id === branchId)?.name ?? null
    : null;

  try {
    const existing = await prisma.vendor.findFirst({
      where: { OR: [{ email: data.email }, { phone }] },
      include: { organization: { select: { id: true, type: true } } },
    });

    let acceptUrl: string | null = null;
    let membershipId: string;
    let invitedVendorId: string;

    if (existing) {
      // Only allow attaching accounts that are unaffiliated or solo vendors.
      const belongsElsewhere =
        existing.organizationId &&
        existing.organizationId !== organizationId &&
        existing.organization?.type !== "SOLO_VENDOR";
      if (belongsElsewhere) {
        return NextResponse.json(
          { error: "This person already belongs to another organization." },
          { status: 409 }
        );
      }
      if (existing.email !== data.email) {
        return NextResponse.json(
          { error: "This phone number is already registered to a different email." },
          { status: 409 }
        );
      }

      const membership = await prisma.$transaction(async (tx) => {
        await tx.vendor.update({
          where: { id: existing.id },
          data: { organizationId, branchId },
        });
        return tx.organizationMembership.upsert({
          where: { organizationId_vendorId: { organizationId, vendorId: existing.id } },
          update: { branchId, role: data.role },
          create: { organizationId, vendorId: existing.id, branchId, role: data.role },
        });
      });

      membershipId = membership.id;
      invitedVendorId = existing.id;
      // Existing active account — no password step needed.
      acceptUrl = existing.status === "ACTIVE" ? null : buildAcceptUrl(appUrl, await issueToken(existing.id));
    } else {
      // Create a brand-new inactive staff account that must set a password.
      const token = crypto.randomBytes(24).toString("base64url");
      const placeholder = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
      const created = await prisma.$transaction(async (tx) => {
        const vendor = await tx.vendor.create({
          data: {
            businessName: orgName,
            ownerName: data.name,
            phone,
            email: data.email,
            passwordHash: placeholder,
            vendorType: "OTHER",
            communityId: ctx.vendor.communityId,
            organizationId,
            branchId,
            status: "INACTIVE",
            inviteToken: token,
            inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
          },
        });
        const membership = await tx.organizationMembership.create({
          data: { organizationId, vendorId: vendor.id, branchId, role: data.role },
        });
        return { vendor, membership };
      });
      membershipId = created.membership.id;
      invitedVendorId = created.vendor.id;
      acceptUrl = buildAcceptUrl(appUrl, token);
    }

    await sendStaffInviteEmail({
      to: data.email,
      staffName: data.name,
      organizationName: orgName,
      branchName,
      role: data.role,
      acceptUrl,
      loginUrl,
    }).catch((err) => console.error("[tenant/members] invite email failed:", err));

    await writeAudit({
      actorType: "vendor",
      actorId: ctx.vendor.id,
      action: "member.invited",
      entityType: "OrganizationMembership",
      entityId: membershipId,
      metadata: { organizationId, invitedVendorId, email: data.email, role: data.role, branchId },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, membershipId, pending: Boolean(acceptUrl) }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message.includes("Unique")
      ? "This email or phone is already registered."
      : "Could not invite the staff member.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function issueToken(vendorId: string): Promise<string> {
  const token = crypto.randomBytes(24).toString("base64url");
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { inviteToken: token, inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return token;
}

function buildAcceptUrl(appUrl: string, token: string): string {
  return `${appUrl}/staff/accept?token=${encodeURIComponent(token)}`;
}

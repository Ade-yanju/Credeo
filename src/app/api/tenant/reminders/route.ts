import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";

const schema = z.object({
  preDueRemindersEnabled: z.boolean().optional(),
  overdueRemindersEnabled: z.boolean().optional(),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId || !ctx.organization) {
    return NextResponse.json({ preDueRemindersEnabled: true, overdueRemindersEnabled: true });
  }
  return NextResponse.json({
    preDueRemindersEnabled: ctx.organization.preDueRemindersEnabled,
    overdueRemindersEnabled: ctx.organization.overdueRemindersEnabled,
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Only the owner or an admin can change reminder settings." }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const updated = await prisma.organization.update({
    where: { id: ctx.organizationId! },
    data: {
      ...(data.preDueRemindersEnabled !== undefined ? { preDueRemindersEnabled: data.preDueRemindersEnabled } : {}),
      ...(data.overdueRemindersEnabled !== undefined ? { overdueRemindersEnabled: data.overdueRemindersEnabled } : {}),
    },
    select: { preDueRemindersEnabled: true, overdueRemindersEnabled: true },
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "reminders.settings_updated",
    entityType: "Organization",
    entityId: ctx.organizationId!,
    metadata: { changes: data },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, ...updated });
}

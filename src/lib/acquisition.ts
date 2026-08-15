import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const ACQUISITION_OPERATORS = ["SUPER_ADMIN", "MARKETING"] as const;
export const ACQUISITION_READERS = ["SUPER_ADMIN", "MARKETING", "ANALYTICS", "CFO"] as const;
export const TERMINAL_ACQUISITION_STAGES = ["LOST", "UNQUALIFIED", "WON"] as const;
export const ACTIVE_ACQUISITION_STAGES = [
  "IDENTIFIED", "CONTACTED", "RESPONDED", "QUALIFIED", "DEMO_SCHEDULED",
  "DEMO_COMPLETED", "ONBOARDING", "ACTIVATED",
] as const;

type RegistrationPayload = { prospectId: string; expiresAt: number };

function acquisitionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required for acquisition registration links");
  }
  return secret ?? "dev-only-secret-change-me-before-production";
}

export function signAcquisitionRegistrationToken(prospectId: string): string {
  const payload: RegistrationPayload = { prospectId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", acquisitionSecret())
    .update("v1:acquisition-registration:" + encoded, "utf8").digest("base64url");
  return encoded + "." + signature;
}

export function verifyAcquisitionRegistrationToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 1) return null;
    const encoded = token.slice(0, dot);
    const received = token.slice(dot + 1);
    const expected = crypto.createHmac("sha256", acquisitionSecret())
      .update("v1:acquisition-registration:" + encoded, "utf8").digest("base64url");
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as RegistrationPayload;
    return payload.prospectId && payload.expiresAt >= Date.now() ? payload.prospectId : null;
  } catch {
    return null;
  }
}

export function acquisitionRegistrationUrl(prospectId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + "/register?acq=" + encodeURIComponent(signAcquisitionRegistrationToken(prospectId));
}

const STAGE_TIMESTAMPS: Partial<Record<string, string>> = {
  CONTACTED: "contactedAt", RESPONDED: "respondedAt", QUALIFIED: "qualifiedAt",
  DEMO_SCHEDULED: "demoScheduledAt", DEMO_COMPLETED: "demoCompletedAt",
  ONBOARDING: "onboardingStartedAt", ACTIVATED: "activatedAt", WON: "wonAt", LOST: "lostAt",
};

export function stageTimestampPatch(stage: string, now = new Date()) {
  const field = STAGE_TIMESTAMPS[stage];
  return field ? { [field]: now } : {};
}

export async function linkProspectToVendor(prospectId: string, vendorId: string, actorId?: string | null) {
  const now = new Date();
  const prospect = await prisma.acquisitionProspect.findUnique({ where: { id: prospectId } });
  if (!prospect) throw new Error("Prospect not found");
  if (prospect.convertedVendorId && prospect.convertedVendorId !== vendorId) {
    throw new Error("This prospect is already linked to another vendor");
  }
  return prisma.$transaction(async (tx) => {
    const stage = prospect.stage === "WON" || prospect.stage === "ACTIVATED" ? prospect.stage : "ONBOARDING";
    const updated = await tx.acquisitionProspect.update({
      where: { id: prospectId },
      data: { convertedVendorId: vendorId, convertedAt: prospect.convertedAt ?? now, stage, onboardingStartedAt: prospect.onboardingStartedAt ?? now },
    });
    await tx.acquisitionActivity.create({
      data: { prospectId, type: "SYSTEM_SYNC", outcome: "Vendor linked through registration or confirmed admin match", stageFrom: prospect.stage, stageTo: stage, createdByAdminId: actorId ?? null },
    });
    return updated;
  });
}

// Product-driven lifecycle sync. Never reopen lost/unqualified prospects.
export async function syncProspectLifecycleForVendor(vendorId: string) {
  const prospect = await prisma.acquisitionProspect.findUnique({
    where: { convertedVendorId: vendorId },
    select: { id: true, stage: true, activatedAt: true, wonAt: true },
  });
  if (!prospect || prospect.stage === "LOST" || prospect.stage === "UNQUALIFIED") return null;
  const [firstCredit, subscription] = await Promise.all([
    prisma.credit.findFirst({ where: { vendorId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.vendorSubscription.findUnique({ where: { vendorId }, select: { status: true, updatedAt: true } }),
  ]);
  const target = firstCredit && subscription?.status === "ACTIVE" ? "WON" : firstCredit ? "ACTIVATED" : "ONBOARDING";
  if (prospect.stage === target || (prospect.stage === "WON" && target !== "WON")) return prospect;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const data = {
      stage: target,
      ...((target === "ACTIVATED" || target === "WON") ? { activatedAt: prospect.activatedAt ?? firstCredit?.createdAt ?? now } : {}),
      ...(target === "WON" ? { wonAt: prospect.wonAt ?? subscription?.updatedAt ?? now } : {}),
    };
    const updated = await tx.acquisitionProspect.update({ where: { id: prospect.id }, data });
    await tx.acquisitionActivity.create({
      data: { prospectId: prospect.id, type: "SYSTEM_SYNC", outcome: target === "WON" ? "Vendor activated and subscription became active" : "Vendor logged first credit", stageFrom: prospect.stage, stageTo: target },
    });
    return updated;
  });
}

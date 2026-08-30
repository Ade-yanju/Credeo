import crypto from "crypto";
import type { AcquisitionStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Customer care handles merchant outreach and follow-up, so it can work the
// acquisition queue while finance and analytics remain read-only.
export const ACQUISITION_OPERATORS = ["SUPER_ADMIN", "MARKETING", "CUSTOMER_CARE"] as const;
export const ACQUISITION_READERS = ["SUPER_ADMIN", "MARKETING", "CUSTOMER_CARE", "ANALYTICS", "CFO"] as const;
export const TERMINAL_ACQUISITION_STAGES = ["LOST", "UNQUALIFIED", "WON"] as const;
export const ACTIVE_ACQUISITION_STAGES = [
  "IDENTIFIED", "CONTACTED", "RESPONDED", "QUALIFIED", "DEMO_SCHEDULED",
  "DEMO_COMPLETED", "ONBOARDING", "ACTIVATED",
] as const;

export function isTerminalAcquisitionStage(stage: string) {
  return (TERMINAL_ACQUISITION_STAGES as readonly string[]).includes(stage);
}

const REGISTRATION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function acquisitionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required for acquisition registration links");
  }
  return secret ?? "dev-only-secret-change-me-before-production";
}

function registrationTokenHash(token: string) {
  return crypto.createHmac("sha256", acquisitionSecret())
    .update("v2:acquisition-registration:" + token, "utf8").digest("base64url");
}

export async function issueAcquisitionRegistrationToken(prospectId: string): Promise<string> {
  // The URL holds only an unguessable bearer value. The database retains an
  // HMAC hash, expiry, and the prospect's contacts for server-side binding.
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.acquisitionProspect.update({
    where: { id: prospectId },
    data: {
      registrationTokenHash: registrationTokenHash(token),
      registrationTokenExpiresAt: new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS),
    },
  });
  return token;
}

export function acquisitionRegistrationUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + "/register?acq=" + encodeURIComponent(token);
}

export async function registrationMatchesProspect(token: string | undefined, phone: string, email: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const prospect = await prisma.acquisitionProspect.findUnique({
    where: { registrationTokenHash: registrationTokenHash(token) },
    select: { id: true, phone: true, email: true, stage: true, registrationTokenExpiresAt: true },
  });
  if (!prospect || prospect.stage === "LOST" || prospect.stage === "UNQUALIFIED") return null;
  if (!prospect.registrationTokenExpiresAt || prospect.registrationTokenExpiresAt < new Date()) return null;
  if ((prospect.phone && prospect.phone !== phone) || (prospect.email && prospect.email !== email)) return null;
  return prospect.id;
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
  if (prospect.stage === "LOST" || prospect.stage === "UNQUALIFIED") {
    throw new Error("A lost or unqualified prospect cannot be linked without being re-qualified first");
  }
  if (prospect.convertedVendorId && prospect.convertedVendorId !== vendorId) {
    throw new Error("This prospect is already linked to another vendor");
  }
  return prisma.$transaction(async (tx) => {
    const stage = prospect.stage === "WON" || prospect.stage === "ACTIVATED" ? prospect.stage : "ONBOARDING";
    const updated = await tx.acquisitionProspect.update({
      where: { id: prospectId },
      data: {
        convertedVendorId: vendorId,
        convertedAt: prospect.convertedAt ?? now,
        stage,
        onboardingStartedAt: prospect.onboardingStartedAt ?? now,
        // A linked prospect cannot be claimed again through an old URL.
        registrationTokenHash: null,
        registrationTokenExpiresAt: null,
      },
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
  const target: AcquisitionStage = firstCredit && subscription?.status === "ACTIVE" ? "WON" : firstCredit ? "ACTIVATED" : "ONBOARDING";
  if (prospect.stage === target || (prospect.stage === "WON" && target !== "WON")) return prospect;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const data = {
      stage: target,
      ...((target === "ACTIVATED" || target === "WON") ? { activatedAt: prospect.activatedAt ?? firstCredit?.createdAt ?? now } : {}),
      ...(target === "WON" ? { wonAt: prospect.wonAt ?? subscription?.updatedAt ?? now } : {}),
      ...(target === "WON" ? { nextActionType: null, nextActionAt: null, nextActionNote: null } : {}),
    };
    const updated = await tx.acquisitionProspect.update({ where: { id: prospect.id }, data });
    await tx.acquisitionActivity.create({
      data: { prospectId: prospect.id, type: "SYSTEM_SYNC", outcome: target === "WON" ? "Vendor activated and subscription became active" : "Vendor logged first credit", stageFrom: prospect.stage, stageTo: target },
    });
    return updated;
  });
}

import { prisma } from "@/lib/prisma";
import { assessAcquisitionProspect } from "@/lib/ai";

export async function qualifyAcquisitionProspect(id: string, adminId?: string | null) {
  const prospect = await prisma.acquisitionProspect.findUnique({ where: { id } });
  if (!prospect || prospect.stage !== "IDENTIFIED") return "skipped" as const;
  const assessment = await assessAcquisitionProspect(prospect);
  if (!assessment) return "unavailable" as const;
  const notes = [`AI review: ${assessment.reasons.join(" ")}`, `Suggested next step: ${assessment.suggestedNextAction}`].join("\n").slice(0, 2000);
  await prisma.$transaction([
    prisma.acquisitionProspect.update({ where: { id }, data: { vendorType: assessment.vendorType, fit: assessment.fit, priority: assessment.priority, fitNotes: notes } }),
    prisma.acquisitionActivity.create({ data: { prospectId: id, type: "SYSTEM_SYNC", outcome: "AI qualification completed", body: notes, createdByAdminId: adminId ?? null } }),
  ]);
  return "qualified" as const;
}

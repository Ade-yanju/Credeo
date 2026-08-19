import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPhone } from "@/lib/session";
import { entitlementDenied } from "@/lib/entitlement-guard";
import type { CreditStatus, RepaymentMethod, ScoreEventType } from "@prisma/client";

// GET /api/credits/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { phone } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const credit = await prisma.credit.findFirst({
    where: { id: params.id, vendorId: vendor.id },
    include: { student: true, repayments: { orderBy: { receivedAt: "desc" } } },
  });
  if (!credit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(credit);
}

const patchSchema = z.object({
  repaymentAmount: z.number().positive().optional(),
  repaymentMethod: z.string().optional(),
  status:          z.string().optional(), // for write-off
  notes:           z.string().max(300).optional(),
});

// PATCH /api/credits/[id] — record repayment or update status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const phone = getSessionPhone();
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Subscription comes along because entitlement here depends on the PAYLOAD,
  // not the route: this one endpoint both records money received and writes
  // credit off. See the action decision after parsing below.
  const vendor = await prisma.vendor.findUnique({
    where: { phone },
    include: { subscription: true },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const credit = await prisma.credit.findFirst({
    where: { id: params.id, vendorId: vendor.id },
  });
  if (!credit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { repaymentAmount, repaymentMethod, status, notes } = parsed.data;

  // One endpoint, two very different actions. Recording money a customer paid
  // survives a lapsed trial; writing credit off is a credit decision and does
  // not (see ALLOWED_WHEN_LOCKED in lib/entitlement.ts).
  const denied = entitlementDenied(
    vendor.subscription,
    status && !repaymentAmount ? "credit.update" : "repayment.create"
  );
  if (denied) return denied;

  // Handle write-off or manual status change (no repayment)
  if (status && !repaymentAmount) {
    const updated = await prisma.credit.update({
      where: { id: credit.id },
      data: { status: status as CreditStatus, notes: notes ?? credit.notes },
      include: { student: true },
    });
    if (status === "WRITTEN_OFF") {
      await updateScore(credit.studentId, vendor.id, credit.id, "WRITTEN_OFF", Number(credit.amount), -120);
    }
    return NextResponse.json(updated);
  }

  if (!repaymentAmount) {
    return NextResponse.json({ error: "repaymentAmount is required" }, { status: 400 });
  }

  // Create repayment record
  await prisma.repayment.create({
    data: {
      creditId: credit.id,
      amount: repaymentAmount,
      method: (repaymentMethod as RepaymentMethod) ?? "CASH",
      notes: notes ?? null,
    },
  });

  const totalRepaid = Number(credit.amountRepaid) + repaymentAmount;
  const totalOwed = Number(credit.amount);
  const isPaidFull = totalRepaid >= totalOwed;

  // Determine new status and score event
  let newStatus: CreditStatus;
  let scoreEventType: ScoreEventType;
  let scoreDelta: number;

  if (isPaidFull) {
    const now = new Date();
    const isLate = now > new Date(credit.dueDate);
    newStatus = "PAID";
    scoreEventType = isLate ? "PAID_LATE" : "PAID_ON_TIME";
    scoreDelta = isLate ? -15 : +25;
  } else {
    newStatus = "PARTIALLY_PAID";
    scoreEventType = "PAID_PARTIAL";
    scoreDelta = +5;
  }

  const [updated] = await Promise.all([
    prisma.credit.update({
      where: { id: credit.id },
      data: {
        amountRepaid: totalRepaid,
        status: newStatus,
        ...(isPaidFull ? { closedAt: new Date() } : {}),
      },
      include: { student: true },
    }),
    updateScore(credit.studentId, vendor.id, credit.id, scoreEventType, repaymentAmount, scoreDelta),
  ]);

  return NextResponse.json(updated);
}

async function updateScore(
  studentId: string,
  vendorId: string,
  creditId: string,
  eventType: ScoreEventType,
  amount: number,
  delta: number
) {
  const [, student] = await Promise.all([
    prisma.creditScoreEvent.create({
      data: { studentId, vendorId, creditId, eventType, amount, scoreDelta: delta },
    }),
    prisma.student.findUnique({ where: { id: studentId } }),
  ]);
  if (!student) return;
  const newScore = Math.max(0, Math.min(1000, student.vodiumScore + delta));
  await prisma.student.update({
    where: { id: studentId },
    data: { vodiumScore: newScore, scoreUpdatedAt: new Date() },
  });
}

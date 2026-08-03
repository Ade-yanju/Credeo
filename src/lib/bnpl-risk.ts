/**
 * Vodium Ledger — BNPL risk / credit-limit controls.
 *
 * The core financial safeguard: gate self-service BNPL requests so one customer
 * can't rack up unlimited or oversized exposure, especially first-timers, and
 * block customers who already have a default. Stores still approve manually —
 * this is the automatic guardrail beneath that.
 *
 * Tunable via env (all optional, sensible defaults):
 *   BNPL_MAX_ORDER            default 50000  — max single order (₦)
 *   BNPL_FIRST_ORDER_MAX      default 20000  — max first-ever order for a new customer (₦)
 *   BNPL_MAX_EXPOSURE         default 100000 — max total outstanding per customer per store (₦)
 *   BNPL_MAX_OPEN_ORDERS      default 5      — max concurrent unpaid orders per customer per store
 *   BNPL_VELOCITY_PER_DAY     default 3      — max new requests per 24h per customer
 */

import { prisma } from "@/lib/prisma";

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export type BnplRiskResult = {
  allowed: boolean;
  reason?: string;
  score: number;
  outstanding: number;
  openOrders: number;
  hasDefault: boolean;
  isNewCustomer: boolean;
  /**
   * Advisory only — an AI reading of repayment behaviour, shown to the vendor
   * to help a manual approval decision. It NEVER changes `allowed`: the rules
   * above are the safety gate, and a model must not be able to talk the system
   * into extending credit the deterministic limits refused.
   */
  aiInsight?: { score: number; reasons: string[] };
};

export async function assessBnplRisk(input: {
  organizationId: string;
  studentId: string;
  amount: number;
}): Promise<BnplRiskResult> {
  const { organizationId, studentId, amount } = input;
  const MAX_ORDER = num("BNPL_MAX_ORDER", 50_000);
  const FIRST_ORDER_MAX = num("BNPL_FIRST_ORDER_MAX", 20_000);
  const MAX_EXPOSURE = num("BNPL_MAX_EXPOSURE", 100_000);
  const MAX_OPEN_ORDERS = num("BNPL_MAX_OPEN_ORDERS", 5);
  const VELOCITY_PER_DAY = num("BNPL_VELOCITY_PER_DAY", 3);
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [student, credits, openOrders, recentOrders, everPaid] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { vodiumScore: true } }),
    prisma.credit.findMany({
      where: { organizationId, studentId, status: { in: ["OUTSTANDING", "DUE_SOON", "OVERDUE", "PARTIALLY_PAID"] } },
      select: { amount: true, amountRepaid: true, status: true },
    }),
    prisma.bnplOrder.count({ where: { organizationId, studentId, status: { in: ["DRAFT", "ACTIVE", "PARTIALLY_PAID", "OVERDUE"] } } }),
    prisma.bnplOrder.count({ where: { organizationId, studentId, createdAt: { gte: dayAgo } } }),
    prisma.bnplOrder.count({ where: { organizationId, studentId, status: { in: ["ACTIVE", "PARTIALLY_PAID", "PAID"] } } }),
  ]);

  const score = student?.vodiumScore ?? 500;
  const outstanding = credits.reduce((s, c) => s + (Number(c.amount) - Number(c.amountRepaid)), 0);
  const hasDefault = credits.some((c) => c.status === "OVERDUE");
  const isNewCustomer = everPaid === 0;

  const base = { score, outstanding, openOrders, hasDefault, isNewCustomer };

  if (amount <= 0) return { allowed: false, reason: "Invalid amount.", ...base };
  if (amount > MAX_ORDER) return { allowed: false, reason: `Orders above ₦${MAX_ORDER.toLocaleString()} must be arranged in-store.`, ...base };
  if (hasDefault) return { allowed: false, reason: "There's an overdue balance on this number. Please clear it first.", ...base };
  if (isNewCustomer && amount > FIRST_ORDER_MAX) {
    return { allowed: false, reason: `First orders are limited to ₦${FIRST_ORDER_MAX.toLocaleString()}.`, ...base };
  }
  if (outstanding + amount > MAX_EXPOSURE) {
    return { allowed: false, reason: "This would exceed the credit limit on this number.", ...base };
  }
  if (openOrders >= MAX_OPEN_ORDERS) {
    return { allowed: false, reason: "You have too many open orders. Please settle some first.", ...base };
  }
  if (recentOrders >= VELOCITY_PER_DAY) {
    return { allowed: false, reason: "Too many requests today. Please try again tomorrow.", ...base };
  }

  return { allowed: true, ...base };
}

/**
 * Optional AI reading of a customer's repayment behaviour, for a vendor who is
 * deciding whether to approve manually.
 *
 * Deliberately NOT part of assessBnplRisk: that function is the safety gate and
 * must stay fast, deterministic, and impossible for a model to influence. This
 * is a separate, advisory call — returns null when AI is unavailable.
 */
export async function explainCustomerRisk(input: {
  organizationId: string;
  studentId: string;
}): Promise<{ score: number; reasons: string[] } | null> {
  const [student, credits] = await Promise.all([
    prisma.student.findUnique({
      where: { id: input.studentId },
      select: { fullName: true },
    }),
    prisma.credit.findMany({
      where: { organizationId: input.organizationId, studentId: input.studentId },
      select: { amount: true, amountRepaid: true, status: true, dueDate: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);
  if (!student || !credits.length) return null;

  const { suggestRiskScore } = await import("@/lib/ai");
  const totalOwed = credits.reduce(
    (s, c) => s + Math.max(0, Number(c.amount) - Number(c.amountRepaid)),
    0,
  );

  return suggestRiskScore({
    customerName: student.fullName,
    totalOwed,
    history: credits.map((c) => ({
      date: c.createdAt.toISOString().slice(0, 10),
      amount: Number(c.amount),
      status:
        c.status === "PAID"
          ? "PAID"
          : c.status === "OVERDUE"
            ? "OVERDUE"
            : "UNPAID",
    })),
  });
}

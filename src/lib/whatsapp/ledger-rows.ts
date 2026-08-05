/**
 * Vodium Ledger — pure helpers for the handwritten-book import.
 *
 * Split out from ledger-import.ts deliberately: that module talks to Prisma and
 * the WhatsApp API, and the invariant suite must be able to test these rules
 * without a database. Nothing here may import prisma.
 */

export interface StagedRow {
  customerName: string;
  amountOwed: number;
  note?: string;
}

/**
 * A phone-shaped key that can never be dialled or messaged.
 *
 * `pending:` is the repo-wide convention for "customer with no real number"
 * (see src/app/api/credits/route.ts) and every send path already filters on
 * that exact prefix — reminders cron, credit-lifecycle, invoice-lifecycle,
 * customer-verify. Changing this prefix silently starts sending debt reminders
 * to a non-number, so it must stay in lockstep with those filters.
 *
 * The random suffix rather than the `pending:${Date.now()}` used elsewhere:
 * Student.phone is unique, and a bulk import creates rows inside a single
 * millisecond, so a timestamp alone collides and drops every row after the
 * first.
 */
export function makePlaceholderPhone(): string {
  return `pending:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Narrow the raw session-context blob back into staged rows.
 *
 * The rows round-trip through JSON in the WhatsApp session, so what comes back
 * is untrusted input — a partial write or an older shape must yield nothing
 * rather than become a debt on someone's record.
 */
export function parseStagedRows(value: unknown): StagedRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      customerName: String(r.customerName ?? "").trim(),
      amountOwed: Number(r.amountOwed ?? 0),
      note: typeof r.note === "string" ? r.note : undefined,
    }))
    .filter((r) => r.customerName.length > 0 && Number.isFinite(r.amountOwed) && r.amountOwed > 0);
}

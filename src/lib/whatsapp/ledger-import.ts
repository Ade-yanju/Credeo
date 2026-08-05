/**
 * Vodium Ledger — "the vendor photographed their handwritten book".
 *
 * Almost every informal Nigerian vendor already keeps a paper book of who owes
 * them what. Retyping months of it is the single biggest reason a vendor signs
 * up and never comes back. This reads a page of it instead.
 *
 * SAFETY MODEL — mirrors receipt-intake.ts, for the same reason:
 * an OCR read is a PROPOSAL, never a fact. Handwriting is genuinely hard to
 * read, and a misread amount here writes a wrong debt into a vendor's ledger
 * that they may never notice. So nothing is saved until the vendor sees every
 * parsed row and taps confirm, and rows the model could not read are reported
 * as a count ("I couldn't read 3 rows") rather than guessed at.
 *
 * WHY IMPORT IS EXPLICIT (vendor types IMPORT first):
 * A vendor can also be someone else's debtor, so an unprompted photo from a
 * vendor is ambiguous — it might be their book, or their own transfer receipt.
 * Requiring IMPORT first makes intent unambiguous and means an unprompted image
 * behaves exactly as it did before this feature existed.
 *
 * PHONE NUMBERS: a paper book rarely has them. Imported customers therefore get
 * a `pending:` placeholder phone — the convention already used by the dashboard
 * (src/app/api/credits/route.ts) and already filtered out of every send path
 * (reminders cron, credit-lifecycle, invoice-lifecycle, customer-verify). They
 * are real customers on the vendor's book; they simply cannot be reminded until
 * a real number is added. Synthesising a plausible +234 number instead would
 * eventually send debt reminders to a stranger.
 */

import { prisma } from "@/lib/prisma";
import { extractLedgerPage, isVisionMediaType, type LedgerPageEntry } from "@/lib/ocr";
import { downloadWhatsAppMedia } from "@/lib/whatsapp/media";
import { sendWhatsAppButtons, sendWhatsAppMessage } from "@/lib/whatsapp/outbound";
import { vendorCustomerPrefix } from "@/lib/customer-id";
import { getStudentLimit } from "@/lib/plan";
import { messages } from "@/lib/whatsapp/messages";
import { makePlaceholderPhone, type StagedRow } from "@/lib/whatsapp/ledger-rows";

// Re-exported so callers have one import site for the whole feature.
export { makePlaceholderPhone, parseStagedRows, type StagedRow } from "@/lib/whatsapp/ledger-rows";

/** Session-context key: vendor typed IMPORT and we're waiting for the photo. */
export const AWAITING_LEDGER_KEY = "awaitingLedgerPhoto";
/** Session-context key: rows parsed from the photo, awaiting confirmation. */
export const LEDGER_ROWS_KEY = "ledgerRows";

export const LEDGER_CONFIRM_ID = "LEDGER_IMPORT_YES";
export const LEDGER_CANCEL_ID = "LEDGER_IMPORT_NO";

/** Imported credits have no due date in the book — default to two weeks out. */
const DEFAULT_DUE_DAYS = 14;

/** Most books have well under this per page; a bad read must not create 200 rows. */
const MAX_ROWS_PER_PAGE = 40;

/** Start the flow: ask for the photo and remember that we're expecting one. */
export async function beginLedgerImport(
  fromPhone: string,
  creds?: { token: string; phoneId: string },
): Promise<void> {
  await sendWhatsAppMessage(fromPhone, messages.ledgerAskPhoto(), creds);
}

/**
 * Read a photographed ledger page and stage its rows for confirmation.
 *
 * Returns the rows to stage in the session, or null when we have already
 * replied and the turn should end.
 */
export async function readLedgerPhoto(input: {
  fromPhone: string;
  mediaId: string;
  creds?: { token: string; phoneId: string };
}): Promise<StagedRow[] | null> {
  const { fromPhone, mediaId, creds } = input;

  const media = await downloadWhatsAppMedia(mediaId, creds);
  if (!media) {
    await sendWhatsAppMessage(fromPhone, messages.ledgerUnreadable(), creds);
    return null;
  }

  if (!isVisionMediaType(media.mimeType)) {
    await sendWhatsAppMessage(fromPhone, messages.ledgerNotAnImage(), creds);
    return null;
  }

  const page = await extractLedgerPage({
    imageBase64: media.base64,
    mediaType: media.mimeType,
  });

  // null means OCR is switched off (no API key) — a different problem from
  // "I looked and couldn't read it", and worth saying so rather than letting
  // the vendor rephotograph the same page forever.
  if (!page) {
    await sendWhatsAppMessage(fromPhone, messages.ledgerUnavailable(), creds);
    return null;
  }

  const allEntries = page.entries;
  const rows = allEntries.slice(0, MAX_ROWS_PER_PAGE).map((e: LedgerPageEntry) => ({
    customerName: e.customerName,
    amountOwed: e.amountOwed,
    note: e.note,
  }));
  // Never drop rows silently — a vendor who cannot see that part of their page
  // was cut would assume the whole book imported.
  const dropped = Math.max(0, allEntries.length - rows.length);

  if (!rows.length) {
    await sendWhatsAppMessage(fromPhone, messages.ledgerNothingRead(), creds);
    return null;
  }

  await sendWhatsAppButtons(
    fromPhone,
    messages.ledgerConfirm(rows, page.unreadableRows, DEFAULT_DUE_DAYS, dropped),
    [
      { id: LEDGER_CONFIRM_ID, title: `Import ${rows.length} ✓` },
      { id: LEDGER_CANCEL_ID, title: "Cancel" },
    ],
    creds,
  );

  return rows;
}

export interface ImportOutcome {
  imported: number;
  skipped: number;
  /** True when the vendor's plan customer limit stopped the import short. */
  hitLimit: boolean;
  limit?: number;
}

/**
 * Create the confirmed rows as real customers and credits.
 *
 * Each row is independent: one bad row must not roll back a vendor's whole
 * book, so failures are counted and reported rather than thrown.
 */
export async function commitLedgerImport(input: {
  vendor: {
    id: string;
    businessName: string;
    phone: string;
    communityId: string | null;
    organizationId: string | null;
    branchId: string | null;
    subscription: { plan: "STARTER" | "GROWTH" | "PRO" } | null;
  };
  rows: StagedRow[];
}): Promise<ImportOutcome> {
  const { vendor, rows } = input;

  const plan = vendor.subscription?.plan ?? "STARTER";
  const limit = getStudentLimit(plan);

  // Count once up front rather than per row — the same gate the dashboard
  // applies, so an import cannot be used to slip past a plan's customer cap.
  let customerCount = await prisma.student.count({
    where: { credits: { some: { vendorId: vendor.id } } },
  });

  // nextVendorCustomerId() derives its sequence from that same count, which does
  // not move until a credit exists — calling it per row would hand every
  // imported customer an identical id. Build the ids from the prefix directly
  // and advance the counter locally instead. (Deriving the prefix by stripping
  // trailing digits off a generated id would break for a business name that is
  // itself numeric, e.g. "123 Store" → prefix "123".)
  const prefix = vendorCustomerPrefix(vendor.businessName);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DEFAULT_DUE_DAYS);

  let imported = 0;
  let skipped = 0;
  let hitLimit = false;

  for (const row of rows) {
    if (limit !== null && customerCount >= limit) {
      hitLimit = true;
      skipped += 1;
      continue;
    }

    try {
      // A placeholder that can never be dialled or messaged — see
      // makePlaceholderPhone() for why it isn't a synthesised +234 number.
      const placeholder = makePlaceholderPhone();

      const student = await prisma.student.create({
        data: {
          fullName: row.customerName,
          phone: placeholder,
          matricNumber: `${prefix}${String(customerCount + 1).padStart(3, "0")}`,
          communityId: vendor.communityId,
          organizationId: vendor.organizationId,
        },
      });

      const credit = await prisma.credit.create({
        data: {
          vendorId: vendor.id,
          organizationId: vendor.organizationId,
          branchId: vendor.branchId,
          studentId: student.id,
          amount: row.amountOwed,
          description: row.note ?? "Imported from ledger book",
          dueDate,
          status: "OUTSTANDING",
        },
      });

      await prisma.creditScoreEvent.create({
        data: {
          studentId: student.id,
          vendorId: vendor.id,
          creditId: credit.id,
          eventType: "CREDIT_EXTENDED",
          amount: row.amountOwed,
          scoreDelta: 0,
        },
      });

      imported += 1;
      customerCount += 1;
    } catch (err) {
      console.warn(
        `[ledger] could not import "${row.customerName}":`,
        err instanceof Error ? err.message : err,
      );
      skipped += 1;
    }
  }

  return { imported, skipped, hitLimit, limit: limit ?? undefined };
}


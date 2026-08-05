/**
 * Vodium Ledger — OCR via Claude vision.
 *
 * The problem this solves: customers pay by bank transfer and then send the
 * vendor a screenshot of the receipt on WhatsApp. Today a human reads that
 * screenshot and types the repayment into the ledger. This module reads it
 * instead, so the bot can propose the repayment and the vendor just confirms.
 *
 * Two entry points:
 *   extractPaymentReceipt() — bank transfer receipts / payment screenshots
 *   extractLedgerPage()     — a photo of a handwritten "who owes me" notebook,
 *                             used once during vendor onboarding
 *
 * Like ai.ts, everything degrades to null when ANTHROPIC_API_KEY is unset.
 * A null result means "could not read it" — never treat it as an error, and
 * never auto-post a repayment from a low-confidence read (see confidence).
 */

import Anthropic from "@anthropic-ai/sdk";

const VISION_MODEL = "claude-sonnet-5";

/**
 * Built on first use, never at module load.
 *
 * The Anthropic constructor throws when no API key is present, so constructing
 * it at import time takes the whole WhatsApp webhook route down with it whenever
 * ANTHROPIC_API_KEY is unset — a build-time failure ("Failed to collect page
 * data"), not a runtime one, and precisely the case this module's header
 * promises to survive by returning null.
 */
let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/** Media types Claude vision accepts. Anything else must be converted first. */
export type VisionMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export function isVisionMediaType(value: string): value is VisionMediaType {
  return value === "image/jpeg" || value === "image/png" || value === "image/gif" || value === "image/webp";
}

function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function numberFrom(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export interface PaymentReceipt {
  /** Naira amount transferred. 0 when unreadable. */
  amount: number;
  /** Who sent the money, as printed on the receipt. */
  senderName?: string;
  /** Who received it — matched against the vendor's account name. */
  recipientName?: string;
  bankName?: string;
  /** Transaction reference / session ID, used to spot duplicate submissions. */
  reference?: string;
  /** Date as printed, free-form (banks format inconsistently). */
  paidAt?: string;
  /**
   * How confident the model is that this really is a successful payment
   * receipt AND that the amount is right. Callers MUST require "high" before
   * auto-logging anything; anything less should ask the vendor to confirm.
   */
  confidence: "high" | "medium" | "low";
  /** True when the receipt shows a failed/pending/reversed transaction. */
  looksFailed: boolean;
}

/**
 * Read a bank-transfer receipt screenshot.
 *
 * Deliberately conservative: the prompt tells the model to report low
 * confidence rather than guess, because a wrongly-logged repayment silently
 * wipes a real debt from a vendor's ledger.
 */
export async function extractPaymentReceipt(input: {
  imageBase64: string;
  mediaType: VisionMediaType;
  /** Vendor's account name, when known — lets the model verify the recipient. */
  expectedRecipient?: string;
}): Promise<PaymentReceipt | null> {
  const client = getClient();
  if (!client) return null;

  const schema = {
    type: "object" as const,
    properties: {
      isPaymentReceipt: { type: "boolean" as const },
      amount: { type: "number" as const },
      senderName: { type: "string" as const },
      recipientName: { type: "string" as const },
      bankName: { type: "string" as const },
      reference: { type: "string" as const },
      paidAt: { type: "string" as const },
      confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
      looksFailed: { type: "boolean" as const },
    },
    required: ["isPaymentReceipt", "amount", "confidence", "looksFailed"],
    additionalProperties: false as const,
  };

  try {
    const response = await client.messages.parse({
      model: VISION_MODEL,
      max_tokens: 1024,
      system:
        "You read Nigerian bank transfer receipts and payment screenshots (GTBank, Opay, " +
        "Kuda, Moniepoint, PalmPay, Access, Zenith, First Bank and similar apps). " +
        "Extract only what is actually visible in the image. " +
        "Set confidence to 'high' ONLY when the image is clearly a successful transfer receipt " +
        "and the amount is unambiguous. Use 'low' if the image is blurry, cropped, edited, " +
        "not a receipt, or the amount is uncertain. " +
        "Set looksFailed to true if the receipt shows failed, pending, reversed, or declined. " +
        "Amounts are in Naira — report the number only, with no currency symbol or separators. " +
        "Never guess an amount that you cannot read.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 },
            },
            {
              type: "text",
              text: input.expectedRecipient
                ? `Read this payment receipt. The money should have been paid to "${input.expectedRecipient}" — ` +
                  "report the recipient name you actually see, and lower your confidence if it does not match."
                : "Read this payment receipt.",
            },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = extractJson<Record<string, unknown>>(text);
    if (!parsed || parsed.isPaymentReceipt !== true) return null;

    const rawConfidence = stringOrUndefined(parsed.confidence);
    const confidence: PaymentReceipt["confidence"] =
      rawConfidence === "high" || rawConfidence === "medium" ? rawConfidence : "low";

    return {
      amount: Math.max(0, numberFrom(parsed.amount)),
      senderName: stringOrUndefined(parsed.senderName),
      recipientName: stringOrUndefined(parsed.recipientName),
      bankName: stringOrUndefined(parsed.bankName),
      reference: stringOrUndefined(parsed.reference),
      paidAt: stringOrUndefined(parsed.paidAt),
      confidence,
      looksFailed: parsed.looksFailed === true,
    };
  } catch (err) {
    console.warn("[ocr] extractPaymentReceipt failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface LedgerPageEntry {
  customerName: string;
  amountOwed: number;
  note?: string;
}

/**
 * Read a photo of a handwritten credit notebook — the "book" almost every
 * informal Nigerian vendor already keeps. Used at onboarding so a vendor does
 * not have to retype months of records to start using the app.
 *
 * Handwriting is genuinely hard to read, so entries come back for review; the
 * caller must show them to the vendor for confirmation before saving.
 */
export async function extractLedgerPage(input: {
  imageBase64: string;
  mediaType: VisionMediaType;
}): Promise<null | { entries: LedgerPageEntry[]; unreadableRows: number }> {
  const client = getClient();
  if (!client) return null;

  const schema = {
    type: "object" as const,
    properties: {
      entries: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            customerName: { type: "string" as const },
            amountOwed: { type: "number" as const },
            note: { type: "string" as const },
          },
          required: ["customerName", "amountOwed"],
          additionalProperties: false as const,
        },
      },
      unreadableRows: { type: "number" as const },
    },
    required: ["entries", "unreadableRows"],
    additionalProperties: false as const,
  };

  try {
    const response = await client.messages.parse({
      model: VISION_MODEL,
      max_tokens: 4096,
      system:
        "You read photos of handwritten credit ledgers kept by Nigerian shop owners. " +
        "Each row is usually a customer name and an amount owed in Naira, sometimes with an item note. " +
        "Extract only rows you can genuinely read. Count rows you cannot read confidently in " +
        "unreadableRows instead of guessing at them. Never invent a name or an amount.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 },
            },
            { type: "text", text: "Read every customer and amount owed from this ledger page." },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = extractJson<Record<string, unknown>>(text);
    if (!parsed) return null;

    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
          .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
          .map((e) => ({
            customerName: String(e.customerName ?? "").trim(),
            amountOwed: Math.max(0, numberFrom(e.amountOwed)),
            note: stringOrUndefined(e.note),
          }))
          .filter((e) => e.customerName.length > 0 && e.amountOwed > 0)
      : [];

    return { entries, unreadableRows: Math.max(0, Math.round(numberFrom(parsed.unreadableRows))) };
  } catch (err) {
    console.warn("[ocr] extractLedgerPage failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

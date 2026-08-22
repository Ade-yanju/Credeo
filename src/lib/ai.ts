/**
 * Vodium Ledger — shared Claude AI layer.
 *
 * All LLM calls in the app go through this module. Every function degrades
 * gracefully when ANTHROPIC_API_KEY is unset (dev, or before the key is
 * provisioned): the caller gets a `null` result and keeps its existing
 * deterministic behaviour, exactly as if the AI layer did not exist.
 *
 * Callers must NEVER treat a null result as an error — it is the designed
 * "AI not available" path, and the rest of the system already has a
 * deterministic fallback for every one of these helpers (see nlu.ts,
 * bnpl-risk.ts, messages.ts).
 */

import Anthropic from "@anthropic-ai/sdk";

/** Model for structured NLU + risk + OCR. Fast and cost-effective. */
const CHEAP_MODEL = "claude-sonnet-5";
/** Model for open-ended copy (reminder wording, vendor digests). */
const COPY_MODEL = "claude-opus-5";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? undefined });

function enabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Turn an LLM text response into a typed JSON result, tolerating the ways
 * models wrap JSON (``` fences, leading prose, trailing whitespace).
 */
function extractJson<T>(text: string, fallback: T): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = match ? match[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}

function assertObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFrom(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Classify a public business listing for acquisition. This is advisory only:
 * it never contacts a prospect, creates an account, or changes pipeline stage.
 */
export async function assessAcquisitionProspect(input: {
  businessName: string;
  locationText?: string | null;
  city?: string | null;
  state?: string | null;
  sourceDetail?: string | null;
}): Promise<null | {
  vendorType: "PROVISION_SHOP" | "FOOD_CANTEEN" | "LAUNDRY" | "PRINTING" | "BARBING_SALON" | "HAIR_SALON" | "PHARMACY" | "MINI_MART" | "OTHER";
  fit: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED";
  priority: "LOW" | "NORMAL" | "HIGH";
  reasons: string[];
  suggestedNextAction: string;
}> {
  if (!enabled()) return null;
  const schema = {
    type: "object" as const,
    properties: {
      vendorType: { type: "string" as const, enum: ["PROVISION_SHOP", "FOOD_CANTEEN", "LAUNDRY", "PRINTING", "BARBING_SALON", "HAIR_SALON", "PHARMACY", "MINI_MART", "OTHER"] },
      fit: { type: "string" as const, enum: ["HIGH", "MEDIUM", "LOW", "UNQUALIFIED"] },
      priority: { type: "string" as const, enum: ["LOW", "NORMAL", "HIGH"] },
      reasons: { type: "array" as const, items: { type: "string" as const } },
      suggestedNextAction: { type: "string" as const },
    },
    required: ["vendorType", "fit", "priority", "reasons", "suggestedNextAction"],
    additionalProperties: false as const,
  };
  try {
    const response = await client.messages.parse({
      model: CHEAP_MODEL, max_tokens: 500,
      system: "You qualify public Nigerian business listings for Vodium Ledger, a ledger and credit-management product for small merchants. Be conservative: only use supplied facts; do not infer private facts or contact details. This is an advisory score for staff review, not permission to contact or create accounts.",
      messages: [{ role: "user", content: JSON.stringify(input) }],
      output_config: { format: { type: "json_schema", schema } },
    });
    const text = response.content.find((block) => block.type === "text")?.text;
    const parsed = text ? extractJson<unknown>(text, null) : null;
    if (!assertObject(parsed) || !Array.isArray(parsed.reasons)) return null;
    const vendorTypes = ["PROVISION_SHOP", "FOOD_CANTEEN", "LAUNDRY", "PRINTING", "BARBING_SALON", "HAIR_SALON", "PHARMACY", "MINI_MART", "OTHER"] as const;
    const fits = ["HIGH", "MEDIUM", "LOW", "UNQUALIFIED"] as const;
    const priorities = ["LOW", "NORMAL", "HIGH"] as const;
    if (!vendorTypes.includes(parsed.vendorType as typeof vendorTypes[number]) || !fits.includes(parsed.fit as typeof fits[number]) || !priorities.includes(parsed.priority as typeof priorities[number])) return null;
    return {
      vendorType: parsed.vendorType as typeof vendorTypes[number], fit: parsed.fit as typeof fits[number], priority: parsed.priority as typeof priorities[number],
      reasons: parsed.reasons.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 3),
      suggestedNextAction: typeof parsed.suggestedNextAction === "string" ? parsed.suggestedNextAction.trim().slice(0, 300) : "Review listing and verify contact details.",
    };
  } catch (err) {
    console.warn("[ai] assessAcquisitionProspect failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Structured extraction — with zod schemas for parse()               */
/* ------------------------------------------------------------------ */

/**
 * Parse a vendor's WhatsApp message into an ADD credit command.
 * Understands Nigerian English and Pidgin: "chidi collect 2 bread 500 naira",
 * "add credit for amara 1500", "madam dey owe 800".
 * Returns null when the message is not (or does not contain) an ADD command —
 * callers then fall back to the deterministic matcher.
 */
export async function parseAddCredit(input: {
  message: string;
}): Promise<null | {
  customerName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  amountOwed: number;
  note?: string;
}> {
  if (!enabled()) return null;

  const schema = {
    type: "object" as const,
    properties: {
      isAddCommand: { type: "boolean" as const },
      customerName: { type: "string" as const },
      items: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            quantity: { type: "number" as const },
            unitPrice: { type: "number" as const },
          },
          required: ["name", "quantity", "unitPrice"],
          additionalProperties: false as const,
        },
      },
      amountOwed: { type: "number" as const },
      note: { type: "string" as const },
    },
    required: ["isAddCommand", "customerName", "items", "amountOwed"],
    additionalProperties: false as const,
  };

  try {
    const response = await client.messages.parse({
      model: CHEAP_MODEL,
      max_tokens: 1024,
      system:
        "You parse WhatsApp messages from Nigerian campus vendors into structured credit commands. " +
        "Vendors write in lowercase, Nigerian English, and Pidgin, often without punctuation. " +
        "Return isAddCommand=false for anything that is not an instruction to record credit owed by a customer.",
      messages: [
        {
          role: "user",
          content: `Parse this vendor message into a credit command:
"${input.message}"`,
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = extractJson<unknown>(text, null) as Record<string, unknown> | null;
    if (!assertObject(parsed) || parsed.isAddCommand !== true) return null;
    const customerName = String(parsed.customerName ?? "").trim();
    if (!customerName) return null;
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter(assertObject)
          .map((it) => ({
            name: String(it.name ?? "").trim() || "Item",
            quantity: Math.max(1, Math.round(numberFrom(it.quantity, 1))),
            unitPrice: Math.max(0, numberFrom(it.unitPrice, 0)),
          }))
      : [];
    const amountOwed = Math.max(0, numberFrom(parsed.amountOwed, 0));
    if (!items.length && amountOwed <= 0) return null;
    return {
      customerName,
      items,
      amountOwed,
      note: typeof parsed.note === "string" ? parsed.note.trim() : undefined,
    };
  } catch (err) {
    console.warn("[ai] parseAddCredit failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Suggest a repayment risk score (0–100) and the reasons behind it.
 * Higher = more likely to repay on time.
 */
export async function suggestRiskScore(input: {
  customerName: string;
  history: Array<{
    date: string;
    amount: number;
    status: "PAID" | "UNPAID" | "OVERDUE";
  }>;
  totalOwed: number;
}): Promise<null | { score: number; reasons: string[] }> {
  if (!enabled()) return null;

  const schema = {
    type: "object" as const,
    properties: {
      score: { type: "number" as const },
      reasons: {
        type: "array" as const,
        items: { type: "string" as const },
      },
    },
    required: ["score", "reasons"],
    additionalProperties: false as const,
  };

  try {
    const response = await client.messages.parse({
      model: CHEAP_MODEL,
      max_tokens: 512,
      system:
        "You are a credit-scoring assistant for informal campus-vendor lending in Nigeria. " +
        "Suggest a repayment risk score from 0 (very risky) to 100 (very reliable) based on a " +
        "customer's repayment history, and 1-3 short human-readable reasons in Nigerian English. " +
        "Be conservative: informal credit with frequent late payment should score low.",
      messages: [
        {
          role: "user",
          content: `Customer: ${input.customerName}
Total currently owed: ₦${input.totalOwed}
History: ${JSON.stringify(input.history)}`,
        },
      ],
      output_config: { format: { type: "json_schema", schema } },
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = extractJson<unknown>(text, null) as Record<string, unknown> | null;
    if (!assertObject(parsed)) return null;
    const score = Math.max(0, Math.min(100, Math.round(numberFrom(parsed.score, 50))));
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r): r is string => typeof r === "string").slice(0, 3)
      : [];
    return { score, reasons };
  } catch (err) {
    console.warn("[ai] suggestRiskScore failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Open-ended copy — reminder wording + vendor digest                 */
/* ------------------------------------------------------------------ */

/**
 * Generate one friendly, respectful reminder message for a customer.
 * The copy must not shame the customer and must fit WhatsApp's character
 * limits. Returns null when AI is unavailable — callers fall back to the
 * existing static reminder copy.
 */
export async function generateReminderCopy(input: {
  customerName: string;
  shopName: string;
  amountOwed: number;
  dueText: string; // "due tomorrow" | "overdue by 2 days"
  isOverdue: boolean;
}): Promise<null | string> {
  if (!enabled()) return null;
  try {
    const response = await client.messages.create({
      model: COPY_MODEL,
      max_tokens: 300,
      system:
        "You write short WhatsApp payment reminders for a Nigerian campus vendor. " +
        "Tone: warm, respectful, never shaming. The customer is a student who simply forgot. " +
        "Write in simple Nigerian English. Keep it under 300 characters, one or two sentences, " +
        "no emoji, no ALL CAPS. Start with a greeting using the customer's first name.",
      messages: [
        {
          role: "user",
          content:
            `Remind ${input.customerName} about ₦${input.amountOwed} owed to ${input.shopName} — ` +
            `${input.dueText}.`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text?.trim();
    return text && text.length <= 600 ? text : null;
  } catch (err) {
    console.warn("[ai] generateReminderCopy failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Summarise a vendor's ledger into a short plain-text WhatsApp digest:
 * who is overdue, who is reliable, and a simple cash-flow outlook.
 * Returns null when AI is unavailable — callers omit the digest.
 */
export async function generateVendorDigest(input: {
  shopName: string;
  totalOutstanding: number;
  overdue: Array<{ name: string; amount: number; daysLate: number }>;
  recentRepayments: Array<{ name: string; amount: number }>;
}): Promise<null | string> {
  if (!enabled()) return null;
  try {
    const response = await client.messages.create({
      model: COPY_MODEL,
      max_tokens: 600,
      system:
        "You write a short weekly WhatsApp digest for a Nigerian campus vendor using the Vodium " +
        "Ledger credit tracker. Plain Nigerian English, warm but professional, 3-5 short lines, " +
        "no emoji. Mention who is overdue and roughly how much, who paid recently, and one simple " +
        "cash-flow observation. Do not invent numbers that are not provided.",
      messages: [
        {
          role: "user",
          content:
            `Shop: ${input.shopName}\nTotal outstanding: ₦${input.totalOutstanding}\n` +
            `Overdue: ${JSON.stringify(input.overdue)}\n` +
            `Recent repayments: ${JSON.stringify(input.recentRepayments)}`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text?.trim();
    return text && text.length <= 1200 ? text : null;
  } catch (err) {
    console.warn("[ai] generateVendorDigest failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

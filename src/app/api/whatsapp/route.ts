/**
 * Vodium Ledger — Meta Cloud API WhatsApp webhook
 *
 * GET  /api/whatsapp  — webhook verification (Meta hub challenge)
 * POST /api/whatsapp  — incoming message events
 *
 * Required env vars:
 *   WHATSAPP_VERIFY_TOKEN  — the string you set in Meta's Webhook configuration
 *   WHATSAPP_APP_SECRET    — your Meta App Secret (for HMAC signature check)
 *   WHATSAPP_ACCESS_TOKEN  — permanent access token (used by outbound.ts)
 *   WHATSAPP_PHONE_NUMBER_ID — phone number ID from Meta dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma";
import { getRedis } from "../../../lib/redis";
import { computeScore } from "../../../lib/credit-score/score";
import { nextVendorCustomerId } from "../../../lib/customer-id";
import { formatNaira, normalisePhone } from "../../../lib/utils";
import { getOrCreateCustomerForVendor, roundMoney } from "../../../lib/bnpl";
import { signInvoiceToken } from "../../../lib/bnpl-token";
import { messages } from "../../../lib/whatsapp/messages";
import { sendTypingIndicator, sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppMessage, type WhatsAppButton } from "../../../lib/whatsapp/outbound";
import { getOrgChannelCredentials } from "../../../lib/whatsapp/channel-token";
import { contactPhoneFrom } from "../../../lib/whatsapp/contact";
import { parseCommunity } from "../../../lib/community";
import { createSoloOrganizationForVendor, trialEndsAt } from "../../../lib/tenant";
import {
  step,
  friendlyDueText,
  reminderPromiseForDue,
  type SessionContext,
  type SideEffect,
} from "../../../lib/whatsapp/state-machine";
import {
  getCustomerScorePreview,
  sendCustomerVerification,
  vendorKnowsCustomer,
  verifyVerification,
  maskPhone,
} from "../../../lib/customer-verify";
import type { WhatsAppState } from "@prisma/client";

export const runtime = "nodejs";

// ── Meta webhook payload types ────────────────────────────────────────────────

interface MetaTextMessage {
  from:      string;   // E.164 without "+"
  id:        string;
  timestamp: string;
  type:      "text" | "interactive" | "contacts" | string;
  text?:     { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?:   { id: string; title: string };
  };
  // Sent when a user shares a phone contact (📎 → Contact). Lets a vendor pick
  // the debtor from their address book instead of typing the number.
  contacts?: Array<{
    name?:  { formatted_name?: string };
    phones?: Array<{ phone?: string; wa_id?: string }>;
  }>;
}

interface MetaWebhook {
  object: string;
  entry:  Array<{
    id:      string;
    changes: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: MetaTextMessage[];
        statuses?: unknown[];
      };
    }>;
  }>;
}

// ── GET — webhook verification ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    // Return the challenge as plain text — Meta requires this exact response.
    return new NextResponse(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST — incoming messages ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Always return 200 to Meta — any non-200 causes retries and webhook suspension.
  // All errors are caught and logged; we never let an exception escape this handler.

  const rawBody = await req.text();

  // ── HMAC signature check ────────────────────────────────────────────────────
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
    const expected  = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    // Constant-time compare (both same length — SHA256 hex is always 64 chars + "sha256=")
    const a = Buffer.from(sigHeader.padEnd(expected.length, "\0"));
    const b = Buffer.from(expected.padEnd(sigHeader.length, "\0"));
    const maxLen = Math.max(a.length, b.length);
    const aBuf = Buffer.alloc(maxLen); a.copy(aBuf);
    const bBuf = Buffer.alloc(maxLen); b.copy(bBuf);
    if (!crypto.timingSafeEqual(aBuf, bBuf) || a.length !== b.length) {
      console.error("[whatsapp] HMAC signature mismatch — check WHATSAPP_APP_SECRET in Vercel env vars");
      // Still return 200 so Meta doesn't suspend the webhook, but don't process
      return NextResponse.json({ ok: true });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed: without the app secret we cannot verify Meta's signature, so
    // refuse to process (prevents forged webhook events driving the bot).
    console.error("[whatsapp] WHATSAPP_APP_SECRET not set in production — rejecting unverifiable webhook");
    return NextResponse.json({ ok: true });
  } else {
    console.warn("[whatsapp] WHATSAPP_APP_SECRET not set — skipping signature check (dev only).");
  }

  // ── Parse payload ───────────────────────────────────────────────────────────
  let payload: MetaWebhook;
  try {
    payload = JSON.parse(rawBody) as MetaWebhook;
  } catch {
    console.error("[whatsapp] Failed to parse webhook JSON");
    return NextResponse.json({ ok: true });
  }

  // ── Extract message ─────────────────────────────────────────────────────────
  const change  = payload.entry?.[0]?.changes?.[0];
  const value   = change?.value;
  const message = value?.messages?.[0];
  const phoneNumberId = value?.metadata?.phone_number_id;

  // Text messages carry a body; button taps arrive as "interactive" replies whose
  // id we treat exactly like typed text (e.g. tapping [Add credit] sends "ADD").
  // A shared contact card becomes its phone number, so at any "what's the
  // number?" step a vendor can pick the debtor from their contacts instead of
  // typing — the phone-parsing steps strip non-digits anyway.
  const rawText =
    message?.type === "text"
      ? message.text?.body
      : message?.type === "interactive"
        ? message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id
        : message?.type === "contacts"
          ? contactPhoneFrom(message.contacts)
          : undefined;

  // Silently ack status updates, delivery receipts, unsupported media, etc.
  if (!message || !rawText?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const fromPhone   = `+${message.from}`;   // Meta sends without "+", normalise to E.164
  const messageText = rawText.trim();

  console.log(`[whatsapp] ← ${fromPhone}: "${messageText}"`);

  // Meta retries a delivery it thinks failed (including when we simply replied
  // slowly), re-sending the SAME message id. Without this guard a retry replays
  // the whole turn — which can log a credit or send an invoice twice.
  if (await isDuplicateMessage(message.id)) {
    console.log(`[whatsapp] duplicate ${message.id} ignored`);
    return NextResponse.json({ ok: true });
  }

  // ── Process message (wrapped so errors never escape) ────────────────────────
  try {
    // These two don't depend on each other — run them together rather than
    // paying two sequential round-trips before the bot can even start thinking.
    const [channel, vendorByPhone] = await Promise.all([
      phoneNumberId
        ? prisma.whatsAppChannel.findUnique({
            where: { phoneNumberId },
            select: { id: true, organizationId: true, status: true },
          })
        : Promise.resolve(null),
      prisma.vendor.findUnique({ where: { phone: fromPhone } }),
      // Self-heal: an inbound message PROVES this number can reach us. Clear a
      // stale unreachable flag (they unblocked the bot, or it was set by a
      // transient Meta error) so their reminders resume. No-op for everyone else.
      prisma.student.updateMany({
        where: { phone: fromPhone, whatsappBlockedAt: { not: null } },
        data: { whatsappBlockedAt: null },
      }),
    ]);

    // Reply from the store's own WhatsApp number when this message arrived on a
    // store channel; otherwise fall back to the global Vodium number.
    const [credsRaw, session] = await Promise.all([
      getOrgChannelCredentials(channel?.organizationId),
      prisma.whatsAppSession.upsert({
        where:  { phone: fromPhone },
        update: {
          lastInteractionAt: new Date(),
          ...(channel ? { channelId: channel.id, organizationId: channel.organizationId } : {}),
        },
        create: {
          phone: fromPhone,
          state: "IDLE",
          context: {},
          ...(channel ? { channelId: channel.id, organizationId: channel.organizationId } : {}),
        },
      }),
    ]);
    const creds = credsRaw ?? undefined;

    // Mark the message read and show "typing…" while we think — the reply
    // replaces it. Cosmetic, so it must never block or fail the turn.
    void sendTypingIndicator(message.id, creds);

    // Resolve vendor — restrict BOT to registered vendors only. The by-phone
    // lookup above already covers the common case, so only re-query when the
    // session is linked to a different vendor id.
    const vendor =
      session.vendorId && session.vendorId !== vendorByPhone?.id
        ? await prisma.vendor.findUnique({ where: { id: session.vendorId } })
        : vendorByPhone;

    if (!vendor) {
      // Any reply from a customer counts as "responded" — mark their open
      // reminded credits so the escalation sweep leaves them alone. Cheap and
      // fire-and-forget; never block the reply on it.
      prisma.credit.updateMany({
        where: { student: { phone: fromPhone }, reminderSentAt: { not: null }, reminderRespondedAt: null, status: { in: ["OUTSTANDING", "DUE_SOON", "OVERDUE"] } },
        data: { reminderRespondedAt: new Date() },
      }).catch((err) => console.error("[whatsapp] responded-stamp failed:", err));

      // Customers replying "PAID" to a reminder raise a claim — the vendor must
      // confirm before the credit is actually marked paid. (CLAIM_PAID is the
      // reminder button's id — unambiguous even for vendor-debtors.)
      const claimHandled = await handleCustomerPaidClaim(
        fromPhone,
        messageText.trim().toUpperCase() === "CLAIM_PAID" ? "PAID" : messageText,
        creds
      );
      if (claimHandled) return NextResponse.json({ ok: true });

      // "Not my credit" opens a dispute for customer care to attend to.
      const disputeHandled = await handleCustomerDispute(fromPhone, messageText, creds);
      if (disputeHandled) return NextResponse.json({ ok: true });

      console.log(`[whatsapp] Rejected: unregistered user ${fromPhone}`);
      await sendWhatsAppMessage(
        fromPhone,
        "You are not registered as a vendor on Vodium Ledger. Please sign up at vodiumledger.com or contact support.",
        creds
      );
      return NextResponse.json({ ok: true });
    }

    // A vendor can also be someone's DEBTOR ("anybody can be a debtor"). From
    // them, a bare "PAID" is ambiguous: settling their own credit vs marking a
    // customer of theirs paid. Buttons on reminders carry the unambiguous
    // CLAIM_PAID id; a typed bare PAID gets a two-button question instead of
    // silently opening their debtor list (the bug this replaced).
    let effectiveText = messageText;
    const upperMsg = messageText.trim().toUpperCase();
    if (upperMsg === "CLAIM_PAID") {
      const claimHandled = await handleCustomerPaidClaim(fromPhone, "PAID", creds);
      if (claimHandled) return NextResponse.json({ ok: true });
      effectiveText = "PAID"; // no personal debt after all — vendor command
    } else if (upperMsg === "PAID_CMD") {
      effectiveText = "PAID"; // explicit "a customer paid me"
    } else if (upperMsg === "PAID" && session.state === "IDLE") {
      const ownDebt = await prisma.credit.findFirst({
        where: { student: { phone: fromPhone }, status: { in: [...OPEN_CREDIT_STATUSES] } },
        select: { id: true },
      });
      if (ownDebt) {
        await sendWhatsAppButtons(fromPhone, messages.paidWhichRole(), [
          { id: "CLAIM_PAID", title: "I paid my debt" },
          { id: "PAID_CMD", title: "Customer paid me" },
        ], creds);
        return NextResponse.json({ ok: true });
      }
    }

    // Run state machine
    const sessionCtx: SessionContext = {
      state:    session.state,
      context:  (session.context as Record<string, unknown>) ?? {},
      vendorId: vendor?.id,
    };

    const result = step(sessionCtx, { body: effectiveText, fromPhone });

    // Persist updated session
    const mergedContext = { ...sessionCtx.context, ...(result.contextPatch ?? {}) };
    await prisma.whatsAppSession.update({
      where: { phone: fromPhone },
      data: {
        state:   result.nextState,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context: mergedContext as any,
        vendorId: vendor?.id,
        ...(channel ? { channelId: channel.id, organizationId: channel.organizationId } : {}),
      },
    });

    // Side effects
    let finalReply     = result.reply;
    let finalButtons   = result.buttons;
    let finalList      = result.list;
    let linkedVendorId = vendor?.id;
    let stateOverride: WhatsAppState | undefined;
    let contextOverride: Record<string, unknown> | undefined;

    if (result.sideEffects?.length) {
      for (const effect of result.sideEffects) {
        const r = await runSideEffect(effect, fromPhone, vendor?.id, mergedContext);
        if (r.replyOverride !== undefined) {
          finalReply   = r.replyOverride;
          finalButtons = r.buttonsOverride;
          finalList    = undefined;
        }
        if (r.newVendorId)        linkedVendorId  = r.newVendorId;
        if (r.stateOverride)      stateOverride   = r.stateOverride;
        if (r.contextPatchOverride) contextOverride = { ...(contextOverride ?? {}), ...r.contextPatchOverride };
      }
      if (linkedVendorId && linkedVendorId !== vendor?.id) {
        await prisma.whatsAppSession.update({
          where: { phone: fromPhone },
          data:  { vendorId: linkedVendorId },
        });
      }
      // A side effect can redirect the conversation (e.g. into verification).
      if (stateOverride || contextOverride) {
        await prisma.whatsAppSession.update({
          where: { phone: fromPhone },
          data: {
            ...(stateOverride ? { state: stateOverride } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            context: { ...mergedContext, ...(contextOverride ?? {}) } as any,
          },
        });
      }
    }

    console.log(`[whatsapp] → ${fromPhone}: "${finalReply.slice(0, 80)}..."`);

    // Send reply (with a tappable list or buttons when the step provides them)
    if (finalList) {
      await sendWhatsAppList(fromPhone, finalReply, finalList.buttonText, finalList.rows, creds);
    } else if (finalButtons?.length) {
      await sendWhatsAppButtons(fromPhone, finalReply, finalButtons, creds);
    } else {
      await sendWhatsAppMessage(fromPhone, finalReply, creds);
    }

  } catch (err) {
    console.error("[whatsapp] Error processing message from", fromPhone, ":", err);
    // Never leave the vendor at a dead end. An error reply with no next action
    // is the moment people give up on the bot, so always offer a way forward —
    // retrying the thing they were doing, or falling back to the menu.
    try {
      await sendWhatsAppButtons(
        fromPhone,
        "Sorry — something went wrong on my side. Nothing was lost.\n\nTap below to try again.",
        [
          { id: "ADD",  title: "Add credit" },
          { id: "LIST", title: "Who's owing" },
          { id: "HELP", title: "Menu" },
        ],
        // No org credentials in scope here — the platform number is the right
        // sender for an error reply regardless of which channel it arrived on.
      );
    } catch (sendErr) {
      console.error("[whatsapp] Failed to send fallback message:", sendErr);
    }
  }

  // Always 200 so Meta doesn't retry or suspend the webhook
  return NextResponse.json({ ok: true });
}

/**
 * True if this Meta message id has already been handled.
 *
 * Fails OPEN: if Redis is unavailable we process the message rather than drop
 * a real vendor's credit. That trades a rare duplicate for never losing work.
 */
async function isDuplicateMessage(messageId: string | undefined): Promise<boolean> {
  if (!messageId) return false;
  const redis = getRedis();
  if (!redis) return false;
  try {
    // NX = only set if absent; the first caller wins and everyone else is a dupe.
    const first = await redis.set(`wa:msg:${messageId}`, "1", { nx: true, ex: 600 });
    return first === null;
  } catch (err) {
    console.error("[whatsapp] dedup check failed (processing anyway):", err);
    return false;
  }
}

// ── side-effect executor ──────────────────────────────────────────────────────

interface SideEffectResult {
  replyOverride?: string;
  /** Buttons attached to the overriding reply (ignored without replyOverride). */
  buttonsOverride?: WhatsAppButton[];
  newVendorId?:   string;
  /** Redirect the conversation to a new state (e.g. into customer verification). */
  stateOverride?: WhatsAppState;
  /** Merge extra keys into the persisted session context. */
  contextPatchOverride?: Record<string, unknown>;
}

const OPEN_CREDIT_STATUSES = ["OUTSTANDING", "DUE_SOON", "OVERDUE", "PARTIALLY_PAID"] as const;

const ADD_AGAIN_BUTTONS: WhatsAppButton[] = [
  { id: "ADD",  title: "Add another" },
  { id: "LIST", title: "Who's owing" },
];

/** Creates the credit, its score event and the vendor notification. Shared by the
 *  direct path and the post-verification path. */
async function finalizeCredit(input: {
  vendorId: string;
  vendor: { organizationId: string | null; branchId: string | null };
  studentId: string;
  customerName: string;
  amount: number;
  dueInMinutes: number;
  remindersEnabled: boolean;
}) {
  const dueDate = new Date(Date.now() + input.dueInMinutes * 60_000);
  await prisma.credit.create({
    data: {
      vendorId: input.vendorId,
      organizationId: input.vendor.organizationId,
      branchId: input.vendor.branchId,
      studentId: input.studentId,
      amount: input.amount,
      dueDate,
      status: "OUTSTANDING",
      remindersEnabled: input.remindersEnabled,
    },
  });
  await prisma.creditScoreEvent.create({
    data: { studentId: input.studentId, vendorId: input.vendorId, eventType: "CREDIT_EXTENDED", amount: input.amount, scoreDelta: 0 },
  });
  await prisma.notification.create({
    data: {
      vendorId: input.vendorId,
      title: "New Credit Added",
      message: `₦${Number(input.amount).toLocaleString()} credit recorded for ${input.customerName} via WhatsApp.`,
      type: "INFO",
    },
  });
}

/** Clears the pending-verification keys from the session context. */
const CLEAR_PENDING_VERIFY = {
  pvHmac: null, pvExpiresAt: null, pvPhone: null, pvMasked: null, pvNew: null,
  pcName: null, pcAmount: null, pcDue: null, pcReminders: null,
} as const;

/** Marks a credit fully paid: repayment, score event, score update, vendor notification. */
async function settleCredit(
  credit: { id: string; amount: unknown; dueDate: Date; student: { id: string; fullName: string; vodiumScore: number | null } },
  vendorId: string
): Promise<{ customerName: string; amount: number }> {
  const amount   = Number(credit.amount);
  const customer = credit.student;
  const now      = new Date();
  const paidOnTime = now <= credit.dueDate;
  const scoreDelta = paidOnTime ? 25 : -15;
  const eventType  = paidOnTime ? "PAID_ON_TIME" : ("PAID_LATE" as const);

  await prisma.credit.update({ where: { id: credit.id }, data: { status: "PAID", amountRepaid: amount, closedAt: now } });
  await prisma.repayment.create({ data: { creditId: credit.id, amount, method: "CASH", receivedAt: now, recordedBy: vendorId } });
  await prisma.creditScoreEvent.create({ data: { studentId: customer.id, vendorId, creditId: credit.id, eventType, amount, scoreDelta } });
  const newScore = Math.min(1000, Math.max(0, (customer.vodiumScore ?? 500) + scoreDelta));
  await prisma.student.update({ where: { id: customer.id }, data: { vodiumScore: newScore, scoreUpdatedAt: now } });

  await prisma.notification.create({
    data: {
      vendorId,
      title: "Credit Paid",
      message: `${customer.fullName} paid ₦${amount.toLocaleString()} via WhatsApp.`,
      type: "SUCCESS",
    },
  });

  return { customerName: customer.fullName, amount };
}

/**
 * A customer (not a vendor) says a credit isn't theirs — open a dispute for the
 * admin queue. Nothing is decided here: customer care reviews it. Because the
 * Vodium score is shared across shops, this is the customer's route to recourse.
 * Returns false when the sender isn't a known customer / isn't disputing.
 */
async function handleCustomerDispute(
  fromPhone: string,
  text: string,
  creds?: { token: string; phoneId: string }
): Promise<boolean> {
  const upper = text.trim().toUpperCase();
  const tapped = upper.match(/^DISPUTE_([\w-]+)$/);
  const typed = ["NOT MINE", "NOT MY CREDIT", "DISPUTE", "NOT ME"].includes(upper);
  if (!tapped && !typed) return false;

  const student = await prisma.student.findUnique({ where: { phone: fromPhone } });
  if (!student) return false;

  // Resolve which credit. A tapped button carries its id; a typed message only
  // works when there's exactly one open credit to point at.
  let credit;
  if (tapped) {
    credit = await prisma.credit.findFirst({
      // Scope to THIS customer so a guessed id can't dispute someone else's credit.
      where: { id: tapped[1], studentId: student.id },
      include: { vendor: { select: { id: true, businessName: true, phone: true, organizationId: true } } },
    });
    if (!credit) {
      await sendWhatsAppMessage(fromPhone, messages.disputeNothingToDispute(), creds);
      return true;
    }
  } else {
    const open = await prisma.credit.findMany({
      where: { studentId: student.id, status: { in: [...OPEN_CREDIT_STATUSES] } },
      include: { vendor: { select: { id: true, businessName: true, phone: true, organizationId: true } } },
      take: 2,
    });
    if (!open.length) {
      await sendWhatsAppMessage(fromPhone, messages.disputeNothingToDispute(), creds);
      return true;
    }
    if (open.length > 1) {
      await sendWhatsAppMessage(fromPhone, messages.disputePickFromReminder(), creds);
      return true;
    }
    credit = open[0];
  }

  const existing = await prisma.dispute.findFirst({
    where: { creditId: credit.id, studentId: student.id, status: { in: ["OPEN", "IN_REVIEW"] } },
    select: { id: true },
  });
  if (existing) {
    await sendWhatsAppMessage(fromPhone, messages.disputeAlreadyOpen(), creds);
    return true;
  }

  const amount = Number(credit.amount);
  await prisma.dispute.create({
    data: {
      creditId: credit.id,
      studentId: student.id,
      vendorId: credit.vendor.id,
      organizationId: credit.organizationId,
      reason: tapped ? "Customer tapped 'Not my credit' on a reminder." : `Customer replied: "${text.trim()}"`,
      status: "OPEN",
    },
  });

  // Pause reminders while it's under review — don't chase someone over a credit
  // they say isn't theirs.
  await prisma.credit.update({ where: { id: credit.id }, data: { remindersEnabled: false } });

  await prisma.notification.create({
    data: {
      vendorId: credit.vendor.id,
      title: "Credit Disputed",
      message: `${student.fullName} says the ₦${amount.toLocaleString()} you recorded is not theirs. Vodium is reviewing it.`,
      type: "WARNING",
    },
  });

  const vendorCreds = (await getOrgChannelCredentials(credit.vendor.organizationId)) ?? undefined;
  try {
    await sendWhatsAppMessage(credit.vendor.phone, messages.disputeToVendor(student.fullName, amount), vendorCreds);
  } catch (err) {
    console.error("[whatsapp] Failed to notify vendor of dispute:", err);
  }

  await sendWhatsAppMessage(fromPhone, messages.disputeAckToCustomer(credit.vendor.businessName, amount), creds);
  return true;
}

/**
 * A customer (not a vendor) replied "PAID" — raise a claim with every vendor
 * holding an open credit for them. Nothing is marked paid here: each vendor
 * gets a tappable Confirm/Not-received prompt and the ledger only changes
 * when they confirm. Returns false when the sender isn't a known customer.
 */
async function handleCustomerPaidClaim(
  fromPhone: string,
  text: string,
  creds?: { token: string; phoneId: string }
): Promise<boolean> {
  const upper = text.trim().toUpperCase();
  if (upper !== "PAID" && !upper.startsWith("PAID ")) return false;

  const student = await prisma.student.findUnique({ where: { phone: fromPhone } });
  if (!student) return false;

  const credits = await prisma.credit.findMany({
    where: { studentId: student.id, status: { in: [...OPEN_CREDIT_STATUSES] } },
    include: { vendor: { select: { id: true, businessName: true, phone: true, organizationId: true } } },
    orderBy: { dueDate: "asc" },
  });

  if (!credits.length) {
    await sendWhatsAppMessage(fromPhone, messages.claimNoCredit(), creds);
    return true;
  }

  const vendorNames: string[] = [];
  for (const credit of credits) {
    const amount = Number(credit.amount);
    if (!vendorNames.includes(credit.vendor.businessName)) vendorNames.push(credit.vendor.businessName);

    await prisma.notification.create({
      data: {
        vendorId: credit.vendor.id,
        title: "Payment Claim",
        message: `${student.fullName} says they've paid ₦${amount.toLocaleString()}. Confirm on WhatsApp once you receive it.`,
        type: "INFO",
      },
    });

    const vendorCreds = (await getOrgChannelCredentials(credit.vendor.organizationId)) ?? undefined;
    try {
      await sendWhatsAppButtons(
        credit.vendor.phone,
        messages.claimToVendor(student.fullName, amount),
        [
          { id: `CONFIRM_PAID_${credit.id}`, title: "Confirm received ✓" },
          { id: `NOT_PAID_${credit.id}`,     title: "Not received" },
        ],
        vendorCreds
      );
    } catch (err) {
      console.error("[whatsapp] Failed to notify vendor of payment claim:", err);
    }
  }

  await sendWhatsAppMessage(fromPhone, messages.claimAckToCustomer(vendorNames), creds);
  return true;
}

async function runSideEffect(
  effect:    SideEffect,
  fromPhone: string,
  vendorId?: string,
  sessionContext: Record<string, unknown> = {}
): Promise<SideEffectResult> {
  switch (effect.type) {

    case "CREATE_VENDOR": {
      const { name, businessName, communityName, phone } = effect.data;
      const normalPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const existing    = await prisma.vendor.findUnique({ where: { phone: normalPhone } });
      if (existing) return { newVendorId: existing.id };

      const communityMeta    = parseCommunity(communityName);
      const community = await prisma.community.upsert({
        where:  { name: communityMeta.name },
        update: {},
        create: { name: communityMeta.name, shortName: communityMeta.shortName ?? null, city: communityMeta.city, state: communityMeta.state, status: "PILOT" },
      });

      const placeholderEmail = `${normalPhone.replace("+", "")}@wa.vodiumledger.com`;
      const placeholderHash  = `$2a$12$whatsapp${crypto.randomBytes(16).toString("hex")}`;
      const subscriptionTrialEndsAt = trialEndsAt();

      const newVendor = await prisma.vendor.create({
        data: {
          ownerName: name, businessName, phone: normalPhone,
          email: placeholderEmail, passwordHash: placeholderHash,
          communityId: community.id, vendorType: "OTHER", status: "ACTIVE",
          subscription: { create: { plan: "STARTER", status: "TRIAL", trialEndsAt: subscriptionTrialEndsAt, monthlyAmount: 2000 } },
        },
      });
      await createSoloOrganizationForVendor(newVendor);
      return { newVendorId: newVendor.id };
    }

    case "SAVE_BANK": {
      const { bankName, accountNumber, accountName } = effect.data;
      await prisma.vendor.update({
        where: { id: effect.data.vendorId },
        data: { bankName, bankAccountNumber: accountNumber, bankAccountName: accountName },
      });
      return {}; // the state machine already sent the confirmation
    }

    case "SCORE_PREVIEW": {
      // Warn the vendor about the customer's cross-vendor reliability before they
      // decide the amount. Only overrides the prompt when the customer is known.
      const preview = await getCustomerScorePreview({
        phone: effect.data.customerPhone,
        name: effect.data.customerName,
      });
      if (!preview?.found) return {};
      return {
        replyOverride: messages.addCreditAskAmountWithScore(effect.data.customerName, preview.warning),
        buttonsOverride: [{ id: "CANCEL", title: "Cancel" }],
      };
    }

    case "CREATE_CREDIT": {
      if (!vendorId) return {};
      const { customerName, customerPhone, amount, dueInMinutes, remindersEnabled } = effect.data;
      const normalCustomerPhone = normalisePhone(customerPhone);
      if (!normalCustomerPhone) {
        return {
          replyOverride: "That customer phone number is not valid. Please restart with ADD and enter a valid WhatsApp number.", buttonsOverride: [{ id: "ADD", title: "Try again" }] as WhatsAppButton[],
        };
      }
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { businessName: true, communityId: true, organizationId: true, branchId: true },
      });

      // Anyone can be a debtor, including another shop's vendor — the only
      // number we refuse is the vendor's OWN (you don't owe yourself).
      if (normalCustomerPhone === fromPhone) {
        return {
          replyOverride: "That's your own number 🙂 — you can't log a credit against yourself. Send the customer's WhatsApp number.",
          buttonsOverride: [{ id: "ADD", title: "Try again" }] as WhatsAppButton[],
        };
      }

      const existingCustomer = await prisma.student.findUnique({
        where: { phone: normalCustomerPhone },
      });

      // Send a code to the customer's own WhatsApp before attaching:
      //  • existing customer at a NEW shop — mandatory, protects their shared
      //    record (no skip);
      //  • brand-new number — proves the number is real and its owner is
      //    present, but the vendor may skip: verification must never block
      //    logging a credit (15-second rule).
      // Repeat customers at this shop skip codes entirely.
      const isNewCustomer = !existingCustomer;
      const needsCode = isNewCustomer || !(await vendorKnowsCustomer(vendorId, existingCustomer.id));
      if (needsCode) {
        let challenge;
        try {
          challenge = await sendCustomerVerification({ phone: normalCustomerPhone, storeName: vendor?.businessName ?? "the shop" });
        } catch (err) {
          console.error("[whatsapp] customer verification send failed:", err);
          return { replyOverride: messages.verifyDeliveryFailed(), buttonsOverride: [{ id: "ADD", title: "Try again" }] as WhatsAppButton[] };
        }
        const masked = maskPhone(normalCustomerPhone);
        return {
          // "console" channel = nothing actually reached the customer (no OTP
          // template + no open 24h session). Saying "code sent" here is how
          // vendors end up waiting on a code that never arrives — tell them
          // what to do instead. The challenge is still stored, so once the
          // customer opens a chat, Resend delivers.
          replyOverride: challenge.channel !== "whatsapp"
            ? messages.verifyCantReach(masked)
            : isNewCustomer
              ? messages.verifyNewAskCode(masked)
              : messages.verifyAskCode(masked),
          buttonsOverride: isNewCustomer
            ? [{ id: "RESEND", title: "Resend code" }, { id: "SKIP_VERIFY", title: "Save without code" }, { id: "CANCEL", title: "Cancel" }]
            : [{ id: "RESEND", title: "Resend code" }, { id: "CANCEL", title: "Cancel" }],
          stateOverride: "VERIFYING_CUSTOMER",
          contextPatchOverride: {
            pvHmac: challenge.hmac, pvExpiresAt: challenge.expiresAt, pvPhone: normalCustomerPhone, pvMasked: masked,
            pvNew: isNewCustomer,
            pcName: customerName, pcAmount: amount, pcDue: dueInMinutes, pcReminders: remindersEnabled,
          },
        };
      }

      // No verification needed: a repeat customer at this shop.
      const generatedCustomerId = await nextVendorCustomerId(vendorId, vendor?.businessName ?? "Customer");
      let customer = existingCustomer;
      if (existingCustomer) {
        if (!existingCustomer.matricNumber) {
          customer = await prisma.student.update({
            where: { id: existingCustomer.id },
            data: { matricNumber: generatedCustomerId },
          });
        }
      } else {
        customer = await prisma.student.create({
          data: {
            fullName: customerName,
            phone: normalCustomerPhone,
            matricNumber: generatedCustomerId,
            communityId: vendor?.communityId ?? null,
            organizationId: vendor?.organizationId ?? null,
          },
        });
      }
      if (!customer || !vendor) return {};

      await finalizeCredit({
        vendorId,
        vendor: { organizationId: vendor.organizationId, branchId: vendor.branchId },
        studentId: customer.id,
        customerName,
        amount,
        dueInMinutes,
        remindersEnabled,
      });

      return {}; // state machine already sent the "✅ Saved" confirmation
    }

    case "VERIFY_CUSTOMER_CODE": {
      if (!vendorId) return { replyOverride: messages.noVendorAccount() };
      const phone = String(sessionContext.pvPhone ?? "");
      const hmac = String(sessionContext.pvHmac ?? "");
      const expiresAt = Number(sessionContext.pvExpiresAt ?? 0);

      if (!phone || !hmac || !verifyVerification(phone, effect.data.code, expiresAt, hmac)) {
        return {
          replyOverride: messages.verifyBadCode(),
          buttonsOverride: [{ id: "RESEND", title: "Resend code" }, { id: "CANCEL", title: "Cancel" }],
          stateOverride: "VERIFYING_CUSTOMER",
        };
      }

      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { businessName: true, communityId: true, organizationId: true, branchId: true },
      });
      let customer = await prisma.student.findUnique({ where: { phone } });
      // A brand-new debtor has no record until their number is confirmed —
      // create it now, verified.
      if (!customer && vendor && sessionContext.pvNew === true) {
        customer = await prisma.student.create({
          data: {
            fullName: String(sessionContext.pcName ?? "Customer"),
            phone,
            matricNumber: await nextVendorCustomerId(vendorId, vendor.businessName),
            communityId: vendor.communityId ?? null,
            organizationId: vendor.organizationId ?? null,
          },
        });
      }
      if (!vendor || !customer) {
        return { replyOverride: "Sorry, I couldn't complete that. Please try *ADD* again.", buttonsOverride: [{ id: "ADD", title: "Try again" }] as WhatsAppButton[], stateOverride: "IDLE", contextPatchOverride: { ...CLEAR_PENDING_VERIFY } };
      }

      if (!customer.matricNumber) {
        await prisma.student.update({
          where: { id: customer.id },
          data: { matricNumber: await nextVendorCustomerId(vendorId, vendor.businessName) },
        });
      }

      const amount = Number(sessionContext.pcAmount ?? 0);
      const dueInMinutes = Number(sessionContext.pcDue ?? 0);
      const remindersEnabled = sessionContext.pcReminders !== false;

      await finalizeCredit({
        vendorId,
        vendor: { organizationId: vendor.organizationId, branchId: vendor.branchId },
        studentId: customer.id,
        customerName: customer.fullName,
        amount,
        dueInMinutes,
        remindersEnabled,
      });

      const reply = messages.addCreditConfirmed(
        customer.fullName,
        amount,
        friendlyDueText(dueInMinutes),
        remindersEnabled ? reminderPromiseForDue(dueInMinutes) : messages.noReminderPromise(),
      );
      return {
        replyOverride: `✅ Verified.\n\n${reply}`,
        buttonsOverride: ADD_AGAIN_BUTTONS,
        stateOverride: "IDLE",
        contextPatchOverride: { ...CLEAR_PENDING_VERIFY },
      };
    }

    case "RESEND_CUSTOMER_CODE": {
      const phone = String(sessionContext.pvPhone ?? "");
      if (!phone) {
        return { replyOverride: "That request expired. Please start again with *ADD*.", buttonsOverride: [{ id: "ADD", title: "Add credit" }] as WhatsAppButton[], stateOverride: "IDLE", contextPatchOverride: { ...CLEAR_PENDING_VERIFY } };
      }
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId ?? "" }, select: { businessName: true } });
      const resendButtons: WhatsAppButton[] = sessionContext.pvNew === true
        ? [{ id: "RESEND", title: "Resend code" }, { id: "SKIP_VERIFY", title: "Save without code" }, { id: "CANCEL", title: "Cancel" }]
        : [{ id: "RESEND", title: "Resend code" }, { id: "CANCEL", title: "Cancel" }];
      try {
        const challenge = await sendCustomerVerification({ phone, storeName: vendor?.businessName ?? "the shop" });
        return {
          replyOverride: challenge.channel === "whatsapp"
            ? messages.verifyResent(maskPhone(phone))
            : messages.verifyCantReach(maskPhone(phone)),
          buttonsOverride: resendButtons,
          stateOverride: "VERIFYING_CUSTOMER",
          contextPatchOverride: { pvHmac: challenge.hmac, pvExpiresAt: challenge.expiresAt },
        };
      } catch (err) {
        console.error("[whatsapp] resend verification failed:", err);
        return { replyOverride: messages.verifyDeliveryFailed(), buttonsOverride: resendButtons.slice(1), stateOverride: "VERIFYING_CUSTOMER" };
      }
    }

    case "SKIP_VERIFY": {
      // Save without the customer's code — offered ONLY for a brand-new
      // debtor. Re-checked here (never trusted from the button id alone): an
      // existing customer's shared record must not be joinable code-free.
      if (!vendorId) return { replyOverride: messages.noVendorAccount() };
      if (sessionContext.pvNew !== true) {
        return {
          replyOverride: messages.verifyBadCode(),
          buttonsOverride: [{ id: "RESEND", title: "Resend code" }, { id: "CANCEL", title: "Cancel" }] as WhatsAppButton[],
          stateOverride: "VERIFYING_CUSTOMER",
        };
      }
      const phone = String(sessionContext.pvPhone ?? "");
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { businessName: true, communityId: true, organizationId: true, branchId: true },
      });
      if (!phone || !vendor) {
        return { replyOverride: "That request expired. Please start again with *ADD*.", buttonsOverride: [{ id: "ADD", title: "Add credit" }] as WhatsAppButton[], stateOverride: "IDLE", contextPatchOverride: { ...CLEAR_PENDING_VERIFY } };
      }

      // The number may have been claimed since the flow started — re-check
      // rather than blindly create (unique constraint on phone).
      let customer = await prisma.student.findUnique({ where: { phone } });
      if (!customer) {
        customer = await prisma.student.create({
          data: {
            fullName: String(sessionContext.pcName ?? "Customer"),
            phone,
            matricNumber: await nextVendorCustomerId(vendorId, vendor.businessName),
            communityId: vendor.communityId ?? null,
            organizationId: vendor.organizationId ?? null,
          },
        });
      }

      const amount = Number(sessionContext.pcAmount ?? 0);
      const dueInMinutes = Number(sessionContext.pcDue ?? 0);
      const remindersEnabled = sessionContext.pcReminders !== false;
      await finalizeCredit({
        vendorId,
        vendor: { organizationId: vendor.organizationId, branchId: vendor.branchId },
        studentId: customer.id,
        customerName: customer.fullName,
        amount,
        dueInMinutes,
        remindersEnabled,
      });

      const confirm = messages.addCreditConfirmed(
        customer.fullName,
        amount,
        friendlyDueText(dueInMinutes),
        remindersEnabled ? reminderPromiseForDue(dueInMinutes) : messages.noReminderPromise(),
      );
      return {
        replyOverride: `${messages.savedUnverified()}\n\n${confirm}`,
        buttonsOverride: ADD_AGAIN_BUTTONS,
        stateOverride: "IDLE",
        contextPatchOverride: { ...CLEAR_PENDING_VERIFY },
      };
    }

    case "CREATE_INVOICE": {
      if (!vendorId) return { replyOverride: messages.noVendorAccount() };
      const { customerName, customerPhone, items, dueInMinutes } = effect.data;

      let vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { organization: true },
      });
      if (!vendor) return {};

      // Invoices are organization-scoped; older bot vendors may predate solo orgs.
      if (!vendor.organizationId) {
        await createSoloOrganizationForVendor(vendor);
        vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, include: { organization: true } });
      }
      if (!vendor?.organizationId || !vendor.organization) {
        return { replyOverride: "I couldn't set up invoicing for your shop. Please try again or reply *SUPPORT*.", buttonsOverride: [{ id: "INVOICE", title: "Try again" }] as WhatsAppButton[] };
      }
      const organization = vendor.organization;

      let customer;
      try {
        customer = await getOrCreateCustomerForVendor({
          vendorId,
          vendorBusinessName: vendor.businessName,
          communityId: vendor.communityId,
          organizationId: vendor.organizationId,
          fullName: customerName,
          phone: customerPhone,
          actingVendorPhone: vendor.phone,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "I couldn't save that customer.";
        return { replyOverride: `❌ ${message}\n\nReply *INVOICE* to try again.`, buttonsOverride: [{ id: "INVOICE", title: "Try again" }] as WhatsAppButton[] };
      }

      const subtotal = roundMoney(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
      if (subtotal <= 0) {
        return { replyOverride: "The invoice total must be greater than zero. Reply *INVOICE* to try again.", buttonsOverride: [{ id: "INVOICE", title: "Try again" }] as WhatsAppButton[] };
      }

      const dueDate = new Date(Date.now() + dueInMinutes * 60_000);
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: vendor.organizationId,
          branchId: vendor.branchId,
          vendorId,
          studentId: customer.id,
          invoiceNumber: `INV-${(organization.slug ?? "VDM").slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
          status: "DRAFT",
          subtotal,
          discountAmount: 0,
          total: subtotal,
          dueDate,
          items: {
            create: items.map((i) => ({
              name: i.name.trim(),
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: roundMoney(i.quantity * i.unitPrice),
            })),
          },
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vodiumledger.com";
      const link = `${appUrl}/invoice/${signInvoiceToken(invoice.id)}`;
      const storeName = organization.name ?? vendor.businessName;
      const dueText = dueDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

      const customerMessage =
        `Hi *${customer.fullName}* 👋\n\n` +
        `${storeName} has sent you an invoice.\n\n` +
        `*Invoice:* ${invoice.invoiceNumber}\n` +
        `*Amount:* ${formatNaira(subtotal)}\n` +
        `*Due:* ${dueText}\n\n` +
        `View it here:\n${link}\n\n` +
        `Thank you! 🙏`;

      const orgCreds = await getOrgChannelCredentials(vendor.organizationId);
      try {
        await sendWhatsAppMessage(customer.phone, customerMessage, orgCreds ?? undefined);
      } catch (err) {
        console.error("[whatsapp] Invoice delivery failed:", err);
        return { replyOverride: messages.invoiceSendFailed(invoice.invoiceNumber, link), buttonsOverride: [{ id: "INVOICE", title: "New invoice" }, { id: "LIST", title: "Who's owing" }] as WhatsAppButton[] };
      }

      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "SENT", sentAt: new Date() } });
      await prisma.notification.create({
        data: {
          vendorId,
          title: "Invoice Sent",
          message: `Invoice ${invoice.invoiceNumber} (${formatNaira(subtotal)}) sent to ${customer.fullName} via WhatsApp.`,
          type: "SUCCESS",
        },
      });

      return {
        replyOverride: messages.invoiceSent(customer.fullName, invoice.invoiceNumber, subtotal),
        buttonsOverride: [
          { id: "INVOICE", title: "New invoice" },
          { id: "LIST",    title: "Who's owing" },
        ],
      };
    }

    case "FETCH_LIST": {
      const credits = await prisma.credit.findMany({
        where: { vendorId: effect.data.vendorId, status: { in: ["OUTSTANDING", "DUE_SOON", "OVERDUE", "PARTIALLY_PAID"] } },
        include: { student: true },
        orderBy: { dueDate: "asc" },
      });
      if (!credits.length) {
        return {
          replyOverride: messages.listEmpty(),
          buttonsOverride: [
            { id: "ADD",     title: "Add credit" },
            { id: "INVOICE", title: "New invoice" },
          ],
        };
      }
      const now = Date.now();
      return {
        replyOverride: messages.listFull(credits.map((c) => ({ customerName: c.student.fullName, amount: Number(c.amount), daysUntilDue: Math.ceil((c.dueDate.getTime() - now) / 86_400_000) }))),
        buttonsOverride: [
          { id: "PAID_CMD",  title: "Mark one paid" },
          { id: "ADD",   title: "Add credit" },
          { id: "SCORE", title: "Check a score" },
        ],
      };
    }

    case "MARK_PAID": {
      if (!vendorId) return { replyOverride: messages.noVendorAccount() };
      const { customerName } = effect.data;
      const words   = customerName.split(/\s+/).filter(Boolean);
      const credits = await prisma.credit.findMany({
        where: { vendorId, status: { in: [...OPEN_CREDIT_STATUSES] }, student: { OR: words.map((w) => ({ fullName: { contains: w, mode: "insensitive" as const } })) } },
        include: { student: true }, orderBy: { dueDate: "asc" }, take: 1,
      });
      if (!credits.length) {
        return { replyOverride: messages.paidNotFound(customerName), buttonsOverride: [{ id: "LIST", title: "Who's owing" }] };
      }
      const settled = await settleCredit(credits[0], vendorId);
      return {
        replyOverride: messages.paidConfirmed(settled.customerName, settled.amount),
        buttonsOverride: [
          { id: "LIST", title: "Who's owing" },
          { id: "ADD",  title: "Add credit" },
        ],
      };
    }

    case "CONFIRM_PAID": {
      const { creditId } = effect.data;
      const credit = await prisma.credit.findFirst({
        where: { id: creditId, vendorId: effect.data.vendorId, status: { in: [...OPEN_CREDIT_STATUSES] } },
        include: { student: true },
      });
      if (!credit) return { replyOverride: messages.confirmNotFound() };

      const settled = await settleCredit(credit, effect.data.vendorId);

      // Close the loop with the customer.
      const confirmingVendor = await prisma.vendor.findUnique({
        where: { id: effect.data.vendorId },
        select: { businessName: true, organizationId: true },
      });
      const customerCreds = (await getOrgChannelCredentials(confirmingVendor?.organizationId)) ?? undefined;
      try {
        await sendWhatsAppMessage(
          credit.student.phone,
          messages.claimConfirmedToCustomer(confirmingVendor?.businessName ?? "The vendor", settled.amount),
          customerCreds
        );
      } catch (err) {
        console.error("[whatsapp] Failed to notify customer of confirmed payment:", err);
      }

      return {
        replyOverride: messages.paidConfirmed(settled.customerName, settled.amount),
        buttonsOverride: [{ id: "LIST", title: "Who's owing" }],
      };
    }

    case "DISPUTE_PAID": {
      const { creditId } = effect.data;
      const credit = await prisma.credit.findFirst({
        where: { id: creditId, vendorId: effect.data.vendorId, status: { in: [...OPEN_CREDIT_STATUSES] } },
        include: { student: true, vendor: { select: { businessName: true, organizationId: true } } },
      });
      if (!credit) return { replyOverride: messages.confirmNotFound() };

      const customerCreds = (await getOrgChannelCredentials(credit.vendor.organizationId)) ?? undefined;
      try {
        await sendWhatsAppMessage(
          credit.student.phone,
          messages.claimDisputedToCustomer(credit.vendor.businessName, Number(credit.amount)),
          customerCreds
        );
      } catch (err) {
        console.error("[whatsapp] Failed to notify customer of disputed claim:", err);
      }

      return { replyOverride: messages.claimDisputeNoted(credit.student.fullName), buttonsOverride: [{ id: "LIST", title: "Who's owing" }] as WhatsAppButton[] };
    }

    case "FETCH_SCORE": {
      const { customerQuery, fromPhone: _fromPhone } = effect.data;
      const words = customerQuery.split(/\s+/).filter(Boolean);
      
      // Try by phone first
      const normalQueryPhone = normalisePhone(customerQuery);
      const byPhone = normalQueryPhone ? await prisma.student.findUnique({ where: { phone: normalQueryPhone }, include: { scoreEvents: { orderBy: { occurredAt: "asc" } } } }) : null;
      
      const customer = byPhone ?? await prisma.student.findFirst({ where: { OR: words.map((w) => ({ fullName: { contains: w, mode: "insensitive" as const } })), NOT: { phone: { startsWith: "pending:" } } }, include: { scoreEvents: { orderBy: { occurredAt: "asc" } } }, orderBy: { createdAt: "desc" } });
      
      const scoreButtons: WhatsAppButton[] = [
        { id: "LIST", title: "Who's owing" },
        { id: "ADD",  title: "Add credit" },
      ];
      if (!customer)                    return { replyOverride: messages.scoreNotFound(customerQuery), buttonsOverride: scoreButtons };
      if (!customer.scoreEvents.length) return { replyOverride: messages.scoreNoHistory(customer.fullName), buttonsOverride: scoreButtons };

      const { score, summary } = computeScore(customer.scoreEvents);
      return { replyOverride: messages.scoreReply(customer.fullName, score, summary), buttonsOverride: scoreButtons };
    }


    default:
      return {};
  }
}

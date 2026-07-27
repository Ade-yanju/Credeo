/**
 * Vodium Ledger — WhatsApp conversation state machine.
 *
 * Pure functions only. No I/O, no DB calls, no Twilio.
 * The route handler owns all side-effect execution.
 */

import { messages, type InvoiceItemEntry } from "./messages";
import { matchIntent, isEscapeCommand, isAffirmative, isNegative } from "./nlu";
import type { WhatsAppState } from "@prisma/client";

// ─── public types ─────────────────────────────────────────────────────────────

export type Intent =
  | "START"
  | "ADD"
  | "INVOICE"
  | "PAID"
  | "LIST"
  | "SCORE"
  | "HELP"
  | "DASHBOARD"
  | "SUPPORT"
  | "BANK"
  | "FREE_TEXT";

export interface IncomingMessage {
  body: string;
  fromPhone: string;
}

export interface SessionContext {
  state: WhatsAppState;
  context: Record<string, unknown>;
  vendorId?: string;
}

/** Tappable reply button (rendered via Meta interactive messages). */
export type BotButton = { id: string; title: string };

/** Tappable list menu (up to 10 rows) for choices that don't fit in 3 buttons. */
export type BotListRow = { id: string; title: string; description?: string };
export type BotList = { buttonText: string; rows: BotListRow[] };

export interface StepResult {
  reply: string;
  nextState: WhatsAppState;
  contextPatch?: Record<string, unknown>;
  sideEffects?: SideEffect[];
  /** Optional tappable buttons attached to the reply. Max 3, titles ≤ 20 chars. */
  buttons?: BotButton[];
  /** Optional tappable list menu — takes priority over `buttons` when set. */
  list?: BotList;
}

export type SideEffect =
  | { type: "CREATE_VENDOR";  data: { name: string; businessName: string; communityName: string; phone: string } }
  | { type: "CREATE_CREDIT";  data: { vendorId: string; customerName: string; customerPhone: string; amount: number; dueInMinutes: number; remindersEnabled: boolean } }
  | { type: "CREATE_INVOICE"; data: { vendorId: string; customerName: string; customerPhone: string; items: InvoiceItemEntry[]; dueInMinutes: number } }
  | { type: "SCORE_PREVIEW";  data: { customerName: string; customerPhone: string } }
  | { type: "VERIFY_CUSTOMER_CODE"; data: { vendorId: string; code: string } }
  | { type: "RESEND_CUSTOMER_CODE"; data: { vendorId: string } }
  | { type: "SKIP_VERIFY"; data: { vendorId: string } }
  | { type: "SAVE_BANK";      data: { vendorId: string; bankName: string; accountNumber: string; accountName: string } }
  | { type: "MARK_PAID";      data: { vendorId: string; customerName: string } }
  | { type: "CONFIRM_PAID";   data: { vendorId: string; creditId: string } }
  | { type: "DISPUTE_PAID";   data: { vendorId: string; creditId: string } }
  | { type: "FETCH_LIST";     data: { vendorId: string } }
  | { type: "FETCH_SCORE";    data: { customerQuery: string; fromPhone: string } };

// ─── intent detection ─────────────────────────────────────────────────────────

export function detectIntent(body: string): Intent {
  const t = body.trim().toUpperCase();

  // Exact commands first — identical to the original table, so no existing
  // behaviour can regress no matter what the language layer decides.
  if (t === "START" || t === "BEGIN" || t === "HI" || t === "HELLO") return "START";
  if (t === "ADD" || t === "NEW" || t === "CREDIT")                   return "ADD";
  if (/^(ADD|NEW|CREDIT)\s+\S/.test(t))                              return "ADD";
  if (t === "INVOICE" || t === "BILL")                                 return "INVOICE";
  if (t.startsWith("PAID"))                                            return "PAID";
  if (t === "LIST" || t === "OWE" || t === "OWING" || t === "WHO")   return "LIST";
  if (t.startsWith("SCORE"))                                           return "SCORE";
  if (t === "HELP" || t === "?" || t === "MENU" || t === "COMMANDS")  return "HELP";
  if (t === "DASHBOARD" || t === "WEB" || t === "PORTAL")             return "DASHBOARD";
  if (t === "SUPPORT" || t === "AGENT" || t === "HUMAN")              return "SUPPORT";
  if (t === "ACCOUNT" || t === "BANK" || t === "PAYMENT")              return "BANK";

  // Then the tolerant layer: natural phrasing, Pidgin, and typos.
  // "add credit for chidi", "who dey owe me", "hlep" all resolve here.
  return matchIntent(body) as Intent;
}

// ─── main step function ───────────────────────────────────────────────────────

const MAIN_BUTTONS: BotButton[] = [
  { id: "ADD",     title: "Add credit" },
  { id: "INVOICE", title: "New invoice" },
  { id: "LIST",    title: "Who's owing" },
];

const CANCEL_BUTTON: BotButton[] = [{ id: "CANCEL", title: "Cancel" }];

const DUE_BUTTONS: BotButton[] = [
  { id: "7",      title: "In 7 days" },
  { id: "END",    title: "End of month" },
  { id: "CANCEL", title: "Cancel" },
];

const REMINDER_BUTTONS: BotButton[] = [
  { id: "REMIND",   title: "Save ✓" },
  { id: "NOREMIND", title: "Save, no reminders" },
  { id: "CANCEL",   title: "Cancel" },
];

const VERIFY_BUTTONS: BotButton[] = [
  { id: "RESEND", title: "Resend code" },
  { id: "CANCEL", title: "Cancel" },
];

/** Full command menu — WhatsApp caps reply buttons at 3, so HELP uses a list. */
const MENU_LIST: BotList = {
  buttonText: "Open menu",
  rows: [
    { id: "ADD",       title: "Add credit",      description: "Record a new credit in 15 seconds" },
    { id: "INVOICE",   title: "New invoice",     description: "Create & send an invoice on WhatsApp" },
    { id: "PAID_CMD",  title: "Mark paid",       description: "Record a customer's repayment" },
    { id: "LIST",      title: "Who's owing",     description: "See all outstanding credits" },
    { id: "SCORE",     title: "Check a score",   description: "A customer's reliability score" },
    { id: "ACCOUNT",   title: "Payment details", description: "Bank details shown on reminders" },
    { id: "DASHBOARD", title: "Dashboard link",  description: "Open your full web dashboard" },
    { id: "SUPPORT",   title: "Talk to a human", description: "Get help within 24 hours" },
  ],
};

export function step(session: SessionContext, msg: IncomingMessage): StepResult {
  const body = msg.body.trim();
  const intent = detectIntent(body);
  const upperBody = body.toUpperCase();

  if (intent === "HELP" || isEscapeCommand(body, "help")) {
    return { reply: messages.help(), nextState: "IDLE", contextPatch: clearFlowContext(), list: MENU_LIST };
  }

  if (isEscapeCommand(body, "cancel")) {
    return { reply: messages.cancelled(), nextState: "IDLE", contextPatch: clearFlowContext(), buttons: MAIN_BUTTONS };
  }

  // ── payment-claim buttons (tapped by the vendor; always win, even mid-flow) ──

  const confirmPaid = body.match(/^CONFIRM_PAID_([\w-]+)$/i);
  if (confirmPaid) {
    if (!session.vendorId) return { reply: messages.noVendorAccount(), nextState: "IDLE" };
    return {
      reply: "Confirming…",
      nextState: session.state,
      sideEffects: [{ type: "CONFIRM_PAID", data: { vendorId: session.vendorId, creditId: confirmPaid[1] } }],
    };
  }

  const notPaid = body.match(/^NOT_PAID_([\w-]+)$/i);
  if (notPaid) {
    if (!session.vendorId) return { reply: messages.noVendorAccount(), nextState: "IDLE" };
    return {
      reply: "Noted.",
      nextState: session.state,
      sideEffects: [{ type: "DISPUTE_PAID", data: { vendorId: session.vendorId, creditId: notPaid[1] } }],
    };
  }

  // ── mid-flow states (sticky — always take priority over intent) ──────────

  switch (session.state) {
    case "ONBOARDING_NAME":
      return {
        reply: messages.onboardingAskBusiness(body),
        nextState: "ONBOARDING_BUSINESS",
        contextPatch: { ownerName: body },
      };

    case "ONBOARDING_BUSINESS":
      return {
        reply: messages.onboardingAskUniversity(),
        nextState: "ONBOARDING_COMMUNITY",
        contextPatch: { businessName: body },
      };

    case "ONBOARDING_UNIVERSITY":
    case "ONBOARDING_COMMUNITY": {
      const businessName = String(session.context.businessName ?? "your shop");
      // Pass the raw input — parseCommunity() in the route handler normalises it.
      return {
        reply: messages.onboardingDone(businessName),
        nextState: "IDLE",
        contextPatch: { communityName: body },
        buttons: MAIN_BUTTONS,
        sideEffects: [
          {
            type: "CREATE_VENDOR",
            data: {
              name: String(session.context.ownerName ?? "Vendor"),
              businessName,
              communityName: body,
              phone: msg.fromPhone,
            },
          },
        ],
      };
    }

    case "ADDING_CREDIT_STUDENT": {
      // Vendors often paste the ENTIRE command at this step ("ADD Chidi
      // 0803… 2500 7d"). Parse it as one instead of saving the whole line as
      // the customer's name — production had customers literally named
      // "David +234 815 977 8234 4500 30m", and reminders greeted them so.
      const pasted = parseQuickCredit(body);
      if (pasted) {
        return {
          reply: messages.addCreditConfirmBeforeSave(
            pasted.customerName,
            pasted.customerPhone,
            pasted.amount,
            friendlyDueText(pasted.dueInMinutes),
          ),
          nextState: "ADDING_CREDIT_REMINDER",
          contextPatch: {
            creditCustomerName: pasted.customerName,
            creditCustomerPhone: pasted.customerPhone,
            creditAmount: pasted.amount,
            creditDueMinutes: pasted.dueInMinutes,
          },
          buttons: REMINDER_BUTTONS,
        };
      }

      // A bare "ADD Lekan" reaching this step means the command word leaked —
      // strip it. And a "name" carrying a phone number's worth of digits isn't
      // a name; asking again beats polluting the ledger.
      const name = body.replace(/^(ADD|NEW|CREDIT)\s+/i, "").replace(/\s+/g, " ").trim();
      const digitCount = (name.match(/\d/g) ?? []).length;
      if (name.length < 2 || name.length > 60 || digitCount >= 7) {
        return {
          reply: messages.addCreditNameLooksWrong(),
          nextState: "ADDING_CREDIT_STUDENT",
          buttons: CANCEL_BUTTON,
        };
      }

      return {
        reply: messages.addCreditAskPhone(name),
        nextState: "ADDING_CREDIT_PHONE",
        contextPatch: { creditCustomerName: name },
        buttons: CANCEL_BUTTON,
      };
    }

    case "ADDING_CREDIT_PHONE": {
      // Very basic phone validation: at least 7 digits
      const phoneDigits = body.replace(/\D/g, "");
      if (phoneDigits.length < 7) {
        return { reply: messages.invalidPhone(), nextState: "ADDING_CREDIT_PHONE", buttons: CANCEL_BUTTON };
      }
      // Ask for the amount, but let a SCORE_PREVIEW side effect prepend the
      // customer's cross-vendor reliability warning when they're already known.
      const previewName = String(session.context.creditCustomerName ?? "Customer");
      return {
        reply: messages.addCreditAskAmount(previewName),
        nextState: "ADDING_CREDIT_AMOUNT",
        contextPatch: { creditCustomerPhone: body },
        buttons: CANCEL_BUTTON,
        sideEffects: [{ type: "SCORE_PREVIEW", data: { customerName: previewName, customerPhone: body } }],
      };
    }

    case "ADDING_CREDIT_AMOUNT": {
      const amount = parseAmount(body);
      if (!amount) {
        return { reply: messages.invalidAmount(), nextState: "ADDING_CREDIT_AMOUNT", buttons: CANCEL_BUTTON };
      }
      return {
        reply: messages.addCreditAskDue(String(session.context.creditCustomerName ?? "Customer"), amount),
        nextState: "ADDING_CREDIT_DUE",
        contextPatch: { creditAmount: amount },
        buttons: DUE_BUTTONS,
      };
    }

    case "ADDING_CREDIT_DUE": {
      const dueInMinutes = parseDueDuration(body);
      if (!dueInMinutes) {
        return { reply: messages.invalidDueDate(), nextState: "ADDING_CREDIT_DUE", buttons: DUE_BUTTONS };
      }
      return {
        reply: messages.addCreditConfirmBeforeSave(
          String(session.context.creditCustomerName ?? "Customer"),
          String(session.context.creditCustomerPhone ?? ""),
          Number(session.context.creditAmount ?? 0),
          friendlyDueText(dueInMinutes),
        ),
        nextState: "ADDING_CREDIT_REMINDER",
        contextPatch: { creditDueMinutes: dueInMinutes },
        buttons: REMINDER_BUTTONS,
      };
    }

    case "ADDING_CREDIT_REMINDER": {
      const remindersEnabled =
        upperBody === "REMIND" || isAffirmative(body)
          ? true
          : upperBody === "NOREMIND" || isNegative(body)
            ? false
            : null;
      if (remindersEnabled === null) {
        return {
          reply: messages.addCreditConfirmBeforeSave(
            String(session.context.creditCustomerName ?? "Customer"),
            String(session.context.creditCustomerPhone ?? ""),
            Number(session.context.creditAmount ?? 0),
            friendlyDueText(Number(session.context.creditDueMinutes ?? 0)),
          ),
          nextState: "ADDING_CREDIT_REMINDER",
          buttons: REMINDER_BUTTONS,
        };
      }

      const dueInMinutes = Number(session.context.creditDueMinutes ?? 0);
      if (!dueInMinutes) {
        // Context lost mid-flow (e.g. stale session) — re-ask the due date.
        return { reply: messages.invalidDueDate(), nextState: "ADDING_CREDIT_DUE", buttons: DUE_BUTTONS };
      }

      const customerName = String(session.context.creditCustomerName ?? "Customer");
      const customerPhone = String(session.context.creditCustomerPhone ?? "");
      const amount = Number(session.context.creditAmount ?? 0);
      const dueText = friendlyDueText(dueInMinutes);

      return {
        reply: messages.addCreditConfirmed(
          customerName,
          amount,
          dueText,
          remindersEnabled ? reminderPromiseForDue(dueInMinutes) : messages.noReminderPromise(),
        ),
        nextState: "IDLE",
        contextPatch: { creditCustomerName: null, creditCustomerPhone: null, creditAmount: null, creditDueMinutes: null },
        buttons: [
          { id: "ADD",  title: "Add another" },
          { id: "LIST", title: "Who's owing" },
        ],
        sideEffects: [
          {
            type: "CREATE_CREDIT",
            data: { vendorId: session.vendorId!, customerName, customerPhone, amount, dueInMinutes, remindersEnabled },
          },
        ],
      };
    }

    case "VERIFYING_CUSTOMER": {
      // Vendor is entering the code we sent to the customer's WhatsApp.
      if (upperBody === "RESEND" || upperBody === "RESEND CODE") {
        return {
          reply: "Sending a new code…",
          nextState: "VERIFYING_CUSTOMER",
          sideEffects: [{ type: "RESEND_CUSTOMER_CODE", data: { vendorId: session.vendorId! } }],
        };
      }
      // Saving without the code is only offered for BRAND-NEW debtors (the
      // side effect re-checks pvNew; an existing customer's shared record is
      // never joinable without their code).
      if (upperBody === "SKIP_VERIFY" || upperBody === "SAVE WITHOUT CODE") {
        return {
          reply: "Saving…",
          nextState: "VERIFYING_CUSTOMER",
          sideEffects: [{ type: "SKIP_VERIFY", data: { vendorId: session.vendorId! } }],
        };
      }
      const code = body.replace(/\D/g, "");
      if (code.length < 4) {
        return {
          reply: messages.verifyBadCode(),
          nextState: "VERIFYING_CUSTOMER",
          buttons: VERIFY_BUTTONS,
        };
      }
      return {
        reply: "Checking the code…",
        nextState: "VERIFYING_CUSTOMER",
        sideEffects: [{ type: "VERIFY_CUSTOMER_CODE", data: { vendorId: session.vendorId!, code } }],
      };
    }

    case "MARKING_PAID": {
      // vendor typed customer name after we asked "who paid?"
      return {
        reply: "Checking…",
        nextState: "IDLE",
        sideEffects: [
          { type: "MARK_PAID", data: { vendorId: session.vendorId!, customerName: body } },
        ],
      };
    }

    case "LOOKING_UP_SCORE":
      return {
        reply: "Looking up score…",
        nextState: "IDLE",
        sideEffects: [{ type: "FETCH_SCORE", data: { customerQuery: body, fromPhone: msg.fromPhone } }],
      };
  }

  // ── invoice flow (tracked in session context, not a dedicated DB state) ──

  const bankResult = stepBankFlow(session, body);
  if (bankResult) return bankResult;

  const invoiceResult = stepInvoiceFlow(session, body, upperBody);
  if (invoiceResult) return invoiceResult;

  // ── IDLE / fresh intent dispatch ─────────────────────────────────────────

  switch (intent) {
    case "START":
      if (session.vendorId) {
        const businessName = String(session.context.businessName ?? "your shop");
        return { reply: messages.alreadyRegistered(businessName), nextState: "IDLE", buttons: MAIN_BUTTONS };
      }
      return { reply: messages.onboardingAskName(), nextState: "ONBOARDING_NAME" };

    case "ADD": {
      if (!session.vendorId) return { reply: messages.noVendorAccount(), nextState: "IDLE" };

      // One-shot: "ADD Chidi 08012345678 2500 7d" skips all six prompts.
      const quick = parseQuickCredit(body);
      if (quick) {
        return {
          reply: messages.addCreditConfirmBeforeSave(
            quick.customerName,
            quick.customerPhone,
            quick.amount,
            friendlyDueText(quick.dueInMinutes),
          ),
          nextState: "ADDING_CREDIT_REMINDER",
          contextPatch: {
            creditCustomerName: quick.customerName,
            creditCustomerPhone: quick.customerPhone,
            creditAmount: quick.amount,
            creditDueMinutes: quick.dueInMinutes,
          },
          buttons: REMINDER_BUTTONS,
        };
      }

      return { reply: messages.addCreditAskCustomer(), nextState: "ADDING_CREDIT_STUDENT", buttons: CANCEL_BUTTON };
    }

    case "INVOICE":
      if (!session.vendorId) return { reply: messages.noVendorAccount(), nextState: "IDLE" };
      return {
        reply: messages.invoiceAskCustomer(),
        nextState: "IDLE",
        contextPatch: { ...clearFlowContext(), invStep: "customer" },
        buttons: CANCEL_BUTTON,
      };

    case "PAID": {
      if (!session.vendorId) return { reply: messages.noVendorAccount(), nextState: "IDLE" };
      const nameAfterPaid = body.replace(/^PAID\s*/i, "").trim();
      if (nameAfterPaid) {
        return {
          reply: "Checking…",
          nextState: "IDLE",
          sideEffects: [
            { type: "MARK_PAID", data: { vendorId: session.vendorId, customerName: nameAfterPaid } },
          ],
        };
      }
      return { reply: messages.paidAsk(), nextState: "MARKING_PAID", buttons: CANCEL_BUTTON };
    }

    case "LIST":
      if (!session.vendorId) return { reply: messages.noVendorAccount(), nextState: "IDLE" };
      return {
        reply: "Fetching…",
        nextState: "IDLE",
        sideEffects: [{ type: "FETCH_LIST", data: { vendorId: session.vendorId } }],
      };

    case "SCORE": {
      const queryAfterScore = body.replace(/^SCORE\s*/i, "").trim();
      if (queryAfterScore) {
        return {
          reply: "Looking up score…",
          nextState: "IDLE",
          sideEffects: [{ type: "FETCH_SCORE", data: { customerQuery: queryAfterScore, fromPhone: msg.fromPhone } }],
        };
      }
      return { reply: messages.scoreLookupAsk(), nextState: "LOOKING_UP_SCORE", buttons: CANCEL_BUTTON };
    }

    case "BANK":
      if (!session.vendorId) return { reply: messages.noVendorAccount(), nextState: "IDLE" };
      return {
        reply: messages.bankAskName(),
        nextState: "IDLE",
        contextPatch: { ...clearFlowContext(), bankStep: "name" },
        buttons: CANCEL_BUTTON,
      };

    case "DASHBOARD":
      return {
        reply: `Open your dashboard here:\n${process.env.NEXT_PUBLIC_APP_URL ?? "https://vodiumledger.com"}/dashboard`,
        nextState: "IDLE",
        buttons: MAIN_BUTTONS,
      };

    case "SUPPORT":
      return {
        reply: `For support, send an email to *support@vodiumledger.com* or reply here and a human will be in touch within 24 hours.`,
        nextState: "IDLE",
        buttons: MAIN_BUTTONS,
      };

    default:
      // First touch from an unknown number
      if (session.state === "IDLE" && !session.vendorId) {
        return {
          reply: messages.welcome(),
          nextState: "IDLE",
          buttons: [
            { id: "START", title: "Set up my shop" },
            { id: "HELP",  title: "Help" },
          ],
        };
      }
      return { reply: messages.unknown(), nextState: "IDLE", buttons: MAIN_BUTTONS };
  }
}

// ─── invoice flow ─────────────────────────────────────────────────────────────


function stepBankFlow(session: SessionContext, body: string): StepResult | null {
  const bankStep = typeof session.context.bankStep === "string" ? session.context.bankStep : null;
  if (!bankStep) return null;

  switch (bankStep) {
    case "name":
      return {
        reply: messages.bankAskNumber(body),
        nextState: "IDLE",
        contextPatch: { bankName: body, bankStep: "number" },
        buttons: CANCEL_BUTTON,
      };

    case "number": {
      const digits = body.replace(/\D/g, "");
      if (digits.length < 6 || digits.length > 20) {
        return { reply: messages.bankInvalidNumber(), nextState: "IDLE", buttons: CANCEL_BUTTON };
      }
      return {
        reply: messages.bankAskAccountName(),
        nextState: "IDLE",
        contextPatch: { bankAccountNumber: digits, bankStep: "account" },
        buttons: CANCEL_BUTTON,
      };
    }

    case "account": {
      const bankName = String(session.context.bankName ?? "");
      const accountNumber = String(session.context.bankAccountNumber ?? "");
      if (!bankName || !accountNumber) {
        return { reply: messages.bankAskName(), nextState: "IDLE", contextPatch: { bankStep: "name" }, buttons: CANCEL_BUTTON };
      }
      return {
        reply: messages.bankSaved(bankName, accountNumber, body),
        nextState: "IDLE",
        contextPatch: { bankStep: null, bankName: null, bankAccountNumber: null },
        buttons: MAIN_BUTTONS,
        sideEffects: [{
          type: "SAVE_BANK",
          data: { vendorId: session.vendorId!, bankName, accountNumber, accountName: body },
        }],
      };
    }

    default:
      return null;
  }
}

function stepInvoiceFlow(session: SessionContext, body: string, upperBody: string): StepResult | null {
  const invStep = typeof session.context.invStep === "string" ? session.context.invStep : null;
  if (!invStep) return null;

  const customerName = String(session.context.invCustomerName ?? "the customer");

  switch (invStep) {
    case "customer":
      return {
        reply: messages.invoiceAskPhone(body),
        nextState: "IDLE",
        contextPatch: { invCustomerName: body, invStep: "phone" },
        buttons: CANCEL_BUTTON,
      };

    case "phone": {
      const phoneDigits = body.replace(/\D/g, "");
      if (phoneDigits.length < 7) {
        return { reply: messages.invalidPhone(), nextState: "IDLE", buttons: CANCEL_BUTTON };
      }
      return {
        reply: messages.invoiceAskItems(customerName),
        nextState: "IDLE",
        contextPatch: { invCustomerPhone: body, invStep: "items", invItems: [] },
        buttons: CANCEL_BUTTON,
      };
    }

    case "items": {
      const items = invoiceItemsFromContext(session.context);
      const itemButtons: BotButton[] = items.length
        ? [{ id: "DONE", title: "Done ✓" }, ...CANCEL_BUTTON]
        : CANCEL_BUTTON;
      if (upperBody === "DONE" || upperBody === "FINISH" || upperBody === "FINISHED") {
        if (!items.length) return { reply: messages.invoiceNeedItem(), nextState: "IDLE", buttons: CANCEL_BUTTON };
        return {
          reply: messages.invoiceAskDue(customerName),
          nextState: "IDLE",
          contextPatch: { invStep: "due" },
          buttons: DUE_BUTTONS,
        };
      }
      const item = parseInvoiceItem(body);
      if (!item) return { reply: messages.invoiceInvalidItem(), nextState: "IDLE", buttons: itemButtons };
      const updated = [...items, item];
      return {
        reply: messages.invoiceItemAdded(updated),
        nextState: "IDLE",
        contextPatch: { invItems: updated },
        buttons: [{ id: "DONE", title: "Done ✓" }, ...CANCEL_BUTTON],
      };
    }

    case "due": {
      const dueInMinutes = parseDueDuration(body);
      if (!dueInMinutes) return { reply: messages.invalidDueDate(), nextState: "IDLE", buttons: DUE_BUTTONS };
      const items = invoiceItemsFromContext(session.context);
      const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      return {
        reply: messages.invoiceConfirm(customerName, items, total, friendlyDueText(dueInMinutes)),
        nextState: "IDLE",
        contextPatch: { invDueMinutes: dueInMinutes, invStep: "confirm" },
        buttons: INVOICE_CONFIRM_BUTTONS,
      };
    }

    case "confirm": {
      if (upperBody === "SEND" || upperBody === "YES" || upperBody === "CONFIRM" || upperBody === "OK") {
        return {
          reply: "Creating your invoice…",
          nextState: "IDLE",
          contextPatch: clearFlowContext(),
          sideEffects: [
            {
              type: "CREATE_INVOICE",
              data: {
                vendorId: session.vendorId!,
                customerName: String(session.context.invCustomerName ?? ""),
                customerPhone: String(session.context.invCustomerPhone ?? ""),
                items: invoiceItemsFromContext(session.context),
                dueInMinutes: Number(session.context.invDueMinutes ?? 0),
              },
            },
          ],
        };
      }
      return { reply: messages.invoiceConfirmHint(), nextState: "IDLE", buttons: INVOICE_CONFIRM_BUTTONS };
    }

    default:
      return null;
  }
}

const INVOICE_CONFIRM_BUTTONS: BotButton[] = [
  { id: "SEND",   title: "Send it ✓" },
  { id: "CANCEL", title: "Cancel" },
];

export interface QuickCredit {
  customerName: string;
  customerPhone: string;
  amount: number;
  dueInMinutes: number;
}

/**
 * One-shot credit entry: `ADD Chidi Okeke 08012345678 2500 7d`.
 *
 * This is the 15-second path the product principle asks for — one message
 * instead of six prompts. Order is fixed and unambiguous because each field has
 * a distinct shape: the phone is the long digit run, the amount is the money,
 * the optional trailing token is the due date, and whatever is left is the name.
 *
 * Returns null when the message isn't a complete one-shot (the caller then
 * falls back to the guided flow), so a bare "ADD" still works as before.
 */
/**
 * Vendors paste numbers the way their phone displays them: "+234 815 977 8234",
 * "+1 (229) 672-8093". Split on whitespace those become 3–4 tokens, none with
 * enough digits to look like a phone — so the whole parse failed and the bot
 * fell back to asking step by step, where the vendor (reasonably) pasted the
 * entire command again and it was saved verbatim as the customer's NAME.
 * Production has customers literally named "David +234 815 977 8234 4500 30m".
 *
 * This walks the token list and joins consecutive digit-fragments into one
 * phone token. It stops once a plausible phone is complete (≥10 digits) and the
 * next fragment would overshoot E.164's 15-digit cap — that next fragment is
 * the amount, not more phone.
 */
export function mergePhoneFragments(tokens: string[]): string[] {
  const isFragment = (t: string) => /^[+(]?\d[\d()-]*$/.test(t);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (isFragment(tokens[i])) {
      let merged = tokens[i];
      let digits = tokens[i].replace(/\D/g, "").length;
      let j = i + 1;
      while (j < tokens.length && isFragment(tokens[j]) && !tokens[j].startsWith("+")) {
        // 10+ digits is already a complete phone (NG local is 11, E.164 min 10)
        // — the next digit-run is the amount, not more phone. Without this stop
        // "08012345678 2500" merges into one 15-digit "phone".
        if (digits >= 10) break;
        merged += tokens[j];
        digits += tokens[j].replace(/\D/g, "").length;
        j++;
      }
      if (j > i + 1 && digits >= 7 && digits <= 15) {
        out.push(merged);
        i = j - 1;
        continue;
      }
    }
    out.push(tokens[i]);
  }
  return out;
}

export function parseQuickCredit(input: string): QuickCredit | null {
  const body = input.trim().replace(/^(ADD|NEW|CREDIT)\s+/i, "");
  const tokens = mergePhoneFragments(body.split(/\s+/).filter(Boolean));
  if (tokens.length < 3) return null; // needs at least name + phone + amount

  // Due date: only if the LAST token looks like a duration/date, never a bare
  // number — a trailing bare number is the amount, not "N days".
  let dueInMinutes = 7 * 1440; // sensible default: one week
  const last = tokens[tokens.length - 1];
  if (/^(\d+\s*[mhdMHD]|END|end|\d{1,2}[-/]\d{1,2}[-/]\d{4})$/.test(last)) {
    const parsed = parseDueDuration(last);
    if (!parsed) return null;
    dueInMinutes = parsed;
    tokens.pop();
  }
  if (tokens.length < 3) return null;

  // Amount is the last remaining token. A token with 7+ digits is a phone that
  // ended up last (e.g. no amount given) — never read it as ₦8-billion.
  const amountToken = tokens[tokens.length - 1];
  if (amountToken.replace(/\D/g, "").length >= 7) return null;
  const amount = parseAmount(amountToken);
  if (!amount) return null;
  tokens.pop();

  // Phone: the last token that is a plausible run of digits.
  let phoneIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].replace(/\D/g, "").length >= 7) { phoneIdx = i; break; }
  }
  if (phoneIdx === -1) return null;
  const customerPhone = tokens[phoneIdx];
  tokens.splice(phoneIdx, 1);

  const customerName = tokens.join(" ").trim();
  if (customerName.length < 2 || /^[\d+]/.test(customerName)) return null;

  return { customerName, customerPhone, amount, dueInMinutes };
}

/**
 * Parses "Rice, 2, 1500" (item, qty, unit price) or "Delivery, 500" (qty 1).
 */
export function parseInvoiceItem(input: string): InvoiceItemEntry | null {
  // "₦1,200" → "₦1200" so thousands separators don't break the comma split.
  const withoutThousands = input.replace(/(\d),(?=\d{3}\b)/g, "$1");
  const parts = withoutThousands.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return null;

  const name = parts[0];
  if (!name || /^[\d₦,.\s]+$/.test(name)) return null;

  if (parts.length === 2) {
    const unitPrice = parseAmount(parts[1]);
    return unitPrice ? { name, quantity: 1, unitPrice } : null;
  }

  const quantity = parseInt(parts[1].replace(/\D/g, ""), 10);
  const unitPrice = parseAmount(parts[2]);
  if (!quantity || quantity < 1 || quantity > 999 || !unitPrice) return null;
  return { name, quantity, unitPrice };
}

function invoiceItemsFromContext(context: Record<string, unknown>): InvoiceItemEntry[] {
  const raw = context.invItems;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (i): i is InvoiceItemEntry =>
      !!i &&
      typeof i === "object" &&
      typeof (i as InvoiceItemEntry).name === "string" &&
      typeof (i as InvoiceItemEntry).quantity === "number" &&
      typeof (i as InvoiceItemEntry).unitPrice === "number"
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export function friendlyDueText(dueInMinutes: number): string {
  if (dueInMinutes < 60) {
    return `in ${dueInMinutes} minute${dueInMinutes === 1 ? "" : "s"}`;
  }
  if (dueInMinutes < 1440) {
    const hours = Math.round(dueInMinutes / 60);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(dueInMinutes / 1440);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function parseAmount(input: string): number | null {
  // Accepts the shapes vendors actually type: "2500", "₦2,500", "2500 naira",
  // "2k", "2.5k". Anything else is rejected rather than guessed at — a wrong
  // amount on someone's ledger is worse than asking again.
  const cleaned = input
    .toLowerCase()
    .replace(/naira|ngn|₦/g, "")
    .replace(/[,\s]/g, "")
    .trim();

  // "2k" / "2.5k" → thousands
  const k = cleaned.match(/^(\d+(?:\.\d+)?)k$/);
  if (k) {
    const n = parseFloat(k[1]) * 1000;
    return n > 0 ? n : null;
  }

  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

export function parseDueDuration(input: string): number | null {
  const cleaned = input.trim().toUpperCase();

  // Everyday phrasing, resolved deterministically.
  const words = cleaned.replace(/[^A-Z ]/g, "").trim();
  if (words === "TODAY" || words === "TONIGHT")      return 12 * 60;
  if (words === "TOMORROW")                           return 1440;
  if (words === "NEXT WEEK" || words === "ONE WEEK" || words === "A WEEK") return 7 * 1440;
  if (words === "TWO WEEKS" || words === "2 WEEKS")   return 14 * 1440;
  if (words === "NEXT MONTH" || words === "ONE MONTH" || words === "A MONTH") return 30 * 1440;
  if (words === "END OF MONTH" || words === "MONTH END" || words === "ENDS") {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 60_000));
  }

  // Handle "END" (end of month)
  if (cleaned === "END") {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const ms = end.getTime() - now.getTime();
    return Math.max(1, Math.ceil(ms / 60_000));
  }

  // Handle "30m", "1h", "2d" etc.
  const unitMatch = cleaned.match(/^(\d+)\s*([MHD])$/);
  if (unitMatch) {
    const val = parseInt(unitMatch[1], 10);
    const unit = unitMatch[2];
    if (unit === "M") return val; // minutes
    if (unit === "H") return val * 60; // hours
    if (unit === "D") return val * 1440; // days
  }

  // Handle "DD-MM-YYYY" dates
  const dateMatch = cleaned.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const target = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const ms = target.getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 60_000) : null;
  }

  // Default to days if just a number
  const n = parseInt(cleaned, 10);
  if (!isNaN(n) && n > 0 && n <= 730) {
    return n * 1440;
  }

  return null;
}

export function reminderLeadMinutesForDue(dueInMinutes: number): number {
  // Floor at 6 minutes (one 5-minute cron interval + slack): a lead SHORTER
  // than the cron gap can fall entirely between two ticks, in which case the
  // credit goes straight to OVERDUE without its pre-due nudge ever sending.
  // For credits shorter than that floor, the window opens immediately.
  if (dueInMinutes <= 10) return Math.min(dueInMinutes, 6);
  if (dueInMinutes <= 30) return 10;
  if (dueInMinutes <= 120) return 30;
  if (dueInMinutes <= 1440) return 120;
  if (dueInMinutes <= 3 * 1440) return 12 * 60;
  if (dueInMinutes <= 7 * 1440) return 24 * 60;
  if (dueInMinutes <= 30 * 1440) return 2 * 1440;
  return 7 * 1440;
}

/**
 * Is this credit's pre-due reminder due to go out right now?
 *
 * Extracted from the cron so the decision is testable in isolation. It was
 * previously inline, which made "why did no reminder send?" impossible to
 * answer without a database — the exact question that cost us a support cycle.
 *
 * The lead time scales with the ORIGINAL credit window, so an hour-long debt is
 * reminded minutes before, and a term-long one days before.
 */
export function isReminderDue(
  credit: { dueDate: Date; dateExtended: Date },
  now: Date = new Date(),
): boolean {
  const minutesUntilDue = Math.ceil((credit.dueDate.getTime() - now.getTime()) / 60_000);
  const originalWindow = Math.max(
    1,
    Math.ceil((credit.dueDate.getTime() - credit.dateExtended.getTime()) / 60_000),
  );
  return minutesUntilDue <= reminderLeadMinutesForDue(originalWindow);
}

export function reminderPromiseForDue(dueInMinutes: number): string {
  const lead = reminderLeadMinutesForDue(dueInMinutes);
  if (lead < 60) {
    return `I'll send them a polite reminder about ${lead} minute${lead === 1 ? "" : "s"} before the due time.`;
  }
  if (lead < 1440) {
    const hours = Math.round(lead / 60);
    return `I'll send them a polite reminder about ${hours} hour${hours === 1 ? "" : "s"} before the due time.`;
  }
  const days = Math.round(lead / 1440);
  return `I'll send them a polite reminder about ${days} day${days === 1 ? "" : "s"} before the due date.`;
}

function clearFlowContext(): Record<string, null> {
  return {
    ownerName: null,
    businessName: null,
    communityName: null,
    creditCustomerName: null,
    creditCustomerPhone: null,
    creditAmount: null,
    creditDueMinutes: null,
    invStep: null,
    invCustomerName: null,
    invCustomerPhone: null,
    invItems: null,
    invDueMinutes: null,
    // pending customer-verification keys
    pvHmac: null,
    pvExpiresAt: null,
    pvPhone: null,
    pvMasked: null,
    pcName: null,
    pcAmount: null,
    pcDue: null,
    pcReminders: null,
    bankStep: null,
    bankName: null,
    bankAccountNumber: null,
  };
}

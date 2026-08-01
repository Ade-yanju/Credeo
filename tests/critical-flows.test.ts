/**
 * Invariant tests for the money paths.
 *
 * These are deliberately NOT happy-path tests. Every regression that reached
 * real vendors so far passed the happy-path suite: each individual step worked,
 * but a *property of the flow as a whole* had broken — a credit could be
 * abandoned before it was ever written, or a confirmation screen quietly
 * stopped showing the number it was there to confirm.
 *
 * So each test here asserts a property that must hold for EVERY path, not a
 * single scripted journey. If one fails, a vendor is losing work or money.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { isValidTemplateName, normaliseTemplateName, resolveConfiguredTemplateName, DEFAULT_OTP_TEMPLATE_NAME } from "../src/lib/otp-delivery";
import { DEFAULT_INVOICE_TEMPLATE, resolveInvoiceTemplateName } from "../src/lib/whatsapp/invoice-template";

process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

import {
  step,
  detectIntent,
  parseAmount,
  parseQuickCredit,
  parseDueDuration,
  isReminderDue,
  reminderLeadMinutesForDue,
  type SessionContext,
  type StepResult,
} from "../src/lib/whatsapp/state-machine";

const VENDOR = "vendor_1";
const FROM = "+2348030000000";

function send(state: string, context: Record<string, unknown>, body: string): StepResult {
  return step({ state, context, vendorId: VENDOR } as SessionContext, { body, fromPhone: FROM });
}

/** Drive a whole conversation, threading state + context exactly as the webhook does. */
function converse(inputs: string[]): { last: StepResult; effects: string[] } {
  let state = "IDLE";
  let context: Record<string, unknown> = {};
  let last!: StepResult;
  const effects: string[] = [];

  for (const body of inputs) {
    last = send(state, context, body);
    state = last.nextState;
    context = { ...context, ...(last.contextPatch ?? {}) };
    for (const e of last.sideEffects ?? []) effects.push(e.type);
  }
  return { last, effects };
}

// ── Invariant 1: a credit must never be silently lost ────────────────────────

test("INVARIANT every ADD path ends by actually creating the credit", () => {
  // The regression this catches: the flow used to end on a question, and a
  // vendor who never answered left NO credit written at all — so no record and
  // no reminders, while the vendor believed the debt was logged.
  const journeys: Array<{ name: string; inputs: string[] }> = [
    { name: "guided, remind",       inputs: ["ADD", "Chidi Okeke", "08012345678", "2500", "7", "REMIND"] },
    { name: "guided, no remind",    inputs: ["ADD", "Chidi Okeke", "08012345678", "2500", "7", "NOREMIND"] },
    { name: "guided, typed yes",    inputs: ["ADD", "Chidi Okeke", "08012345678", "2500", "7", "yes"] },
    { name: "one-shot, remind",     inputs: ["ADD Chidi Okeke 08012345678 2500 7d", "REMIND"] },
    { name: "one-shot, no due",     inputs: ["ADD Ada 08031234567 1500", "REMIND"] },
    { name: "one-shot, no remind",  inputs: ["ADD Ada 08031234567 1500", "NOREMIND"] },
  ];

  for (const j of journeys) {
    const { effects } = converse(j.inputs);
    assert.ok(
      effects.includes("CREATE_CREDIT"),
      `"${j.name}" finished without writing the credit — the vendor's work would be lost`,
    );
  }
});

test("INVARIANT the debtor's number is confirmed before the credit is written", () => {
  // Catches: the one-shot form skipping confirmation, so a mistyped digit
  // logged the debt against a stranger who then received the reminders.
  const paths: Array<{ name: string; inputs: string[]; phone: string }> = [
    { name: "guided",   inputs: ["ADD", "Chidi Okeke", "08012345678", "2500", "7"], phone: "08012345678" },
    { name: "one-shot", inputs: ["ADD Chidi Okeke 08012345678 2500 7d"],            phone: "08012345678" },
  ];

  for (const p of paths) {
    const { last } = converse(p.inputs);
    assert.ok(
      last.reply.includes(p.phone),
      `"${p.name}" reached the save step without showing the number back to the vendor`,
    );
  }
});

// ── Invariant 1b: the bot understands how vendors actually type ──────────────

test("INVARIANT every documented command still resolves exactly as before", () => {
  // Regression guard for the language layer: the tolerant matcher must never
  // change what an existing command does.
  const exact: Array<[string, string]> = [
    ["START", "START"], ["ADD", "ADD"], ["INVOICE", "INVOICE"], ["LIST", "LIST"],
    ["PAID", "PAID"], ["SCORE", "SCORE"], ["HELP", "HELP"], ["DASHBOARD", "DASHBOARD"],
    ["SUPPORT", "SUPPORT"], ["ACCOUNT", "BANK"],
    ["PAID Chidi", "PAID"], ["SCORE Ada", "SCORE"],
    ["ADD Chidi 08012345678 2500", "ADD"],
  ];
  for (const [input, expected] of exact) {
    assert.equal(detectIntent(input), expected, `"${input}" must still mean ${expected}`);
  }
});

test("INVARIANT natural phrasing, Pidgin and typos reach the right command", () => {
  // Every one of these previously fell through to "Sorry, I didn't catch that",
  // which is the moment a vendor decides the bot is broken and stops using it.
  const natural: Array<[string, string]> = [
    ["add credit", "ADD"],
    ["i want to add credit", "ADD"],
    ["abeg add credit for chidi", "ADD"],
    ["record debt", "ADD"],
    ["who is owing me", "LIST"],
    ["who dey owe me", "LIST"],
    ["show my list", "LIST"],
    ["my debtors", "LIST"],
    ["check my book", "LIST"],
    ["mark as paid", "PAID"],
    ["customer don pay", "PAID"],
    ["send invoice", "INVOICE"],
    ["create invoice", "INVOICE"],
    ["check score", "SCORE"],
    ["can i trust this person", "SCORE"],
    ["my account details", "BANK"],
    ["set my bank", "BANK"],
    ["talk to human", "SUPPORT"],
    ["what can you do", "HELP"],
    ["open dashboard", "DASHBOARD"],
    // typos
    ["hlep", "HELP"],
    ["invoce", "INVOICE"],
    ["dashbord", "DASHBOARD"],
    ["acount", "BANK"],
  ];
  for (const [input, expected] of natural) {
    assert.equal(detectIntent(input), expected, `"${input}" should reach ${expected}`);
  }
});

test("INVARIANT invoice template names are normalised for Meta", () => {
  const previous = process.env.WHATSAPP_INVOICE_TEMPLATE_NAME;
  try {
    delete process.env.WHATSAPP_INVOICE_TEMPLATE_NAME;
    assert.equal(resolveInvoiceTemplateName(), DEFAULT_INVOICE_TEMPLATE);

    process.env.WHATSAPP_INVOICE_TEMPLATE_NAME = "Vodium Invoice";
    assert.equal(resolveInvoiceTemplateName(), "vodium_invoice");

    process.env.WHATSAPP_INVOICE_TEMPLATE_NAME = "!!!";
    assert.equal(resolveInvoiceTemplateName(), DEFAULT_INVOICE_TEMPLATE);
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_INVOICE_TEMPLATE_NAME;
    else process.env.WHATSAPP_INVOICE_TEMPLATE_NAME = previous;
  }
});

test("INVARIANT the matcher stays strict enough not to hijack real data", () => {
  // Customer names and free text must NOT be mistaken for commands, or the bot
  // would run the wrong action on someone's ledger.
  for (const notACommand of [
    "Chidi Okeke", "Adebayo", "Mama Bisi Provisions", "Blessing",
    "08012345678", "2500", "he said he will pay me next tomorrow morning",
  ]) {
    assert.equal(detectIntent(notACommand), "FREE_TEXT", `"${notACommand}" must not be read as a command`);
  }
});

test("INVARIANT amounts and dates accept how vendors write them", () => {
  assert.equal(parseAmount("2500"), 2500);
  assert.equal(parseAmount("₦2,500"), 2500);
  assert.equal(parseAmount("2500 naira"), 2500);
  assert.equal(parseAmount("2k"), 2000);
  assert.equal(parseAmount("2.5k"), 2500);
  // Junk must still be refused rather than guessed.
  assert.equal(parseAmount("plenty"), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount(""), null);

  assert.equal(parseDueDuration("tomorrow"), 1440);
  assert.equal(parseDueDuration("next week"), 7 * 1440);
  assert.equal(parseDueDuration("two weeks"), 14 * 1440);
  assert.equal(parseDueDuration("7"), 7 * 1440);
  assert.equal(parseDueDuration("2h"), 120);
  assert.equal(parseDueDuration("rubbish"), null);
});

// ── Invariant 2: no dead ends ────────────────────────────────────────────────

test("INVARIANT every multi-step flow can always be cancelled", () => {
  // A vendor stuck in a flow with no way out will abandon the product.
  const midFlow: Array<[string, Record<string, unknown>]> = [
    ["ADDING_CREDIT_STUDENT",  {}],
    ["ADDING_CREDIT_PHONE",    { creditCustomerName: "Ada" }],
    ["ADDING_CREDIT_AMOUNT",   { creditCustomerName: "Ada" }],
    ["ADDING_CREDIT_DUE",      { creditCustomerName: "Ada", creditAmount: 100 }],
    ["ADDING_CREDIT_REMINDER", { creditCustomerName: "Ada", creditAmount: 100, creditDueMinutes: 60 }],
    ["VERIFYING_CUSTOMER",     { pvPhone: "+2348012345678", pvHmac: "h", pvExpiresAt: Date.now() + 60_000 }],
    ["MARKING_PAID",           {}],
    ["LOOKING_UP_SCORE",       {}],
    ["IDLE",                   { invStep: "items", invItems: [] }],
    ["IDLE",                   { bankStep: "number", bankName: "GTBank" }],
  ];

  for (const [state, context] of midFlow) {
    const r = send(state, context, "CANCEL");
    assert.equal(r.nextState, "IDLE", `${state} could not be cancelled`);
    assert.ok(r.buttons?.length, `${state} left the vendor with no next action after cancelling`);
  }
});

test("INVARIANT HELP always works, even mid-flow, without corrupting state", () => {
  for (const state of ["ADDING_CREDIT_AMOUNT", "ADDING_CREDIT_REMINDER", "VERIFYING_CUSTOMER", "MARKING_PAID"]) {
    const r = send(state, { creditCustomerName: "Ada" }, "HELP");
    assert.equal(r.nextState, "IDLE");
    assert.ok(r.list || r.buttons?.length, `HELP from ${state} offered no way forward`);
  }
});

test("INVARIANT unparseable input never silently drops a vendor out of a flow", () => {
  // Junk at a step must re-ask, not abandon the half-built credit.
  const cases: Array<[string, Record<string, unknown>]> = [
    ["ADDING_CREDIT_AMOUNT",   { creditCustomerName: "Ada" }],
    ["ADDING_CREDIT_DUE",      { creditCustomerName: "Ada", creditAmount: 100 }],
    ["ADDING_CREDIT_REMINDER", { creditCustomerName: "Ada", creditAmount: 100, creditDueMinutes: 60, creditCustomerPhone: "0801" }],
  ];
  for (const [state, context] of cases) {
    const r = send(state, context, "!!! nonsense !!!");
    assert.equal(r.nextState, state, `${state} dropped the vendor out of the flow on bad input`);
    assert.equal(r.sideEffects, undefined, `${state} wrote data from unparseable input`);
  }
});

// ── Invariant 3: reminders actually fire ─────────────────────────────────────

test("INVARIANT a WhatsApp template name is rejected before it wastes API calls", () => {
  // Production had WHATSAPP_OTP_TEMPLATE_NAME set to "Vodium Ledger" — the
  // business display name, not a template. Every OTP therefore made two doomed
  // Meta calls (~2s) before falling back, and first-time customers, who can
  // ONLY be reached by template, silently received no code at all.
  assert.equal(isValidTemplateName("otp_code"), true);
  assert.equal(isValidTemplateName("verification_code_2"), true);

  assert.equal(isValidTemplateName("Vodium Ledger"), false, "display names are not template names");
  assert.equal(isValidTemplateName("OTP_CODE"), false, "uppercase is invalid");
  assert.equal(isValidTemplateName("otp-code"), false, "hyphens are invalid");
  assert.equal(isValidTemplateName(""), false);

  // A loosely-written name is coerced rather than abandoned, so an existing
  // template still gets used: "Vodium Ledger" → "vodium_ledger".
  assert.equal(normaliseTemplateName("Vodium Ledger"), "vodium_ledger");
  assert.equal(normaliseTemplateName("OTP Code"), "otp_code");
  assert.equal(normaliseTemplateName("otp-code"), "otp_code");
  assert.equal(normaliseTemplateName("  Verification Code  "), "verification_code");
  // Already valid names pass through untouched.
  assert.equal(normaliseTemplateName("otp_code"), "otp_code");
  // Nothing usable left → null, and the caller skips the template path.
  assert.equal(normaliseTemplateName("!!!"), null);
});

test("INVARIANT the cron endpoints an external scheduler calls still exist", () => {
  // Scheduling happens OUTSIDE this repo (cron-job.org), so these URLs are a
  // public contract. Renaming or moving one of these routes would stop that
  // schedule firing with no build error and no other test failure — reminders
  // would simply go quiet, exactly the failure merchants reported.
  for (const endpoint of ["reminders", "daily", "subscriptions"]) {
    const route = new URL(`../src/app/api/cron/${endpoint}/route.ts`, import.meta.url);
    assert.ok(
      existsSync(route),
      `/api/cron/${endpoint} is gone — the external scheduler still calls it and would 404 silently`,
    );
    assert.match(
      readFileSync(route, "utf8"),
      /CRON_SECRET/,
      `/api/cron/${endpoint} must stay protected by CRON_SECRET`,
    );
  }
});

test("INVARIANT the required external cron cadence stays documented", () => {
  // Reminders are scheduled OUTSIDE this repo (cron-job.org), so no test can
  // read the real schedule. What a test CAN do is pin the requirement: the
  // shortest window the bot's own menu produces is 10 minutes ("30M" credits),
  // so the external job must run at least that often. If someone tightens the
  // lead times below this, that scheduler has to be tightened too — and this
  // failure is where they find out.
  const shortestWindow = reminderLeadMinutesForDue(30);
  assert.equal(
    shortestWindow,
    10,
    "shortest reminder window changed — update the cron-job.org interval to match",
  );

  // The requirement must stay written down where the next person will look.
  const routeSrc = readFileSync(
    new URL("../src/app/api/cron/reminders/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    routeSrc,
    /every 5 minutes|external scheduler|cron-job/i,
    "the reminders route must document how often it needs to be called",
  );
});

test("INVARIANT a credit inside its window is always reminder-due", () => {
  // This is the "reminders stopped working" class of complaint, made testable.
  const now = new Date("2026-07-01T12:00:00Z");
  const mins = (n: number) => new Date(now.getTime() + n * 60_000);

  // A 7-day credit gets a 2-day lead: due in 1 day → send; due in 5 days → wait.
  const weekLong = { dateExtended: mins(-7 * 1440), dueDate: mins(1440) };
  assert.equal(isReminderDue(weekLong, now), true, "a credit due tomorrow must be reminded");

  const weekLongEarly = { dateExtended: now, dueDate: mins(7 * 1440) };
  assert.equal(isReminderDue(weekLongEarly, now), false, "a week away is too early");

  // A 2-hour credit gets a 30-minute lead — short debts must not be forgotten.
  const twoHour = { dateExtended: mins(-90), dueDate: mins(30) };
  assert.equal(isReminderDue(twoHour, now), true, "short credits must still be reminded");

  // Anything already overdue is unambiguously due.
  const overdue = { dateExtended: mins(-2880), dueDate: mins(-60) };
  assert.equal(isReminderDue(overdue, now), true, "an overdue credit must always be reminded");

  // The lead time must always be positive, or nothing would ever send.
  for (const window of [1, 30, 120, 1440, 10080, 43200]) {
    assert.ok(reminderLeadMinutesForDue(window) > 0, `lead time collapsed to 0 for a ${window}-minute credit`);
  }

  // A lead shorter than the 5-minute cron gap can fall entirely between two
  // ticks — the credit would go straight to OVERDUE with no pre-due nudge.
  // Every window ≥ 6 minutes must therefore open its reminder window at least
  // one cron interval before due; shorter ones open immediately.
  for (const window of [6, 8, 10]) {
    assert.ok(
      reminderLeadMinutesForDue(window) >= 6,
      `a ${window}-minute credit's reminder window is narrower than the cron interval`,
    );
  }
  assert.equal(reminderLeadMinutesForDue(3), 3, "ultra-short credits must open their window immediately");
});

/**
 * Every path that sends a customer a WhatsApp reminder must skip numbers Meta
 * has flagged permanently undeliverable, and must record new ones.
 *
 * This is a real regression, not a hypothetical: `sendOverdueReminders` was the
 * one sender missing both halves, so a single unreachable customer failed on
 * every 5-minute cron run indefinitely — burning Meta quota and masking real
 * failures behind a permanent `failed=1`.
 */
test("every reminder sender skips and records unreachable numbers", () => {
  const lifecycle = readFileSync("src/lib/credit-lifecycle.ts", "utf8");
  const preDue = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");

  // Both senders in credit-lifecycle (overdue + escalation) plus the pre-due
  // route filter blocked customers out of their query.
  const filters = lifecycle.match(/whatsappBlockedAt:\s*null/g) ?? [];
  assert.equal(filters.length, 2, "overdue AND escalation must filter blocked customers");
  assert.match(preDue, /whatsappBlockedAt:\s*null/, "pre-due reminders must filter blocked customers");

  // ...and each records a newly-discovered permanent failure so it is skipped
  // next run. Three senders, three writes.
  const writes = (lifecycle.match(/whatsappBlockedAt:\s*now/g) ?? []).length
    + (preDue.match(/whatsappBlockedAt:\s*now/g) ?? []).length;
  assert.equal(writes, 3, "each reminder sender must record permanent failures");

  // The permanent-failure branch is what drives it — a plain catch that only
  // counts failures would satisfy the checks above but still retry forever.
  assert.equal(
    (lifecycle.match(/err\.permanent/g) ?? []).length, 2,
    "both lifecycle senders must branch on WhatsAppSendError.permanent",
  );
});

// ── Real production failures: pasted phone numbers and polluted names ────────
//
// Vendors paste numbers the way their phone shows them ("+234 815 977 8234").
// That parse used to fail, the bot fell back to asking step by step, and the
// vendor pasted the whole command again — which was saved VERBATIM as the
// customer's name. Production had customers named
// "David  +234 815 977 8234  4500  30m", and reminders greeted them so.

test("one-shot ADD handles phone numbers pasted with spaces and punctuation", () => {
  const spaced = parseQuickCredit("ADD David +234 815 977 8234 4500 30m");
  assert.ok(spaced, "spaced NG number must parse");
  assert.equal(spaced!.customerName, "David");
  assert.equal(spaced!.customerPhone, "+2348159778234");
  assert.equal(spaced!.amount, 4500);
  assert.equal(spaced!.dueInMinutes, 30);

  const punct = parseQuickCredit("ADD Clement Isaac +1 (229) 672-8093 2500 7d");
  assert.ok(punct, "parenthesised US number must parse");
  assert.equal(punct!.customerName, "Clement Isaac");
  assert.equal(punct!.customerPhone, "+1(229)672-8093");
  assert.equal(punct!.amount, 2500);

  // Unspaced input keeps working exactly as before.
  const plain = parseQuickCredit("add Chidi Okeke 08012345678 2500 7d");
  assert.ok(plain);
  assert.equal(plain!.customerPhone, "08012345678");
  assert.equal(plain!.customerName, "Chidi Okeke");
});

test("a phone number is never misread as a ₦-billions amount", () => {
  // No amount given — the merged phone is the last token. Reject, don't
  // book ₦12,296,728,093 on someone's ledger.
  assert.equal(parseQuickCredit("ADD Clement Isaac +1 (229) 672-8093 30M"), null);
  assert.equal(parseQuickCredit("ADD Bola 0803 123 4567"), null);
});

test("the name step never saves a pasted command as the customer's name", () => {
  // Full command pasted at the "who took the credit?" prompt → parsed as one,
  // straight to the confirm step.
  const pasted = send("ADDING_CREDIT_STUDENT", {}, "ADD Chidi Okeke 08012345678 2500 7d");
  assert.equal(pasted.nextState, "ADDING_CREDIT_REMINDER");
  assert.equal(pasted.contextPatch?.creditCustomerName, "Chidi Okeke");
  assert.equal(pasted.contextPatch?.creditCustomerPhone, "08012345678");

  // A leaked command word is stripped — "ADD Lekan" is a customer called Lekan.
  const leaked = send("ADDING_CREDIT_STUDENT", {}, "ADD Lekan");
  assert.equal(leaked.nextState, "ADDING_CREDIT_PHONE");
  assert.equal(leaked.contextPatch?.creditCustomerName, "Lekan");

  // A "name" carrying a phone number's worth of digits is re-asked, not saved.
  const garbage = send("ADDING_CREDIT_STUDENT", {}, "Clement Isaac +1 (229) 672-8093 30M");
  assert.equal(garbage.nextState, "ADDING_CREDIT_STUDENT");

  // An ordinary name still flows through untouched.
  const ok = send("ADDING_CREDIT_STUDENT", {}, "Chidi Okeke");
  assert.equal(ok.nextState, "ADDING_CREDIT_PHONE");
  assert.equal(ok.contextPatch?.creditCustomerName, "Chidi Okeke");
});

test("an inbound message from a flagged customer clears the unreachable flag", () => {
  // Self-heal: any inbound message proves the number can reach us, so the
  // webhook must clear whatsappBlockedAt — otherwise a customer flagged by a
  // transient Meta error (or who unblocked the bot) stays silenced forever.
  const webhook = readFileSync("src/app/api/whatsapp/route.ts", "utf8");
  assert.match(webhook, /whatsappBlockedAt:\s*\{\s*not:\s*null\s*\}/, "webhook must look for flagged senders");
  assert.match(webhook, /data:\s*\{\s*whatsappBlockedAt:\s*null\s*\}/, "webhook must clear the flag");
});

test("no OTP path claims 'code sent' when nothing was delivered", () => {
  // sendOtpCode returns channel "console" when it delivered nothing. Every
  // caller must branch on that instead of pretending.
  const webhook = readFileSync("src/app/api/whatsapp/route.ts", "utf8");
  assert.ok(webhook.includes("verifyCantReach"), "bot must have an honest can't-reach reply");
  const credits = readFileSync("src/app/api/credits/route.ts", "utf8");
  assert.match(credits, /delivered:\s*channel === "whatsapp"/, "web API must report delivery honestly");
});

// ── New-debtor verification and OTP template resolution ──────────────────────

test("OTP template name resolves without any env configuration", () => {
  const prev = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  try {
    // Unset → the platform default the admin console creates. This is what
    // makes "create template" a one-click setup with no env change.
    delete process.env.WHATSAPP_OTP_TEMPLATE_NAME;
    assert.equal(resolveConfiguredTemplateName(), DEFAULT_OTP_TEMPLATE_NAME);

    // A loosely-written override is coerced, an exact one passes through.
    process.env.WHATSAPP_OTP_TEMPLATE_NAME = "Vodium Ledger";
    assert.equal(resolveConfiguredTemplateName(), "vodium_ledger");
    process.env.WHATSAPP_OTP_TEMPLATE_NAME = "otp_code";
    assert.equal(resolveConfiguredTemplateName(), "otp_code");

    // Garbage never blocks OTP — fall back to the default rather than none.
    process.env.WHATSAPP_OTP_TEMPLATE_NAME = "!!!";
    assert.equal(resolveConfiguredTemplateName(), DEFAULT_OTP_TEMPLATE_NAME);
  } finally {
    if (prev === undefined) delete process.env.WHATSAPP_OTP_TEMPLATE_NAME;
    else process.env.WHATSAPP_OTP_TEMPLATE_NAME = prev;
  }
});

test("a new debtor can be saved without a code, an existing customer cannot", () => {
  // The state machine forwards the skip as a side effect…
  const r = send("VERIFYING_CUSTOMER", { pvNew: true, pvPhone: "+2348012345678" }, "SKIP_VERIFY");
  assert.equal(r.sideEffects?.[0]?.type, "SKIP_VERIFY");

  // …and the webhook re-checks pvNew server-side before honouring it — a
  // forged button press must never join an existing customer's record.
  const webhook = readFileSync("src/app/api/whatsapp/route.ts", "utf8");
  assert.match(webhook, /case "SKIP_VERIFY":[\s\S]{0,600}pvNew !== true/, "SKIP_VERIFY must re-check pvNew");

  // The web API mirrors it: skipVerification only exists in the NEW-student
  // branch; the existing-student branch still demands the code.
  const credits = readFileSync("src/app/api/credits/route.ts", "utf8");
  const existingBranch = credits.slice(credits.indexOf("if (existingStudent) {"), credits.indexOf("} else {"));
  assert.ok(!existingBranch.includes("skipVerification"), "existing customers must never be skippable");
});

test("verification still never blocks cancelling", () => {
  const r = send("VERIFYING_CUSTOMER", { pvNew: true, pvPhone: "+2348012345678", pvHmac: "h", pvExpiresAt: Date.now() + 60_000 }, "CANCEL");
  assert.equal(r.nextState, "IDLE");
});

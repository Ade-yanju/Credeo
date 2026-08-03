import test from "node:test";
import assert from "node:assert/strict";

// Env is read lazily inside the functions, so setting it here (before the tests
// run) is sufficient even though the imports are hoisted. Set unconditionally so
// the test is hermetic regardless of any (possibly invalid) CI env value.
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); // valid 32-byte key

import { normalisePhone, formatNaira } from "../src/lib/utils";
import { encryptSecret, decryptSecret } from "../src/lib/crypto/secrets";
import { signOrderToken, verifyOrderToken, signAmbassadorToken, verifyAmbassadorToken, signInvoiceToken } from "../src/lib/bnpl-token";
import { normaliseAmbassadorCode } from "../src/lib/referral";
import { detectIntent, parseInvoiceItem, parseQuickCredit, step, type SessionContext } from "../src/lib/whatsapp/state-machine";
import { isPermanentFailure, parseMetaErrorCode } from "../src/lib/whatsapp/outbound";
import { WhatsAppSendError } from "../src/lib/whatsapp/outbound";
import {
  deliverThenUpgrade,
  isTemplateUnusable,
  type DeliveryChannel,
} from "../src/lib/whatsapp/session-window";
import { contactPhoneFrom } from "../src/lib/whatsapp/contact";
import { messages, payToBlock } from "../src/lib/whatsapp/messages";
import { signVerification, verifyVerification, maskPhone } from "../src/lib/customer-verify-token";
import { ADMIN_ROUTE_ROLES } from "../src/lib/session-cookies";

test("normalisePhone handles Nigerian formats", () => {
  assert.equal(normalisePhone("08031234567"), "+2348031234567");
  assert.equal(normalisePhone("+2348031234567"), "+2348031234567");
  assert.equal(normalisePhone("2348031234567"), "+2348031234567");
  assert.equal(normalisePhone("123"), null);
});

test("formatNaira formats with the naira sign and separators", () => {
  const out = formatNaira(1000000);
  assert.match(out, /₦/);
  assert.match(out, /1,000,000/);
});

test("secret encryption round-trips and rejects tampering", () => {
  const enc = encryptSecret("super-secret-token");
  assert.ok(enc, "expected ciphertext");
  assert.equal(decryptSecret(enc), "super-secret-token");
  assert.equal(decryptSecret(enc!.slice(0, -3) + "xxx"), null); // tampered
  assert.equal(decryptSecret("not-a-token"), null);
});

test("bnpl order token signs and verifies, rejects tampering", () => {
  const token = signOrderToken("order_abcdef123456");
  assert.equal(verifyOrderToken(token), "order_abcdef123456");
  assert.equal(verifyOrderToken(token + "x"), null);
  assert.equal(verifyOrderToken("garbage.token"), null);
});

test("parseInvoiceItem reads item lines and rejects junk", () => {
  assert.deepEqual(parseInvoiceItem("Rice, 2, 1500"), { name: "Rice", quantity: 2, unitPrice: 1500 });
  assert.deepEqual(parseInvoiceItem("Delivery, 500"), { name: "Delivery", quantity: 1, unitPrice: 500 });
  assert.deepEqual(parseInvoiceItem("Jollof pack, 3, ₦1,200"), { name: "Jollof pack", quantity: 3, unitPrice: 1200 });
  assert.equal(parseInvoiceItem("just some text"), null);
  assert.equal(parseInvoiceItem("Rice, 0, 100"), null);
  assert.equal(parseInvoiceItem("500, 2"), null);
});

test("WhatsApp invoice flow walks to a CREATE_INVOICE side effect", () => {
  const send = (context: Record<string, unknown>, body: string) =>
    step(
      { state: "IDLE", context, vendorId: "vendor_1" } as SessionContext,
      { body, fromPhone: "+2348030000000" },
    );
  const advance = (context: Record<string, unknown>, patch?: Record<string, unknown>) =>
    ({ ...context, ...(patch ?? {}) });

  assert.equal(detectIntent("invoice"), "INVOICE");

  let ctx: Record<string, unknown> = {};
  let r = send(ctx, "INVOICE");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.invStep, "customer");

  r = send(ctx, "Chidi Okeke");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.invStep, "phone");

  r = send(ctx, "08012345678");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.invStep, "items");

  r = send(ctx, "Rice, 2, 1500");
  ctx = advance(ctx, r.contextPatch);
  r = send(ctx, "Delivery, 500");
  ctx = advance(ctx, r.contextPatch);
  assert.equal((ctx.invItems as unknown[]).length, 2);

  r = send(ctx, "not an item at all");
  assert.match(r.reply, /couldn't read that item/i);

  r = send(ctx, "DONE");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.invStep, "due");

  r = send(ctx, "7");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.invStep, "confirm");
  assert.match(r.reply, /3,500/); // 2×1500 + 500

  r = send(ctx, "SEND");
  ctx = advance(ctx, r.contextPatch);
  const effect = r.sideEffects?.[0];
  assert.ok(effect && effect.type === "CREATE_INVOICE");
  if (effect?.type === "CREATE_INVOICE") {
    assert.equal(effect.data.customerName, "Chidi Okeke");
    assert.equal(effect.data.items.length, 2);
    assert.equal(effect.data.dueInMinutes, 7 * 1440);
  }
  assert.equal(ctx.invStep, null); // flow context cleared
});

test("shared WhatsApp contact card yields the customer's number", () => {
  // The exact shape Meta delivers for 📎 → Contact.
  assert.equal(
    contactPhoneFrom([{ name: { formatted_name: "Chidi" }, phones: [{ phone: "+234 801 234 5678", wa_id: "2348012345678", type: "CELL" }] }]),
    "2348012345678",
    "prefers the normalised wa_id",
  );
  // Contact not on WhatsApp → no wa_id, only a formatted phone. Still usable.
  assert.equal(
    contactPhoneFrom([{ phones: [{ phone: "0803-123-4567" }] }]),
    "0803-123-4567",
  );
  // Several numbers: take the first that has enough digits.
  assert.equal(
    contactPhoneFrom([{ phones: [{ phone: "123" }, { wa_id: "2348030000000" }] }]),
    "2348030000000",
  );
  // Email-only card (no phones) → nothing, so the bot ignores it gracefully.
  assert.equal(contactPhoneFrom([{ name: { formatted_name: "No Phone" }, phones: [] }]), undefined);
  assert.equal(contactPhoneFrom(undefined), undefined);

  // End to end: sharing a contact at the phone step advances the ADD flow.
  const shared = contactPhoneFrom([{ phones: [{ wa_id: "2348012345678" }] }]);
  const r = step(
    { state: "ADDING_CREDIT_PHONE", context: { creditCustomerName: "Chidi" }, vendorId: "vendor_1" } as SessionContext,
    { body: shared!, fromPhone: "+2348030000000" },
  );
  assert.equal(r.nextState, "ADDING_CREDIT_AMOUNT", "the shared number is accepted as the phone");
  assert.equal(r.contextPatch?.creditCustomerPhone, "2348012345678");
});

test("vendor bank details render on reminders, and are optional", () => {
  assert.equal(payToBlock(undefined), "", "no details → no block");
  assert.equal(payToBlock({ bankName: "GTBank" }), "", "account number required too");

  const block = payToBlock({ bankName: "GTBank", bankAccountNumber: "0123456789", bankAccountName: "Mama Bisi Stores" });
  assert.match(block, /Pay to/);
  assert.match(block, /GTBank/);
  assert.match(block, /0123456789/);
  assert.match(block, /Mama Bisi Stores/);

  // The block must actually reach the customer-facing reminder.
  const reminder = messages.reminderToCustomer("Chidi", "Mama Bisi Stores", 2500, "tomorrow", block);
  assert.match(reminder, /0123456789/);
  // ...and its absence must not leave a hole in the copy.
  const plain = messages.reminderToCustomer("Chidi", "Mama Bisi Stores", 2500, "tomorrow");
  assert.doesNotMatch(plain, /Pay to/);
  assert.match(plain, /Reply \*PAID\*/);
});

test("ACCOUNT flow collects bank details and saves them", () => {
  const send = (context: Record<string, unknown>, body: string) =>
    step({ state: "IDLE", context, vendorId: "vendor_1" } as SessionContext, { body, fromPhone: "+2348030000000" });
  const advance = (c: Record<string, unknown>, p?: Record<string, unknown>) => ({ ...c, ...(p ?? {}) });

  assert.equal(detectIntent("ACCOUNT"), "BANK");
  assert.equal(detectIntent("bank"), "BANK");

  let ctx: Record<string, unknown> = {};
  let r = send(ctx, "ACCOUNT");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.bankStep, "name");

  r = send(ctx, "GTBank");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.bankStep, "number");

  // Junk account numbers are rejected rather than saved.
  const bad = send(ctx, "abc");
  assert.match(bad.reply, /doesn't look like an account number/i);
  assert.equal(bad.contextPatch, undefined);

  r = send(ctx, "0123456789");
  ctx = advance(ctx, r.contextPatch);
  assert.equal(ctx.bankStep, "account");
  assert.equal(ctx.bankAccountNumber, "0123456789");

  r = send(ctx, "Mama Bisi Stores");
  ctx = advance(ctx, r.contextPatch);
  const effect = r.sideEffects?.[0];
  assert.ok(effect && effect.type === "SAVE_BANK");
  if (effect?.type === "SAVE_BANK") {
    assert.equal(effect.data.bankName, "GTBank");
    assert.equal(effect.data.accountNumber, "0123456789");
    assert.equal(effect.data.accountName, "Mama Bisi Stores");
  }
  assert.equal(ctx.bankStep, null, "flow context cleared after saving");
});

test("one-shot ADD collapses six prompts into one message", () => {
  const q = parseQuickCredit("ADD Chidi Okeke 08012345678 2500 7d");
  assert.ok(q, "should parse the documented one-shot form");
  assert.equal(q!.customerName, "Chidi Okeke");
  assert.equal(q!.customerPhone, "08012345678");
  assert.equal(q!.amount, 2500);
  assert.equal(q!.dueInMinutes, 7 * 1440);

  // Due date is optional and defaults to a week.
  const noDue = parseQuickCredit("ADD Ada 08031234567 1500");
  assert.equal(noDue?.dueInMinutes, 7 * 1440);
  assert.equal(noDue?.amount, 1500);

  // A trailing bare number is the AMOUNT, never "N days" — otherwise
  // "ADD Ada 0803... 1500" would silently become a 1500-day credit.
  assert.equal(parseQuickCredit("ADD Ada 08031234567 1500")?.amount, 1500);

  // Money formatting and other due forms survive.
  assert.equal(parseQuickCredit("ADD Ada 08031234567 ₦2,500 END")?.amount, 2500);
  assert.equal(parseQuickCredit("ADD Ada 08031234567 900 2h")?.dueInMinutes, 120);

  // Incomplete input falls back to the guided flow rather than guessing.
  assert.equal(parseQuickCredit("ADD"), null);
  assert.equal(parseQuickCredit("ADD Chidi"), null);
  assert.equal(parseQuickCredit("ADD Chidi 2500"), null, "no phone → guided flow");
  assert.equal(parseQuickCredit("ADD Chidi 08012345678 abc"), null, "no amount");

  // And the intent router must recognise the argument form at all.
  assert.equal(detectIntent("ADD Chidi 08012345678 2500"), "ADD");
  assert.equal(detectIntent("ADD"), "ADD");
});

test("one-shot ADD jumps straight to the reminder question", () => {
  const r = step(
    { state: "IDLE", context: {}, vendorId: "vendor_1" } as SessionContext,
    { body: "ADD Chidi Okeke 08012345678 2500 7d", fromPhone: "+2348030000000" },
  );
  assert.equal(r.nextState, "ADDING_CREDIT_REMINDER");
  assert.equal(r.contextPatch?.creditCustomerName, "Chidi Okeke");
  assert.equal(r.contextPatch?.creditAmount, 2500);
  // The parsed phone MUST be echoed back before saving — a mistyped digit would
  // otherwise log the debt against a stranger, who then receives the reminders.
  assert.match(r.reply, /08012345678/, "confirmation must show the number");
  assert.match(r.reply, /Chidi Okeke/);
  assert.deepEqual(r.buttons?.map((b) => b.id), ["REMIND", "NOREMIND", "CANCEL"]);
  for (const b of r.buttons ?? []) assert.ok(b.title.length <= 20, `too long: ${b.title}`);
});

test("permanent vs transient WhatsApp failures are classified correctly", () => {
  // Blocked / not-on-WhatsApp → never retry.
  assert.equal(isPermanentFailure(400, 131026), true, "undeliverable");
  assert.equal(isPermanentFailure(400, 100), true, "invalid number");
  // Rate limits and outages → always retry.
  assert.equal(isPermanentFailure(429, 131026), false, "rate limit wins");
  assert.equal(isPermanentFailure(500), false);
  assert.equal(isPermanentFailure(503, 100), false, "outage wins");
  // Unknown 4xx → treat as transient rather than silently giving up.
  assert.equal(isPermanentFailure(400, 999999), false);
  assert.equal(isPermanentFailure(400), false);

  assert.equal(parseMetaErrorCode('{"error":{"code":131026,"message":"x"}}'), 131026);
  assert.equal(parseMetaErrorCode("not json"), undefined);
});

test("ADD flow asks whether to remind the customer and stores the choice", () => {
  const send = (state: string, context: Record<string, unknown>, body: string) =>
    step(
      { state, context, vendorId: "vendor_1" } as SessionContext,
      { body, fromPhone: "+2348030000000" },
    );

  // Due date answered → bot asks the reminder question with tappables.
  const askReminder = send("ADDING_CREDIT_DUE", { creditCustomerName: "Ada", creditCustomerPhone: "0801", creditAmount: 2500 }, "7");
  assert.equal(askReminder.nextState, "ADDING_CREDIT_REMINDER");
  assert.deepEqual(askReminder.buttons?.map((b) => b.id), ["REMIND", "NOREMIND", "CANCEL"]);
  assert.equal(askReminder.contextPatch?.creditDueMinutes, 7 * 1440);
  assert.match(askReminder.reply, /0801/, "guided flow must also confirm the number");

  const ctx = { creditCustomerName: "Ada", creditCustomerPhone: "0801", creditAmount: 2500, creditDueMinutes: 7 * 1440 };

  // Opting out saves the credit with reminders disabled.
  const optOut = send("ADDING_CREDIT_REMINDER", ctx, "NOREMIND");
  const offEffect = optOut.sideEffects?.[0];
  assert.ok(offEffect && offEffect.type === "CREATE_CREDIT");
  if (offEffect?.type === "CREATE_CREDIT") assert.equal(offEffect.data.remindersEnabled, false);
  assert.match(optOut.reply, /won't message them/i);

  // Opting in (tap or typed YES) keeps reminders on.
  const optIn = send("ADDING_CREDIT_REMINDER", ctx, "yes");
  const onEffect = optIn.sideEffects?.[0];
  if (onEffect?.type === "CREATE_CREDIT") assert.equal(onEffect.data.remindersEnabled, true);
  assert.match(optIn.reply, /reminder/i);

  // Anything else re-asks instead of guessing.
  const retry = send("ADDING_CREDIT_REMINDER", ctx, "maybe");
  assert.equal(retry.nextState, "ADDING_CREDIT_REMINDER");
  assert.equal(retry.sideEffects, undefined);
});

test("ambassador codes normalise and reject junk", () => {
  assert.equal(normaliseAmbassadorCode("tunde"), "TUNDE");
  assert.equal(normaliseAmbassadorCode("  Tunde  "), "TUNDE");
  assert.equal(normaliseAmbassadorCode("UNILAG-01"), "UNILAG-01");
  assert.equal(normaliseAmbassadorCode("ab"), null, "too short");
  assert.equal(normaliseAmbassadorCode("-LEAD"), null, "cannot start with a dash");
  assert.equal(normaliseAmbassadorCode("tun de"), null, "no spaces");
  assert.equal(normaliseAmbassadorCode("../../etc"), null, "no path traversal");
  assert.equal(normaliseAmbassadorCode(undefined), null);
  assert.equal(normaliseAmbassadorCode(""), null);
});

test("ambassador stats tokens are signed and namespaced", () => {
  const token = signAmbassadorToken("amb_abcdef123456");
  assert.equal(verifyAmbassadorToken(token), "amb_abcdef123456");
  assert.equal(verifyAmbassadorToken(token + "x"), null, "tampered");
  assert.equal(verifyAmbassadorToken("garbage.token"), null);
  // Namespaces must not be interchangeable — an invoice link must never open
  // an ambassador's scoreboard.
  assert.equal(verifyAmbassadorToken(signInvoiceToken("amb_abcdef123456")), null);
  assert.equal(verifyOrderToken(signAmbassadorToken("amb_abcdef123456")), null);
});

test("every admin role can reach the shared /admin overview", () => {
  // A role missing from the catch-all is redirected from /admin to /admin —
  // an infinite redirect loop, not a permission error.
  const catchAllPage = ADMIN_ROUTE_ROLES.find((r) => r.prefix === "/admin");
  const catchAllApi  = ADMIN_ROUTE_ROLES.find((r) => r.prefix === "/api/admin");
  for (const role of ["SUPER_ADMIN", "CFO", "CUSTOMER_CARE", "ANALYTICS", "MARKETING"]) {
    assert.ok(catchAllPage?.roles.includes(role), `${role} missing from /admin catch-all`);
    assert.ok(catchAllApi?.roles.includes(role), `${role} missing from /api/admin catch-all`);
  }
});

test("each admin API mirrors the permissions of its page", () => {
  const rolesFor = (path: string) =>
    ADMIN_ROUTE_ROLES.find((r) => path.startsWith(r.prefix))?.roles ?? [];

  // An API must never be reachable by a role that cannot open the matching page,
  // or the UI restriction is cosmetic.
  for (const [page, api] of [
    ["/admin/support", "/api/admin/support/vendors"],
    ["/admin/vendors", "/api/admin/vendors/abc"],
    ["/admin/team", "/api/admin/team"],
    ["/admin/disputes", "/api/admin/disputes/abc"],
    ["/admin/organizations", "/api/admin/organizations"],
    ["/admin/marketing", "/api/admin/ambassadors"],
  ] as const) {
    assert.deepEqual(
      [...rolesFor(api)].sort(),
      [...rolesFor(page)].sort(),
      `${api} does not match the permissions of ${page}`,
    );
  }
});

test("marketing routes are restricted to super admin + marketing", () => {
  const roleFor = (path: string) =>
    ADMIN_ROUTE_ROLES.find((r) => path.startsWith(r.prefix))?.roles ?? [];

  for (const path of ["/admin/marketing", "/api/admin/ambassadors", "/api/admin/ambassadors/abc"]) {
    const roles = roleFor(path);
    assert.deepEqual([...roles].sort(), ["MARKETING", "SUPER_ADMIN"], `${path} must not fall through to the catch-all`);
  }
  // Marketing must not reach vendor or finance data.
  assert.ok(!roleFor("/admin/finance").includes("MARKETING"));
  assert.ok(!roleFor("/admin/vendors").includes("MARKETING"));
  assert.ok(!roleFor("/admin/disputes").includes("MARKETING"));
});

test("WhatsApp bot-profile route is super-admin only", () => {
  const roles = ADMIN_ROUTE_ROLES.find((r) => "/api/admin/whatsapp-profile".startsWith(r.prefix))?.roles ?? [];
  assert.deepEqual([...roles], ["SUPER_ADMIN"], "only the super admin manages the bot's public identity");
  // Must not fall through to a broader catch-all.
  assert.ok(roles.length === 1);
});

test("dispute routes are restricted to super admin + customer care", () => {
  // The rules are first-match-wins and end in a catch-all that allows every
  // role, so a dispute rule must be matched BEFORE "/admin" / "/api/admin".
  const roleFor = (path: string) =>
    ADMIN_ROUTE_ROLES.find((r) => path.startsWith(r.prefix))?.roles ?? [];

  for (const path of ["/admin/disputes", "/api/admin/disputes", "/api/admin/disputes/abc123"]) {
    const roles = roleFor(path);
    assert.deepEqual([...roles].sort(), ["CUSTOMER_CARE", "SUPER_ADMIN"], `${path} must not fall through to the catch-all`);
    assert.ok(!roles.includes("CFO"), `${path} must not be reachable by CFO`);
    assert.ok(!roles.includes("ANALYTICS"), `${path} must not be reachable by Analytics`);
  }
});

test("customer verification code signs, verifies, and rejects tampering/expiry", () => {
  const phone = "+2348031234567";
  const future = Date.now() + 60_000;
  const hmac = signVerification(phone, "123456", future);
  assert.equal(verifyVerification(phone, "123456", future, hmac), true);
  assert.equal(verifyVerification(phone, "000000", future, hmac), false, "wrong code");
  assert.equal(verifyVerification("+2348030000000", "123456", future, hmac), false, "wrong phone");
  assert.equal(verifyVerification(phone, "123456", Date.now() - 1000, hmac), false, "expired");
  assert.equal(verifyVerification(phone, "123456", future, hmac + "x"), false, "tampered hmac");
  assert.match(maskPhone(phone), /4567$/);
  assert.doesNotMatch(maskPhone(phone), /8031/);
});

test("ADD phone step requests a cross-vendor score preview", () => {
  const r = step(
    { state: "ADDING_CREDIT_PHONE", context: { creditCustomerName: "Ada" }, vendorId: "vendor_1" } as SessionContext,
    { body: "08031234567", fromPhone: "+2348030000000" },
  );
  assert.equal(r.nextState, "ADDING_CREDIT_AMOUNT");
  const preview = r.sideEffects?.[0];
  assert.ok(preview && preview.type === "SCORE_PREVIEW");
  if (preview?.type === "SCORE_PREVIEW") assert.equal(preview.data.customerPhone, "08031234567");
});

test("VERIFYING_CUSTOMER routes code entry, resend, and cancel", () => {
  const ctx = { pvPhone: "+2348031234567", pvHmac: "h", pvExpiresAt: Date.now() + 60_000, pcName: "Ada", pcAmount: 2500, pcDue: 10080, pcReminders: true };

  const code = step(
    { state: "VERIFYING_CUSTOMER", context: ctx, vendorId: "vendor_1" } as SessionContext,
    { body: "123456", fromPhone: "+2348030000000" },
  );
  const codeEffect = code.sideEffects?.[0];
  assert.ok(codeEffect && codeEffect.type === "VERIFY_CUSTOMER_CODE");
  if (codeEffect?.type === "VERIFY_CUSTOMER_CODE") assert.equal(codeEffect.data.code, "123456");

  const resend = step(
    { state: "VERIFYING_CUSTOMER", context: ctx, vendorId: "vendor_1" } as SessionContext,
    { body: "RESEND", fromPhone: "+2348030000000" },
  );
  assert.equal(resend.sideEffects?.[0]?.type, "RESEND_CUSTOMER_CODE");

  // Too-short input re-asks instead of firing a verify effect.
  const tooShort = step(
    { state: "VERIFYING_CUSTOMER", context: ctx, vendorId: "vendor_1" } as SessionContext,
    { body: "12", fromPhone: "+2348030000000" },
  );
  assert.equal(tooShort.sideEffects, undefined);
  assert.equal(tooShort.nextState, "VERIFYING_CUSTOMER");

  const cancel = step(
    { state: "VERIFYING_CUSTOMER", context: ctx, vendorId: "vendor_1" } as SessionContext,
    { body: "CANCEL", fromPhone: "+2348030000000" },
  );
  assert.equal(cancel.nextState, "IDLE");
  assert.equal(cancel.contextPatch?.pvPhone, null);
  assert.equal(cancel.contextPatch?.pcAmount, null);
});

test("payment-claim buttons route to confirm/dispute side effects", () => {
  const confirm = step(
    { state: "IDLE", context: {}, vendorId: "vendor_1" } as SessionContext,
    { body: "CONFIRM_PAID_clx123abc", fromPhone: "+2348030000000" },
  );
  assert.deepEqual(confirm.sideEffects?.[0], {
    type: "CONFIRM_PAID",
    data: { vendorId: "vendor_1", creditId: "clx123abc" },
  });

  const dispute = step(
    { state: "IDLE", context: {}, vendorId: "vendor_1" } as SessionContext,
    { body: "NOT_PAID_clx123abc", fromPhone: "+2348030000000" },
  );
  assert.deepEqual(dispute.sideEffects?.[0], {
    type: "DISPUTE_PAID",
    data: { vendorId: "vendor_1", creditId: "clx123abc" },
  });

  // A non-vendor can never trigger a confirm — the claim stays unverified.
  const stranger = step(
    { state: "IDLE", context: {} } as SessionContext,
    { body: "CONFIRM_PAID_clx123abc", fromPhone: "+2348039999999" },
  );
  assert.equal(stranger.sideEffects, undefined);
});

test("key replies carry tappable buttons and menus", () => {
  const help = step(
    { state: "IDLE", context: {}, vendorId: "vendor_1" } as SessionContext,
    { body: "HELP", fromPhone: "+2348030000000" },
  );
  assert.ok(help.list && help.list.rows.length >= 6, "HELP should carry the full menu list");
  assert.ok(help.list!.rows.every((r) => r.title.length <= 24 && (r.description ?? "").length <= 72));

  const confirmStep = step(
    {
      state: "IDLE",
      context: { invStep: "due", invItems: [{ name: "Rice", quantity: 1, unitPrice: 500 }], invCustomerName: "Ada" },
      vendorId: "vendor_1",
    } as SessionContext,
    { body: "7", fromPhone: "+2348030000000" },
  );
  assert.deepEqual(confirmStep.buttons?.map((b) => b.id), ["SEND", "CANCEL"]);

  // Due-date prompt offers tappable durations.
  const dueStep = step(
    { state: "ADDING_CREDIT_AMOUNT", context: { creditCustomerName: "Ada" }, vendorId: "vendor_1" } as SessionContext,
    { body: "2500", fromPhone: "+2348030000000" },
  );
  assert.deepEqual(dueStep.buttons?.map((b) => b.id), ["7", "END", "CANCEL"]);

  // Every prompt in the ADD flow carries at least a Cancel tappable.
  const askName = step(
    { state: "IDLE", context: {}, vendorId: "vendor_1" } as SessionContext,
    { body: "ADD", fromPhone: "+2348030000000" },
  );
  assert.equal(askName.buttons?.[0]?.id, "CANCEL");

  // Button titles never exceed WhatsApp's 20-char cap.
  for (const r of [help, confirmStep, dueStep, askName]) {
    for (const b of r.buttons ?? []) assert.ok(b.title.length <= 20, `button title too long: ${b.title}`);
  }
});

test("CANCEL exits the invoice flow", () => {
  const r = step(
    { state: "IDLE", context: { invStep: "items", invItems: [] }, vendorId: "vendor_1" } as SessionContext,
    { body: "CANCEL", fromPhone: "+2348030000000" },
  );
  assert.equal(r.contextPatch?.invStep, null);
  assert.match(r.reply, /cancelled/i);
});

// ── 24-hour window / deliver-then-upgrade ────────────────────────────────────
//
// The property that matters: an out-of-session customer must get the TEMPLATE
// (the only thing Meta delivers outside the window) AND THEN the rich message,
// because a delivered template re-opens the window. Getting this wrong is how
// reminders silently vanish, so it is worth pinning down.

/** Drives deliverThenUpgrade with the DB seams stubbed out. */
function deliverThenUpgradeForTest(opts: {
  sessionOpen: boolean;
  sendTemplate: () => Promise<void>;
  sendRich: () => Promise<void>;
  onTemplateUnusable?: (err: WhatsAppSendError) => Promise<void>;
  skipTemplate?: boolean;
}): Promise<{ channel: DeliveryChannel; delivered: boolean; templateIssue?: string }> {
  return deliverThenUpgrade({
    phone: "+2348030000000",
    sendTemplate: opts.sendTemplate,
    sendRich: opts.sendRich,
    onTemplateUnusable: opts.onTemplateUnusable,
    skipTemplate: opts.skipTemplate,
    isSessionOpen: async () => opts.sessionOpen,
    onWindowOpened: async () => {},
  });
}

test("isTemplateUnusable only matches Meta's template error codes", () => {
  assert.equal(isTemplateUnusable(new WhatsAppSendError("nope", 400, 132001)), true);
  assert.equal(isTemplateUnusable(new WhatsAppSendError("nope", 400, 132015)), true);
  // 131026 = recipient unreachable. That is NOT a template problem — it must
  // propagate so the caller can flag the number as blocked.
  assert.equal(isTemplateUnusable(new WhatsAppSendError("blocked", 400, 131026)), false);
  assert.equal(isTemplateUnusable(new Error("boom")), false);
});

test("deliverThenUpgrade: open session sends rich only, never the template", async () => {
  const order: string[] = [];
  const result = await deliverThenUpgradeForTest({
    sessionOpen: true,
    sendTemplate: async () => { order.push("template"); },
    sendRich: async () => { order.push("rich"); },
  });
  assert.deepEqual(order, ["rich"]);
  assert.equal(result.channel, "session");
  assert.equal(result.delivered, true);
});

test("deliverThenUpgrade: closed session sends template THEN rich", async () => {
  const order: string[] = [];
  const result = await deliverThenUpgradeForTest({
    sessionOpen: false,
    sendTemplate: async () => { order.push("template"); },
    sendRich: async () => { order.push("rich"); },
  });
  // Order matters: the template opens the window the rich message needs.
  assert.deepEqual(order, ["template", "rich"]);
  assert.equal(result.channel, "upgraded");
  assert.equal(result.delivered, true);
});

test("deliverThenUpgrade: unusable template degrades honestly to delivered=false", async () => {
  let provisioned = false;
  const result = await deliverThenUpgradeForTest({
    sessionOpen: false,
    sendTemplate: async () => { throw new WhatsAppSendError("missing", 400, 132001); },
    sendRich: async () => {},
    onTemplateUnusable: async () => { provisioned = true; },
  });
  assert.equal(result.channel, "freetext-fallback");
  // The whole point: free text outside the window may be silently dropped, so
  // we must NOT report it as delivered.
  assert.equal(result.delivered, false);
  assert.equal(provisioned, true, "should attempt to self-provision the template");
});

test("deliverThenUpgrade: template delivered but rich failing still counts as delivered", async () => {
  const result = await deliverThenUpgradeForTest({
    sessionOpen: false,
    sendTemplate: async () => {},
    sendRich: async () => { throw new Error("rich send failed"); },
  });
  assert.equal(result.channel, "template-only");
  // The customer WAS notified by the template, so this is a real delivery.
  assert.equal(result.delivered, true);
});

test("deliverThenUpgrade: recipient-level errors propagate, not swallowed", async () => {
  await assert.rejects(
    deliverThenUpgradeForTest({
      sessionOpen: false,
      sendTemplate: async () => { throw new WhatsAppSendError("blocked", 400, 131026); },
      sendRich: async () => {},
    }),
    /blocked/,
  );
});

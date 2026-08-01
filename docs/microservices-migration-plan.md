# Microservices Migration Plan

Vodium Ledger is still best operated as a modular monolith until message volume
or team ownership forces a split. The system already has clean domains that can
be extracted one at a time without rewriting the product.

## Current Domains

- `Identity`: vendor login, registration, email OTP, sessions.
- `Ledger`: customers, credits, repayments, credit score events.
- `Messaging`: WhatsApp webhook, OTP delivery, reminders, invoice delivery.
- `Invoicing`: invoice creation, sending, lifecycle reminders, payments.
- `Billing`: Paystack subscriptions and webhooks.
- `Tenant`: organizations, branches, members, WhatsApp channels.

## Extraction Order

1. `Messaging Service`
   - Owns WhatsApp sends, templates, delivery status, OTP sends, and reminder jobs.
   - First candidate because most production risk is external API delivery.
   - Exposes an internal API or queue contract: `send_otp`, `send_reminder`,
     `send_invoice`, `send_template`.

2. `Billing Service`
   - Owns Paystack webhooks, subscription state, invoices from Paystack, and plan
     entitlements.
   - Low coupling if the monolith reads subscription status through one contract.

3. `Invoicing Service`
   - Owns invoice CRUD, signed invoice links, invoice payment records, and invoice
     reminders.
   - Extract only after Messaging is stable because invoice delivery depends on it.

4. `Credit Ledger Service`
   - Owns customers, credits, repayments, disputes, score events.
   - Highest coupling and highest business risk, so extract last.

## Migration Rules

- Keep PostgreSQL shared at first, but introduce service-owned tables and avoid
  cross-domain writes from outside the owning module.
- Add an outbox table before network extraction so invoice/reminder sends can be
  retried safely without duplicate customer messages.
- Move cron work into queue workers before splitting services.
- Use idempotency keys for all message sends: invoice id, credit id plus reminder
  type, or OTP phone plus expiry bucket.
- Preserve the current Next.js app as the vendor/admin UI and API gateway while
  services are extracted behind internal endpoints.

## Near-Term Refactor Inside The Monolith

- Keep all WhatsApp delivery decisions in `src/lib/whatsapp/*-delivery.ts`.
- Keep lifecycle jobs in `src/lib/*-lifecycle.ts` with thin API route wrappers.
- Avoid direct `sendWhatsAppMessage` calls from app routes unless the customer
  has just messaged the bot and an open session is guaranteed.
- Track channel choice (`template`, `session`, `fallback`) in logs and later in a
  `MessageDelivery` table.

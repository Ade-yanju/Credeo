# Funding Demo and Functional Readiness

## What can be demonstrated now

The strongest funding presentation is a complete merchant story, not a list
of isolated screens:

1. Register a vendor and show OTP-protected access.
2. Open the dashboard and show the empty or seeded business overview.
3. Send a WhatsApp message such as `ADD Chidi 08031234567 3500 7d`.
4. Show the confirmation step and the saved credit.
5. Open the customer profile and show the balance, score, and audit history.
6. Send `LIST` and show outstanding customers.
7. Send `PAID Chidi`, confirm the repayment, and show the updated balance and
   score event.
8. Trigger a reminder and show the customer-facing WhatsApp message.
9. Send a natural-language command or voice note if AI/ASR credentials are
   configured.
10. Show the admin view, health endpoint, subscription plans, and roadmap.

### AI demonstration messages

Use these examples after the basic flow:

```text
“Who dey owe me?”                 → LIST
“How reliable is Chidi?”          → SCORE Chidi
“Amaka don pay me”                → PAID Amaka
“Show my bank details”            → BANK
“I want to create an invoice”     → INVOICE
```

The AI classifier only translates the message into a known command. The
deterministic state machine still controls the next question, confirmation,
permission check, and database side effect.

## Definition of functional

Before presenting the system as pilot-ready, verify all of the following in a
staging or pilot environment:

### Application

- `npm ci` completes from `package-lock.json`.
- `npm run preflight` passes in the production/staging environment without
  printing any secret values.
- Prisma client generation succeeds.
- Database migrations apply to a clean database.
- Seed data loads and can be removed/recreated safely in staging.
- Typecheck, tests, lint, and production build pass.
- `/api/health` returns HTTP 200 with database and WhatsApp configured.

### Vendor operations

- Registration, login, OTP, signout, and password recovery work.
- A vendor can create a credit from the dashboard and WhatsApp.
- Customer phone validation prevents self-credit and duplicate identity errors.
- A credit can be marked paid once, with idempotent retry behaviour.
- Overdue and due-soon states appear correctly.
- CSV/PDF exports contain correct amounts and dates.

### WhatsApp

- Meta webhook verification succeeds.
- Invalid HMAC requests are rejected without processing.
- Duplicate Meta message IDs do not duplicate credits or payments.
- Inbound webhook events are claimed in the durable database inbox as well as
  the short-lived Redis guard.
- If the durable inbox cannot be reached, the webhook returns a retryable 503
  before any financial action is executed.
- Successful outbound sends record their message type and Meta provider ID for
  reconciliation.
- Text, buttons, list replies, contact cards, images, and audio are handled.
- Approved templates exist for OTP, reminders, and invoices.
- The credit-logged customer notification template is approved.
- Approved templates exist for weekly PDF reports and vendor digests.
- `vodium_vendor_digest` has been approved with body variables for vendor name
  and the generated summary; the digest path can request provisioning when Meta
  reports the template is missing.
- `vodium_subscription_nudge` follows the same provisioning and no-plain-text
  fallback policy for subscription reminders.
- Admin → WhatsApp template readiness shows each required template name and
  Meta approval status before a pilot is activated.
- Scheduled reminders, invoices, OTPs, and reports never downgrade to plain
  text when a template is unavailable.
- Out-of-window messaging reports delivery truthfully.
- Blocked/non-WhatsApp numbers are not retried indefinitely.

### Financial and data safety

- OCR receipts require human vendor confirmation.
- AI-created credits require explicit vendor confirmation.
- Official score calculation is deterministic and auditable.
- Tenant boundaries prevent one organisation from reading another's records.
- Admin roles restrict sensitive operations.
- Production secrets are not committed to Git.
- Disputes and manual corrections create audit entries.

### Scheduled operations

- Reminder cron runs with `CRON_SECRET`.
- WhatsApp outbox cron runs every five minutes with `CRON_SECRET`.
- Daily maintenance and subscription cron jobs run.
- Weekly reports/digests run for opted-in vendors.
- Sentry receives a test error in staging.
- An uptime monitor watches `/api/health`.
- Admin staff can inspect outbox counts and manually retry a failed template
  message.

## Current verification limitation

The repository includes tests and build scripts, but the current development
shell must have Node.js/npm available before those commands can be executed.
Do not report the system as fully verified until this command set has passed in
CI or the deployment environment:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

## Recommended pilot evidence pack

Prepare these items for funders:

- One-page product overview.
- Architecture diagram and this system overview.
- Five-minute recorded merchant workflow.
- Screenshots of dashboard, customer score, reminders, and admin operations.
- Pilot metrics: vendors onboarded, credits logged, repayment rate, recovery
  time, active WhatsApp users, and repeat usage.
- Security and data-handling note.
- Infrastructure cost estimate per active vendor.
- 90-day pilot plan with success thresholds.
- Known limitations and the controls used to manage them.

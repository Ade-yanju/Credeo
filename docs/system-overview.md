# Vodium Ledger: System Overview

## Purpose

Vodium Ledger is a WhatsApp-first credit-management platform for merchants,
campus vendors, supermarkets, and multi-branch organisations. It replaces
paper notebooks and scattered chats with one auditable record of credit,
repayment, reminders, invoices, and customer behaviour.

The product has three connected surfaces:

1. **Vendor WhatsApp assistant** — the fastest way to record a credit, check
   debtors, mark repayment, send invoices, import a paper ledger, or receive a
   voice-note command.
2. **Vendor dashboard** — the full operational view for credits, customers,
   invoices, products, branches, reports, settings, and subscription billing.
3. **Admin console** — platform operations, vendor support, disputes,
   acquisition, analytics, organisations, WhatsApp configuration, and team
access.

Automated reminders, invoices, OTPs, and scheduled reports use approved
WhatsApp templates. Plain text is reserved for active conversational sessions
and is never used as a silent fallback for scheduled delivery.

## End-to-end operating model

```text
Vendor or customer action
        ↓
WhatsApp webhook / dashboard API / storefront
        ↓
Authentication, tenant and permission checks
        ↓
Deterministic validation + optional AI interpretation
        ↓
Credit, repayment, invoice, order or ledger transaction
        ↓
Audit log + score update + notifications
        ↓
WhatsApp reminder, invoice, dashboard report or admin follow-up
```

AI is an interpretation and communication layer. It must not directly write
financial records. The application validates every amount, customer, vendor,
permission, status transition, and confirmation before committing a change.
Natural-language commands are mapped back into the existing deterministic
WhatsApp state machine; low-confidence classifications fall through to the
normal help response.

## Core workflows

### 1. Vendor onboarding

The vendor registers through `/register` or starts onboarding on WhatsApp.
Phone/email OTP verifies access, the vendor chooses a business and community,
and the system creates the vendor, organisation, trial subscription, and
WhatsApp session.

### 2. Record a credit

The vendor can use the dashboard, type a command such as `ADD`, send natural
language, or send a voice note. The system identifies the customer, confirms
their phone number, amount, due date, and reminder preference, then creates a
`Credit` and an audit event. The customer can receive an invoice or credit
notification where the required WhatsApp template/session rules permit it.

### 3. Track repayment

The vendor marks a credit paid from WhatsApp or the dashboard. A repayment is
recorded, the credit lifecycle is updated, the official Vodium score is
recalculated, and notifications/audit records are created.

When a customer sends a receipt image, OCR extracts a possible amount, bank,
sender, and reference. This creates a claim for vendor confirmation; OCR never
marks a credit paid automatically.

### 4. Remind and recover

Cron jobs find credits approaching their due date or overdue. Reminder delivery
uses a session message when possible and approved Meta templates outside the
24-hour WhatsApp window. Reminder state prevents duplicate sends and records
delivery failures or blocked numbers.

### 5. Score and explain behaviour

The deterministic score engine combines repayment events, timing, recency, and
cross-vendor history into the 0–1000 Vodium Score. AI can provide a human
explanation or advisory insight, but the official score and credit lifecycle
remain application-controlled.

### 6. Operate at organisation scale

An organisation can have branches, staff memberships, domains, products,
storefront orders, multiple WhatsApp channels, subscriptions, and admin
controls. Tenant context and entitlement checks scope access and enforce plan
limits.

## Data ownership

PostgreSQL via Prisma is the source of truth. The important entities are:

- `Organization`, `Branch`, `OrganizationMembership`: multi-tenant access.
- `Vendor`: merchant account and configuration.
- `Student`: customer identity and score.
- `Credit`, `Repayment`, `CreditScoreEvent`: credit lifecycle and behaviour.
- `Invoice`, `InvoiceItem`, `PaymentReceipt`: billing and payment evidence.
- `WhatsAppSession`, `WhatsAppChannel`: conversation state and phone channels.
- `WalletLedgerEntry`: monetary ledger entries for supported wallet flows.
- `AuditLog`: traceability for important actions.
- `VendorSubscription`, `SubscriptionEvent`: SaaS billing lifecycle.
- `Dispute`, `Notification`: exception handling and user communication.

## Production health signal

`GET /api/health` checks database connectivity, Redis availability, WhatsApp
credentials, the reminder pipeline, and the outbound template outbox. Configure
an uptime monitor to alert on HTTP 503. This is the first check to show a funder
or pilot partner that the deployed service is being monitored.

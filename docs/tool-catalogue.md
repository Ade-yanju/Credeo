# Vodium Ledger: Tool Catalogue

This catalogue describes what each subsystem does, where it lives, and what a
pilot operator needs to configure.

## User-facing tools

| Tool | What it does | Main entry points |
| --- | --- | --- |
| Vendor registration and OTP | Creates and verifies vendor accounts without passwords | `/register`, `src/app/api/auth/*`, `src/app/api/vendor/register/route.ts` |
| WhatsApp assistant | Onboards vendors, records credits, lists debtors, marks repayment, checks scores, sends invoices, and handles support | `/api/whatsapp`, `src/lib/whatsapp/state-machine.ts` |
| AI message understanding | Classifies natural-language commands and parses Nigerian English/Pidgin credit messages; all routed actions return to the deterministic state machine | `src/lib/ai.ts`, `src/lib/whatsapp/ai-command.ts`, `src/lib/whatsapp/ai-fallback.ts` |
| Voice-note intake | Transcribes vendor voice notes and feeds the transcript into the normal command flow | `src/lib/asr.ts`, `src/lib/whatsapp/voice-intake.ts` |
| Ledger-book import | Reads a photo of a paper ledger, shows staged rows, and imports only after confirmation | `src/lib/whatsapp/ledger-import.ts` |
| Receipt OCR | Reads transfer receipts and creates a vendor-review claim | `src/lib/ocr.ts`, `src/lib/whatsapp/receipt-intake.ts` |
| Credit dashboard | Shows totals, due-soon credits, overdue credits, recovery, and activity | `/dashboard` |
| Credit management | Creates, edits, filters, exports, and reviews credits | `/dashboard/credits`, `/api/credits/*` |
| Customer profiles | Shows customer balances, score, history, and repayment events | `/dashboard/customers/*`, `/api/customers/*` |
| Invoice and PDF delivery | Creates invoices, produces PDFs, records payments, and sends through WhatsApp | `/dashboard/invoices`, `/api/invoices/*` |
| Reminder engine | Sends pre-due and overdue reminders with duplicate protection | `/api/cron/reminders`, `src/lib/whatsapp/reminder-delivery.ts` |
| Vendor reports | Produces weekly PDF reports and AI digests through approved WhatsApp templates; no scheduled plain-text fallback | `/api/cron/weekly-report`, `/api/cron/digest` |
| Subscription reminders | Sends grace-period and renewal nudges through an approved utility template plus email, with one-time provisioning when Meta reports it missing | `src/lib/subscription-nudge.ts`, `src/lib/whatsapp/subscription-nudge-template.ts` |
| Products and storefront | Supports product catalogue, customer orders, OTP checkout, and organisation storefronts | `/dashboard/products`, `/dashboard/supermarket`, `/api/storefront/*` |
| BNPL workflows | Manages orders, approvals, repayments, mandates, coupons, and advisory risk insight | `/dashboard/bnpl`, `/api/bnpl/*` |

## Business and operations tools

| Tool | What it does | Main entry points |
| --- | --- | --- |
| Admin overview and analytics | Monitors platform activity, vendors, finance, and acquisition | `/admin`, `/admin/analytics`, `/api/admin/*` |
| Vendor acquisition | Discovers public business listings, qualifies prospects, tracks outreach, and converts prospects through claim links | `/admin/acquisition`, `src/lib/acquisition*` |
| Support and disputes | Gives staff a queue for customer disputes, vendor support, and invitations | `/admin/support`, `/admin/disputes` |
| Organisation controls | Manages branches, staff, domains, members, and tenant settings | `/dashboard/settings`, `/api/tenant/*` |
| WhatsApp channel management | Connects organisation WhatsApp numbers and tests outbound delivery | `/api/whatsapp/channels/*` |
| WhatsApp template readiness | Lists and provisions the approved templates required for reminders, credit notifications, invoices, OTPs, reports, digests, and subscription nudges | `/api/admin/whatsapp-otp-template` |
| Template data mapping | Defines the approved placeholders and the ledger/subscription data supplied at send time | `docs/whatsapp-template-specifications.md`, `src/lib/whatsapp/credit-notification-delivery.ts`, `src/lib/vendor-digest.ts`, `src/lib/subscription-nudge.ts` |
| Subscription billing | Handles Starter, Growth, and Pro plans, trial state, Paystack events, and entitlement gates | `/dashboard/upgrade`, `/api/paystack/*` |
| Ambassadors/referrals | Tracks campus representatives and referred vendors | `/admin/marketing`, `/api/admin/ambassadors/*` |
| News and marketing | Publishes product/news content and newsletter subscriptions | `/admin/news`, `/api/newsletter/subscribe` |

## Platform services

| Service | Role |
| --- | --- |
| Next.js App Router | Web pages, API routes, webhook processing, and server rendering |
| PostgreSQL/Supabase | Durable application data and relational reporting |
| Prisma | Type-safe database access and migrations |
| Meta WhatsApp Cloud API | Inbound/outbound WhatsApp messages, media, templates, and delivery statuses |
| WhatsApp durable inbox | Persists inbound Meta message IDs before processing so retries cannot duplicate ledger actions | `WhatsAppInboundEvent`, `src/lib/whatsapp/inbox.ts` |
| WhatsApp delivery log | Records outbound message type and Meta provider ID for reconciliation and future retries | `WhatsAppDelivery`, `src/lib/whatsapp/delivery-log.ts`, `src/lib/whatsapp/outbound.ts` |
| WhatsApp outbox | Queues vendor digests and organisation-backed reminders with idempotency, retry backoff, and failure state; ready for invoices/OTPs/reports | `WhatsAppOutboxMessage`, `src/lib/whatsapp/outbox.ts`, `/api/cron/whatsapp-outbox` |
| Outbox operations | Admin UI shows queue health and recent failures, and allows authorised staff to retry one message; the health endpoint exposes stalled-queue status | `/admin/whatsapp-outbox`, `/api/admin/whatsapp-outbox`, `/api/health` |
| Anthropic | Optional structured extraction, OCR, reminder copy, digests, and advisory insight |
| Spitch | Optional voice-note transcription for configured languages |
| Upstash Redis | OTP storage, rate limiting, and message de-duplication where configured |
| Resend | Email OTP, invitations, notifications, and newsletters |
| Twilio Verify | Optional phone OTP verification |
| Paystack | Vendor subscriptions and supported customer payment mandates |
| Google Places | Admin-only business discovery for acquisition |
| Vercel/cron | Hosting and scheduled reminder, digest, subscription, and maintenance jobs |
| Sentry | Error monitoring across server, edge, and client |
| PostHog | Product analytics when configured |
| Production preflight | Checks that core, WhatsApp, cron, and template configuration exists without printing secret values | `npm run preflight`, `scripts/production-preflight.mjs` |

## Configuration groups

The safe template is `.env.example`. Production values belong in the hosting
provider's secret manager, never in Git.

- Required core: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`.
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, and approved template names.
- AI/media: `ANTHROPIC_API_KEY`, optional `SPITCH_API_KEY`.
- Operations: `CRON_SECRET`, Redis credentials, Resend, Sentry, and PostHog.
- Revenue: Paystack secret/public keys and plan IDs.
- Acquisition: `GOOGLE_MAPS_API_KEY`.

## What is functional without optional services?

The application is designed to degrade safely:

- Without Anthropic, deterministic WhatsApp commands and dashboard workflows
  continue; loose-language parsing and OCR do not.
- Without Spitch, typed WhatsApp messages continue; voice notes are declined.
- Without Redis, production rate limiting/de-duplication should be treated as
  a launch blocker and must be restored before a public pilot.
- Without WhatsApp credentials, the web dashboard remains available but the
  WhatsApp assistant and outbound reminders are not operational.
- Without Paystack, manual ledger operations continue but paid subscription
  activation cannot complete.

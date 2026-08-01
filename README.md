# Vodium Ledger

> Africa's credit infrastructure layer — starting with Nigerian university campuses.

A WhatsApp-first credit tracking and intelligence platform that helps campus vendors safely extend credit to students, automate repayment reminders, and access cross-vendor credit scores.

This is **Phase 1 of Vodium** — the data and revenue foundation that earns us the right to launch Vodium Premium (a consumer credit card brand) in Year 2.

---

## Vision

```
Phase 1 (Now)   → Campus credit infrastructure (B2B SaaS for vendors)
Phase 2 (Yr 2)  → Consumer credit products for graduates entering the workforce
Phase 3 (Yr 3+) → Vodium Premium card for affluent professionals & HNWIs
```

Every paying vendor and every tracked repayment builds the proprietary credit graph that no Nigerian fintech currently owns.

---

## The Problem

Nigerian campus vendors extend millions of naira in informal credit daily — food, provisions, printing, laundry — and have no system to track it. Defaults go unrecorded. There is no shared credit history. A student who defaults at one canteen walks straight into the next one.

Vodium Ledger gives vendors a 15-second way to log a credit, reminds students automatically, and builds a cross-vendor score that de-risks every future transaction.

---

## Tech Stack

| Layer        | Choice                          | Why                                               |
| ------------ | ------------------------------- | ------------------------------------------------- |
| Framework    | Next.js 14 (App Router) + TypeScript | Single codebase for web + API               |
| Styling      | Tailwind CSS + shadcn/ui        | Speed + consistency with Vodium brand             |
| Database     | PostgreSQL via Supabase         | Relational data, generous free tier               |
| ORM          | Prisma                          | Type-safe DB access                               |
| Auth         | Phone OTP (Twilio Verify) + Email OTP (Resend) | No passwords — vendors trust phone  |
| WhatsApp     | SendPulse WhatsApp Business API | Cost-effective at scale vs Twilio                 |
| Payments     | Paystack                        | Nigerian-native, supports cards/transfer/USSD     |
| Cache/Queues | Upstash Redis                   | Serverless, rate limiting & OTP storage           |
| Analytics    | PostHog                         | Open-source product analytics                     |
| Errors       | Sentry                          | Full-stack error monitoring                       |
| Hosting      | Vercel                          | Zero-config Next.js deploys + cron jobs           |

---

## What We've Built

### Authentication
- Phone OTP login via Twilio Verify with Nigerian phone number normalisation
- Email OTP via Resend as a 2FA layer for account creation and login
- Session management with rate-limited OTP requests (3 attempts / 10 minutes)
- Dev fallback: OTP printed to terminal when Twilio is not configured
- Vendor registration flow with business details, campus, and vendor type

### WhatsApp Bot (full state machine)
- Vendor onboarding entirely via WhatsApp: name → business → university → account created
- Add a credit: `ADD` → student name → amount → due date → confirmed and logged
- Mark as paid: `PAID <student name>` — closes the credit and triggers score recalculation
- View all owing students: `LIST` — returns formatted list of outstanding balances
- Credit score lookup: `SCORE <student name/matric>` — returns Vodium Score + summary
- Built-in reminders: `DASHBOARD`, `SUPPORT`, `HELP` menu
- Persistent session state stored in PostgreSQL (`WhatsAppSession` model)
- Pure state-machine logic in [`src/lib/whatsapp/state-machine.ts`](src/lib/whatsapp/state-machine.ts) — no I/O, fully testable

### Web Dashboard (vendor-facing)
- Phone OTP protected login at `/login`
- Main dashboard at `/dashboard` with:
  - Total owed, paid this month, customers owing, recovery rate (KPI cards)
  - 6-month credit volume chart (extended vs recovered)
  - Overdue credits table with days-overdue indicator
  - Due-soon credits (within 48 hours)
  - Live activity feed (8 most recent events)
- Credit management at `/dashboard/credits` — full credit list with filters
- Customer list at `/dashboard/customers`
- Add credit via web at `/dashboard/credit/new`
- PDF invoices from web and bot flows, sent automatically to the customer on WhatsApp
- Settings page at `/dashboard/settings`

### Automated Reminders (cron job)
- External cron job calls `/api/cron/reminders` every 5 minutes with `Authorization: Bearer <CRON_SECRET>`
- Finds every outstanding credit whose adaptive reminder window is open
- Sends WhatsApp reminders through open sessions or approved Meta templates when the customer is out of session
- Stamps `reminderSentAt` to prevent duplicate sends
- Respects pending (unregistered) student phone numbers — skips them cleanly

### Credit Score Engine (rule-based v1)
- Vodium Score: 0–1000 scale, 500 baseline for new students
- Score events: `PAID_ON_TIME` (+25), `PAID_LATE` (−15), `DEFAULTED` (−80), `WRITTEN_OFF` (−120)
- Recency weighting — recent events matter more than older ones
- Volume bonus — being trusted repeatedly by multiple vendors is a positive signal
- Human-readable summary tiers: Excellent / Good / Building / Risky / High risk
- Cross-vendor: one student's score reflects behaviour at all participating vendors

### Subscription Billing
- Three-tier pricing: Starter (₦2K/mo), Growth (₦5K/mo), Campus Pro (₦10K/mo)
- Paystack webhook handler for `subscription.create`, `charge.success`, `subscription.disable`, `invoice.payment_failed`
- Trial → Active → Past Due → Cancelled lifecycle fully handled
- Trial period support with `trialEndsAt` field

### Data Model
- `University`, `Vendor`, `Student`, `Credit`, `Repayment`, `CreditScoreEvent`
- `WhatsAppSession` for bot conversation state
- `AuditLog` for every credit and repayment action
- `VendorSubscription` for billing state
- Full index coverage for performance at scale

### Admin Panel
- Internal admin dashboard at `/admin` (separate auth)
- Vendor management at `/admin/vendors`
- Analytics at `/admin/analytics`

### Infrastructure
- Sentry error monitoring on server, edge, and client
- Upstash Redis for OTP storage and rate limiting
- External cron calls `/api/cron/reminders` every 5 minutes; daily maintenance lives at `/api/cron/subscriptions`
- Seed script for dev data at `scripts/seed.ts`

---

## What We're Yet to Build

### Weeks 7–8: Polish + Onboarding
- [x] 5-minute vendor onboarding flow (guided, in-app) — `/register`
- [x] Paystack subscription initiation flow — `POST /api/paystack/subscribe` + settings page upgrade buttons
- [x] Subscription gating — student count enforced per plan tier in `POST /api/credits`
- [x] Landing page (public-facing) — `/page.tsx`
- [ ] First 5 paying pilot vendors live (business goal)

### Weeks 9–10: Score Visibility
- [x] Score visible on vendor's student profile page — `/dashboard/customers/[id]` with SVG gauge + timeline
- [x] Customer rows clickable — link to profile from customers table
- [x] Score history timeline on student profile — `CreditScoreEvent` feed on profile page
- [ ] Student-facing score lookup (student checks their own score — requires student auth, Q3 scope)
- [ ] Score change WhatsApp notifications to vendor (Q3 scope)

### Weeks 11–12: Vendor Growth
- [x] Vendor NPS widget — floating in-dashboard prompt, httpOnly cookie dismiss, 30-day cooldown
- [x] WhatsApp bulk reminder — `POST /api/vendor/remind-overdue` + "Remind all overdue" button on dashboard
- [x] Export credits to CSV — `GET /api/credits/export` + Download CSV button on credits page
- [ ] Second campus launch — recruit campus rep, replicate playbook (business goal)

### Q3: Credit Graph Expansion
- [ ] Student web portal — sign in and see their own credit history and score
- [ ] Matric number verification (lightweight, not BVN/NIN)
- [ ] Multi-vendor score aggregation improvements
- [ ] Score-based vendor insights ("students scoring 700+ repay 94% on time")

### Q4: Platform
- [ ] Vendor referral programme
- [ ] Campus rep commission tracking
- [ ] Bulk credit import (for vendors migrating from notebooks or Excel)
- [ ] Paystack direct debit for automated student repayment (optional, regulatory check needed)
- [ ] PostHog funnel analytics wired to key events

### Future (Phase 2 scope, not v1)
- Consumer-facing credit product for graduates
- ML-based credit scoring (when ≥5,000 students with ≥3 credits each)
- Native mobile apps
- Multi-language support
- Vodium Premium card

---

## 90-Day Roadmap

| Period | Goal | Status |
| --- | --- | --- |
| Weeks 1–2 | Foundation: schema, auth, bot skeleton | ✅ Done |
| Weeks 3–4 | WhatsApp MVP: add credit, mark paid, reminders | ✅ Done |
| Weeks 5–6 | Web dashboard v1: KPI cards, credit list, customers | ✅ Done |
| Weeks 7–8 | Onboarding flow + subscription billing + plan gating | ✅ Done |
| Weeks 9–10 | Score visibility: student profile, gauge, history timeline | ✅ Done |
| Weeks 11–12 | NPS widget, bulk reminders, CSV export, full security hardening | ✅ Done |
| Q3 | Student portal, matric verification, score graph expansion | Upcoming |
| Q4 | Referral programme, bulk import, PostHog funnels | Upcoming |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars
cp .env.example .env.local
# Fill in: DATABASE_URL, DIRECT_URL, WHATSAPP_*, RESEND_API_KEY,
#          PAYSTACK_*, UPSTASH_REDIS_*, SESSION_SECRET

# 3. Set up database
npx prisma migrate dev --name init
npx prisma generate

# 4. Seed pilot data (optional)
npm run seed

# 5. Run dev server
npm run dev
```

App runs at `http://localhost:3000`. Dev OTP codes print to terminal if WhatsApp is not configured.

---

## Project Structure

```
prisma/
  schema.prisma           ← all entities and relations
src/
  app/
    api/
      auth/               ← phone + email OTP endpoints
      whatsapp/           ← WhatsApp webhook (Meta Cloud API)
      credits/            ← credit CRUD
      repayments/         ← repayment recording
      customers/          ← student/customer API
      cron/reminders/     ← 5-minute reminder cron endpoint
      paystack/webhook/   ← billing lifecycle events
    dashboard/            ← vendor web UI (protected)
    admin/                ← internal admin panel
    login/                ← phone OTP login page
    register/             ← vendor registration
    page.tsx              ← landing page
  lib/
    prisma.ts             ← Prisma client singleton
    redis.ts              ← Upstash Redis + rate limiting
    session.ts            ← session management
    utils.ts              ← cn(), formatNaira(), normalisePhoneNG()
    email/otp.ts          ← Resend email OTP
    whatsapp/
      messages.ts         ← all bot copy (single source of truth for voice)
      state-machine.ts    ← pure conversation logic
      outbound.ts         ← WhatsApp message sending
    credit-score/
      score.ts            ← rule-based Vodium Score
scripts/
  seed.ts                 ← dev seed data
```

---

## Success Metrics

| Metric | Target (90 days) |
| --- | --- |
| Paying vendors | 50+ |
| MRR | ₦150K+ |
| Credits logged per week | 500+ |
| Total ₦ tracked | ₦10M+ |
| Unique students with credit history | 1,000+ |
| Repayment rate | 70%+ |
| Time to first credit (signup → log) | <5 minutes |

---

## Founding Team

| Role | Name | Focus |
| --- | --- | --- |
| CEO | Victor Kalejaiye | Strategy, vendor sales, fundraising |
| Co-CEO + Data | Adeyemi Folusho | Credit scoring, analytics, data layer |
| CPO | Demilade Akinsipe | Product, UX, brand |
| CTO | Ogunyade Olamilekan | Engineering, infra, code quality |

---

## Security & Compliance

### Authentication & Sessions
- **HMAC-SHA256 signed session tokens** — raw phone number is never stored in a cookie; every session cookie is signed with `SESSION_SECRET`. Forging a session requires the server secret.
- **Time-scoped admin tokens** — admin sessions use `base36(iat).HMAC(secret,"v1:admin:"+iat)` with an 8-hour TTL. Rotating `SESSION_SECRET` immediately invalidates all admin sessions.
- **httpOnly, Secure, SameSite cookies only** — no auth state in localStorage or sessionStorage.
- **Constant-time comparison** — all HMAC/token comparisons use `crypto.timingSafeEqual` to prevent timing-oracle attacks.
- **Email OTP as 2FA** — both login and registration require a 6-digit code sent to the vendor's email (Resend). Single-use, 10-minute TTL, deleted immediately after verification.
- **Rate limiting on all OTP endpoints** — 5 attempts / 15 minutes for login, 3 OTP sends / 10 minutes for registration, 5 OTP verifications / 10 minutes.

### Webhook Security
- **Fail-closed webhooks** — if `SENDPULSE_WEBHOOK_SECRET` or `PAYSTACK_WEBHOOK_SECRET` is not set in production, the webhook endpoint returns 503 and rejects all traffic. There is no silent fallback to an empty secret.
- **Paystack webhook** verifies `x-paystack-signature` using HMAC-SHA512 with `timingSafeEqual`.
- **WhatsApp webhook** verifies `x-secret-token` using a constant-time XOR loop.

### Middleware & Headers
- **Edge middleware** enforces session validity before `/dashboard/*` and `/admin/*` — invalid or forged cookies are cleared and the request redirected to `/login`.
- **Security headers on every response**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, plus a full `Content-Security-Policy`.

### Data & Access Control
- **Vendor data isolation** — vendor A cannot see vendor B's customers; every DB query scopes by `vendorId`. Student profile pages 404 if the authenticated vendor has no relationship with that student.
- **Vodium Score clamped** — score is always kept within [0, 1000]; WhatsApp bot uses `Math.min(1000, Math.max(0, …))` on every update.
- **NPS dismiss state in httpOnly cookie** — no localStorage; the 30-day cooldown can't be cleared by client-side scripts or XSS.
- **Input validation with Zod** — all API routes validate with strict schemas; `vendorType` is validated via `z.enum` (not cast), preventing invalid enum injection.

### Infrastructure
- No passwords — email OTP only; bcrypt hash stored only for WhatsApp-onboarded vendors.
- Minimal student PII: name, matric number, phone. No NIN/BVN in v1.
- NDPR-compliant privacy policy and consent flow (to be published with landing page).
- AuditLog on every credit and repayment action.
- Encryption at rest (Supabase default) + TLS in transit.
- Upstash Redis rate limiting on all sensitive endpoints (fails open when not configured — acceptable in development).

---

## License

Proprietary — Vodium © 2026. All rights reserved.

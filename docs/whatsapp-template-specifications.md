# VodiumLedger WhatsApp template build guide

This is the implementation sheet for every WhatsApp template currently used by
VodiumLedger. It is written for the person configuring the Meta WhatsApp
Business Account and for the developer wiring the approved names into Vercel.

The most important rule is exact alignment:

1. The Meta template name must match the value sent by the application.
2. The language code must match the approved language, normally `en_US`.
3. The body variable order must not change after approval.
4. The number of runtime values must match the number of body variables.
5. The wording must remain a utility or authentication message, not marketing.

## 1. What must be ready before creating templates

### Meta account

Use the WhatsApp Business Account (WABA) that owns the phone number configured
in `WHATSAPP_PHONE_NUMBER_ID`. In Meta Business Settings, confirm that:

- the business and WhatsApp Business Account are active;
- the sending phone number belongs to that WABA;
- the system user token has `whatsapp_business_messaging` and
  `whatsapp_business_management` permissions;
- the system user has the WABA assigned under its assets;
- Business Verification is complete if Meta requests it for authentication or
  utility template creation.

If the token can see more than one WABA, set
`WHATSAPP_BUSINESS_ACCOUNT_ID` explicitly. This avoids creating a template in
one account while the application sends from another.

### Vodium environment configuration

Set these in Vercel for the same environment as the deployment. Vercel values
should be entered without surrounding quotation marks.

| Variable | Default | Required when |
| --- | --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | — | Any real Meta send or template lookup |
| `WHATSAPP_PHONE_NUMBER_ID` | — | Any real Meta send or template lookup |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | auto-discovered | Recommended; required when automatic WABA discovery selects the wrong account |
| `WHATSAPP_OTP_TEMPLATE_NAME` | `vodium_otp` | OTP template override |
| `WHATSAPP_OTP_TEMPLATE_LANG` | `en_US` then `en` fallback | OTP template uses another approved language |
| `WHATSAPP_OTP_TEMPLATE_BUTTON` | enabled | Set `false` only when the approved OTP template has no copy-code button |
| `WHATSAPP_REMINDER_TEMPLATE_NAME` | `vodium_payment_reminder` | Payment reminder override |
| `WHATSAPP_REMINDER_TEMPLATE_LANG` | `en_US` | Reminder template uses another approved language |
| `WHATSAPP_CREDIT_LOGGED_TEMPLATE_NAME` | `vodium_credit_logged` | Customer credit-notification override |
| `WHATSAPP_CREDIT_LOGGED_TEMPLATE_LANG` | `en_US` | Credit notification uses another approved language |
| `WHATSAPP_INVOICE_TEMPLATE_NAME` | `vodium_invoice_pdf` | Invoice template override |
| `WHATSAPP_INVOICE_TEMPLATE_LANG` | `en_US` | Invoice template uses another approved language |
| `WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME` | `vodium_weekly_report` | Weekly report override |
| `WHATSAPP_WEEKLY_REPORT_TEMPLATE_LANG` | `en_US` | Weekly report uses another approved language |
| `WHATSAPP_VENDOR_DIGEST_TEMPLATE_NAME` | `vodium_vendor_digest` | Vendor digest override |
| `WHATSAPP_VENDOR_DIGEST_TEMPLATE_LANG` | `en_US` | Vendor digest uses another approved language |
| `WHATSAPP_SUBSCRIPTION_NUDGE_TEMPLATE_NAME` | `vodium_subscription_nudge` | Subscription nudge override |
| `WHATSAPP_SUBSCRIPTION_NUDGE_TEMPLATE_LANG` | `en_US` | Subscription nudge uses another approved language |
| `WHATSAPP_INVOICE_TEMPLATE_HEADER_HANDLE` | — | Creating either PDF document template through the admin provisioning endpoint |

The template-name variables are optional when the default names are used. If a
template was created with a different name, either rename it in Meta or set the
matching Vercel variable and redeploy. Names are lowercase identifiers with
letters, numbers, and underscores; for example, use
`vodium_payment_reminder`, not `Vodium Payment Reminder`.

## 2. Template inventory

| Template | Category | Type | Used for | Admin auto-provisioning |
| --- | --- | --- | --- | --- |
| `vodium_otp` | Authentication | Text + OTP copy-code button | First-time customer/vendor verification | Yes |
| `vodium_payment_reminder` | Utility | Text | Due-soon, overdue, and escalation reminders | Yes |
| `vodium_credit_logged` | Utility | Text | Confirmation that a vendor logged a credit for a customer | Yes |
| `vodium_invoice_pdf` | Utility | Document header + text | Customer invoice PDF delivery | Yes, requires a PDF header handle |
| `vodium_weekly_report` | Utility | Document header + text | Vendor weekly report PDF | Yes, reuses the invoice PDF header handle |
| `vodium_vendor_digest` | Marketing | Text | Vendor's weekly ledger intelligence summary | Yes |
| `vodium_subscription_nudge` | Marketing | Text | Trial/grace-period and renewal notices | Yes |

The application does not use a plain-text fallback for reminders, invoices,
weekly reports, vendor digests, or subscription nudges when a template is
unavailable. The message is recorded as failed or undelivered so the operator
can correct the template rather than believing the customer received it.

## 3. Exact template definitions

Create the templates with the following names, language, category, component
type, body copy, and example values. The example values are submitted to Meta
for review; they are not sent to customers.

### A. `vodium_otp`

Purpose: deliver a verification code to a phone that has not opened a
WhatsApp conversation with the Vodium number.

- Name: `vodium_otp`
- Language: `English (US)` / `en_US`
- Category: `AUTHENTICATION`
- Header: none
- Body: use Meta's authentication-template generated body
- Security recommendation: enabled
- Code expiry: 10 minutes
- Button: OTP / Copy code
- Runtime body value: `{{1}}` = six-digit OTP code

The admin provisioning route creates this authentication template using Meta's
authentication format. Do not create it as a normal Utility template with text
such as “Your code is {{1}}”; that can produce a different template shape from
the send request. The OTP flow sends the code in the body and supplies the
copy-code button value.

Where it is used: `src/lib/otp-delivery.ts`.

### B. `vodium_payment_reminder`

Purpose: tell a customer that an amount is due or overdue, including enough
context to identify the vendor and the debt.

- Name: `vodium_payment_reminder`
- Language: `en_US`
- Category: `UTILITY`
- Header: none
- Buttons: none required
- Body:

```text
Hi {{1}}, a friendly reminder from {{2}}: {{3}} is outstanding — {{4}}. Reply PAID once you have settled, or reply here if anything looks wrong. Paying on time builds your Vodium credit score.
```

| Variable | Runtime value | Example submitted to Meta |
| --- | --- | --- |
| `{{1}}` | Customer first name | `Chidi` |
| `{{2}}` | Vendor/shop name | `Mama Nkechi Stores` |
| `{{3}}` | Outstanding amount formatted in naira | `₦2,500` |
| `{{4}}` | Due-status phrase | `due tomorrow` |

The runtime order is `[firstName, shopName, amountOwed, dueText]`. The reminder
cron uses this template for due-soon, overdue, and escalation reminders. For
organisation-backed vendors, the message is also placed in the durable outbox
with an idempotency key before dispatch.

Where it is used: `src/lib/whatsapp/reminder-delivery.ts`.

### C. `vodium_credit_logged`

Purpose: confirm to a customer that a vendor has recorded a new credit entry.
This is a financial notification, so it should reach customers outside the
24-hour conversation window.

- Name: `vodium_credit_logged`
- Language: `en_US`
- Category: `UTILITY`
- Header: none
- Buttons: none required
- Body:

```text
Hi {{1}}, {{2}} recorded a credit of {{3}} for {{4}} on {{5}}. It is due on {{6}}. Reply PAID when you settle or contact the shop if anything looks wrong.
```

| Variable | Runtime value | Example submitted to Meta |
| --- | --- | --- |
| `{{1}}` | Customer first name | `Chidi` |
| `{{2}}` | Vendor/shop name | `Mama Nkechi Stores` |
| `{{3}}` | Credit amount in naira | `₦2,500` |
| `{{4}}` | Credit description, or `goods or services` | `school supplies` |
| `{{5}}` | Date credit was logged | `12 Aug 2026` |
| `{{6}}` | Due date | `19 Aug 2026` |

The current sender resolves this name from
`WHATSAPP_CREDIT_LOGGED_TEMPLATE_NAME`. The admin template provisioning route
creates this template along with the other required delivery templates.

Where it is used: `src/lib/whatsapp/credit-notification-delivery.ts`.

### D. `vodium_invoice_pdf`

Purpose: deliver a customer invoice and its PDF outside an open WhatsApp
conversation.

- Name: `vodium_invoice_pdf`
- Language: `en_US`
- Category: `UTILITY`
- Header: `DOCUMENT`
- Buttons: none required
- Body:

```text
Hi {{1}}, {{2}} has sent you invoice {{3}} for {{4}}, due {{5}}. The PDF is attached. You can also view it online here: {{6}}. If you have already paid, please ignore this message.
```

| Variable | Runtime value | Example submitted to Meta |
| --- | --- | --- |
| `{{1}}` | Customer first name | `Chidi` |
| `{{2}}` | Vendor/shop name | `Mama Nkechi Stores` |
| `{{3}}` | Invoice number | `INV-VDM-ABC123` |
| `{{4}}` | Invoice total | `₦2,500` |
| `{{5}}` | Due date | `12 Aug 2026` |
| `{{6}}` | Public invoice URL | `https://vodiumledger.com/invoice/example` |

At send time, the document header contains the real PDF URL and filename. The
PDF used for Meta review is only a sample; it is not the invoice sent to the
customer.

Where it is used: `src/lib/whatsapp/invoice-delivery.ts`.

### E. `vodium_weekly_report`

Purpose: deliver the vendor's weekly ledger report as a PDF.

- Name: `vodium_weekly_report`
- Language: `en_US`
- Category: `UTILITY`
- Header: `DOCUMENT`
- Buttons: none required
- Body:

```text
Hi {{1}}, here is your Vodium Ledger report for {{2}}. You gave out {{3}} in credit and received {{4}}. {{5}} is still owing. The full report is attached.
```

| Variable | Runtime value | Example submitted to Meta |
| --- | --- | --- |
| `{{1}}` | Vendor owner's first name | `Nkechi` |
| `{{2}}` | Report week range | `11 – 17 Aug 2026` |
| `{{3}}` | Total credit logged during the week | `₦48,500` |
| `{{4}}` | Total repayments received | `₦31,200` |
| `{{5}}` | Closing outstanding balance | `₦96,750` |

The report uses the same sample-document upload handle as the invoice template.
The actual generated report PDF replaces the sample document at send time.

Where it is used: `src/lib/whatsapp/weekly-report-delivery.ts`.

### F. `vodium_vendor_digest`

Purpose: send a short weekly intelligence summary to the vendor so they can
act without opening the dashboard.

- Name: `vodium_vendor_digest`
- Language: `en_US`
- Category: `MARKETING`
- Header: none
- Buttons: none required
- Body:

```text
Hi {{1}}, here is your Vodium Ledger summary:

{{2}}
```

| Variable | Runtime value | Example submitted to Meta |
| --- | --- | --- |
| `{{1}}` | Vendor owner's first name | `Nkechi` |
| `{{2}}` | Generated or fallback ledger summary | `You have ₦96,750 still owing. 3 customers are overdue.` |

The summary is generated from database values, not invented by AI. It may
contain the total outstanding amount, up to five overdue customers and their
balances, recent repayments, and a short cash-flow observation. If AI is
unavailable, the deterministic database fallback is sent through the same
template.

The application limits the second variable to 900 characters before sending.
Do not add a third variable unless the runtime mapping in
`src/lib/vendor-digest.ts` is changed at the same time.

Where it is used: `src/lib/vendor-digest.ts`.

### G. `vodium_subscription_nudge`

Purpose: notify a vendor about trial expiry, grace-period timing, or renewal.

- Name: `vodium_subscription_nudge`
- Language: `en_US`
- Category: `MARKETING`
- Header: none
- Buttons: none required
- Body:

```text
Hi {{1}}, {{2}}
```

| Variable | Runtime value | Example submitted to Meta |
| --- | --- | --- |
| `{{1}}` | Vendor owner's first name | `Amina` |
| `{{2}}` | Stage-specific subscription notice | `your Vodium Ledger subscription is approaching its renewal date.` |

The second value is selected by the subscription stage, for example grace
period started, three days remaining, or final grace-period warning. Email is
also sent where an email address exists. WhatsApp uses only this approved
template and never falls back to plain text.

Where it is used: `src/lib/subscription-nudge.ts`.

## 4. How to create them in Meta

### Text templates

Use this sequence for payment reminders, credit logged, vendor digest, and
subscription nudge. Select the category specified in the inventory above:

- `UTILITY`: `vodium_payment_reminder`, `vodium_credit_logged`
- `MARKETING`: `vodium_vendor_digest`, `vodium_subscription_nudge`

1. Open Meta Business Suite → WhatsApp Manager → Message Templates.
2. Select the WABA that owns Vodium's sending number.
3. Select **Create template**.
4. Choose the category specified in section 3:
   - **Utility** for `vodium_payment_reminder` and `vodium_credit_logged`.
   - **Marketing** for `vodium_vendor_digest` and `vodium_subscription_nudge`.
5. Enter the exact lowercase template name.
6. Choose `English (US)` / `en_US`.
7. Add a Body component only.
8. Paste the exact body from section 3.
9. Insert variables in the same order shown in the table.
10. Add the example values for every variable in one complete example row.
11. Do not add extra text, promotional links, extra buttons, or a different
    variable order.
12. Submit for review and wait for `APPROVED`.

The application can send only after Meta has approved the template. `PENDING`
is not a usable production state.

### PDF document templates

Use this sequence for the invoice and weekly report:

1. Create a Utility template with the exact name and `en_US` language.
2. Add a **Header** component with format **Document**.
3. Add the exact Body component and variables from the relevant section.
4. Upload a small sample PDF for Meta's header example.
5. Submit the template for review.
6. After approval, verify the template status and send a real invoice/report in
   staging.

The admin auto-provisioning endpoint needs a Meta resumable-upload handle for
the sample PDF, not a public URL and not a normal WhatsApp media ID. Put that
handle in `WHATSAPP_INVOICE_TEMPLATE_HEADER_HANDLE`. The same handle is reused
for both document templates. If the handle is invalid, create the templates
manually in Meta instead of repeatedly retrying the admin button.

#### Getting the PDF header handle

If Meta's template screen does not provide a usable sample handle, create one
through the resumable upload flow. Keep the access token out of Git and never
put it in a screenshot or a document.

1. Prepare a small, fake PDF such as `vodium-template-sample.pdf`. Do not use a
   real customer's invoice.
2. Record the PDF size in bytes and have the Meta App ID and system-user token
   available.
3. Create an upload session. Replace the placeholders with local values and
   use the Graph API version configured by the project.

```bash
curl -X POST \
  "https://graph.facebook.com/v19.0/<META_APP_ID>/uploads?file_length=<FILE_SIZE_BYTES>&file_type=application/pdf&access_token=<SYSTEM_USER_TOKEN>"
```

4. Meta returns an upload-session identifier. Upload the binary PDF to that
   session:

```bash
curl -X POST \
  "https://graph.facebook.com/v19.0/<UPLOAD_SESSION_ID>" \
  -H "Authorization: OAuth <SYSTEM_USER_TOKEN>" \
  -H "file_offset: 0" \
  --data-binary "@vodium-template-sample.pdf"
```

5. Copy the response's `h` value. It normally begins with `2:` or `4:`. Do not
   copy the upload-session ID, a WhatsApp media ID, or the PDF URL.
6. Add that value to Vercel as `WHATSAPP_INVOICE_TEMPLATE_HEADER_HANDLE` for
   the target environment and redeploy.
7. Open **Admin → Team → WhatsApp delivery templates** and click **Create
   templates**. The invoice and weekly report definitions will use that sample
   handle for their DOCUMENT header examples.

If the handle expires or Meta returns `2494102`, repeat the upload and replace
the Vercel value. The handle is for template creation/review; the actual
invoice or report URL is supplied separately when Vodium sends a message.

### OTP authentication template

Use the authentication-template flow rather than a normal Utility template:

1. Choose **Authentication**.
2. Use `vodium_otp` or the exact name configured in
   `WHATSAPP_OTP_TEMPLATE_NAME`.
3. Enable the security recommendation.
4. Set the code expiry to 10 minutes.
5. Add the Copy Code OTP button.
6. Submit and wait for approval.

The application sends the six-digit code as the first body value and repeats
it in the authentication button. Do not add ordinary body variables or change
the button to a marketing/URL button.

## 5. Admin provisioning and status verification

The admin template panel is available under **Admin → Team → WhatsApp delivery
templates**. It can inspect the current WABA and provision the following seven
templates when they do not already exist:

- OTP
- payment reminder
- credit logged
- invoice PDF
- weekly report
- vendor digest
- subscription nudge

After creating or changing a template:

1. Wait for Meta status `APPROVED`.
2. Open the admin template panel and refresh status.
3. Confirm the displayed name, language, and status.
4. Trigger the matching staging workflow.
5. Check the WhatsApp delivery log and the provider status webhook.
6. Confirm that the message arrived on a test phone outside the 24-hour window.

## 6. Common failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Meta error `132001` | Name, language, or approval mismatch | Copy the exact Meta name into the matching Vercel variable; confirm the language is `en_US` and status is `APPROVED` |
| Template exists but is not found by admin | Wrong WABA or token asset | Set `WHATSAPP_BUSINESS_ACCOUNT_ID`; assign the WABA to the system user; redeploy |
| Body parameter mismatch | Template variables were reordered or added | Recreate/replace the template with the exact body and runtime order in this guide |
| Document template creation fails with `2494102` | Header handle is a media ID, URL, expired handle, or from another app | Upload a sample PDF through Meta's resumable upload flow and use the returned `h` value |
| Template creation fails with `2388185` | Business Verification is incomplete | Complete Meta Business Verification, then submit again |
| Message accepted but not delivered | Template is pending/rejected, recipient is invalid, or delivery status is later failed | Check Meta approval, delivery webhook, recipient format, and Admin → WhatsApp outbox |
| OTP copy button is missing | Authentication template was created as a normal text template or button was disabled | Create an Authentication template with Copy Code and keep `WHATSAPP_OTP_TEMPLATE_BUTTON` enabled |
| One environment works and another does not | Vercel variables differ between Preview and Production | Copy the same template names, language values, WABA ID, and credentials into the deployed environment being tested |

## 7. Data-safety rules

- Meta receives only the values needed by the approved template.
- AI writes digest wording only; it does not calculate balances.
- Balances, dates, repayment totals, and invoice amounts come from PostgreSQL
  queries and deterministic formatting.
- Do not place access tokens, customer identity documents, or raw database
  exports in template examples.
- Use realistic but fake example values in Meta's review form.
- Keep the application template name, language, and variable order in sync with
  this document whenever a template is changed.

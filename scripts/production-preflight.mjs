const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SESSION_SECRET",
  "SECRET_ENCRYPTION_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "CRON_SECRET",
];

const templateDefaults = {
  WHATSAPP_OTP_TEMPLATE_NAME: "vodium_otp",
  WHATSAPP_REMINDER_TEMPLATE_NAME: "vodium_payment_reminder",
  WHATSAPP_INVOICE_TEMPLATE_NAME: "vodium_invoice_pdf",
  WHATSAPP_CREDIT_LOGGED_TEMPLATE_NAME: "vodium_credit_logged",
  WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME: "vodium_weekly_report",
  WHATSAPP_VENDOR_DIGEST_TEMPLATE_NAME: "vodium_vendor_digest",
  WHATSAPP_SUBSCRIPTION_NUDGE_TEMPLATE_NAME: "vodium_subscription_nudge",
};

const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error("Production preflight failed. Missing configuration:");
  for (const name of missing) console.error(`- ${name}`);
  process.exit(1);
}

if (process.env.NODE_ENV !== "production") {
  console.warn("Preflight passed configuration checks; NODE_ENV is not production.");
}

console.log("Production preflight passed configuration checks.");
for (const [name, fallback] of Object.entries(templateDefaults)) {
  console.log(`${name}: ${process.env[name]?.trim() || fallback}`);
}
console.log("Next steps: npm run db:deploy, verify template approval in Admin, then call /api/health.");

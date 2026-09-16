import { LegalArticle } from "@/components/ui/legal";

export const metadata = { title: "Privacy Policy · Vodium Ledger" };

export default function PrivacyPage() {
  return (
    <LegalArticle title="Privacy Policy" updated="26 June 2026">
      <p>
        This Policy explains how Vodium Ledger collects, uses, shares and protects personal data. We process personal data
        in line with the Nigeria Data Protection Act (NDPA) 2023 and applicable regulations.
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        For vendor and staff accounts, Vodium is the data controller. For customer (student/buyer) data entered by a store,
        the <strong>store is the controller</strong> and Vodium is a <strong>data processor</strong> acting on the store&rsquo;s
        instructions under a Data Processing Agreement.
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, business name, email, phone number, role, branch.</li>
        <li><strong>Credit data:</strong> customer name and phone, amounts, due dates, repayments, order items, coupons.</li>
        <li><strong>Consent records:</strong> timestamp and IP address when a customer accepts BNPL terms.</li>
        <li><strong>Technical data:</strong> log, device and usage information for security and reliability.</li>
      </ul>

      <h2>3. How we use data</h2>
      <ul>
        <li>To provide credit tracking, reminders, reporting and payments.</li>
        <li>To authenticate users (email one-time codes) and secure accounts.</li>
        <li>To produce aggregated, de-identified credit intelligence. We do not sell personal data.</li>
        <li>To meet legal, tax and audit obligations.</li>
      </ul>

      <h2>4. Reminders and communications</h2>
      <p>
        Repayment reminders are sent on behalf of the store via WhatsApp, SMS or email. Customers may opt out of non-essential
        messages; transactional messages about an outstanding balance may still be sent.
      </p>

      <h2>5. Sharing</h2>
      <p>We share data with service providers that help us operate (for example payment processors, messaging and email providers, hosting), under contracts that protect the data. We may disclose data where required by law.</p>

      <h2>6. Retention</h2>
      <p>When an account is closed, access is disabled immediately and the account and financial records are retained for 90 days for fraud prevention, financial reconciliation, disputes and lawful investigations. After that window, data is securely deleted or de-identified, except where a longer period is required by law or an active investigation. Organizations may request deletion subject to these obligations.</p>

      <h2>7. Your rights</h2>
      <p>
        Subject to the NDPA, you may request access, correction, deletion, restriction or portability of your data, and may
        object to certain processing. To exercise these rights, contact us using the email below; for customer data held on
        behalf of a store, requests may be routed to that store.
      </p>

      <h2>8. Security</h2>
      <p>We use encryption in transit, access controls, signed sessions, rate limiting and audit logging. No system is perfectly secure, but we work to protect your data and to notify affected parties of breaches as required.</p>

      <h2>9. Changes</h2>
      <p>We may update this Policy; material changes will be notified in-app or by email.</p>
    </LegalArticle>
  );
}

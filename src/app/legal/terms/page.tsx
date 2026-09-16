import { LegalArticle } from "@/components/ui/legal";

export const metadata = { title: "Terms of Service · Vodium Ledger" };

export default function TermsPage() {
  return (
    <LegalArticle title="Terms of Service" updated="26 June 2026">
      <p>
        These Terms govern your access to and use of the Vodium Ledger platform (the &ldquo;Service&rdquo;), operated for
        Nigerian vendors and the organizations that subscribe to it. By creating an account or using the Service, you agree
        to these Terms.
      </p>

      <h2>1. Who can use the Service</h2>
      <p>
        The Service is for registered vendors, supermarkets and their authorised staff. You must provide accurate
        information and are responsible for activity under your account. Staff accounts are created and managed by the
        organization that invited them.
      </p>

      <h2>2. What Vodium Ledger is — and is not</h2>
      <p>
        Vodium Ledger is <strong>software infrastructure</strong> for tracking store credit, repayments and reminders. The
        store, not Vodium, extends credit to its customers and is the lender. Vodium does not lend money, hold customer
        funds, or act as a deposit-taking institution. Payments move through licensed providers (for example Paystack); we
        store only provider references.
      </p>

      <h2>3. Subscriptions and billing</h2>
      <ul>
        <li>Solo vendors receive a free trial, after which a monthly plan applies.</li>
        <li>Supermarket/enterprise tenants receive a trial, then a monthly software fee plus per-branch fees and any agreed setup fee.</li>
        <li>Fees are billed in Naira (₦). Non-payment may lead to suspension of enterprise features after a grace period.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to misuse the Service, including by uploading unlawful data, attempting to breach security, or using it to harass customers. Reminders sent through the Service must be respectful and compliant with applicable law.</p>

      <h2>5. Data</h2>
      <p>
        Your handling of personal data is governed by our <a href="/legal/privacy">Privacy Policy</a> and, for organizations,
        a Data Processing Agreement. Repayment and credit-history data generated through the Service may be used in aggregated
        and de-identified form to improve credit intelligence, as described in the Privacy Policy.
      </p>

      <h2>6. Suspension and termination</h2>
      <p>We may suspend or terminate accounts that breach these Terms or that present legal or security risk. You may close your account at any time. Access is disabled immediately, records are retained for 90 days for fraud, financial, dispute and legal review, and then securely purged or de-identified unless a longer legal or investigation hold applies.</p>

      <h2>7. Disclaimers and liability</h2>
      <p>The Service is provided &ldquo;as is&rdquo;. To the extent permitted by law, Vodium is not liable for indirect or consequential losses, or for a store&rsquo;s decision to extend or recover credit. Nothing limits liability that cannot be excluded by law.</p>

      <h2>8. Changes</h2>
      <p>We may update these Terms; material changes will be notified in-app or by email. Continued use after changes take effect constitutes acceptance.</p>

      <h2>9. Governing law</h2>
      <p>These Terms are governed by the laws of the Federal Republic of Nigeria.</p>
    </LegalArticle>
  );
}

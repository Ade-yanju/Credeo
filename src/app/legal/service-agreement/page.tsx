import { LegalArticle } from "@/components/ui/legal";

export const metadata = { title: "Supermarket Service Agreement · Vodium Ledger" };

export default function ServiceAgreementPage() {
  return (
    <LegalArticle title="Supermarket Service Agreement" updated="26 June 2026">
      <p>
        This Agreement sets out the commercial terms between Vodium Ledger (&ldquo;Vodium&rdquo;) and a supermarket or
        enterprise customer (&ldquo;Organization&rdquo;) that subscribes to the enterprise features. It supplements the
        general <a href="/legal/terms">Terms of Service</a>.
      </p>

      <h2>1. The Service</h2>
      <p>Vodium provides software to record store credit and Buy-Now-Pay-Later (BNPL) orders across the Organization&rsquo;s branches, manage staff and roles, send repayment reminders, and produce reports. Vodium is a software provider, not a lender, and does not hold customer funds.</p>

      <h2>2. Roles and access</h2>
      <p>The Organization&rsquo;s owner controls staff invitations and roles. The Organization is responsible for the actions of its staff and for keeping access up to date when staff change.</p>

      <h2>3. Fees</h2>
      <ul>
        <li>A free trial, then a monthly software fee.</li>
        <li>A per-branch fee for each active branch.</li>
        <li>An optional one-time setup fee for onboarding, domain or WhatsApp configuration.</li>
      </ul>
      <p>Fees are quoted in Naira (₦) and confirmed in writing before activation. Pricing may change with reasonable notice.</p>

      <h2>4. Payment terms and non-payment</h2>
      <p>Fees are due monthly. If fees are unpaid past the grace period, enterprise features may be moved to a read-only or suspended state. The Organization keeps access to export its data during a wind-down period.</p>

      <h2>5. Customer data</h2>
      <p>The Organization is the controller of its customers&rsquo; personal data; Vodium acts as processor under the <a href="/legal/dpa">Data Processing Agreement</a>. The Organization is responsible for obtaining customer consent for credit, reminders and payment authorization.</p>

      <h2>6. Lending and collections</h2>
      <p>The Organization extends credit to its customers and is solely responsible for credit decisions and lawful collection of amounts owed. Vodium provides reminders and reporting tools only and does not guarantee recovery.</p>

      <h2>7. If the Organization stops paying Vodium</h2>
      <p>Stopping payment to Vodium does not affect amounts the Organization&rsquo;s customers owe the Organization. On account closure, access is disabled immediately and Vodium retains the Organization&rsquo;s account and financial records for 90 days for fraud, reconciliation, dispute and legal review. After that period, the data is deleted or de-identified, subject to the Privacy Policy, law and active investigation holds.</p>

      <h2>8. Term and termination</h2>
      <p>Either party may terminate with notice. Vodium may suspend for breach, legal risk or security reasons.</p>

      <h2>9. Governing law</h2>
      <p>This Agreement is governed by the laws of the Federal Republic of Nigeria.</p>
    </LegalArticle>
  );
}

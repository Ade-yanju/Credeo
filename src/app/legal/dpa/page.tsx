import { LegalArticle } from "@/components/ui/legal";

export const metadata = { title: "Data Processing Agreement · Vodium Ledger" };

export default function DpaPage() {
  return (
    <LegalArticle title="Data Processing Agreement" updated="26 June 2026">
      <p>
        This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the agreement between the Organization
        (&ldquo;Controller&rdquo;) and Vodium Ledger (&ldquo;Processor&rdquo;) and governs Vodium&rsquo;s processing of
        personal data on the Organization&rsquo;s behalf under the Nigeria Data Protection Act (NDPA) 2023.
      </p>

      <h2>1. Roles</h2>
      <p>The Organization is the Controller of its customers&rsquo; personal data. Vodium is the Processor and processes that data only on the Organization&rsquo;s documented instructions, including as set out in the product.</p>

      <h2>2. Scope of processing</h2>
      <ul>
        <li><strong>Subject matter:</strong> providing credit-tracking, BNPL, reminders and reporting.</li>
        <li><strong>Data subjects:</strong> the Organization&rsquo;s customers and staff.</li>
        <li><strong>Data types:</strong> names, phone numbers, amounts owed and repaid, order details, consent records.</li>
      </ul>

      <h2>3. Processor obligations</h2>
      <ul>
        <li>Process personal data only on documented instructions.</li>
        <li>Ensure people authorised to process data are bound by confidentiality.</li>
        <li>Apply appropriate technical and organisational security measures.</li>
        <li>Assist the Controller with data-subject requests and breach notification.</li>
        <li>Delete or return personal data at the end of the service, subject to legal retention.</li>
        <li>Make available information needed to demonstrate compliance.</li>
      </ul>

      <h2>4. Sub-processors</h2>
      <p>The Organization authorises Vodium to use sub-processors (for example hosting, database, email, messaging and payment providers) under contracts with equivalent data-protection obligations. Vodium remains responsible for their performance.</p>

      <h2>5. Security</h2>
      <p>Measures include encryption in transit, access controls, signed sessions, rate limiting, and audit logging of sensitive actions.</p>

      <h2>6. Data-subject requests</h2>
      <p>Where a data subject contacts Vodium directly about data processed for the Organization, Vodium will refer the request to the Organization and assist as reasonably required.</p>

      <h2>7. Breach notification</h2>
      <p>Vodium will notify the Organization without undue delay after becoming aware of a personal-data breach affecting the Organization&rsquo;s data, and provide information reasonably needed to meet the Organization&rsquo;s obligations.</p>

      <h2>8. International transfers</h2>
      <p>Where data is processed outside Nigeria by a sub-processor, appropriate safeguards consistent with the NDPA will be applied.</p>

      <h2>9. Retention and deletion</h2>
      <p>On termination, Vodium will disable access and retain the Organization&rsquo;s account and financial records for 90 days for fraud prevention, reconciliation, disputes and lawful investigations. After that period, Vodium will delete or de-identify the data, except where a longer period is required by law or an active investigation.</p>
    </LegalArticle>
  );
}

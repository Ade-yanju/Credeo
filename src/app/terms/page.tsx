import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service : Vodium Ledger",
  description: "Vodium Ledger terms of service for vendors and users.",
};

export default function TermsPage() {
  const EFFECTIVE = "1 June 2026";
  const EMAIL = "legal@vodiumledger.com";

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section className="mb-10">
      <h2 className="font-serif text-xl text-vodium-black mb-3">{title}</h2>
      <div className="text-vodium-black/65 text-[15px] leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-vodium-cream">
      {/* Nav */}
      <nav className="border-b border-black/[0.06] bg-white/80 backdrop-blur-md sticky top-0 z-20 pt-safe px-safe">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-vodium-black border border-vodium-gold/40 flex items-center justify-center">
              <span className="font-serif text-vodium-gold text-sm leading-none">
                V
              </span>
            </div>
            <span className="font-serif tracking-[0.18em] text-vodium-black text-xs">
              VODIUM LEDGER
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-vodium-black/50 hover:text-vodium-black transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center">
              <FileText size={18} className="text-vodium-gold" />
            </div>
            <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold">
              Legal
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-vodium-black mb-4 leading-tight">
            Terms of Service
          </h1>
          <p className="text-vodium-black/40 text-sm">
            Effective:{" "}
            <strong className="text-vodium-black/60">{EFFECTIVE}</strong>
            &nbsp;·&nbsp;Governed by the laws of the Federal Republic of Nigeria
          </p>
        </div>

        <div className="brand-divider mb-10" />

        <Section title="Acceptance of terms">
          <p>
            By creating a Vodium Ledger account or using our services, you agree
            to be bound by these Terms of Service (&quot;Terms&quot;). If you do not
            agree, do not use the platform.
          </p>
          <p>
            These Terms constitute a binding agreement between you (&quot;Vendor&quot;,
            &quot;you&quot;) and VODIUMX TECHNOLOGIES LTD (RC: 8976921) (&quot;Vodium&quot;, &quot;we&quot;, &quot;us&quot;), a
            company incorporated in Nigeria.
          </p>
        </Section>

        <Section title="The service">
          <p>
            Vodium Ledger provides Nigerian campus vendors with software tools
            to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Record and track credit extended to student customers</li>
            <li>
              Send automated WhatsApp reminders to students before repayment due
              dates
            </li>
            <li>
              View repayment histories and credit scores for students on the
              Vodium network
            </li>
            <li>Manage a credit book and export records</li>
          </ul>
          <p>
            Vodium Ledger is a{" "}
            <strong>record-keeping and intelligence tool only.</strong> We do
            not lend money, process payments between vendors and students, or
            guarantee repayment of any credit you extend.
          </p>
        </Section>

        <Section title="Eligibility and accounts">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              You must be at least 18 years old and operate a legitimate
              business to create a vendor account.
            </li>
            <li>
              You are responsible for maintaining the confidentiality of your
              login credentials. Do not share your password.
            </li>
            <li>
              You must provide accurate business and contact information.
              Accounts created with false information may be suspended.
            </li>
            <li>
              One account per business. You may not operate multiple accounts
              for the same business.
            </li>
          </ul>
        </Section>

        <Section title="Subscription and payment">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-vodium-black">Free trial:</strong> All new
              accounts receive a 60-day free trial of the Starter plan. No
              payment method required to start.
            </li>
            <li>
              <strong className="text-vodium-black">Billing:</strong> After the
              trial, a subscription is required to continue using the platform.
              Plans are billed monthly in Nigerian Naira (₦) through Paystack.
            </li>
            <li>
              <strong className="text-vodium-black">Refunds:</strong> Due to the
              nature of software services, we do not offer refunds on paid
              subscription months. If you cancel, your access continues until
              the end of the billing period.
            </li>
            <li>
              <strong className="text-vodium-black">Price changes:</strong> We
              will give at least 30 days notice before increasing subscription
              prices. You may cancel before the increase takes effect.
            </li>
          </ul>
        </Section>

        <Section title="Your data and student data">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-vodium-black">Your credit records</strong>{" "}
              belong to you. You can export them at any time via the dashboard
              CSV export.
            </li>
            <li>
              <strong className="text-vodium-black">
                Student data you enter
              </strong>{" "}
              is your responsibility. You represent that you have a legitimate
              basis to record and process this information, and that you will
              use reminder messages respectfully and only for genuine debt
              recovery purposes.
            </li>
            <li>
              <strong className="text-vodium-black">Vodium Score:</strong> We
              aggregate repayment signals across the network to compute a
              proprietary credit quality score. By using the platform, you grant
              Vodium a licence to use your anonymised credit event data to
              compute scores for use across the network. Individual vendor
              identities are never disclosed to other vendors.
            </li>
            <li>
              You may not use Vodium Ledger to harass, shame, or publicly expose
              students for non-payment. Reminder messages must not be forwarded,
              modified, or weaponised.
            </li>
          </ul>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Use the platform for any unlawful purpose under Nigerian law
            </li>
            <li>Input false credit records or manipulate student scores</li>
            <li>
              Attempt to access another vendor&apos;s data or reverse-engineer
              the credit scoring system
            </li>
            <li>
              Use automated scripts or bots to interact with the platform (other
              than the official WhatsApp bot interface)
            </li>
            <li>
              Resell, sublicense, or white-label the platform without written
              permission
            </li>
            <li>
              Upload malicious code or attempt to compromise the security of the
              platform
            </li>
          </ul>
        </Section>

        <Section title="WhatsApp messaging">
          <p>By using the reminder feature, you agree that:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              You have a legitimate basis to contact the student (i.e., they owe
              you money under an agreed credit arrangement)
            </li>
            <li>
              Student reminders are sent through Meta&apos;s WhatsApp Business
              API and are subject to Meta&apos;s policies
            </li>
            <li>
              You will not use the bot to send spam or unsolicited marketing
              messages
            </li>
          </ul>
        </Section>

        <Section title="Uptime and service availability">
          <p>
            We target 99.5% monthly uptime. We are not liable for outages caused
            by third-party services (Supabase, Vercel, Meta, Paystack, Twilio)
            or force majeure events. Scheduled maintenance will be announced at
            least 24 hours in advance.
          </p>
          <p>
            The platform is provided &ldquo;as is&rdquo;. We do not guarantee
            that the service will be error-free, or that the data stored will be
            free from loss. We recommend you export your credit records
            regularly.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by Nigerian law, Vodium&apos;s total
            liability for any claim arising out of these Terms shall not exceed
            the amount you paid to Vodium in the three months preceding the
            claim.
          </p>
          <p>
            We are not liable for: unpaid debts by your students; losses arising
            from inaccurate credit records you entered; indirect, consequential,
            or punitive damages; or losses arising from third-party service
            outages.
          </p>
        </Section>

        <Section title="Account termination">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-vodium-black">By you:</strong> You may
              delete your account at any time from Settings → Danger zone. We
              will purge your data within 30 days, subject to legal retention
              requirements.
            </li>
            <li>
              <strong className="text-vodium-black">By us:</strong> We may
              suspend or terminate accounts that violate these Terms, fail to
              pay subscription fees after a grace period, or are used for
              fraudulent purposes. We will give 7 days notice except in cases of
              serious misuse.
            </li>
          </ul>
        </Section>

        <Section title="Governing law and disputes">
          <p>
            These Terms are governed by the laws of the Federal Republic of
            Nigeria. Any dispute shall first be attempted to be resolved by
            negotiation. If unresolved within 30 days, disputes shall be
            submitted to arbitration under the Arbitration and Conciliation Act
            (Nigeria), with proceedings in Lagos.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these Terms from time to time. Material changes will
            be notified via email at least 14 days before taking effect.
            Continued use of the platform after the effective date constitutes
            acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Legal:{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-vodium-gold hover:underline"
            >
              {EMAIL}
            </a>
            <br />
            Support:{" "}
            <a
              href="mailto:hello@vodiumledger.com"
              className="text-vodium-gold hover:underline"
            >
              hello@vodiumledger.com
            </a>
            <br />
            VODIUMX TECHNOLOGIES LTD (RC: 8976921), Lagos, Nigeria
          </p>
        </Section>

        <div className="brand-divider mt-12 mb-8" />
        <p className="text-vodium-black/30 text-xs text-center">
          © 2026 VODIUMX TECHNOLOGIES LTD (RC: 8976921) · Lagos, Nigeria · All rights
          reserved
        </p>
      </main>
    </div>
  );
}

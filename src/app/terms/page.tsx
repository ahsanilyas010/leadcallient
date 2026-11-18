import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { BRAND, COMPANY } from "@/lib/brand";
import { FREE_AGENT_SEATS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms for using ${BRAND.productName}, a product of ${COMPANY.legalName}.`,
  alternates: { canonical: "/terms" },
};

// Starting draft — have it reviewed by counsel before relying on it.
export default function TermsPage() {
  const p = BRAND.productName;
  return (
    <LegalPage title="Terms of Service" updated="September 2026">
      <p>
        These terms govern your use of {p}, provided by {COMPANY.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account you agree to
        them on behalf of yourself and the organisation you represent.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must give accurate details and keep your password secure. You&apos;re responsible for activity under your workspace.</li>
        <li>Each login is for one person. The workspace admin controls who has access.</li>
      </ul>

      <h2>Plans and payment</h2>
      <ul>
        <li>
          Every new workspace includes a free 14-day trial for {FREE_AGENT_SEATS} agent seats. When the trial ends, access to the workspace is paused
          until payment is received and we approve the company; your data is kept and nothing is deleted. Additional agent seats are billed in advance at the
          price we agree with you, by bank transfer or through our payment provider, Stripe.
        </li>
        <li>You can change or cancel seats at any time; changes are prorated on the next invoice. Fees already paid are non-refundable except where the law requires.</li>
        <li>Calling runs through your own Zoom Phone account; Zoom bills call minutes and phone numbers to you, not us.</li>
      </ul>

      <h2>Acceptable use and compliance</h2>
      <ul>
        <li>
          You&apos;re responsible for making sure your calling, messaging and data use comply with the laws that apply to you, including
          telemarketing and do-not-call rules (such as the TCPA and National DNC Registry in the US, and TPS/CTPS in the UK), consent and
          recording-disclosure requirements, and data-protection law.
        </li>
        <li>Don&apos;t use {p} for unlawful, harassing or fraudulent activity, or try to break or overload the service.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        You own the data you put into {p}. We process it to provide the service, as described in our{" "}
        <Link href="/privacy" className="text-brand-blue underline">Privacy Policy</Link>, and you can export or delete it.
      </p>

      <h2>Service and liability</h2>
      <p>
        We work to keep {p} available and secure but provide it &ldquo;as is&rdquo;. To the extent the law allows, our total liability is limited to
        the fees you paid us in the 12 months before the claim, and we&apos;re not liable for indirect or consequential losses.
      </p>

      <h2>Ending</h2>
      <p>You can close your account at any time. We may suspend accounts that breach these terms or don&apos;t pay.</p>

      <h2>Contact</h2>
      <p>
        Questions? <Link href="/contact" className="text-brand-blue underline">Contact us</Link>.
      </p>
    </LegalPage>
  );
}

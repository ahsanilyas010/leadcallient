import Link from "next/link";
import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";
import { COMPANY } from "@/lib/brand";

// Shown on Agents & billing while online card payments are switched off: no
// price list or seat picker, just how to reach us to add agents. Each contact
// method appears once its NEXT_PUBLIC_COMPANY_* value is set.
export function ContactCard({ workspaceName }: { workspaceName: string }) {
  const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition";
  const methods = [
    COMPANY.phone && (
      <a key="phone" href={`tel:${COMPANY.phone.replace(/\s+/g, "")}`} className={`${btn} bg-gold-gradient text-ink shadow-lg shadow-gold/25 hover:brightness-105`}>
        <Phone className="h-4 w-4" /> Call {COMPANY.phone}
      </a>
    ),
    COMPANY.whatsappUrl && (
      <a key="wa" href={COMPANY.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#25D366] text-white hover:brightness-105`}>
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
    ),
    COMPANY.email && (
      <a
        key="mail"
        href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(`More agents for ${workspaceName}`)}`}
        className={`${btn} bg-white text-ink ring-1 ring-line hover:bg-canvas`}
      >
        <Mail className="h-4 w-4" /> {COMPANY.email}
      </a>
    ),
  ].filter(Boolean);

  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
      <h2 className="font-display text-xl font-semibold text-ink">Need more agents?</h2>
      <p className="mt-1 text-sm text-muted">
        Plans are arranged with us directly. Tell us how many agents you need and we&apos;ll set your workspace up, usually the same day.
      </p>
      {methods.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">{methods}</div>
      ) : (
        <Link href="/contact" className={`mt-5 ${btn} bg-gold-gradient text-ink shadow-lg shadow-gold/25 hover:brightness-105`}>
          Contact us <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {methods.length > 0 && (
        <Link href="/contact" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
          Our address and office details <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Mail, MapPin, MessageCircle, Phone, PlayCircle, Sparkles } from "lucide-react";
import { BRAND, COMPANY, companyAddressLine } from "@/lib/brand";
import { absoluteUrl, siteUrl } from "@/lib/site";
import { FREE_AGENT_SEATS } from "@/lib/plan";
import { jsonLdHtml, organizationJsonLd } from "@/lib/structured-data";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";

export const metadata: Metadata = {
  title: "Contact us",
  description: `Talk to the ${BRAND.productName} team at ${COMPANY.legalName}, ${companyAddressLine()}. Call or message us about pricing, getting your team set up or Zoom Phone calling.`,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: BRAND.productName,
    title: `Contact ${BRAND.productName}`,
    description: `${COMPANY.legalName} · ${companyAddressLine()}`,
    url: "/contact",
    images: ["/opengraph-image"],
  },
};

const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyAddressLine())}`;

function structuredData() {
  const org = organizationJsonLd();
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      {
        "@type": "ContactPage",
        url: absoluteUrl("/contact"),
        name: `Contact ${BRAND.productName}`,
        about: { "@id": org["@id"] },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: BRAND.productName, item: siteUrl() },
          { "@type": "ListItem", position: 2, name: "Contact", item: absoluteUrl("/contact") },
        ],
      },
    ],
  };
}

const BTN = "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-semibold sm:w-auto";

// The ways to reach us, in the order we'd rather be contacted. Each only
// shows once its NEXT_PUBLIC_COMPANY_* value is set; nothing is shown as
// "coming soon".
function ContactButtons() {
  const buttons = [
    COMPANY.phone && (
      <a key="call" href={`tel:${COMPANY.phone.replace(/\s+/g, "")}`} className={`${BTN} bg-gold-gradient text-ink shadow-lg shadow-gold/25 transition hover:brightness-105`}>
        <Phone className="h-5 w-5" /> Call {COMPANY.phone}
      </a>
    ),
    COMPANY.whatsappUrl && (
      <a
        key="whatsapp"
        href={COMPANY.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN} bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition hover:brightness-105`}
      >
        <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
      </a>
    ),
    COMPANY.email && (
      <a key="email" href={`mailto:${COMPANY.email}`} className={`${BTN} bg-white/10 text-white ring-1 ring-white/30 transition hover:bg-white/15`}>
        <Mail className="h-5 w-5" /> Email us
      </a>
    ),
  ].filter(Boolean);
  if (buttons.length === 0) return null;
  return <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">{buttons}</div>;
}

const HAS_DIRECT_CONTACT = Boolean(COMPANY.phone || COMPANY.whatsappUrl || COMPANY.email);

export default function ContactPage() {
  const a = COMPANY.address;
  return (
    <div className="min-h-screen bg-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(structuredData())} />
      <SiteHeader />

      <main>
        <section className="brand-hero relative overflow-hidden px-4 pb-36 pt-32 text-white sm:pt-36">
          <div className="brand-orb brand-orb-1" aria-hidden />
          <div className="brand-orb brand-orb-2" aria-hidden />
          <div className="relative mx-auto max-w-3xl text-center">
            <h1 className="font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">
              Let&apos;s <span className="text-gold-gradient">talk.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">
              Questions about pricing, adding agents, getting your team set up or Zoom Phone calling?{" "}
              {HAS_DIRECT_CONTACT ? "Call or message us and a real person will reply." : "Reach us at the address below and a real person will reply."}
            </p>
            <ContactButtons />
          </div>
        </section>

        <section className="relative -mt-24 px-4 pb-20">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[1.3fr_1fr]">
            {/* Address */}
            <div className="rounded-3xl bg-white p-6 shadow-xl shadow-brand-blue/10 ring-1 ring-line sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">{COMPANY.legalName}</h2>
                  <p className="text-xs text-muted">The company behind {BRAND.productName}</p>
                </div>
              </div>
              <address className="mt-6 flex items-start gap-3 not-italic text-ink">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                <span className="leading-relaxed">
                  {a.street}
                  <br />
                  {a.city}, {a.region} {a.postalCode}
                  <br />
                  {COMPANY.country}
                </span>
              </address>
              <div className="mt-4 space-y-3 text-sm">
                {COMPANY.phone && (
                  <a href={`tel:${COMPANY.phone.replace(/\s+/g, "")}`} className="flex items-center gap-3 text-ink hover:text-brand-blue">
                    <Phone className="h-5 w-5 text-brand-blue" /> {COMPANY.phone}
                  </a>
                )}
                {COMPANY.email && (
                  <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-3 text-ink hover:text-brand-blue">
                    <Mail className="h-5 w-5 text-brand-blue" /> {COMPANY.email}
                  </a>
                )}
              </div>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline"
              >
                Open in Google Maps <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Next steps */}
            <div className="flex flex-col gap-4">
              {[
                { href: "/signup", icon: PlayCircle, title: "Start free", text: `${FREE_AGENT_SEATS} agents free, set up in two minutes.` },
                { href: "/login#demo", icon: Sparkles, title: "Try the live demo", text: "Six roles on a real demo workspace, no sign-up." },
              ].map(({ href, icon: Icon, title, text }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-1 items-center gap-4 rounded-3xl bg-white p-6 ring-1 ring-line transition hover:shadow-lg"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-gradient text-ink shadow">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-display font-semibold text-ink">{title}</span>
                    <span className="block text-sm text-muted">{text}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-1 group-hover:text-brand-blue" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

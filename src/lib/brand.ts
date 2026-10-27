// Single source of truth for user-visible brand copy — sidebar wordmark,
// login screen, PDF reports, outgoing emails, and a couple of admin-form
// labels. Every one of those call sites reads BRAND.* instead of a
// hardcoded string, so swapping branding is a one-file edit here, not a
// repo-wide grep-and-replace.
export const BRAND = {
  productName: "LeadCallient",
  metaDescription: "LeadCallient — call centre CRM and workforce platform in one place",
  loginTagline: "Contact-centre CRM · Live floor · Zoom Phone calling",
  processorBadgeLabel: "LeadCallient",
  processorLabel: "LeadCallient",
  emailFromName: "LeadCallient",
  emailFromDomainFallback: "mail.leadcallient.demo",
  pdfFilenamePrefix: "leadcallient-client-report",
  agentCodePlaceholder: "LC-114",
  website: "https://leadcallient.demo",
  // Public address of the deployed site, used for canonical URLs, the
  // sitemap and social previews. On Vercel the production domain is picked
  // up automatically (see src/lib/site.ts); this is the fallback.
  siteUrl: "https://dialbyhand.vercel.app",
  seoTitle: "LeadCallient — Contact-Centre CRM with Zoom Phone Calling",
  seoDescription:
    "LeadCallient is a contact-centre CRM with a dial workspace that calls through Zoom Phone, live floor, attendance, QA and compliance.",
};

// The company behind the product, shown on the contact page, in the site
// footer, on Agents & billing and on the sign-in page. The phone and WhatsApp
// defaults are Assorted Business's sales number; NEXT_PUBLIC_COMPANY_PHONE,
// NEXT_PUBLIC_COMPANY_EMAIL and NEXT_PUBLIC_COMPANY_WHATSAPP_URL (see
// .env.example) override them. Set a variable to an empty string to hide
// that contact method.
export const COMPANY = {
  legalName: "Assorted Business LLC",
  country: "United States",
  address: {
    street: "470 Schooleys Mountain Rd",
    city: "Hackettstown",
    region: "NJ",
    postalCode: "07840",
    countryCode: "US",
  },
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? "+92 321 8526405",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? "", // e.g. "hello@leadcallient.com"
  // WhatsApp chat link for the same number ("https://wa.me/<digits>").
  whatsappUrl: process.env.NEXT_PUBLIC_COMPANY_WHATSAPP_URL ?? "https://wa.me/923218526405",
};

// "470 Schooleys Mountain Rd, Hackettstown, NJ 07840, US"
export function companyAddressLine(): string {
  const a = COMPANY.address;
  return `${a.street}, ${a.city}, ${a.region} ${a.postalCode}, ${a.countryCode}`;
}


// Marketing tags. Fill in when ready; empty means the tag isn't loaded.
export const MARKETING = {
  // Meta (Facebook/Instagram) Pixel ID from Events Manager, e.g. "1234567890123456".
  // Tracks PageView on public pages and CompleteRegistration on sign-up.
  metaPixelId: "",
};

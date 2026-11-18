import { BRAND } from "@/lib/brand";

// The site's canonical origin (no trailing slash).
//
// Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment to the
// project's production domain — your custom domain once one is attached —
// so canonical URLs, the sitemap and social cards always point at the real
// site, including from preview builds. Nothing needs to be configured.
export function siteUrl(): string {
  // NEXT_PUBLIC_SITE_URL wins (e.g. an ngrok/cloudflared address while testing
  // Zoom's embedded phone, which needs the exact origin approved by a Zoom admin).
  const override = process.env.NEXT_PUBLIC_SITE_URL;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (override || (prod ? `https://${prod}` : BRAND.siteUrl)).replace(/\/$/, "");
}

export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

// Routes that belong to the signed-in demo app. They are kept out of search
// results (robots.txt disallow + noindex header) so only the marketing page
// is indexed.
export const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/workspace",
  "/dial",
  "/live",
  "/quality",
  "/performance",
  "/portal",
  "/client",
  "/qa",
  "/start",
  "/platform",
  "/change-password",
  "/trial-ended",
  "/api",
];

import type { Metadata } from "next";
import Link from "next/link";
import { Check, Headset, PhoneCall, ShieldCheck, CalendarCheck } from "lucide-react";
import { BrandMark } from "@/components/brand/mark";
import { MetaPixel } from "@/components/marketing/meta-pixel";
import { AttributionCapture } from "@/components/marketing/attribution";
import { BRAND, COMPANY } from "@/lib/brand";
import { FREE_AGENT_SEATS } from "@/lib/plan";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Start a 30-day free trial: 3 agents",
  description: `Create your ${BRAND.productName} workspace in two minutes. A 30-day free trial for ${FREE_AGENT_SEATS} agents, every feature included, no card needed. Call through your own Zoom Phone account.`,
  alternates: { canonical: "/signup" },
  openGraph: {
    type: "website",
    siteName: BRAND.productName,
    title: `Start ${BRAND.productName}: 30-day free trial for ${FREE_AGENT_SEATS} agents`,
    description: "Every feature, no card needed. Set up your call centre in two minutes.",
    url: "/signup",
    images: ["/opengraph-image"],
  },
};

const POINTS = [
  { icon: Headset, text: `30-day free trial for ${FREE_AGENT_SEATS} agents, plus unlimited admins, managers and QA` },
  { icon: PhoneCall, text: "Call through your own Zoom Phone account" },
  { icon: CalendarCheck, text: "Clock-in, shifts and leave built in" },
  { icon: ShieldCheck, text: "Compliance, QA and live floor built in" },
];

export default function SignupPage() {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <MetaPixel />
      <AttributionCapture />

      <aside className="brand-hero relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="brand-orb brand-orb-1" aria-hidden />
        <div className="brand-orb brand-orb-3" aria-hidden />
        <Link href="/" className="relative flex items-center gap-2.5">
          <BrandMark size={34} />
          <span className="font-display text-xl font-semibold">{BRAND.productName}</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Your call centre, <span className="text-gold-gradient">up and dialling</span> today.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-white/85">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <Icon className="h-4 w-4 text-gold-soft" />
                </span>
                <span className="pt-1.5 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">
          {BRAND.productName} is a product of {COMPANY.legalName}.
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center bg-canvas px-4 py-10 sm:px-8">
        <div className="w-full max-w-lg">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={30} />
            <span className="font-display text-lg font-semibold text-ink">{BRAND.productName}</span>
          </Link>
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Start your free trial</h1>
          <p className="mt-2 text-muted">
            30 days free for {FREE_AGENT_SEATS} agents. Every feature, no card needed.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            {["Set up in 2 minutes", "Keep going by bank transfer", "Cancel any time"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-brand-green-text" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-xl shadow-brand-blue/5 ring-1 ring-line sm:p-8">
            <SignupForm />
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Just looking?{" "}
            <Link href="/login#demo" className="font-medium text-brand-blue hover:underline">
              Explore the live demo
            </Link>{" "}
            on a real demo workspace instead.
          </p>
        </div>
      </main>
    </div>
  );
}

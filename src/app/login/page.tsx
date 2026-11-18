import type { Metadata } from "next";
import Link from "next/link";
import { Headset, CalendarCheck, Activity, ShieldCheck, Sparkles, ArrowLeft } from "lucide-react";
import { LoginForm } from "./login-form";
import { BrandMark } from "@/components/brand/mark";
import { BRAND, COMPANY, companyAddressLine } from "@/lib/brand";
import { FREE_AGENT_SEATS } from "@/lib/plan";
import { RealDemoPicker } from "./real-demo-picker";
import { getRealDemoPersonas } from "@/lib/actions/real-demo";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to LeadCallient, or try the live demo workspace as an admin, manager, team lead, agent, QA analyst or client.",
  alternates: { canonical: "/login" },
  openGraph: {
    type: "website",
    siteName: BRAND.productName,
    title: `Try the ${BRAND.productName} demo workspace`,
    description: "Pick a role and explore the dialer, live floor, attendance and QA on a real demo workspace.",
    url: "/login",
    // Overriding openGraph drops the inherited card, so name it again.
    images: ["/opengraph-image"],
  },
};

const HIGHLIGHTS = [
  { icon: Headset, title: "Power-dial workspace", text: "Scripts, dispositions and callbacks in one screen." },
  { icon: CalendarCheck, title: "Attendance", text: "Clock-ins, breaks, shifts and leave in one place." },
  { icon: Activity, title: "Live floor", text: "See every agent's state, calls and conversions in real time." },
  { icon: ShieldCheck, title: "Compliance first", text: "TPS/DNC screening, audit trail and QA scorecards." },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const realDemoPersonas = await getRealDemoPersonas();

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Hero */}
      <div className="brand-hero relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="brand-orb brand-orb-1" aria-hidden />
        <div className="brand-orb brand-orb-2" aria-hidden />
        <div className="brand-orb brand-orb-3" aria-hidden />

        <Link href="/" className="relative flex items-center gap-3 self-start rounded-xl transition hover:opacity-90">
          <div className="rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/20 backdrop-blur">
            <BrandMark size={34} />
          </div>
          <div>
            <div className="font-display text-xl font-semibold">{BRAND.productName}</div>
            <div className="text-xs text-white/70">{BRAND.loginTagline}</div>
          </div>
        </Link>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-soft ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5" /> Live platform
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight">
            Every call, <span className="text-gold-gradient">connected.</span>
          </h2>
          <p className="mt-3 text-sm text-white/75">
            A contact-centre CRM with a dial workspace, live floor, attendance, QA and compliance
            in one place, running on a real database.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }, i) => (
              <div
                key={title}
                className={`animate-slide-up stagger-${i + 1} rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/[0.12]`}
              >
                <Icon className="h-5 w-5 text-gold-soft" />
                <div className="mt-2 text-sm font-semibold">{title}</div>
                <div className="mt-0.5 text-xs text-white/65">{text}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">
          {BRAND.productName} is a product of {COMPANY.legalName} · {companyAddressLine()}.
        </p>
      </div>

      {/* Sign-in */}
      <div className="relative flex items-center justify-center overflow-hidden bg-canvas px-4 py-10">
        <div className="brand-mesh absolute inset-0" aria-hidden />
        <div className="relative w-full max-w-xl animate-slide-up">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-brand-blue"
          >
            <ArrowLeft className="h-4 w-4" /> Back to {BRAND.productName} home
          </Link>
          <div className="mb-6 flex flex-col items-center gap-2 text-center lg:hidden">
            <BrandMark size={40} />
            <p className="text-xs text-muted">{BRAND.loginTagline}</p>
          </div>

          <h1 className="font-display text-2xl font-semibold text-ink">Sign in to {BRAND.productName}</h1>
          <p className="mt-1 text-sm text-muted">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-brand-blue hover:underline">
              Start a free trial
            </Link>{" "}
            for {FREE_AGENT_SEATS} agents, free for 14 days.
          </p>
          <div className="mt-4">
            <LoginForm next={next} />
          </div>

          <div id="demo" className="scroll-mt-6" />
          <RealDemoPicker personas={realDemoPersonas} />
        </div>
      </div>
    </div>
  );
}

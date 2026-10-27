import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Headset,
  Phone,
  Activity,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  ShieldCheck,
  Database,
  Mail,
  Building2,
  Lock,
  Users,
  BellRing,
  Command,
  Sparkles,
  PlayCircle,
  Crown,
  Briefcase,
  Check,
  Radio,
  PhoneCall,
  Trophy,
  FileText,
  Ban,
  Clock,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand/mark";
import { BRAND } from "@/lib/brand";
import { absoluteUrl, siteUrl } from "@/lib/site";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader, SiteFooter, demoCta } from "@/components/landing/site-chrome";
import { FREE_AGENT_SEATS } from "@/lib/plan";
import { jsonLdHtml, organizationJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.productName} — contact-centre CRM that calls through Zoom Phone` },
  description:
    "Dial workspace that places calls through your own Zoom Phone account, live floor, attendance, QA, compliance and client reporting in one CRM.",
  alternates: { canonical: "/" },
};

const FEATURES: { icon: LucideIcon; title: string; text: string; tint: string }[] = [
  { icon: Headset, title: "Dial workspace", text: "One screen per call: lead details, script, objection handling, dispositions and callbacks. Keyboard shortcuts keep agents moving.", tint: "from-[var(--gold)] to-[#ea580c]" },
  { icon: Phone, title: "Zoom Phone calling", text: "Calls run through your own Zoom Phone account in an embedded Zoom dial pad. Call minutes bill to you, not to us.", tint: "from-[#34d399] to-[var(--teal)]" },
  { icon: Activity, title: "Live floor", text: "Who's available, on a call or on break, plus today's calls, connects and conversions, as it happens.", tint: "from-[#34d399] to-[#059669]" },
  { icon: BarChart3, title: "Performance", text: "Campaign funnels and per-agent scorecards: calls, connects, conversions and talk time.", tint: "from-[var(--gold)] to-[#f97316]" },
  { icon: CalendarCheck, title: "Attendance & shifts", text: "Clock in/out, break and status tracking, shift rosters, lateness and leave requests with approvals.", tint: "from-[#38bdf8] to-[var(--brand-blue)]" },
  { icon: ClipboardCheck, title: "QA scorecards", text: "Review calls against weighted criteria with fatal-error rules, coaching notes and agent acknowledgement.", tint: "from-[#a78bfa] to-[var(--violet)]" },
  { icon: ShieldCheck, title: "Compliance built in", text: "Lead screening, a workspace suppression list, calling windows, attempt limits and cooling-off periods enforced on every call.", tint: "from-[#34d399] to-[#059669]" },
  { icon: Database, title: "Data sourcing", text: "Import vendor CSV/XLSX with a recorded lawful basis, and track every batch from source to dial.", tint: "from-[#818cf8] to-[var(--brand-blue)]" },
  { icon: Mail, title: "Email templates", text: "Approved templates only, with merge fields, unsubscribe handling and a send log per lead.", tint: "from-[#f472b6] to-[var(--magenta)]" },
  { icon: Building2, title: "Client portal", text: "A read-only login for each client: funnel, outcomes, agent activity and downloadable PDF reports.", tint: "from-[#22d3ee] to-[var(--teal)]" },
  { icon: Lock, title: "Security & audit", text: "Role-based access, credential events, recent sign-ins and a full audit trail of every change.", tint: "from-[#fb7185] to-[#e11d48]" },
  { icon: Users, title: "People & teams", text: "Create users, assign teams and campaigns, set targets and deactivate leavers in seconds.", tint: "from-[#f472b6] to-[var(--magenta)]" },
  { icon: BellRing, title: "Follow-up tray", text: "Callbacks pop up when they're due, with snooze limits so nothing slips.", tint: "from-[var(--gold)] to-[#ea580c]" },
  { icon: Command, title: "Fast to use", text: "Ctrl+K to jump anywhere, an animated live dashboard, and a layout that works on a phone.", tint: "from-[#c084fc] to-[var(--magenta)]" },
];

const ROLES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Crown, title: "Super admin", text: "Everything: floor, campaigns, people, integrations, compliance and audit." },
  { icon: Briefcase, title: "Ops manager", text: "Runs campaigns, assigns data, approves leave and watches performance." },
  { icon: Users, title: "Team lead", text: "Watches the live floor and coaches their own team." },
  { icon: Headset, title: "Agent", text: "Dials, logs outcomes and works callbacks." },
  { icon: ClipboardCheck, title: "QA analyst", text: "Scores calls and leaves coaching notes." },
  { icon: Building2, title: "Client", text: "Sees their own campaign results and downloads reports." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Which phone system does it use?",
    a: "Zoom Phone. Calls run through your own Zoom Phone account: agents sign in to Zoom inside an embedded dial pad, and Zoom bills call minutes to you. Your Zoom admin needs a Zoom Phone licence and has to install the Zoom Phone Smart Embed app.",
  },
  {
    q: "What does compliance cover?",
    a: "Leads must pass screening before they reach the queue, and the system never hands an agent a suppressed number. Do-not-call outcomes are added to the suppression list in the same step as the call is logged, and calling windows, attempt limits and cooling-off periods are enforced per campaign. Screening is a manual step today; a live TPS/DNC provider plugs in behind the same interface.",
  },
  {
    q: "Can our clients see their results?",
    a: "Yes. Each client gets its own read-only login showing their funnel, call outcomes and agent activity, with downloadable PDF reports. Agents can be shown by name or anonymised.",
  },
  {
    q: "How much does it cost to start?",
    a: `Every workspace starts free with ${FREE_AGENT_SEATS} agents, and admins, managers, team leads and QA are always free. When you need more agents, your admin adds them under Agents & billing. Call minutes are billed by Zoom to your own Zoom Phone account, not by LeadCallient.`,
  },
  {
    q: "Is the demo using real data?",
    a: "The demo is a real workspace running on the live database, filled with fictional clients, leads and agents. Calls from it only ever reach an allow-list of numbers, and it can be reset at any time.",
  },
];

function SectionHeading({ eyebrow, title, text, light = false }: { eyebrow: string; title: React.ReactNode; text?: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${light ? "text-gold-soft" : "text-brand-blue"}`}>{eyebrow}</div>
      <h2 className={`mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl ${light ? "text-white" : "text-ink"}`}>{title}</h2>
      {text && <p className={`mt-3 text-base ${light ? "text-white/70" : "text-muted"}`}>{text}</p>}
    </div>
  );
}

// Static product mock for the hero: a slice of the live floor plus the softphone.
function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-[var(--violet)]/40 via-[var(--magenta)]/20 to-[var(--gold)]/30 blur-2xl" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl shadow-black/40">
        <div className="flex items-center gap-1.5 border-b border-line bg-canvas px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
          <span className="ml-3 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-muted ring-1 ring-line">app.leadcallient.com/admin</span>
        </div>
        <div className="grid grid-cols-[3.25rem_1fr]">
          <div className="flex flex-col items-center gap-2 bg-midnight-gradient py-3">
            <BrandMark size={24} />
            {["from-[#34d399] to-[var(--teal)]", "from-[#60a5fa] to-[#0b5cff]", "from-[var(--gold)] to-[#f97316]", "from-[#f472b6] to-[var(--magenta)]", "from-[#a78bfa] to-[var(--violet)]"].map((g) => (
              <span key={g} className={`h-6 w-6 rounded-md bg-gradient-to-br ${g}`} />
            ))}
          </div>
          <div className="space-y-2.5 p-3">
            <div className="rounded-xl bg-brand-gradient p-3 text-white">
              <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-white/80">
                <Radio className="h-2.5 w-2.5 text-emerald-300" /> Live floor
              </div>
              <div className="mt-0.5 font-display text-sm font-semibold">
                Good afternoon, <span className="text-gold-gradient">Alex</span>
              </div>
              <div className="text-[10px] text-white/75">8 agents · 153 calls · 10 conversions today</div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { n: "3", l: "Available", g: "from-[#34d399] to-[var(--teal)]", i: Users },
                { n: "5", l: "On call", g: "from-[var(--violet)] to-[var(--magenta)]", i: PhoneCall },
                { n: "153", l: "Calls", g: "from-[var(--brand-blue)] to-[var(--violet)]", i: Phone },
                { n: "10", l: "Won", g: "from-[#fde68a] to-[#d97706]", i: Trophy },
              ].map(({ n, l, g, i: Icon }) => (
                <div key={l} className="rounded-lg border border-line p-1.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br ${g} text-white`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="mt-1 font-display text-sm font-semibold text-ink">{n}</div>
                  <div className="text-[8px] text-muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {[
                { n: "Usman Tariq", s: "On call · 03:12", c: "bg-brand-green" },
                { n: "Zara Malik", s: "Available", c: "bg-teal" },
                { n: "Hamza Raza", s: "Wrap-up", c: "bg-violet" },
              ].map((a) => (
                <div key={a.n} className="flex items-center gap-2 rounded-lg bg-canvas px-2 py-1.5 text-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.c}`} />
                  <span className="font-medium text-ink">{a.n}</span>
                  <span className="ml-auto text-muted">{a.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating softphone */}
      <div className="absolute -bottom-20 -right-3 w-44 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:-right-8 sm:w-48">
        <div className="flex items-center gap-1.5 bg-midnight-gradient px-2.5 py-2 text-white">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0b5cff] text-[8px] font-bold">ZP</span>
          <span className="text-[10px] font-semibold">Zoom Phone</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex flex-col items-center gap-1 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white animate-ring">HH</span>
          <div className="text-[11px] font-semibold text-ink">Hannah Harris</div>
          <div className="text-[10px] tabular text-brand-green-text">Connected 03:12</div>
          <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white">
            <Phone className="h-3.5 w-3.5 rotate-[135deg]" />
          </span>
        </div>
      </div>

      {/* Floating callback chip */}
      <div className="absolute -left-3 -top-5 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-xl ring-1 ring-black/5 sm:-left-8">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white">
          <BellRing className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[10px] font-semibold text-ink">Callback due</div>
          <div className="text-[9px] text-muted">Tomorrow 10:30 · Oscar</div>
        </div>
      </div>
    </div>
  );
}
// schema.org JSON-LD: who makes it, what it is, and the FAQ.
function structuredData() {
  const org = organizationJsonLd();
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: siteUrl(),
        name: BRAND.productName,
        description: BRAND.seoDescription,
        inLanguage: "en",
        publisher: { "@id": org["@id"] },
      },
      {
        "@type": "SoftwareApplication",
        name: BRAND.productName,
        url: siteUrl(),
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        description: BRAND.seoDescription,
        image: absoluteUrl("/opengraph-image"),
        featureList: FEATURES.map((f) => f.title),
        publisher: { "@id": org["@id"] },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

export default async function LandingPage() {
  const { href: primaryHref, label: primaryLabel } = await demoCta();

  return (
    <div className="min-h-screen bg-canvas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(structuredData())}
      />
      <SiteHeader />

      <main>
      {/* Hero */}
      <section className="brand-hero relative overflow-hidden px-4 pb-28 pt-32 text-white sm:pt-36">
        <div className="brand-orb brand-orb-1" aria-hidden />
        <div className="brand-orb brand-orb-2" aria-hidden />
        <div className="brand-orb brand-orb-3" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-soft ring-1 ring-white/20">
              <Sparkles className="h-3.5 w-3.5" /> Contact-centre CRM · Zoom Phone dialer
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
              Every call, <span className="text-gold-gradient">connected.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              {BRAND.productName} runs your whole calling floor: dial workspace, live dashboard, attendance, QA, compliance and client
              reports. Calls run through your own Zoom Phone account.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-6 py-3 text-base font-semibold text-ink shadow-xl shadow-gold/25 transition hover:-translate-y-0.5 hover:brightness-105"
              >
                {primaryLabel} <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login#demo"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-base font-medium text-white ring-1 ring-white/20 transition hover:bg-white/15"
              >
                <PlayCircle className="h-5 w-5" /> Try the live demo
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/65">
              {[`${FREE_AGENT_SEATS} agents free forever`, "No card needed", "Set up in 2 minutes"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-300" /> {t}
                </span>
              ))}
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* Numbers */}
      <section className="px-4 py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { n: String(FREE_AGENT_SEATS), l: "agents free forever" },
            { n: "6", l: "roles with their own view" },
            { n: "30", l: "call outcomes out of the box" },
            { n: "1", l: "screen per call" },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 0.06}>
              <div className="rounded-2xl border border-line bg-surface p-5 text-center shadow-sm">
                <div className="font-display text-4xl font-semibold text-brand-gradient">{s.n}</div>
                <div className="mt-1 text-sm text-muted">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 px-4 pb-20">
        <Reveal>
          <SectionHeading
            eyebrow="Everything in one place"
            title={
              <>
                All the tools a calling floor needs, <span className="text-brand-gradient">working together</span>
              </>
            }
            text="From the first dial to the client's monthly report, without switching between five different apps."
          />
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06}>
              <div className="group hover-lift h-full rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.tint} text-white shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3`}>
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>


      {/* Deep dives */}
      <section className="space-y-24 px-4 py-24">
        {[
          {
            id: "workspace",
            eyebrow: "Dial workspace",
            title: "Everything an agent needs, on one screen",
            text: "The queue hands agents the next lead, so there's no cherry-picking. Script and objections sit alongside, dispositions are one keystroke away, and a callback takes seconds to book.",
            points: ["Due-now and fresh lead queues", "Scripts with the opening disclosure agents must read", "Keyboard shortcuts: D for outcome, N for notes, Ctrl+Enter to save", "Wrap-up timer and a celebration when a deal lands"],
            visual: (
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold text-ink">Hannah Harris</div>
                    <div className="tabular text-sm text-muted">+44 7957 606555</div>
                  </div>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">Attempt 4 of 6</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-ink"><PhoneCall className="h-4 w-4" /> Call</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green-tint px-3 py-1.5 text-xs font-medium text-brand-green-text"><span className="h-2 w-2 rounded-full bg-brand-green" /> Connected 02:41</span>
                </div>
                <div className="mt-4 rounded-xl border border-line p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Disposition</div>
                  <div className="mt-1.5 rounded-lg border border-line px-3 py-2 text-ink">Appointment set</div>
                  <div className="mt-3 rounded-lg bg-brand-gradient py-2 text-center text-sm font-semibold text-white">Save &amp; next · Ctrl+Enter</div>
                </div>
              </div>
            ),
          },
          {
            id: "floor",
            eyebrow: "Live floor & performance",
            title: "See the whole floor at a glance",
            text: "Managers see who's available, on a call or on break right now, how many calls and conversions the day has produced, and how every campaign and agent is tracking.",
            points: ["Live status counts from agents' clock-in and break states", "Campaign funnel from loaded to converted", "Agent scorecards: calls, connects, conversions and talk time", "Attendance, lateness, shifts and leave approvals"],
            visual: (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { n: "153", l: "Calls today", g: "from-[var(--brand-blue)] to-[var(--violet)]", i: Phone },
                  { n: "58", l: "Connects", g: "from-[var(--magenta)] to-[var(--brand-orange)]", i: PhoneCall },
                  { n: "10", l: "Conversions", g: "from-[var(--brand-green)] to-[var(--teal)]", i: Trophy },
                  { n: "38%", l: "Contact rate", g: "from-[#fde68a] to-[#d97706]", i: BarChart3 },
                ].map(({ n, l, g, i: Icon }) => (
                  <div key={l} className="hover-lift rounded-2xl border border-line bg-surface p-4 shadow-lg">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${g} text-white shadow`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="mt-3 font-display text-3xl font-semibold text-ink">{n}</div>
                    <div className="text-sm text-muted">{l}</div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "compliance",
            eyebrow: "Compliance & client reporting",
            title: "Safe to dial, easy to prove",
            text: "Leads only reach the queue once they're screened. A do-not-call request is suppressed everywhere in the same step as the call is logged. And every client gets a portal with their own results.",
            points: ["TPS/CTPS and US National DNC screening with evidence", "Global suppression list and do-not-call handling", "Calling windows, attempt limits and cooling-off periods", "Client portal with funnel, outcomes and PDF reports"],
            visual: (
              <div className="space-y-3">
                {[
                  { icon: ShieldCheck, t: "Screened · TPS passed", s: "Evidence stored 19 Sep", c: "bg-brand-green-tint text-brand-green-text" },
                  { icon: Ban, t: "+44 7700 900123 suppressed", s: "Verbal DNC · logged with the call", c: "bg-danger-tint text-danger" },
                  { icon: Clock, t: "Outside calling window", s: "Lead's local time 21:14 · held until 09:00", c: "bg-warning-tint text-warning" },
                  { icon: FileText, t: "Monthly client report", s: "Northwind Roofing · PDF ready", c: "bg-brand-blue-tint text-brand-blue" },
                ].map(({ icon: Icon, t, s, c }) => (
                  <div key={t} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-md">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-ink">{t}</div>
                      <div className="text-xs text-muted">{s}</div>
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
        ].map((d, i) => (
          <div key={d.id} id={d.id} className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal className={i % 2 ? "lg:order-2" : ""}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">{d.eyebrow}</div>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{d.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-muted">{d.text}</p>
              <ul className="mt-6 space-y-2.5">
                {d.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-ink">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1} className={i % 2 ? "lg:order-1" : ""}>
              {d.visual}
            </Reveal>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="bg-surface px-4 py-20">
        <Reveal>
          <SectionHeading eyebrow="How it works" title="Up and dialling in three steps" />
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
          {[
            { icon: Plug, t: "Connect your tools", s: "Connect Zoom from the Integrations page and set a caller ID per campaign." },
            { icon: Database, t: "Load and screen your data", s: "Import lead lists with their source recorded. Everything is screened before it's dialled." },
            { icon: Headset, t: "Start calling", s: "Agents clock in and dial. Managers watch the live floor, and clients see their own results." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 0.08}>
              <div className="relative h-full rounded-2xl border border-line bg-canvas p-6">
                <span className="absolute right-5 top-4 font-display text-5xl font-semibold text-brand-blue/10">{i + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.s}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-20 px-4 py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Built for every seat"
            title="Six roles, each with their own view"
            text="Try any of them in the demo: pick a role on the sign-in page and switch whenever you like."
          />
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.title} delay={(i % 3) * 0.06}>
              <Link href="/login#demo" className="group hover-lift flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-tint text-brand-blue transition group-hover:bg-brand-gradient group-hover:text-white">
                  <r.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="flex items-center gap-1 font-semibold text-ink">
                    {r.title} <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{r.text}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-surface px-4 py-20">
        <Reveal>
          <SectionHeading eyebrow="Questions" title="Frequently asked" />
        </Reveal>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-line bg-canvas p-5 open:bg-surface open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue-tint text-brand-blue transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20">
        <Reveal>
          <div className="brand-banner mx-auto max-w-5xl px-6 py-14 text-center sm:px-12">
            <div className="relative z-10">
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">Start with {FREE_AGENT_SEATS} agents, free</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/80">
                Create your workspace in two minutes. Every feature included, no card needed. Add seats only when your floor grows.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={primaryHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-ink shadow-xl transition hover:-translate-y-0.5"
                >
                  {primaryLabel} <ArrowRight className="h-5 w-5 text-brand-blue" />
                </Link>
                <Link
                  href="/login#demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-base font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/15"
                >
                  <PlayCircle className="h-5 w-5" /> Try the live demo
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      </main>

      <SiteFooter />
    </div>
  );
}

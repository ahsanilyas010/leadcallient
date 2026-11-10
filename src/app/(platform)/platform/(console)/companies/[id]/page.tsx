import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadAgentUsage, loadAudit, loadCompany, loadDailySeries, loadLedger, loadNotes, loadUsers } from "@/lib/owner/data";
import { fmtDuration, fmtMoney } from "@/lib/owner/status";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/format";
import { fmtSeats } from "@/lib/plan";
import { PageHeader, Section, Stat } from "../../../_ui/table";
import { BillingBadge, FlagBadges, StatusBadge, TrialBadge } from "../../../_ui/badges";
import { SeriesChart } from "../../../_ui/series-chart";
import { AuditList, LedgerTable, UsageTable, UsersTable } from "../../../_ui/lists";
import { BillingPlanForm, LedgerForm, NotesForm, SeatsForm, StatusActions, TrialForm } from "../../../_ui/company-actions";

export const metadata: Metadata = { title: "Company · Owner console" };

const TABS = [
  ["overview", "Overview"],
  ["users", "Users"],
  ["dialer", "Dialer usage"],
  ["billing", "Billing"],
  ["trial", "Trial & seats"],
  ["notes", "Notes"],
  ["activity", "Activity"],
] as const;
type Tab = (typeof TABS)[number][0];

function Panel({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const SIGNUP_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "landing_page", "fbclid", "gclid"];

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tab: Tab = (TABS.find(([k]) => k === rawTab)?.[0] ?? "overview") as Tab;

  const c = await loadCompany(id);
  if (!c) notFound();
  const { ws, m } = c;
  const cur = ws.billing_currency;

  const signup = (ws.signup ?? {}) as Record<string, unknown>;
  const signupRows = SIGNUP_KEYS.filter((k) => signup[k]).map((k) => [k.replace(/_/g, " "), String(signup[k])] as [string, string]);
  const setup: [string, boolean][] = [
    ["Created a campaign", Number(m.campaigns) > 0],
    ["Loaded leads", Number(m.leads) > 0],
    ["Added an agent", Number(m.agents_active) > 0],
    ["Set up Zoom meetings", m.zoom_connected],
    ["Made a first call", Number(m.calls_total) > 0],
  ];

  return (
    <>
      <Link href="/platform/companies" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Companies
      </Link>
      <PageHeader
        title={ws.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ws.status} isDemo={ws.is_demo} />
            <TrialBadge trial={c.trial} />
            <BillingBadge billing={c.billing} />
            <span>
              Owner {m.owner_name ? `${m.owner_name} · ` : ""}
              {m.owner_email ?? "—"} · signed up {fmtDate(ws.created_at)}
            </span>
          </span>
        }
        actions={<StatusActions workspaceId={ws.id} status={ws.status} />}
      />
      {c.flags.length > 0 && (
        <div className="-mt-3 mb-5">
          <FlagBadges flags={c.flags} />
        </div>
      )}

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/platform/companies/${ws.id}?tab=${k}`}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              tab === k ? "border-brand-blue text-brand-blue" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab c={c} signupRows={signupRows} setup={setup} />}
      {tab === "users" && <UsersTable users={await loadUsers(ws.id)} />}
      {tab === "dialer" && <DialerTab workspaceId={ws.id} />}
      {tab === "billing" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Price" value={ws.billing_amount !== null ? fmtMoney(Number(ws.billing_amount), cur) : "—"} hint={ws.billing_amount !== null ? `per ${ws.billing_cycle.replace("ly", "")}` : "Not set"} />
            <Stat label="Next due" value={ws.next_due_date ? fmtDate(ws.next_due_date) : "—"} hint={<BillingBadge billing={c.billing} />} />
            <Stat label="Balance owing" value={fmtMoney(Math.max(0, m.balance), cur)} tone={m.balance > 0 ? (c.billing.kind === "overdue" ? "danger" : "warning") : undefined} hint={m.balance < 0 ? `${fmtMoney(-m.balance, cur)} in credit` : undefined} />
            <Stat label="Paid to date" value={fmtMoney(Number(m.paid_total), cur)} hint={m.last_payment_on ? `Last payment ${fmtDate(m.last_payment_on)}` : "No payments yet"} />
          </div>
          <Panel title="Billing plan" description="What this company pays you and when. Setting a price above 0 marks the plan as paid.">
            <BillingPlanForm workspaceId={ws.id} amount={ws.billing_amount === null ? null : Number(ws.billing_amount)} currency={cur} cycle={ws.billing_cycle} nextDueDate={ws.next_due_date} />
          </Panel>
          <Panel title="Add to ledger" description="Record an invoice (charge), a payment you received, or a credit. Balance = charges − payments − credits.">
            <LedgerForm workspaceId={ws.id} currency={cur} defaultAmount={ws.billing_amount === null ? null : Number(ws.billing_amount)} />
          </Panel>
          <LedgerTable rows={await loadLedger(ws.id)} />
        </div>
      )}
      {tab === "trial" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Trial" description={ws.trial_ends_at ? `Ends ${fmtDateTime(ws.trial_ends_at)}` : "No trial on this company."}>
            <TrialForm workspaceId={ws.id} trialEndsAt={ws.trial_ends_at} />
          </Panel>
          <Panel title="Seats" description={`${Number(m.agents_active)} of ${fmtSeats(ws.seat_limit)} agent seats and ${Number(m.data_seats_used)} of ${fmtSeats(ws.data_seat_limit)} data-only seats in use.`}>
            <SeatsForm workspaceId={ws.id} agentSeats={ws.seat_limit} dataSeats={ws.data_seat_limit} />
          </Panel>
        </div>
      )}
      {tab === "notes" && (
        <Panel title="Private notes" description="Only owners can see these. The company never does.">
          <NotesForm workspaceId={ws.id} notes={await loadNotes(ws.id)} />
        </Panel>
      )}
      {tab === "activity" && <AuditList rows={await loadAudit(ws.id)} />}
    </>
  );
}

async function OverviewTab({
  c,
  signupRows,
  setup,
}: {
  c: NonNullable<Awaited<ReturnType<typeof loadCompany>>>;
  signupRows: [string, string][];
  setup: [string, boolean][];
}) {
  const { ws, m } = c;
  const series = await loadDailySeries(30, ws.id);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Users" value={Number(m.users_active)} hint={`${Number(m.users_total)} total incl. inactive`} />
        <Stat label="Agents" value={`${Number(m.agents_active)} / ${fmtSeats(ws.seat_limit)}`} hint={`${Number(m.agents_active_today)} clocked in today`} />
        <Stat label="Calls today" value={Number(m.calls_today)} />
        <Stat label="Calls · 7 days" value={Number(m.calls_7d)} />
        <Stat label="Calls · 30 days" value={Number(m.calls_30d).toLocaleString()} hint={`${Number(m.calls_total).toLocaleString()} all time`} />
        <Stat label="Talk time · 30 days" value={fmtDuration(Number(m.talk_seconds_30d))} hint={`${fmtDuration(Number(m.talk_seconds_total))} all time`} />
        <Stat label="Campaigns" value={Number(m.campaigns)} />
        <Stat label="Leads" value={Number(m.leads).toLocaleString()} />
        <Stat label="Clients" value={Number(m.clients)} />
        <Stat label="Emails sent · 30d" value={Number(m.emails_sent_30d)} />
        <Stat label="Zoom meetings" value={m.zoom_connected ? "Set up" : "Not set up"} hint="Calling uses each agent's own Zoom Phone login" />
        <Stat label="Last activity" value={c.lastActivityAt ? fmtRelative(c.lastActivityAt) : "Never"} hint={m.last_call_at ? `Last call ${fmtRelative(m.last_call_at)}` : "No calls yet"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm lg:col-span-2">
          <p className="mb-2 text-sm font-semibold text-ink">Calls per day · 30 days</p>
          <SeriesChart data={series} dataKey="calls" label="Calls" />
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Setup progress">
            <ul className="flex flex-col gap-1.5 text-sm">
              {setup.map(([label, done]) => (
                <li key={label} className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", done ? "bg-brand-green" : "bg-line")} />
                  <span className={done ? "text-ink" : "text-muted"}>{label}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Account">
            <KV
              rows={[
                ["Slug", ws.slug],
                ["Plan", <span key="p" className="capitalize">{ws.plan}</span>],
                ["Trial ends", ws.trial_ends_at ? fmtDate(ws.trial_ends_at) : "—"],
                ["Data seats", `${Number(m.data_seats_used)} / ${fmtSeats(ws.data_seat_limit)}`],
                ["Screening", ws.require_screening ? "Required" : "Optional"],
                ...(signupRows.length ? signupRows : ([["Signup source", "Direct / unknown"]] as [string, string][])),
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

async function DialerTab({ workspaceId }: { workspaceId: string }) {
  const now = new Date();
  const rows = (await loadAgentUsage(new Date(now.getTime() - 30 * 86_400_000), now, workspaceId)).sort((a, b) => Number(b.calls) - Number(a.calls));
  return (
    <Section title="Last 30 days" actions={<Link href={`/platform/dialer?company=${workspaceId}`} className="text-xs font-semibold text-brand-blue hover:underline">Other date ranges</Link>}>
      <UsageTable rows={rows} />
    </Section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { loadCompanies, loadDailySeries } from "@/lib/owner/data";
import { fmtDuration, fmtMoney } from "@/lib/owner/status";
import { fmtDate, fmtRelative } from "@/lib/format";
import { OTable, OHead, OEmpty, PageHeader, Section, Stat, td } from "../_ui/table";
import { FlagBadges, TrialBadge } from "../_ui/badges";
import { SeriesChart } from "../_ui/series-chart";

export const metadata: Metadata = { title: "Owner console" };

export default async function OwnerOverviewPage() {
  const [all, series30, series90] = await Promise.all([loadCompanies(), loadDailySeries(30), loadDailySeries(90)]);
  const companies = all.filter((c) => !c.ws.is_demo);

  const count = (pred: (c: (typeof companies)[number]) => boolean) => companies.filter(pred).length;
  const sum = (f: (c: (typeof companies)[number]) => number) => companies.reduce((t, c) => t + f(c), 0);

  // Money is summed per currency; most customers share one.
  const currencies = new Map<string, { mrr: number; outstanding: number }>();
  for (const c of companies) {
    const cur = c.ws.billing_currency;
    const e = currencies.get(cur) ?? { mrr: 0, outstanding: 0 };
    e.mrr += c.mrr;
    e.outstanding += Math.max(0, c.m.balance);
    currencies.set(cur, e);
  }
  const money = [...currencies.entries()].filter(([, v]) => v.mrr > 0 || v.outstanding > 0);

  const attention = companies.filter((c) => c.flags.length > 0).sort((a, b) => b.flags.length - a.flags.length);
  const signups30 = series30.reduce((t, d) => t + d.signups, 0);

  return (
    <>
      <PageHeader title="Overview" description="Everything happening across LeadCallient right now. Counts only: no lead or call content." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Companies" value={companies.length} hint={`${signups30} new in 30 days`} />
        <Stat label="Active" value={count((c) => c.ws.status === "active" || c.ws.status === "onboarding")} tone="good" />
        <Stat label="On trial" value={count((c) => c.trial.kind === "trialing")} hint={`${count((c) => c.trial.kind === "trialing" && c.trial.daysLeft <= 7)} end within 7 days`} />
        <Stat label="Trial expired" value={count((c) => c.trial.kind === "expired")} tone={count((c) => c.trial.kind === "expired") ? "warning" : undefined} hint="Not paying yet" />
        <Stat label="Paying" value={count((c) => c.trial.kind === "paying")} tone="good" />
        <Stat label="Suspended" value={count((c) => c.ws.status === "suspended")} tone={count((c) => c.ws.status === "suspended") ? "danger" : undefined} />

        <Stat label="Users" value={sum((c) => Number(c.m.users_active))} hint={`${sum((c) => Number(c.m.users_total))} total incl. inactive`} />
        <Stat label="Agents" value={sum((c) => Number(c.m.agents_active))} hint={`${sum((c) => Number(c.m.agents_active_today))} clocked in today`} />
        <Stat label="Calls today" value={sum((c) => Number(c.m.calls_today))} />
        <Stat label="Calls · 30 days" value={sum((c) => Number(c.m.calls_30d)).toLocaleString()} hint={`${sum((c) => Number(c.m.calls_total)).toLocaleString()} all time`} />
        <Stat label="Talk time · 30 days" value={fmtDuration(sum((c) => Number(c.m.talk_seconds_30d)))} />
        <Stat label="Overdue" value={count((c) => c.billing.kind === "overdue")} tone={count((c) => c.billing.kind === "overdue") ? "danger" : undefined} hint="Companies past due" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {money.length === 0 ? (
          <Stat label="Monthly revenue (MRR)" value={fmtMoney(0)} hint="Set a price on a company's Billing tab" />
        ) : (
          money.flatMap(([cur, v]) => [
            <Stat key={`${cur}-mrr`} label={`MRR · ${cur}`} value={fmtMoney(v.mrr, cur)} hint="Active companies' prices, per month" />,
            <Stat key={`${cur}-out`} label={`Outstanding · ${cur}`} value={fmtMoney(v.outstanding, cur)} tone={v.outstanding > 0 ? "warning" : undefined} />,
          ])
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-ink">Calls per day · 30 days</p>
          <SeriesChart data={series30} dataKey="calls" label="Calls" />
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-ink">New companies per day · 90 days</p>
          <SeriesChart data={series90} dataKey="signups" label="Signups" color="var(--color-violet)" />
        </div>
      </div>

      <Section title={`Needs attention (${attention.length})`} actions={<Link href="/platform/companies?filter=attention" className="text-xs font-semibold text-brand-blue hover:underline">See all</Link>}>
        <OTable>
          <OHead cols={["Company", "Trial", "Why", "Last activity"]} />
          <tbody className="divide-y divide-line">
            {attention.slice(0, 15).map((c) => (
              <tr key={c.ws.id}>
                <td className={td}>
                  <Link href={`/platform/companies/${c.ws.id}`} className="font-medium text-ink hover:text-brand-blue hover:underline">
                    {c.ws.name}
                  </Link>
                  <p className="text-xs text-muted">{c.m.owner_email ?? "—"}</p>
                </td>
                <td className={td}>
                  <TrialBadge trial={c.trial} />
                </td>
                <td className="px-3 py-2.5">
                  <FlagBadges flags={c.flags} />
                </td>
                <td className={td} title={fmtDate(c.lastActivityAt)}>
                  {c.lastActivityAt ? fmtRelative(c.lastActivityAt) : "Never"}
                </td>
              </tr>
            ))}
            {attention.length === 0 && <OEmpty cols={4}>Nothing needs your attention.</OEmpty>}
          </tbody>
        </OTable>
      </Section>

      <Section title="Newest companies" actions={<Link href="/platform/companies" className="text-xs font-semibold text-brand-blue hover:underline">All companies</Link>}>
        <OTable>
          <OHead cols={["Company", "Owner", "Signed up", "Trial", "Agents", "Calls · 30d"]} />
          <tbody className="divide-y divide-line">
            {companies.slice(0, 8).map((c) => (
              <tr key={c.ws.id}>
                <td className={td}>
                  <Link href={`/platform/companies/${c.ws.id}`} className="font-medium text-ink hover:text-brand-blue hover:underline">
                    {c.ws.name}
                  </Link>
                </td>
                <td className={td}>{c.m.owner_email ?? "—"}</td>
                <td className={td}>{fmtDate(c.ws.created_at)}</td>
                <td className={td}>
                  <TrialBadge trial={c.trial} />
                </td>
                <td className={td}>{Number(c.m.agents_active)}</td>
                <td className={td}>{Number(c.m.calls_30d)}</td>
              </tr>
            ))}
            {companies.length === 0 && <OEmpty cols={6}>No companies yet.</OEmpty>}
          </tbody>
        </OTable>
      </Section>
    </>
  );
}

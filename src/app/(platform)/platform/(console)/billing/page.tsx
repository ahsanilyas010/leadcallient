import type { Metadata } from "next";
import Link from "next/link";
import { loadCompanies, loadLedger } from "@/lib/owner/data";
import { fmtMoney } from "@/lib/owner/status";
import { fmtDate } from "@/lib/format";
import { OTable, OHead, OEmpty, PageHeader, Section, Stat, td, tdNum } from "../../_ui/table";
import { BillingBadge, TrialBadge } from "../../_ui/badges";
import { LedgerTable } from "../../_ui/lists";

export const metadata: Metadata = { title: "Billing · Owner console" };

const RANK: Record<string, number> = { overdue: 0, due_soon: 1, current: 2, settled: 3, not_set: 4 };

export default async function BillingPage() {
  const [all, ledger] = await Promise.all([loadCompanies(), loadLedger(undefined, 100)]);
  const companies = all.filter((c) => !c.ws.is_demo);
  const names = new Map(all.map((c) => [c.ws.id, c.ws.name]));
  const rows = [...companies].sort(
    (a, b) => RANK[a.billing.kind] - RANK[b.billing.kind] || b.m.balance - a.m.balance || (a.ws.next_due_date ?? "9999").localeCompare(b.ws.next_due_date ?? "9999"),
  );

  const byCurrency = new Map<string, { mrr: number; owing: number; overdue: number; paid30: number }>();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  for (const c of companies) {
    const e = byCurrency.get(c.ws.billing_currency) ?? { mrr: 0, owing: 0, overdue: 0, paid30: 0 };
    e.mrr += c.mrr;
    e.owing += Math.max(0, c.m.balance);
    if (c.billing.kind === "overdue") e.overdue += Math.max(0, c.m.balance);
    byCurrency.set(c.ws.billing_currency, e);
  }
  for (const l of ledger) {
    if (l.kind !== "payment" || l.occurred_on < monthAgo) continue;
    const e = byCurrency.get(l.currency) ?? { mrr: 0, owing: 0, overdue: 0, paid30: 0 };
    e.paid30 += Number(l.amount);
    byCurrency.set(l.currency, e);
  }
  const money = [...byCurrency.entries()].filter(([, v]) => v.mrr || v.owing || v.paid30);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Manual ledger: set each company's price on its Billing tab, then record charges and payments. A payment gateway can post into the same ledger later."
      />
      {money.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
          No prices or payments yet. Open a company and set its price on the Billing tab.
        </p>
      ) : (
        money.map(([cur, v]) => (
          <div key={cur} className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={`MRR · ${cur}`} value={fmtMoney(v.mrr, cur)} />
            <Stat label={`Owed to you · ${cur}`} value={fmtMoney(v.owing, cur)} tone={v.owing ? "warning" : undefined} />
            <Stat label={`Overdue · ${cur}`} value={fmtMoney(v.overdue, cur)} tone={v.overdue ? "danger" : undefined} />
            <Stat label={`Received · 30 days · ${cur}`} value={fmtMoney(v.paid30, cur)} tone="good" />
          </div>
        ))
      )}

      <Section title="Receivables">
        <OTable>
          <OHead cols={["Company", "Trial", "Price", "Next due", "Status", { label: "Balance", right: true }, { label: "Paid to date", right: true }, "Last payment"]} />
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.ws.id}>
                <td className={td}>
                  <Link href={`/platform/companies/${c.ws.id}?tab=billing`} className="font-medium text-ink hover:text-brand-blue hover:underline">
                    {c.ws.name}
                  </Link>
                </td>
                <td className={td}>
                  <TrialBadge trial={c.trial} />
                </td>
                <td className={td}>{c.ws.billing_amount !== null ? `${fmtMoney(Number(c.ws.billing_amount), c.ws.billing_currency)} / ${c.ws.billing_cycle.replace("ly", "")}` : "—"}</td>
                <td className={td}>{c.ws.next_due_date ? fmtDate(c.ws.next_due_date) : "—"}</td>
                <td className={td}>
                  <BillingBadge billing={c.billing} />
                </td>
                <td className={tdNum}>{c.m.balance ? fmtMoney(c.m.balance, c.ws.billing_currency) : "—"}</td>
                <td className={tdNum}>{Number(c.m.paid_total) ? fmtMoney(Number(c.m.paid_total), c.ws.billing_currency) : "—"}</td>
                <td className={td}>{c.m.last_payment_on ? fmtDate(c.m.last_payment_on) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <OEmpty cols={8}>No companies yet.</OEmpty>}
          </tbody>
        </OTable>
      </Section>

      <Section title="Recent ledger entries">
        <LedgerTable rows={ledger} companyNames={names} />
      </Section>
    </>
  );
}

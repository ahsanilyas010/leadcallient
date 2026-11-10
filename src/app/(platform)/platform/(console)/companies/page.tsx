import type { Metadata } from "next";
import Link from "next/link";
import { loadCompanies } from "@/lib/owner/data";
import { filterCompanies, type CompanyFilters as SP } from "@/lib/owner/filters";
import { fmtMoney } from "@/lib/owner/status";
import { fmtDate, fmtRelative } from "@/lib/format";
import { fmtSeats } from "@/lib/plan";
import { OTable, OHead, OEmpty, PageHeader, td, tdNum } from "../../_ui/table";
import { BillingBadge, FlagBadges, StatusBadge, TrialBadge } from "../../_ui/badges";
import { ExportLink, FilterBar, FilterField, fieldClass } from "../../_ui/filter-bar";

export const metadata: Metadata = { title: "Companies · Owner console" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const rows = filterCompanies(await loadCompanies(), sp);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  qs.set("type", "companies");

  return (
    <>
      <PageHeader title="Companies" description={`${rows.length} compan${rows.length === 1 ? "y" : "ies"}`} actions={<ExportLink href={`/api/platform/export?${qs}`} />} />
      <FilterBar action="/platform/companies" resetHref="/platform/companies">
        <FilterField label="Search">
          <input name="q" defaultValue={sp.q} placeholder="Name or owner email" className={`${fieldClass} w-56`} />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={sp.status ?? ""} className={fieldClass}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="onboarding">Onboarding</option>
            <option value="suspended">Suspended</option>
            <option value="canceled">Canceled</option>
          </select>
        </FilterField>
        <FilterField label="Trial">
          <select name="trial" defaultValue={sp.trial ?? ""} className={fieldClass}>
            <option value="">Any</option>
            <option value="trialing">On trial</option>
            <option value="ending">Ending within 7 days</option>
            <option value="expired">Expired</option>
            <option value="paying">Paying</option>
            <option value="none">No trial</option>
          </select>
        </FilterField>
        <FilterField label="Billing">
          <select name="billing" defaultValue={sp.billing ?? ""} className={fieldClass}>
            <option value="">Any</option>
            <option value="overdue">Overdue</option>
            <option value="due_soon">Due soon</option>
            <option value="current">Balance owing</option>
            <option value="settled">Paid up</option>
            <option value="not_set">No price set</option>
          </select>
        </FilterField>
        <FilterField label="Show">
          <select name="filter" defaultValue={sp.filter ?? ""} className={fieldClass}>
            <option value="">All</option>
            <option value="attention">Needs attention</option>
          </select>
        </FilterField>
        <FilterField label="Sort">
          <select name="sort" defaultValue={sp.sort ?? "newest"} className={fieldClass}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="activity">Last activity</option>
            <option value="calls">Calls (30d)</option>
            <option value="agents">Agents</option>
            <option value="balance">Balance due</option>
            <option value="trial">Trial ends</option>
          </select>
        </FilterField>
        <label className="flex h-9 items-center gap-1.5 text-xs font-medium text-muted">
          <input type="checkbox" name="demo" value="1" defaultChecked={sp.demo === "1"} /> Include demo
        </label>
      </FilterBar>

      <OTable>
        <OHead
          cols={[
            "Company",
            "Status",
            "Signed up",
            "Trial",
            "Price",
            "Billing",
            { label: "Balance", right: true },
            { label: "Agent seats", right: true },
            { label: "Users", right: true },
            { label: "Calls 30d", right: true },
            "Last activity",
            "Flags",
          ]}
        />
        <tbody className="divide-y divide-line">
          {rows.map((c) => (
            <tr key={c.ws.id} className="hover:bg-canvas/60">
              <td className={td}>
                <Link href={`/platform/companies/${c.ws.id}`} className="font-medium text-ink hover:text-brand-blue hover:underline">
                  {c.ws.name}
                </Link>
                <p className="text-xs text-muted">{c.m.owner_email ?? c.ws.slug}</p>
              </td>
              <td className={td}>
                <StatusBadge status={c.ws.status} isDemo={c.ws.is_demo} />
              </td>
              <td className={td}>{fmtDate(c.ws.created_at)}</td>
              <td className={td}>
                <TrialBadge trial={c.trial} />
              </td>
              <td className={td}>
                {c.ws.billing_amount !== null ? `${fmtMoney(Number(c.ws.billing_amount), c.ws.billing_currency)} / ${c.ws.billing_cycle.replace("ly", "")}` : "—"}
              </td>
              <td className={td}>
                <BillingBadge billing={c.billing} />
              </td>
              <td className={tdNum}>{c.m.balance ? fmtMoney(c.m.balance, c.ws.billing_currency) : "—"}</td>
              <td className={tdNum}>
                {Number(c.m.agents_active)} / {fmtSeats(c.ws.seat_limit)}
              </td>
              <td className={tdNum}>{Number(c.m.users_active)}</td>
              <td className={tdNum}>{Number(c.m.calls_30d).toLocaleString()}</td>
              <td className={td}>{c.lastActivityAt ? fmtRelative(c.lastActivityAt) : "Never"}</td>
              <td className="px-3 py-2.5">
                <FlagBadges flags={c.flags} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && <OEmpty cols={12}>No companies match these filters.</OEmpty>}
        </tbody>
      </OTable>
    </>
  );
}

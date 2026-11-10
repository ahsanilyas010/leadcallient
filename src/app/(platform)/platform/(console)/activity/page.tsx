import type { Metadata } from "next";
import Link from "next/link";
import { loadAudit, loadCompanies } from "@/lib/owner/data";
import { fmtDate, fmtRelative } from "@/lib/format";
import { OTable, OHead, OEmpty, PageHeader, Section, td } from "../../_ui/table";
import { StatusBadge } from "../../_ui/badges";
import { AuditList } from "../../_ui/lists";

export const metadata: Metadata = { title: "Activity · Owner console" };

export default async function ActivityPage() {
  const [companies, audit] = await Promise.all([loadCompanies(), loadAudit(undefined, 300)]);
  const names = new Map(companies.map((c) => [c.ws.id, c.ws.name]));
  const signups = companies.filter((c) => !c.ws.is_demo).slice(0, 25);

  return (
    <>
      <PageHeader title="Activity" description="Every change made from this console, plus the latest signups." />
      <Section title="Owner actions">
        <AuditList rows={audit} companyNames={names} />
      </Section>
      <Section title="Latest signups">
        <OTable>
          <OHead cols={["When", "Company", "Owner", "Status", "Source"]} />
          <tbody className="divide-y divide-line">
            {signups.map((c) => {
              const s = (c.ws.signup ?? {}) as Record<string, unknown>;
              const source = [s.utm_source, s.utm_campaign].filter(Boolean).join(" / ") || (s.referrer ? String(s.referrer) : "Direct");
              return (
                <tr key={c.ws.id}>
                  <td className={td} title={fmtDate(c.ws.created_at)}>
                    {fmtRelative(c.ws.created_at)}
                  </td>
                  <td className={td}>
                    <Link href={`/platform/companies/${c.ws.id}`} className="font-medium text-ink hover:text-brand-blue hover:underline">
                      {c.ws.name}
                    </Link>
                  </td>
                  <td className={td}>{c.m.owner_email ?? "—"}</td>
                  <td className={td}>
                    <StatusBadge status={c.ws.status} />
                  </td>
                  <td className="max-w-xs truncate px-3 py-2.5">{String(source)}</td>
                </tr>
              );
            })}
            {signups.length === 0 && <OEmpty cols={5}>No signups yet.</OEmpty>}
          </tbody>
        </OTable>
      </Section>
    </>
  );
}

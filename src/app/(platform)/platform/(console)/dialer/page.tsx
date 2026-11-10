import type { Metadata } from "next";
import { loadAgentUsage, loadCompanies, rangeFromParam } from "@/lib/owner/data";
import { fmtDuration } from "@/lib/owner/status";
import { PageHeader, Stat } from "../../_ui/table";
import { UsageTable } from "../../_ui/lists";
import { ExportLink, FilterBar, FilterField, fieldClass } from "../../_ui/filter-bar";

export const metadata: Metadata = { title: "Dialer usage · Owner console" };

type SP = { range?: string; from?: string; to?: string; company?: string; demo?: string; idle?: string };

export default async function DialerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const range = rangeFromParam(sp.range, sp.from, sp.to);
  const companyId = sp.company && /^[0-9a-f-]{36}$/i.test(sp.company) ? sp.company : undefined;
  const [companies, usage] = await Promise.all([loadCompanies(), loadAgentUsage(range.from, range.to, companyId)]);
  const names = new Map(companies.map((c) => [c.ws.id, c.ws.name]));
  const demoIds = new Set(companies.filter((c) => c.ws.is_demo).map((c) => c.ws.id));
  const rows = usage
    .filter((r) => sp.demo === "1" || !demoIds.has(r.workspace_id))
    .filter((r) => sp.idle === "1" || Number(r.calls) > 0 || Number(r.clocked_seconds) > 0 || r.role === "agent")
    .sort((a, b) => Number(b.calls) - Number(a.calls));

  const calls = rows.reduce((t, r) => t + Number(r.calls), 0);
  const connects = rows.reduce((t, r) => t + Number(r.connects), 0);
  const talk = rows.reduce((t, r) => t + Number(r.talk_seconds), 0);
  const clocked = rows.reduce((t, r) => t + Number(r.clocked_seconds), 0);
  const dialing = rows.filter((r) => Number(r.calls) > 0).length;

  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  qs.set("type", "dialer");

  return (
    <>
      <PageHeader
        title="Dialer usage"
        description={`${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)} · times are UTC`}
        actions={<ExportLink href={`/api/platform/export?${qs}`} />}
      />
      <FilterBar action="/platform/dialer" resetHref="/platform/dialer">
        <FilterField label="Range">
          <select name="range" defaultValue={range.key} className={fieldClass}>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom (dates below)</option>
          </select>
        </FilterField>
        <FilterField label="From">
          <input type="date" name="from" defaultValue={sp.from} className={fieldClass} />
        </FilterField>
        <FilterField label="To">
          <input type="date" name="to" defaultValue={sp.to} className={fieldClass} />
        </FilterField>
        <FilterField label="Company">
          <select name="company" defaultValue={companyId ?? ""} className={`${fieldClass} max-w-56`}>
            <option value="">All</option>
            {companies.map((c) => (
              <option key={c.ws.id} value={c.ws.id}>
                {c.ws.name}
              </option>
            ))}
          </select>
        </FilterField>
        <label className="flex h-9 items-center gap-1.5 text-xs font-medium text-muted">
          <input type="checkbox" name="idle" value="1" defaultChecked={sp.idle === "1"} /> Include managers with no calls
        </label>
        <label className="flex h-9 items-center gap-1.5 text-xs font-medium text-muted">
          <input type="checkbox" name="demo" value="1" defaultChecked={sp.demo === "1"} /> Include demo
        </label>
      </FilterBar>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Agents dialing" value={dialing} hint={`${rows.length} listed`} />
        <Stat label="Calls" value={calls.toLocaleString()} />
        <Stat label="Connect rate" value={calls ? `${Math.round((connects / calls) * 100)}%` : "—"} hint={`${connects.toLocaleString()} connects`} />
        <Stat label="Talk time" value={fmtDuration(talk)} hint={calls ? `${fmtDuration(talk / calls)} per call` : undefined} />
        <Stat label="Hours clocked" value={(clocked / 3600).toFixed(1)} />
      </div>
      <UsageTable rows={rows} companyNames={names} />
    </>
  );
}

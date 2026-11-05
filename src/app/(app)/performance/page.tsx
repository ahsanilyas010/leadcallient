import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { createRealClient } from "@/lib/supabase/real";
import { RANGES, formatDuration, loadCallReport, parseRange, type RangeKey } from "@/lib/reports/call-report";

export const metadata: Metadata = { title: "Performance", robots: { index: false, follow: false } };

// Data-only users see the same read-only funnel and scorecard as managers.
const MANAGER_ROLES = ["super_admin", "ops_manager", "team_lead", "data_manager"];

// Performance, by role. An agent sees their own calls and can download them.
// Managers and team leads see the campaign funnel and the agent scorecard, and
// can open any agent (?agent=<id>) for that agent's daily report and export.
// The campaign funnel and agent scorecard are Postgres views
// (v_campaign_funnel, v_agent_scorecard), so those numbers are always live.
export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ range?: string; agent?: string }> }) {
  const profile = await requireRealProfile();
  const isManager = MANAGER_ROLES.includes(profile.role);
  if (!isManager && profile.role !== "agent") redirect("/start");

  const sp = await searchParams;
  const range = parseRange(sp.range);
  const workspace = await getCurrentWorkspace();
  const supabase = await createRealClient();

  const agentId = isManager ? (sp.agent && /^[0-9a-f-]{36}$/i.test(sp.agent) ? sp.agent : undefined) : profile.id;

  const [funnelRes, scoreRes, report, agentRes] = await Promise.all([
    isManager && !agentId ? supabase.from("v_campaign_funnel").select("*").eq("workspace_id", workspace.id) : null,
    isManager && !agentId ? supabase.from("v_agent_scorecard").select("*").eq("workspace_id", workspace.id) : null,
    agentId ? loadCallReport(supabase, { workspaceId: workspace.id, range, agentId }) : null,
    isManager ? supabase.from("profiles").select("id, full_name").eq("workspace_id", workspace.id).in("role", ["agent", "team_lead"]).order("full_name") : null,
  ]);
  const agents = agentRes?.data ?? [];
  const agentName = agentId === profile.id ? profile.full_name : (agents.find((a) => a.id === agentId)?.full_name ?? "this agent");
  const qs = (r: RangeKey, a?: string) => `?range=${r}${a ? `&agent=${a}` : ""}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {agentId ? (agentId === profile.id ? "My performance" : `Performance: ${agentName}`) : "Performance"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {agentId && (
            <nav aria-label="Time range" className="flex gap-1 rounded-lg border border-line bg-white p-0.5 text-xs">
              {(Object.keys(RANGES) as RangeKey[]).map((r) => (
                <Link
                  key={r}
                  href={qs(r, isManager ? agentId : undefined)}
                  aria-current={r === range ? "true" : undefined}
                  className={`rounded-md px-2.5 py-1 font-medium ${r === range ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                >
                  {RANGES[r].label}
                </Link>
              ))}
            </nav>
          )}
          {isManager && (
            <a
              href={`/api/reports/calls?range=${range}${agentId ? `&agent=${agentId}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
            >
              <Download className="h-3.5 w-3.5" /> Export {agentId ? "this agent" : "all"} (CSV)
            </a>
          )}
          {!isManager && (
            <a
              href={`/api/reports/calls?range=${range}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
            >
              <Download className="h-3.5 w-3.5" /> Download my calls (CSV)
            </a>
          )}
        </div>
      </div>

      {agentId && isManager && (
        <Link href="/performance" className="-mt-3 text-sm text-brand-blue hover:underline">
          Back to the whole team
        </Link>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Calls" value={report.totals.calls} />
            <Tile label="Connects" value={report.totals.connects} />
            <Tile label="Conversions" value={report.totals.conversions} />
            <Tile label="Talk time" value={formatDuration(report.totals.talkSeconds)} />
          </div>
          <Table
            title="By day"
            heads={["Day (UTC)", "Calls", "Connects", "Conversions", "Talk time"]}
            empty="No calls in this period."
            rows={report.days.map((d) => [d.day, d.calls, d.connects, d.conversions, formatDuration(d.talkSeconds)])}
          />
          <Table
            title={`Calls${report.truncated ? " (latest 5,000)" : ""}`}
            heads={["Time (UTC)", "Lead", "Company", "Campaign", "Outcome", "Talk time"]}
            empty="No calls in this period."
            rows={report.rows
              .slice(0, 100)
              .map((r) => [r.startedAt.replace("T", " ").slice(0, 16), r.leadName || r.phone, r.company, r.campaign, r.disposition || "No outcome yet", formatDuration(r.talkSeconds)])}
          />
          {report.rows.length > 100 && <p className="-mt-3 text-xs text-muted">Showing the latest 100. The CSV has all {report.rows.length.toLocaleString("en-GB")}.</p>}
        </>
      )}

      {isManager && !agentId && (
        <>
          <Table
            title="Campaign funnel"
            heads={["Campaign", "Loaded", "Screened", "Dialled", "Connected", "Converted"]}
            empty="No campaigns yet."
            rows={(funnelRes?.data ?? []).map((f) => [f.campaign_name, f.loaded, f.screened, f.dialled, f.connected, f.converted])}
          />
          <Table
            title="Agent scorecard (all time). Open an agent for their daily report."
            heads={["Agent", "Calls", "Connects", "Conversions", "Talk time", "Avg wrap-up"]}
            empty="No calls yet."
            rows={(scoreRes?.data ?? []).map((s) => [
              <Link key={s.agent_id} href={qs("7d", s.agent_id ?? undefined)} className="text-brand-blue hover:underline">
                {s.agent_name}
              </Link>,
              s.calls,
              s.connects,
              s.conversions,
              formatDuration(s.talk_seconds ?? 0),
              formatDuration(s.avg_wrap_seconds ?? 0),
            ])}
          />
          {agents.length > 0 && (
            <p className="text-xs text-muted">
              {agents.filter((a) => !(scoreRes?.data ?? []).some((s) => s.agent_id === a.id)).length} agents have no calls yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function Table({ title, heads, rows, empty }: { title: string; heads: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              {heads.map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={`px-4 py-3 ${j === 0 ? "font-medium text-ink" : ""}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={heads.length} className="px-4 py-8 text-center text-muted">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

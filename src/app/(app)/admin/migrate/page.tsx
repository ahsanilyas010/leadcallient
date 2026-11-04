import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { createRealClient } from "@/lib/supabase/real";
import { LeadImporter } from "@/components/leads/lead-importer";
import { loadOwnerOptions } from "@/lib/leads/owners";
import { EMPTY, fmtDateTime } from "@/lib/format";
import { TableWrap } from "@/components/ui/data-table";
import { crmSource } from "@/lib/leads/crm-sources";

export const metadata: Metadata = { title: "Migrate from another CRM", robots: { index: false, follow: false } };

// The guided CRM migration: choose the CRM, upload its export, match fields,
// map stages and users, run a small test, check it, then move the rest. It is
// the importer in migration mode, so every import rule (data source, lawful
// basis, suppression list, duplicates) applies, and each run can be undone.
export default async function MigratePage() {
  const profile = await requireRole(["super_admin", "ops_manager", "data_manager"]);
  const supabase = await createRealClient();
  const ws = profile.workspace_id;
  const workspace = await getCurrentWorkspace();

  const [{ data: campaigns }, { data: sources }, { data: runs }, owners] = await Promise.all([
    supabase.from("campaigns").select("id, name, country").eq("workspace_id", ws).order("name"),
    supabase.from("data_sources").select("id, name, lawful_basis").eq("workspace_id", ws).eq("is_active", true).order("name"),
    supabase
      .from("source_fetch_runs")
      .select("id, params, records_found, records_imported, records_rejected, records_unphoned, status, finished_at, started_at")
      .eq("workspace_id", ws)
      .contains("params", { kind: "migration" })
      .order("started_at", { ascending: false })
      .limit(10),
    loadOwnerOptions(supabase, ws),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Migrate from another CRM</h1>
        <p className="mt-1 text-sm text-muted">
          Move your contacts, leads, owners, stages, notes and tags across in a few guided steps. Start with a small test run, check it,
          then move everything. Nothing in your old CRM is changed. For a simple list, use{" "}
          <Link href="/admin/import" className="font-medium text-brand-blue hover:underline">
            Upload leads
          </Link>{" "}
          instead.
        </p>
      </div>

      {(campaigns ?? []).length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-sm text-ink shadow-sm">
          Migrated records go into a campaign, and you don&apos;t have one yet.{" "}
          <Link href="/admin/campaigns" className="font-medium text-brand-blue hover:underline">
            Create a campaign
          </Link>{" "}
          first, then come back here.
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <LeadImporter
            mode="migration"
            isManager={profile.role !== "data_manager"}
            canManageData
            owners={owners}
            screeningRequired={workspace.require_screening}
            campaigns={campaigns ?? []}
            dataSources={(sources ?? []).map((s) => ({ id: s.id, name: s.name, needsReview: s.lawful_basis === "unspecified" }))}
          />
        </div>
      )}

      <TableWrap label="Recent migrations">
        <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">Recent migrations</div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">From</th>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Rows</th>
              <th className="px-4 py-2">Moved</th>
              <th className="px-4 py-2">Not moved</th>
              <th className="px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(runs ?? []).map((r) => {
              const p = (r.params ?? {}) as { crm_source?: string; filename?: string; test_run?: boolean };
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-ink">
                    {crmSource(p.crm_source)?.name ?? EMPTY}
                    {p.test_run && <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted">TEST</span>}
                    {r.status === "undone" && <span className="ml-2 rounded bg-danger-tint px-1.5 py-0.5 text-[10px] font-semibold text-danger">UNDONE</span>}
                  </td>
                  <td className="px-4 py-2 text-muted">{p.filename ?? EMPTY}</td>
                  <td className="tabular px-4 py-2">{r.records_found ?? 0}</td>
                  <td className="tabular px-4 py-2">{(r.records_imported ?? 0) + (r.records_unphoned ?? 0)}</td>
                  <td className="tabular px-4 py-2">{r.records_rejected ?? 0}</td>
                  <td className="px-4 py-2 text-muted">{fmtDateTime(r.finished_at ?? r.started_at, profile.timezone)}</td>
                </tr>
              );
            })}
            {(runs ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No migrations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

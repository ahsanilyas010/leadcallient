import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { EmptyState } from "@/components/guide/empty-state";
import { requireProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { createRealClient } from "@/lib/supabase/real";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegisterSourceDialog } from "@/components/leads/register-source-dialog";
import { LeadImporterDialog } from "@/components/leads/lead-importer";
import { EditSourceDialog } from "@/components/leads/edit-source-dialog";
import { UnphonedContacts } from "./unphoned-contacts";
import { fmtDate } from "@/lib/format";
import { TableWrap } from "@/components/ui/data-table";

export const metadata: Metadata = { title: "Data" };

const label = (s: string) => s.replace(/_/g, " ");

export default async function DataPage() {
  const profile = await requireProfile();
  if (!["super_admin", "ops_manager", "team_lead"].includes(profile.role)) redirect("/start");
  const canManage = ["super_admin", "ops_manager"].includes(profile.role);

  const supabase = await createRealClient();
  const ws = profile.workspace_id;
  const workspace = await getCurrentWorkspace();
  const [
    { data: sources },
    { data: campaigns },
    { data: runs },
    { data: performance },
    { data: agents },
    { data: unphoned },
  ] = await Promise.all([
    supabase.from("data_sources").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }),
    supabase.from("campaigns").select("id, name, country").eq("workspace_id", ws).order("name"),
    supabase
      .from("source_fetch_runs")
      .select("*")
      .eq("workspace_id", ws)
      .order("started_at", { ascending: false })
      .limit(30),
    supabase.from("v_source_performance").select("*").eq("workspace_id", ws).order("leads_loaded", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("workspace_id", ws)
      .eq("role", "agent")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("unphoned_contacts")
      .select("id, full_name, email, data_source_id, assigned_to, promoted_lead_id")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const sourceName = new Map((sources ?? []).map((s) => [s.id, s.name]));
  const campaignName = new Map((campaigns ?? []).map((c) => [c.id, c.name]));
  const activeSources = (sources ?? []).filter((s) => s.is_active);
  const noDataYet = (sources ?? []).length === 0 && (runs ?? []).length === 0;

  return (
    <div className="p-4">
      <Tabs defaultValue="sources">
        <TabsList className="mb-4">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="history">Import history</TabsTrigger>
          <TabsTrigger value="performance">Source performance</TabsTrigger>
          <TabsTrigger value="unphoned">
            Phone-less contacts
            {(unphoned ?? []).filter((u) => !u.promoted_lead_id).length > 0 && (
              <Badge variant="warning" className="ml-1.5">
                {(unphoned ?? []).filter((u) => !u.promoted_lead_id).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          {noDataYet && canManage && (
            <div className="mb-4">
              <EmptyState
                testId="data-empty"
                icon={Upload}
                title="Add your first leads"
                action={
                  <Link
                    href="/admin/import"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-4 text-sm font-medium text-white hover:brightness-110"
                  >
                    <Upload className="h-4 w-4" /> Upload leads
                  </Link>
                }
              >
                Upload a CSV or Excel file with one lead per row, then match its columns to Name, Phone number, Company and Email.
                {workspace.require_screening ? " Screen the batch under Compliance so leads can be dialled." : " Assign the leads to agents under Leads and they are ready to dial."}
              </EmptyState>
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {(sources ?? []).length} sources. Every imported lead traces back to one, with a lawful basis on file.
            </p>
            {canManage && (
              <div className="flex gap-2">
                <LeadImporterDialog
                  label="Import vendor file"
                  isManager
                  screeningRequired={workspace.require_screening}
                  campaigns={campaigns ?? []}
                  dataSources={activeSources.map((d) => ({ id: d.id, name: d.name, needsReview: d.lawful_basis === "unspecified" }))}
                />
                <RegisterSourceDialog />
              </div>
            )}
          </div>
          <TableWrap label="Data sources">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Market</th>
                  <th className="px-3 py-2 font-medium">Lawful basis</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  {canManage && (
                    <th className="px-3 py-2 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(sources ?? []).map((d) => (
                  <tr key={d.id} className="h-[38px] border-b border-line last:border-0">
                    <td className="px-3 py-1.5 font-medium text-ink">{d.name}</td>
                    <td className="px-3 py-1.5 text-xs text-muted">{label(d.source_type)}</td>
                    <td className="px-3 py-1.5 text-xs text-muted">{d.market ?? "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-muted">
                      {d.lawful_basis === "unspecified" ? <Badge variant="warning">Needs review</Badge> : label(d.lawful_basis)}
                    </td>
                    <td className="px-3 py-1.5">
                      {d.is_active ? <Badge variant="confirm">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                    </td>
                    {canManage && (
                      <td className="px-3 py-1.5 text-right">
                        <EditSourceDialog source={d} />
                      </td>
                    )}
                  </tr>
                ))}
                {(sources ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                      No sources registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </TabsContent>

        <TabsContent value="history">
          <p className="mb-3 text-xs text-muted">Last 30 imports, across every source.</p>
          <TableWrap label="Import history">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Campaign</th>
                  <th className="px-3 py-2 font-medium">Rows</th>
                  <th className="px-3 py-2 font-medium">Imported</th>
                  <th className="px-3 py-2 font-medium">Rejected</th>
                  <th className="px-3 py-2 font-medium">Phone-less</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {(runs ?? []).map((r) => (
                  <tr key={r.id} className="h-[38px] border-b border-line last:border-0">
                    <td className="px-3 py-1.5 font-medium text-ink">{sourceName.get(r.data_source_id) ?? "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-muted">{(r.params as { filename?: string } | null)?.filename ?? "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-muted">{r.campaign_id ? campaignName.get(r.campaign_id) ?? "—" : "—"}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{r.records_found}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{r.records_imported}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{r.records_rejected}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{r.records_unphoned}</td>
                    <td className="px-3 py-1.5">
                      {r.status === "complete" && <Badge variant="confirm">Complete</Badge>}
                      {r.status === "running" && <Badge variant="warning">Running</Badge>}
                      {r.status === "failed" && (
                        <span title={r.error ?? ""}>
                          <Badge variant="danger">Failed</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 tabular text-xs text-muted">{new Date(r.started_at).toLocaleString()}</td>
                  </tr>
                ))}
                {(runs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted">
                      No imports yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </TabsContent>

        <TabsContent value="performance">
          <p className="mb-3 text-xs text-muted">
            Per source, from first import to conversion. A source with many leads loaded but few passing screening is
            worth revisiting before the next import.
          </p>
          <TableWrap label="Source performance">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Loaded</th>
                  <th className="px-3 py-2 font-medium">Screened</th>
                  <th className="px-3 py-2 font-medium">Suppressed</th>
                  <th className="px-3 py-2 font-medium">Worked</th>
                  <th className="px-3 py-2 font-medium">Contacted</th>
                  <th className="px-3 py-2 font-medium">Converted</th>
                  <th className="px-3 py-2 font-medium">Last import</th>
                </tr>
              </thead>
              <tbody>
                {(performance ?? []).map((p) => (
                  <tr key={p.data_source_id} className="h-[38px] border-b border-line last:border-0">
                    <td className="px-3 py-1.5 font-medium text-ink">{p.name}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{p.leads_loaded}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{p.screened_passed}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{p.suppressed}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{p.worked}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{p.contacted}</td>
                    <td className="px-3 py-1.5 tabular text-muted">{p.converted}</td>
                    <td className="px-3 py-1.5 tabular text-xs text-muted">
                      {fmtDate(p.last_import_at, profile.timezone)}
                    </td>
                  </tr>
                ))}
                {(performance ?? []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted">
                      No sources yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </TabsContent>

        <TabsContent value="unphoned">
          <UnphonedContacts
            canManage={canManage}
            agents={agents ?? []}
            rows={(unphoned ?? []).map((u) => ({
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              source: u.data_source_id ? sourceName.get(u.data_source_id) ?? "—" : "—",
              assigned_to: u.assigned_to,
              promoted: Boolean(u.promoted_lead_id),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

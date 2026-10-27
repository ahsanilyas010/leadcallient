import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { createRealClient } from "@/lib/supabase/real";
import { LeadImporter } from "@/components/leads/lead-importer";
import { ScreenButton } from "@/components/leads/screen-button";
import { EMPTY, fmtDate } from "@/lib/format";
import { TableWrap } from "@/components/ui/data-table";

export const metadata: Metadata = { title: "Upload leads", robots: { index: false, follow: false } };

export default async function ImportLeadsPage() {
  const profile = await requireRole(["super_admin", "ops_manager"]);
  const supabase = await createRealClient();
  const ws = profile.workspace_id;
  const workspace = await getCurrentWorkspace();

  const [{ data: campaigns }, { data: sources }, { data: batches }] = await Promise.all([
    supabase.from("campaigns").select("id, name, country").eq("workspace_id", ws).order("name"),
    supabase.from("data_sources").select("id, name, lawful_basis").eq("workspace_id", ws).eq("is_active", true).order("name"),
    supabase
      .from("lead_batches")
      .select("id, source, row_count, status, screened_at, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Upload leads</h1>
        <p className="mt-1 text-sm text-muted">
          Bring in a CSV or Excel file of any shape. You say what each column is (name, phone number, company, email, or anything else
          you want kept as extra information), check the result, then import. Everything you bring in is listed under{" "}
          <Link href="/admin/leads" className="font-medium text-brand-blue hover:underline">
            Leads
          </Link>
          , where you assign it to agents, or you can call it yourself from the{" "}
          <Link href="/dial" className="font-medium text-brand-blue hover:underline">
            Dial workspace
          </Link>
          .
        </p>
      </div>

      {(campaigns ?? []).length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-sm text-ink shadow-sm" data-testid="import-no-campaign">
          Leads belong to a campaign, and you don&apos;t have one yet.{" "}
          <Link href="/admin/campaigns" className="font-medium text-brand-blue hover:underline">
            Create a campaign
          </Link>{" "}
          first, then come back here.
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <LeadImporter
            isManager
            screeningRequired={workspace.require_screening}
            campaigns={campaigns ?? []}
            dataSources={(sources ?? []).map((s) => ({ id: s.id, name: s.name, needsReview: s.lawful_basis === "unspecified" }))}
          />
        </div>
      )}

      <TableWrap label="Recent uploads">
        <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">Recent uploads</div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Leads</th>
              <th className="px-4 py-2">Screened</th>
              <th className="px-4 py-2">Uploaded</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(batches ?? []).map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2 font-medium text-ink">
                  <Link href={`/admin/leads?batch=${b.id}`} className="hover:underline" title="View and assign these leads">
                    {b.source ?? EMPTY}
                  </Link>
                </td>
                <td className="px-4 py-2">{b.row_count}</td>
                <td className="px-4 py-2 text-muted">{b.screened_at ? fmtDate(b.screened_at, profile.timezone) : "Not yet"}</td>
                <td className="px-4 py-2 text-muted">{fmtDate(b.created_at, profile.timezone)}</td>
                <td className="px-4 py-2">{!b.screened_at && <ScreenButton batchId={b.id} />}</td>
              </tr>
            ))}
            {(batches ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No uploads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/guide/empty-state";
import { requireProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { createRealClient } from "@/lib/supabase/real";
import { SUPPRESSION_REASONS } from "@/lib/compliance/reasons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddSuppressionDialog } from "./add-suppression-dialog";
import { RunScreeningDialog } from "./run-screening-dialog";
import { ScreenAllButton } from "./screen-all-button";
import { ScreeningModeCard } from "./screening-mode-card";
import { RemoveSuppressionButton } from "./remove-suppression-button";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Compliance" };

const reasonLabel = new Map<string, string>(SUPPRESSION_REASONS.map((r) => [r.value, r.label]));

export default async function CompliancePage() {
  const profile = await requireProfile();
  if (!["super_admin", "ops_manager", "qa_analyst"].includes(profile.role)) redirect("/start");
  const canManage = ["super_admin", "ops_manager"].includes(profile.role);

  const supabase = await createRealClient();
  const ws = profile.workspace_id;
  const workspace = await getCurrentWorkspace();
  const screeningRequired = workspace.require_screening;

  const [{ data: stats }, { data: entries }, { data: batches }, { data: campaigns }, { data: pendingLeads }] = await Promise.all([
    supabase.from("v_compliance_stats").select("*").eq("workspace_id", ws).maybeSingle(),
    supabase
      .from("suppression_list")
      .select("id, phone_hash, reason, phone_hint, note, added_by, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("lead_batches")
      .select("id, source, campaign_id, row_count, status, screened_at, evidence_url, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("campaigns").select("id, name").eq("workspace_id", ws),
    // Which batches still have unscreened leads (a re-screen is only useful
    // there), plus leads that came in outside any batch.
    supabase.from("leads").select("batch_id").eq("workspace_id", ws).eq("screening_status", "pending").limit(20000),
  ]);
  const pendingByBatch = new Map<string, number>();
  let pendingLoose = 0;
  for (const l of pendingLeads ?? []) {
    if (l.batch_id) pendingByBatch.set(l.batch_id, (pendingByBatch.get(l.batch_id) ?? 0) + 1);
    else pendingLoose += 1;
  }

  // Resolve a readable number for entries that came from a lead (e.g. a DNC
  // disposition on a call); manual entries carry a masked hint instead.
  const hashes = (entries ?? []).map((e) => e.phone_hash);
  const { data: matchedLeads } = hashes.length
    ? await supabase.from("leads").select("phone_hash, phone_e164").eq("workspace_id", ws).in("phone_hash", hashes)
    : { data: [] as { phone_hash: string | null; phone_e164: string | null }[] };
  const phoneByHash = new Map((matchedLeads ?? []).map((l) => [l.phone_hash, l.phone_e164]));

  const addedByIds = [...new Set((entries ?? []).map((e) => e.added_by).filter((x): x is string => Boolean(x)))];
  const { data: adders } = addedByIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", addedByIds)
    : { data: [] as { id: string; full_name: string }[] };
  const adderName = new Map((adders ?? []).map((a) => [a.id, a.full_name]));
  const campaignName = new Map((campaigns ?? []).map((c) => [c.id, c.name]));

  const byReason = new Map<string, number>();
  for (const e of entries ?? []) byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + 1);

  const cards = [
    { label: "Passed screening", value: stats?.leads_passed ?? 0, cls: "text-brand-green-text" },
    { label: "Pending screening", value: stats?.leads_pending ?? 0, cls: "text-warning" },
    { label: "Suppressed numbers", value: stats?.suppression_total ?? 0, cls: "text-ink" },
    { label: "Leads blocked by suppression", value: stats?.leads_blocked_by_suppression ?? 0, cls: "text-danger" },
  ];

  const nothingScreened = (stats?.leads_passed ?? 0) === 0;
  const waiting = stats?.leads_pending ?? 0;

  return (
    <div className="p-4">
      <ScreeningModeCard required={screeningRequired} canManage={canManage} />
      {nothingScreened && screeningRequired && (
        <div className="mb-4">
          <EmptyState
            testId="compliance-empty"
            icon={ShieldCheck}
            title={waiting > 0 ? `${waiting} lead${waiting === 1 ? "" : "s"} waiting to be screened` : "No screened leads yet"}
            action={
              canManage && waiting === 0 ? (
                <Link
                  href="/admin/import"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-blue px-4 text-sm font-medium text-white hover:brightness-110"
                >
                  Upload leads
                </Link>
              ) : undefined
            }
          >
            Screening checks each lead&apos;s number against do-not-call rules and your suppression list. Only leads that pass can be dialled
            while screening is required.
            {waiting > 0 ? " Use the Screen button in Screening history below." : " Upload some leads, then screen them here."}
          </EmptyState>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="animate-slide-up">
            <CardContent className="pt-4">
              <div className={`text-2xl font-semibold tabular ${c.cls}`}>{c.value}</div>
              <div className="text-xs text-muted">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {byReason.size > 0 && (
        <p className="mb-4 flex flex-wrap gap-1.5 text-xs text-muted">
          Most recent 100 entries by reason:
          {[...byReason].map(([r, n]) => (
            <Badge key={r} variant="neutral">
              {reasonLabel.get(r) ?? r} · {n}
            </Badge>
          ))}
        </p>
      )}

      <Card className="mb-4 animate-slide-up">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Screening history</CardTitle>
          {canManage && <ScreenAllButton pending={waiting} />}
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Batch</th>
                <th className="px-4 py-2 font-medium">Campaign</th>
                <th className="px-4 py-2 font-medium">Rows</th>
                <th className="px-4 py-2 font-medium">Pending</th>
                <th className="px-4 py-2 font-medium">Screened</th>
                <th className="px-4 py-2 font-medium">Evidence</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(batches ?? []).map((b) => {
                const pendingHere = pendingByBatch.get(b.id) ?? 0;
                return (
                  <tr key={b.id} className="h-[38px] border-b border-line last:border-0">
                    <td className="px-4 py-1.5 font-medium text-ink">
                      <Link href={`/admin/leads?batch=${b.id}`} className="hover:underline" title="View the leads in this batch">
                        {b.source ?? "Batch"}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-xs text-muted">
                      {b.campaign_id ? (campaignName.get(b.campaign_id) ?? "—") : <Badge variant="warning">No campaign</Badge>}
                    </td>
                    <td className="px-4 py-1.5 tabular text-muted">{b.row_count}</td>
                    <td className="px-4 py-1.5 tabular text-xs">
                      {pendingHere > 0 ? <Badge variant="warning">{pendingHere}</Badge> : <span className="text-muted">0</span>}
                    </td>
                    <td className="px-4 py-1.5 text-xs text-muted">
                      {b.screened_at ? fmtDateTime(b.screened_at, profile.timezone) : <Badge variant="warning">Not screened</Badge>}
                    </td>
                    <td className="px-4 py-1.5 text-xs text-muted">{b.evidence_url ? "On file" : "None"}</td>
                    <td className="px-4 py-1.5 text-right">
                      {canManage && (
                        <RunScreeningDialog
                          batchId={b.id}
                          label={b.source ?? "Batch"}
                          pending={pendingHere}
                          screenedBefore={Boolean(b.screened_at)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {pendingLoose > 0 && (
                <tr className="h-[38px] border-b border-line last:border-0">
                  <td className="px-4 py-1.5 font-medium text-ink">Leads added outside a batch</td>
                  <td className="px-4 py-1.5 text-xs text-muted">—</td>
                  <td className="px-4 py-1.5 tabular text-muted">{pendingLoose}</td>
                  <td className="px-4 py-1.5 tabular text-xs">
                    <Badge variant="warning">{pendingLoose}</Badge>
                  </td>
                  <td className="px-4 py-1.5 text-xs text-muted">
                    <Badge variant="warning">Not screened</Badge>
                  </td>
                  <td className="px-4 py-1.5 text-xs text-muted">—</td>
                  <td className="px-4 py-1.5 text-right text-xs text-muted">Use the button above</td>
                </tr>
              )}
              {(batches ?? []).length === 0 && pendingLoose === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                    No lead batches yet. Upload leads under Upload leads, then screen them here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="animate-slide-up">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Suppression list</CardTitle>
          {canManage && <AddSuppressionDialog />}
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium">Added by</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 font-medium">Added</th>
                {canManage && <th className="px-4 py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((e) => (
                <tr key={e.id} className="h-[38px] border-b border-line last:border-0">
                  <td className="px-4 py-1.5 tabular font-medium text-ink">
                    {phoneByHash.get(e.phone_hash) ?? e.phone_hint ?? `${e.phone_hash.slice(0, 10)}…`}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant="danger">{reasonLabel.get(e.reason) ?? e.reason.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-1.5 text-muted">{e.added_by ? adderName.get(e.added_by) ?? "—" : "System"}</td>
                  <td className="px-4 py-1.5 text-muted">{e.note ?? "—"}</td>
                  <td className="px-4 py-1.5 tabular text-xs text-muted">{fmtDate(e.created_at, profile.timezone)}</td>
                  {canManage && (
                    <td className="px-4 py-1.5 text-right">
                      <RemoveSuppressionButton id={e.id} />
                    </td>
                  )}
                </tr>
              ))}
              {(entries ?? []).length === 0 && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted">
                    No suppressed numbers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-muted">
        Suppression is enforced in the dial queue: a lead whose number is on this list is never handed to an agent.
        Screening here is a manual stub: it records that a batch was screened (and keeps the evidence file you attach)
        but there is no live TPS/CTPS/National DNC lookup yet. Add TPS/DNC matches to the suppression list by hand
        until a real provider is wired into the ScreeningProvider interface.
      </p>
    </div>
  );
}

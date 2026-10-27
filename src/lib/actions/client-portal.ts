"use server";

import { requireRealProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";

export interface ClientPortalData {
  funnel: { campaign_id: string; campaign_name: string; loaded: number; screened: number; dialled: number; connected: number; converted: number }[];
  outcomes: { disposition_label: string; outcome_group: string; count: number }[];
  activity: { agent_label: string; calls: number; connects: number; conversions: number }[];
}

// Every field here comes from a SECURITY DEFINER function scoped to the
// caller's own client_id (migration 00000000000064) — this action is a
// thin wrapper, not where the access boundary actually lives.
// campaignId narrows every section to one campaign (migration 114); omitted
// means every campaign of the client.
export async function getClientPortalData(anonymize: boolean, clientId?: string, campaignId?: string): Promise<ClientPortalData> {
  const profile = await requireRealProfile();
  const supabase = await createRealClient();

  // A manager previews any one client's report; a client login only ever
  // gets their own (the client_* functions scope by my_client_id()).
  if (profile.role === "super_admin" || profile.role === "ops_manager") {
    if (!clientId) return { funnel: [], outcomes: [], activity: [] };
    const { data, error } = await supabase.rpc("manager_client_report", {
      p_client_id: clientId,
      p_anonymize: anonymize,
      p_campaign_id: campaignId || undefined,
    });
    if (error) throw new Error(error.message);
    const report = data as unknown as ClientPortalData;
    return { funnel: report.funnel ?? [], outcomes: report.outcomes ?? [], activity: report.activity ?? [] };
  }
  if (profile.role !== "client") throw new Error("Only a client login or an admin can view client reports.");

  const [{ data: funnel }, { data: outcomes }, { data: activity }] = await Promise.all([
    supabase.rpc("client_campaign_funnel"),
    supabase.rpc("client_disposition_breakdown", { p_campaign_id: campaignId || undefined }),
    supabase.rpc("client_agent_activity", { p_anonymize: anonymize, p_campaign_id: campaignId || undefined }),
  ]);

  return {
    funnel: (funnel ?? []).filter((f) => !campaignId || f.campaign_id === campaignId),
    outcomes: outcomes ?? [],
    activity: activity ?? [],
  };
}

// Spec: "monthly PDF report generated server-side and stored in Storage."
// Generates on demand rather than only on a schedule — a client can
// always get this month's report immediately instead of waiting for a
// cron job neither of us can verify runs in this environment.
export async function generateMonthlyReport(clientId?: string, campaignId?: string): Promise<{ error?: string; path?: string }> {
  const profile = await requireRealProfile();
  if (profile.role !== "client" && profile.role !== "super_admin" && profile.role !== "ops_manager") {
    return { error: "Not authorized." };
  }

  const { renderClientReportPdf } = await import("@/lib/reports/client-report-pdf-v2");
  const data = await getClientPortalData(profile.role === "client", clientId, campaignId);

  const pdfBuffer = await renderClientReportPdf({
    monthLabel: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    ...data,
  });

  const admin = createServiceClient();
  const path = `${profile.workspace_id}/${new Date().toISOString().slice(0, 7)}-client-report.pdf`;
  const { error } = await admin.storage.from("client-reports").upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (error) return { error: error.message };

  return { path };
}

export async function getReportDownloadUrl(path: string): Promise<{ url?: string; error?: string }> {
  const profile = await requireRealProfile();
  if (!path.startsWith(`${profile.workspace_id}/`)) return { error: "Not authorized." };

  const admin = createServiceClient();
  const { data, error } = await admin.storage.from("client-reports").createSignedUrl(path, 60 * 10);
  if (error || !data) return { error: error?.message ?? "Could not create a download link." };
  return { url: data.signedUrl };
}

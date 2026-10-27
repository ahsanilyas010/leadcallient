import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { LeadImporterDialog } from "@/components/leads/lead-importer";
import { createRealClient } from "@/lib/supabase/real";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countryLabel } from "@/lib/campaign-options";
import { SCREENING_BADGE } from "@/lib/lead-status";
import { AddLeadDialog } from "./add-lead-dialog";
import { LeadRowActions } from "./lead-row-actions";
import { AutoAssignButton } from "./auto-assign-button";
import { SendEmailButton } from "./send-email-button";
import { ManageAgentsDialog } from "./manage-agents-dialog";
import { ActivateToggle } from "./activate-toggle";
import { LeadDetailsDialog } from "./lead-details-dialog";
import { EditCampaignDialog } from "./edit-campaign-dialog";
import { EMPTY, plural } from "@/lib/format";
import { TableWrap } from "@/components/ui/data-table";

const LEAD_LIMIT = 200;

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireRole(["super_admin", "ops_manager"]);
  const ws = profile.workspace_id;
  const workspace = await getCurrentWorkspace();
  const screeningRequired = workspace.require_screening;

  const supabase = await createRealClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ws)
    .maybeSingle();
  if (!campaign) notFound();

  const [
    { data: leads },
    { count: leadTotal },
    { data: roster },
    { data: people },
    { data: templates },
    { data: contacts },
    { data: clients },
    { data: allCampaigns },
    { data: sources },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", id)
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(LEAD_LIMIT),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("campaign_assignments").select("user_id, daily_target").eq("campaign_id", id),
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("workspace_id", ws)
      .in("role", ["agent", "team_lead"])
      .order("full_name"),
    supabase.from("email_templates").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }),
    supabase
      .from("unphoned_contacts")
      .select("id, full_name, email, company_name, assigned_to, created_at")
      .eq("campaign_id", id)
      .is("promoted_lead_id", null)
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").eq("workspace_id", ws).order("name"),
    supabase.from("campaigns").select("id, name, country").eq("workspace_id", ws).order("name"),
    supabase.from("data_sources").select("id, name, lawful_basis").eq("workspace_id", ws).eq("is_active", true).order("name"),
  ]);

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const assignedAgents = (roster ?? []).map((a) => ({
    id: a.user_id,
    name: nameById.get(a.user_id) ?? EMPTY,
    dailyTarget: a.daily_target,
  }));
  const rosterOptions = (people ?? []).filter((p) => p.is_active).map((p) => ({ id: p.id, full_name: p.full_name }));
  const approvedTemplates = (templates ?? []).filter((t) => t.approved).map((t) => ({ id: t.id, name: t.name }));
  const clientName = (clients ?? []).find((c) => c.id === campaign.client_id)?.name;
  const isActive = campaign.status === "active";

  return (
    <div className="p-4">
      <Link href="/admin/campaigns" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All campaigns
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
            {campaign.name}
            <Badge variant="blue">{countryLabel(campaign.country)}</Badge>
            {isActive ? (
              <Badge variant="confirm">Live</Badge>
            ) : (
              <Badge variant={campaign.status === "archived" ? "warning" : "neutral"}>
                {campaign.status === "archived" ? "Archived" : "Paused"}
              </Badge>
            )}
          </h2>
          <p className="tabular text-xs text-muted">
            {campaign.code ?? "No code"} · {clientName ?? "No client"} · {plural(assignedAgents.length, "agent")} assigned ·{" "}
            {leadTotal ?? 0} leads
          </p>
          <p className="mt-1 text-xs text-muted">
            Window{" "}
            {campaign.calling_window_start && campaign.calling_window_end
              ? `${campaign.calling_window_start.slice(0, 5)}-${campaign.calling_window_end.slice(0, 5)}`
              : "unrestricted"}{" "}
            ({campaign.timezone}) · max {campaign.max_attempts} attempts · {campaign.cooling_off_hours}h cooling-off ·
            caller ID {campaign.caller_id ?? "not set"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EditCampaignDialog
            campaignId={campaign.id}
            clients={clients ?? []}
            values={{
              name: campaign.name,
              code: campaign.code,
              client_id: campaign.client_id,
              country: campaign.country,
              audience: campaign.audience,
              vertical: campaign.vertical,
              timezone: campaign.timezone,
              caller_id: campaign.caller_id,
              calling_window_start: campaign.calling_window_start,
              calling_window_end: campaign.calling_window_end,
              max_attempts: campaign.max_attempts,
              cooling_off_hours: campaign.cooling_off_hours,
              recording_enabled: campaign.recording_enabled,
              disclosure_script: campaign.disclosure_script,
              objection_notes: campaign.objection_notes,
              status: campaign.status,
            }}
          />
          <ManageAgentsDialog campaignId={campaign.id} assigned={assignedAgents} roster={rosterOptions} />
          {campaign.status !== "archived" && <ActivateToggle campaignId={campaign.id} isActive={isActive} />}
        </div>
      </div>

      <Tabs defaultValue="leads">
        <TabsList className="mb-3">
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="contacts">Needs a phone ({contacts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="templates">Email templates</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Showing {(leads ?? []).length} of {leadTotal ?? 0}. Upload a file straight into this campaign, or see every column and
              assign in bulk under{" "}
              <Link href={`/admin/leads?campaign=${campaign.id}`} className="text-brand-blue hover:underline">
                Leads
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <LeadImporterDialog
                label="Upload a file"
                isManager
                screeningRequired={screeningRequired}
                initialCampaignId={campaign.id}
                campaigns={allCampaigns ?? []}
                dataSources={(sources ?? []).map((s) => ({ id: s.id, name: s.name, needsReview: s.lawful_basis === "unspecified" }))}
              />
              <AutoAssignButton campaignId={campaign.id} />
              <AddLeadDialog campaignId={campaign.id} campaignCountry={campaign.country} agents={assignedAgents} screeningRequired={screeningRequired} />
            </div>
          </div>

          <TableWrap label="Campaign leads">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">City</th>
                  <th className="px-3 py-2 font-medium">Assigned to</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Screening</th>
                  <th className="px-3 py-2 font-medium">Attempts</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(leads ?? []).map((l) => {
                  const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || l.full_name;
                  const custom = { ...((l.custom as Record<string, unknown> | null) ?? {}) };
                  if (l.agent_notes) custom.agent_notes = l.agent_notes;
                  if (l.source) custom.source_sheet = l.source;
                  return (
                    <tr key={l.id} className="h-[38px] border-b border-line last:border-0">
                      <td className="px-3 py-1.5 font-medium text-ink">{name || EMPTY}</td>
                      <td className="px-3 py-1.5 tabular">{l.phone_e164}</td>
                      <td className="max-w-[160px] truncate px-3 py-1.5 text-muted">{l.company_name ?? EMPTY}</td>
                      <td className="max-w-[180px] truncate px-3 py-1.5 text-muted">{l.email ?? EMPTY}</td>
                      <td className="px-3 py-1.5 text-muted">{l.city ?? EMPTY}</td>
                      <td className="px-3 py-1.5 text-muted">
                        {l.assigned_to ? (nameById.get(l.assigned_to) ?? EMPTY) : <span className="text-warning">Unassigned</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant="neutral">{l.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant={SCREENING_BADGE[l.screening_status] ?? "neutral"}>{l.screening_status}</Badge>
                      </td>
                      <td className="px-3 py-1.5 tabular text-muted">
                        {l.attempts} / {campaign.max_attempts}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <LeadDetailsDialog
                            leadName={name || l.phone_e164 || "Lead"}
                            custom={custom}
                            contact={{
                              email: l.email,
                              company_name: l.company_name,
                              job_title: l.job_title,
                              address_line1: l.address_line1,
                              city: l.city,
                              region: l.region,
                              postcode: l.postcode,
                            }}
                          />
                          <SendEmailButton leadId={l.id} hasEmail={Boolean(l.email)} templates={approvedTemplates} />
                          <LeadRowActions
                            leadId={l.id}
                            screeningStatus={l.screening_status}
                            assignedTo={l.assigned_to}
                            agents={assignedAgents.map((a) => ({ id: a.id, name: a.name }))}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(leads ?? []).length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted">
                      No leads yet. Upload a file, add one by hand, or post to the inbound webhook.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>

          <p className="mt-3 text-[11px] text-muted">
            {screeningRequired
              ? "A lead becomes dialable once it has passed screening and the campaign is live."
              : "A lead is dialable as soon as the campaign is live (screening is optional in this workspace)."}{" "}
            Assigned leads are served only to their agent; unassigned leads stay in the shared pool for the campaign roster.
          </p>
        </TabsContent>

        <TabsContent value="contacts">
          <TableWrap label="Phone-less contacts">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Assigned to</th>
                </tr>
              </thead>
              <tbody>
                {(contacts ?? []).map((c) => (
                  <tr key={c.id} className="h-[38px] border-b border-line last:border-0">
                    <td className="px-3 py-1.5 font-medium text-ink">{c.full_name ?? EMPTY}</td>
                    <td className="px-3 py-1.5 text-muted">{c.company_name ?? EMPTY}</td>
                    <td className="px-3 py-1.5 text-muted">{c.email ?? EMPTY}</td>
                    <td className="px-3 py-1.5 text-muted">
                      {c.assigned_to ? (nameById.get(c.assigned_to) ?? EMPTY) : <span className="text-warning">Unassigned</span>}
                    </td>
                  </tr>
                ))}
                {(contacts ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted">
                      No contacts waiting for a phone number.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
          <p className="mt-3 text-[11px] text-muted">
            The assigned agent adds a number from the Call sheet; it is then checked against suppression and enters the lead
            list{screeningRequired ? " as unscreened" : ""}.
          </p>
        </TabsContent>

        <TabsContent value="templates">
          <div className="mb-3 flex justify-end">
            <Link href="/admin/settings/email" className="text-xs text-brand-blue hover:underline">
              Manage templates in Settings
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(templates ?? []).map((t) => (
              <Card key={t.id} className="animate-slide-up">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>{t.name}</CardTitle>
                  {t.approved ? <Badge variant="confirm">Approved</Badge> : <Badge variant="warning">Pending approval</Badge>}
                </CardHeader>
                <CardContent className="text-xs text-muted">
                  <div className="mb-1 font-medium text-ink">{t.subject}</div>
                  <div className="line-clamp-3">{t.body_md}</div>
                </CardContent>
              </Card>
            ))}
            {(templates ?? []).length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
                No templates yet. Agents can only send approved templates, never free-form mail.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

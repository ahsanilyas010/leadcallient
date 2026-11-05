import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/guide/empty-state";
import { OpenDialogButton } from "@/components/guide/open-dialog-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BRAND } from "@/lib/brand";
import { countryLabel } from "@/lib/campaign-options";
import { CreateCampaignDialog } from "./create-campaign-dialog";
import { CreateClientDialog, EditClientDialog } from "./client-dialogs";
import { InboundWebhookPanel } from "./inbound-webhook-panel";
import { EMPTY, plural } from "@/lib/format";
import { TableWrap } from "@/components/ui/data-table";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS_BADGE = {
  active: { variant: "confirm", label: "Live" },
  paused: { variant: "neutral", label: "Paused" },
  archived: { variant: "warning", label: "Archived" },
} as const;

export default async function CampaignsPage() {
  const profile = await requireRole(["super_admin", "ops_manager", "data_manager"]);
  const supabase = await createRealClient();

  const [{ data: campaigns }, { data: clients }, { data: tokenRow }, { data: rosters }] =
    await Promise.all([
      supabase.from("campaigns").select("*").eq("workspace_id", profile.workspace_id).order("created_at", { ascending: false }),
      supabase.from("clients").select("*").eq("workspace_id", profile.workspace_id).order("name"),
      supabase.from("lead_intake_tokens").select("token_prefix, last_used_at").eq("workspace_id", profile.workspace_id).maybeSingle(),
      supabase.from("campaign_assignments").select("campaign_id").eq("workspace_id", profile.workspace_id),
    ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const rosterCount = new Map<string, number>();
  for (const r of rosters ?? []) rosterCount.set(r.campaign_id, (rosterCount.get(r.campaign_id) ?? 0) + 1);

  // Per-campaign lead counts (head-only count queries, one per campaign).
  const leadCounts = new Map<string, number>();
  await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id);
      leadCounts.set(c.id, count ?? 0);
    }),
  );

  return (
    <div className="p-4">
      <Tabs defaultValue="campaigns">
        <div className="mb-4 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="webhook">Inbound webhook</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="campaigns">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted">{campaigns?.length ?? 0} campaigns · one country per campaign</p>
            <CreateCampaignDialog clients={clients ?? []} hideTrigger={(campaigns ?? []).length === 0} openEvent="guide:new-campaign" />
          </div>

          {(campaigns ?? []).length === 0 ? (
            <EmptyState
              testId="campaigns-empty"
              icon={Megaphone}
              title="Create your first campaign"
              action={
                <OpenDialogButton event="guide:new-campaign" icon={<Megaphone className="h-4 w-4" />}>
                  Create your first campaign
                </OpenDialogButton>
              }
            >
              A campaign is one calling project. It holds the leads, the script, the calling hours and the agents working it. Once it exists, bring leads in with Upload leads.
              {(clients ?? []).length === 0
                ? " Every campaign belongs to a client, the company you are calling for. You can create the client in the same step (use your own company if you call for yourself)."
                : ""}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(campaigns ?? []).map((c) => {
                const s = STATUS_BADGE[c.status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.paused;
                return (
                  <Link
                    key={c.id}
                    href={`/admin/campaigns/${c.id}`}
                    className="animate-slide-up block rounded-lg border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-ink">{c.name}</div>
                        <div className="tabular text-xs text-muted">{c.code ?? "No code"}</div>
                      </div>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <Badge variant="blue">{countryLabel(c.country)}</Badge>
                      <Badge variant="neutral">{c.audience}</Badge>
                      {c.vertical && <Badge variant="neutral">{c.vertical.replace(/_/g, " ")}</Badge>}
                      {c.recording_enabled && <Badge variant="warning">Recording</Badge>}
                    </div>
                    <div className="space-y-1 text-xs text-muted">
                      <div>Client: {c.client_id ? (clientName.get(c.client_id) ?? EMPTY) : EMPTY}</div>
                      <div>
                        {plural(leadCounts.get(c.id) ?? 0, "lead")} · {plural(rosterCount.get(c.id) ?? 0, "agent")}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="clients">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted">{clients?.length ?? 0} clients</p>
            <CreateClientDialog />
          </div>

          <TableWrap label="Campaigns">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Controller</th>
                  <th className="px-3 py-2 font-medium">DPA signed</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(clients ?? []).map((c) => (
                  <tr key={c.id} className="h-[38px] border-b border-line last:border-0">
                    <td className="px-3 py-1.5 font-medium text-ink">{c.name}</td>
                    <td className="px-3 py-1.5 text-muted">{c.country ?? EMPTY}</td>
                    <td className="px-3 py-1.5 text-muted">
                      {c.contact_email ? (
                        <>
                          {c.contact_name ? `${c.contact_name} · ` : ""}
                          {c.contact_email}
                        </>
                      ) : (
                        <span className="text-warning">Not set</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {c.is_data_controller ? (
                        <Badge variant="blue">Client</Badge>
                      ) : (
                        <Badge variant="neutral">{BRAND.processorBadgeLabel}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-muted">
                      {c.dpa_signed_on ?? <span className="text-warning">Not on file</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <EditClientDialog client={c} />
                    </td>
                  </tr>
                ))}
                {(clients ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                      No clients yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </TabsContent>

        <TabsContent value="webhook">
          <InboundWebhookPanel
            tokenPrefix={tokenRow?.token_prefix ?? null}
            lastUsedAt={tokenRow?.last_used_at ?? null}
            exampleCampaignId={campaigns?.[0]?.id ?? null}
          />
          <p className="mt-3 text-xs text-muted">
            Bulk imports and vendor feeds live under <Link href="/admin/data" className="text-brand-blue hover:underline">Data</Link>.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { clientLogoUrl } from "@/lib/client-logo";
import { countryLabel } from "@/lib/campaign-options";
import { Badge } from "@/components/ui/badge";
import { ClientLogoImg } from "@/components/ui/client-logo-img";

export const metadata: Metadata = { title: "Campaign settings", robots: { index: false, follow: false } };

const STATUS = { active: "Live", paused: "Paused", archived: "Archived" } as const;

// One row per campaign with its own settings at a glance: client and logo,
// country, calling window, attempts, recording. Each opens that campaign's page
// to change them.
export default async function CampaignSettingsPage() {
  const profile = await requireRole(["super_admin", "ops_manager"]);
  const supabase = await createRealClient();
  const [{ data: campaigns }, { data: clients }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("workspace_id", profile.workspace_id).order("name"),
    supabase.from("clients").select("id, name").eq("workspace_id", profile.workspace_id),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Campaign settings</h1>
      <p className="mt-1 text-sm text-muted">
        Calling hours, attempts, caller ID, scripts, screening and auto-assign are set per campaign. Open one to change it.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {(campaigns ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex h-10 w-20 items-center justify-center rounded-lg border border-line bg-canvas text-[10px] text-muted">
              {c.client_id ? <ClientLogoImg src={clientLogoUrl(profile.workspace_id, c.client_id)} fallback="No logo" /> : "No client"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-ink">
                {c.name}
                <Badge variant={c.status === "active" ? "confirm" : "neutral"}>{STATUS[c.status as keyof typeof STATUS] ?? c.status}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {c.client_id ? (clientName.get(c.client_id) ?? "Client") : "No client"} · {c.country ? countryLabel(c.country) : "No country"} ·{" "}
                {c.calling_window_start && c.calling_window_end ? `${c.calling_window_start.slice(0, 5)}-${c.calling_window_end.slice(0, 5)} ${c.timezone}` : "No calling window"} ·{" "}
                {c.max_attempts} attempts · screening {c.require_screening === null ? "follows the workspace" : c.require_screening ? "required" : "optional"} ·
                auto-assign {c.auto_assign_new ? "on" : "off"}
              </div>
            </div>
            <Link href={`/admin/campaigns/${c.id}`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas">
              Open settings
            </Link>
          </li>
        ))}
        {(campaigns ?? []).length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">No campaigns yet.</li>
        )}
      </ul>
    </div>
  );
}

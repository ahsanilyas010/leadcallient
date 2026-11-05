import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { DuplicateGroups, type DupLead } from "./duplicate-groups";

export const metadata: Metadata = { title: "Duplicates", robots: { index: false, follow: false } };

// Data cleanup: leads that share a phone number or an email, grouped, with a
// merge per group.
export default async function DuplicatesPage() {
  const profile = await requireRole(["super_admin", "ops_manager", "data_manager"]);
  const supabase = await createRealClient();
  const { data: groups, error } = await supabase.rpc("duplicate_lead_groups", { p_limit: 200 });
  const ids = [...new Set((groups ?? []).flatMap((g) => g.lead_ids))];
  const leads: DupLead[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from("leads")
      .select("id, full_name, company_name, phone_e164, email, campaign_id, assigned_to, status, attempts, tags, created_at")
      .in("id", ids.slice(i, i + 300));
    leads.push(...((data ?? []) as DupLead[]));
  }
  const [{ data: campaigns }, { data: people }] = await Promise.all([
    supabase.from("campaigns").select("id, name").eq("workspace_id", profile.workspace_id),
    supabase.from("profiles").select("id, full_name").eq("workspace_id", profile.workspace_id),
  ]);

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Duplicates</h1>
          <p className="max-w-3xl text-xs text-muted">
            Leads that share a phone number or an email address. Pick the one to keep in each group and merge: its empty fields are filled
            from the others, their tags, extra information, notes, calls and callbacks move onto it, and the others go to the trash (you can
            restore them from there).
          </p>
        </div>
        <Link href="/admin/leads" className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-canvas">
          Back to Leads
        </Link>
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error.message}
        </p>
      )}
      <DuplicateGroups
        groups={(groups ?? []).map((g) => ({ matchOn: g.match_on as "phone" | "email", value: g.match_value, ids: g.lead_ids }))}
        leads={leads}
        campaignName={Object.fromEntries((campaigns ?? []).map((c) => [c.id, c.name]))}
        personName={Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]))}
        timezone={profile.timezone}
      />
    </div>
  );
}

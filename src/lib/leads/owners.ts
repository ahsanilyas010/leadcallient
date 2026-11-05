import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";

// People a lead can be handed to (guard_lead_assignment enforces the same
// roles): active agents, team leads and managers. Never a Data-only, lead gen,
// QA or client login.
export const OWNER_ROLES = ["agent", "team_lead", "ops_manager", "super_admin"] as const;

export async function loadOwnerOptions(
  supabase: SupabaseClient<RealDatabase>,
  workspaceId: string,
): Promise<{ id: string; name: string; role: string }[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("workspace_id", workspaceId)
    .in("role", [...OWNER_ROLES])
    .eq("is_active", true)
    .order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name, role: p.role }));
}

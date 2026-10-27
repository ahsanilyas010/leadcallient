import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";

// Only agents use a paid seat. Admins, managers, team leads, QA analysts and
// client logins are free on every plan. Real-Postgres version, for Phase
// 1's new surfaces (People page) — src/lib/accounts/limits.ts
// has the original in-memory-store version the pre-existing CRM pages use.
export async function activeAgentCount(supabase: SupabaseClient<RealDatabase>, workspaceId: string): Promise<number> {
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "agent")
    .eq("is_active", true);
  return count ?? 0;
}

export function seatLimitMessage(seats: number) {
  return `Your plan includes ${seats} agent${seats === 1 ? "" : "s"}, and they're all in use. Add more under Agents & billing to create more agents.`;
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";
import { isUnlimitedSeats } from "@/lib/plan";

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

// True when one more active agent would exceed the workspace's seats. Always
// false for a workspace with unlimited seats (see UNLIMITED_SEATS).
export function seatsFull(used: number, seatLimit: number): boolean {
  return !isUnlimitedSeats(seatLimit) && used >= seatLimit;
}

// Seats still free to hand out. Unlimited workspaces report the sentinel
// itself so every `seatsLeft <= 0` check in the dialogs stays false.
export function seatsRemaining(used: number, seatLimit: number): number {
  return isUnlimitedSeats(seatLimit) ? seatLimit : Math.max(0, seatLimit - used);
}

export function seatLimitMessage(seats: number) {
  return `Your plan includes ${seats} agent${seats === 1 ? "" : "s"}, and they're all in use. Add more under Agents & billing to create more agents.`;
}

// Data-only seats (migration 117): counted separately from agent seats.
export async function activeDataSeatCount(supabase: SupabaseClient<RealDatabase>, workspaceId: string): Promise<number> {
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "data_manager")
    .eq("is_active", true);
  return count ?? 0;
}

export function dataSeatLimitMessage(seats: number) {
  return seats === 0
    ? "Your plan doesn't include Data-only seats yet. Add them under Agents & billing to create a Data-only login."
    : `Your plan includes ${seats} Data-only seat${seats === 1 ? "" : "s"}, and they're all in use. Add more under Agents & billing.`;
}

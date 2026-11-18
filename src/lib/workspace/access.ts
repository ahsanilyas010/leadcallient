import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase, RealTables } from "@/lib/supabase/real-types";
import { accessState, type AccessState } from "@/lib/access";

type WorkspaceRow = Pick<
  RealTables<"workspaces">,
  "is_demo" | "seat_limit" | "stripe_subscription_id" | "trial_ends_at" | "access_approved_at"
>;

export const ACCESS_COLUMNS = "is_demo, seat_limit, stripe_subscription_id, trial_ends_at, access_approved_at";

export function accessFromRow(w: WorkspaceRow, now = Date.now()): AccessState {
  return accessState(
    {
      isDemo: w.is_demo,
      seatLimit: w.seat_limit,
      hasSubscription: Boolean(w.stripe_subscription_id),
      trialEndsAt: w.trial_ends_at,
      accessApprovedAt: w.access_approved_at,
    },
    now,
  );
}

// One small read of the signed-in member's own workspace row (RLS lets a
// member read it). A missing row counts as full access so a transient error
// never locks a paying customer out; the sign-in itself is still enforced.
export async function workspaceAccess(supabase: SupabaseClient<RealDatabase>, workspaceId: string): Promise<AccessState> {
  const { data } = await supabase.from("workspaces").select(ACCESS_COLUMNS).eq("id", workspaceId).maybeSingle();
  if (!data) return { kind: "full", reason: "no_trial" };
  return accessFromRow(data as WorkspaceRow);
}

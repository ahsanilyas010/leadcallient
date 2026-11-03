"use server";

import { revalidatePath } from "next/cache";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentWorkspace } from "@/lib/workspace/current";

// Permanently removes a login. Deactivation (src/lib/actions/deactivate.ts)
// stays the default because a person's calls, QA scores and attendance point
// at their id; this exists for accounts that never did anything — a typo'd
// email, a duplicate, someone who never started. Deleting the auth user
// cascades to the profile; the history tables deliberately have no cascade,
// so a person with a trail is refused up front and the admin is steered back
// to Deactivate instead of silently losing records.

// (table, column) pairs that make a person part of the audit trail.
const HISTORY: [
  "calls" | "callbacks" | "call_transfers" | "qa_scores" | "zoom_meetings",
  string,
][] = [
  ["calls", "agent_id"],
  ["callbacks", "agent_id"],
  ["call_transfers", "from_user"],
  ["call_transfers", "to_user"],
  ["qa_scores", "agent_id"],
  ["qa_scores", "qa_analyst_id"],
  ["zoom_meetings", "host_id"],
  ["zoom_meetings", "created_by"],
];

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const caller = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(caller.role)) return { error: "Only admins can delete users." };

  const admin = createServiceClient();
  const workspace = await getCurrentWorkspace();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!target) return { error: "Unknown user." };
  if (target.id === caller.id) return { error: "You can't delete your own account." };
  if (target.id === workspace.created_by) return { error: "The workspace owner can't be deleted." };
  if (target.role === "super_admin" && caller.role !== "super_admin") {
    return { error: "Only a super admin can delete another super admin." };
  }

  const hasHistory = (
    await Promise.all(
      HISTORY.map(async ([table, column]) => {
        const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, userId);
        return (count ?? 0) > 0;
      }),
    )
  ).some(Boolean);
  if (hasHistory) {
    return {
      error: `${target.full_name} has call, QA or meeting history, so the account can't be deleted. Deactivate it instead: the record stays for audit and they can't sign in.`,
    };
  }

  // A team can outlive the person who led it; everything else that points at
  // a profile either cascades (campaign assignments, guide state) or is
  // nulled by its own constraint (lead assignment).
  await admin.from("teams").update({ team_lead_id: null }).eq("workspace_id", workspace.id).eq("team_lead_id", userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Some other reference we didn't anticipate (an upload, an intake token, an
    // audit row): same advice, the row is worth more than the empty seat.
    const fk = /foreign key|violates|constraint|database error/i.test(error.message);
    return {
      error: fk
        ? `${target.full_name} is referenced by other records, so the account can't be deleted. Deactivate it instead.`
        : `Couldn't delete the login: ${error.message}`,
    };
  }

  revalidatePath("/admin/people");
  revalidatePath("/admin/campaigns");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { activeAgentCount, activeDataSeatCount, dataSeatLimitMessage, seatLimitMessage, seatsFull } from "@/lib/workspace/limits";

// Deactivate, never delete. A deleted user row orphans call attempts, QA
// reviews and attendance history — the audit trail this exists for.
// seatLimit marks a reactivation refused for lack of agent seats (the People
// page opens the purchase-seats popup for it).
async function setActive(userId: string, isActive: boolean): Promise<{ error?: string; seatLimit?: boolean; seatKind?: "agent" | "data" }> {
  const caller = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(caller.role)) return { error: "Only admins can change activation state." };

  const admin = createServiceClient();
  const workspace = await getCurrentWorkspace();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!target) return { error: "Unknown user." };
  if (target.id === caller.id && !isActive) return { error: "You can't deactivate your own account." };
  if (target.id === workspace.created_by && !isActive) return { error: "The workspace owner can't be deactivated." };
  if (target.role === "super_admin" && caller.role !== "super_admin") {
    return { error: "Only a super admin can change another super admin." };
  }
  if (!isActive && target.role === "super_admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("role", "super_admin")
      .eq("is_active", true)
      .neq("id", target.id);
    if (!count) return { error: "That is the last active super admin. Make someone else a super admin first." };
  }
  if (isActive && target.role === "agent" && seatsFull(await activeAgentCount(admin, workspace.id), workspace.seat_limit)) {
    return { error: seatLimitMessage(workspace.seat_limit), seatLimit: true, seatKind: "agent" };
  }
  if (isActive && target.role === "data_manager" && seatsFull(await activeDataSeatCount(admin, workspace.id), workspace.data_seat_limit)) {
    return { error: dataSeatLimitMessage(workspace.data_seat_limit), seatLimit: true, seatKind: "data" };
  }

  const { error } = await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (error) return { error: error.message };

  // Ban/unban the Supabase Auth login too, so a deactivated person's existing
  // session can't be refreshed and they can't sign back in.
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? "none" : "87600h" });
  if (authError) {
    return { error: `Profile updated, but the login couldn't be ${isActive ? "re-enabled" : "disabled"}: ${authError.message}` };
  }

  revalidatePath("/admin/people");
  return {};
}

export async function deactivateUser(userId: string) {
  return setActive(userId, false);
}

export async function reactivateUser(userId: string) {
  return setActive(userId, true);
}

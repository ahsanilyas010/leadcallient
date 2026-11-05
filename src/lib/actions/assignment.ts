"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { ensureOnRosters } from "@/lib/leads/roster";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  assigned?: number;
}

// Managers and the Data-only role run campaigns and hand leads out (a Data-only
// user can never be on a roster or own a lead themselves: the database
// refuses both).
const MANAGER_ROLES = ["super_admin", "ops_manager", "data_manager"];
const uuid = z.string().uuid();

async function requireManager() {
  const profile = await requireProfile();
  if (!MANAGER_ROLES.includes(profile.role)) return null;
  return profile;
}

// Puts an agent (or team lead) on a campaign's roster. The roster is what
// the dial queue (next_lead_for_agent) and auto-assign read. Also used by
// the People page's "assign campaign" dialog.
export async function assignAgentToCampaign(
  campaignId: string,
  userId: string,
  dailyTarget = 20,
): Promise<ActionResult> {
  const profile = await requireManager();
  if (!profile) return { error: "Only an admin can change a campaign roster." };
  if (!uuid.safeParse(campaignId).success || !uuid.safeParse(userId).success) return { error: "Invalid request." };
  const target = Math.min(1000, Math.max(1, Math.round(dailyTarget) || 20));

  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("campaign_assignments")
    .upsert(
      { workspace_id: profile.workspace_id, campaign_id: campaignId, user_id: userId, daily_target: target },
      { onConflict: "campaign_id,user_id" },
    )
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Couldn't add that agent. The campaign or agent may not exist, or you may not have access." };
  }
  revalidatePath("/admin/campaigns", "layout");
  revalidatePath("/admin/people", "layout");
  return { ok: true };
}

export async function removeAgentFromCampaign(campaignId: string, userId: string): Promise<ActionResult> {
  const profile = await requireManager();
  if (!profile) return { error: "Only an admin can change a campaign roster." };
  // Taking someone off a roster also hands their unworked leads back: a
  // manager's call (remove_agent_from_campaign checks the same).
  if (profile.role === "data_manager") return { error: "Only an admin or ops manager can take someone off a campaign." };
  if (!uuid.safeParse(campaignId).success || !uuid.safeParse(userId).success) return { error: "Invalid request." };

  const supabase = await createRealClient();
  // Unworked leads of theirs go back to the pool; worked leads stay.
  const { data, error } = await supabase.rpc("remove_agent_from_campaign", {
    p_campaign_id: campaignId,
    p_user_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/campaigns", "layout");
  revalidatePath("/admin/people", "layout");
  return { ok: true, assigned: data ?? 0 };
}

// A campaign is only dialable while its status is 'active'.
export async function setCampaignActive(campaignId: string, isActive: boolean): Promise<ActionResult> {
  const profile = await requireManager();
  if (!profile) return { error: "Only an admin can activate a campaign." };
  if (!uuid.safeParse(campaignId).success) return { error: "Invalid request." };

  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: isActive ? "active" : "paused" })
    .eq("id", campaignId)
    .eq("workspace_id", profile.workspace_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Campaign not found, or you don't have access to it." };
  revalidatePath("/admin/campaigns", "layout");
  return { ok: true };
}

// Assign (or, with userId = null, unassign) one lead.
export async function assignLead(leadId: string, userId: string | null): Promise<ActionResult> {
  const profile = await requireManager();
  if (!profile) return { error: "Only an admin can assign leads." };
  if (!uuid.safeParse(leadId).success || (userId !== null && !uuid.safeParse(userId).success)) {
    return { error: "Invalid request." };
  }

  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ assigned_to: userId, ...(userId ? { assigned_by: profile.id } : {}) })
    .eq("id", leadId)
    .eq("workspace_id", profile.workspace_id)
    .select("id, campaign_id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "That lead couldn't be assigned. It may not exist, or you may not have access to it." };
  }
  // The agent must be on the campaign roster to be served (or even shown) the
  // lead, so assigning puts them on it.
  if (userId) {
    try {
      await ensureOnRosters(supabase, profile.workspace_id, userId, data.map((l) => l.campaign_id));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Assigned, but couldn't update the campaign roster." };
    }
  }
  revalidatePath("/admin/campaigns", "layout");
  revalidatePath("/admin/leads");
  revalidatePath("/callsheet");
  revalidatePath("/dial");
  return { ok: true };
}

// Round-robin top-up of every rostered agent toward their daily target,
// from this campaign's unassigned, screened-and-passed leads.
export async function autoAssignReadyLeads(campaignId: string): Promise<ActionResult> {
  const profile = await requireManager();
  if (!profile) return { error: "Only an admin can assign leads." };
  if (!uuid.safeParse(campaignId).success) return { error: "Invalid request." };

  const supabase = await createRealClient();
  const { count: rosterCount } = await supabase
    .from("campaign_assignments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  if (!rosterCount) return { error: "No agents are assigned to this campaign yet." };

  const { data, error } = await supabase.rpc("auto_assign_campaign_leads", { p_campaign_id: campaignId });
  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "Nothing to assign: every agent is at their target, or there are no unassigned leads that have passed screening.",
    };
  }
  revalidatePath("/admin/campaigns", "layout");
  return { ok: true, assigned: data };
}

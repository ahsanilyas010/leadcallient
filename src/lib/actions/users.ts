"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTempPassword } from "@/lib/auth/generate-password";
import { accounts, AccountError } from "@/lib/accounts";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { activeAgentCount, seatLimitMessage, seatsFull } from "@/lib/workspace/limits";
import { createRealClient } from "@/lib/supabase/real";
import { isValidTimezone } from "@/lib/timezones";
import { BRAND } from "@/lib/brand";

export interface CreateUserResult {
  error?: string;
  // True when the refusal is "no agent seats left": the People page opens the
  // purchase-seats popup instead of showing the error inline.
  seatLimit?: boolean;
  tempPassword?: string;
  fullName?: string;
}

const ROLES = ["super_admin", "ops_manager", "team_lead", "agent", "lead_gen", "qa_analyst", "client"] as const;

const createSchema = z.object({
  full_name: z.string().trim().min(1, "Name and email are required."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(ROLES),
  agent_code: z.string().trim().max(32).optional(),
  team_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  timezone: z.string().trim().refine(isValidTimezone, "Choose a time zone from the list.").default("Europe/London"),
});

// Next free agent code in the workspace's own pattern ("LC-114" -> "LC-115").
async function nextAgentCode(workspaceId: string): Promise<string> {
  const prefix = BRAND.agentCodePlaceholder.replace(/\d+$/, "") || "AG-";
  const admin = createServiceClient();
  const { data } = await admin.from("profiles").select("agent_code").eq("workspace_id", workspaceId).not("agent_code", "is", null);
  let max = 100;
  for (const r of data ?? []) {
    const m = /(\d+)$/.exec(r.agent_code ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

function blankToUndefined(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
}

// Admin-issued credentials: a one-time password the person must change at
// first sign-in. Runs with the service role (creating an auth user needs it)
// so it re-checks the caller's role and workspace itself.
export async function createUser(_prev: CreateUserResult, formData: FormData): Promise<CreateUserResult> {
  const caller = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(caller.role)) return { error: "Only admins can create users." };

  const parsed = createSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role") ?? "agent",
    agent_code: blankToUndefined(formData.get("agent_code")),
    team_id: blankToUndefined(formData.get("team_id")),
    client_id: blankToUndefined(formData.get("client_id")),
    timezone: blankToUndefined(formData.get("timezone")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const input = parsed.data;

  // Only a super admin may mint another super admin.
  if (input.role === "super_admin" && caller.role !== "super_admin") {
    return { error: "Only a super admin can create another super admin." };
  }
  if (input.role === "client" && !input.client_id) return { error: "Choose which client this login belongs to." };

  const admin = createServiceClient();
  const workspace = await getCurrentWorkspace();

  // team_id / client_id must belong to the caller's own workspace.
  if (input.team_id) {
    const { data } = await admin.from("teams").select("id").eq("id", input.team_id).eq("workspace_id", workspace.id).maybeSingle();
    if (!data) return { error: "Unknown team." };
  }
  if (input.client_id) {
    const { data } = await admin.from("clients").select("id").eq("id", input.client_id).eq("workspace_id", workspace.id).maybeSingle();
    if (!data) return { error: "Unknown client." };
  }

  if (input.role === "agent") {
    const used = await activeAgentCount(admin, workspace.id);
    if (seatsFull(used, workspace.seat_limit)) return { error: seatLimitMessage(workspace.seat_limit), seatLimit: true };
  }

  const agentCode = input.agent_code || (input.role === "agent" ? await nextAgentCode(workspace.id) : null);
  const tempPassword = generateTempPassword();
  let uid: string;
  try {
    uid = (
      await accounts().createMember({
        workspaceId: workspace.id,
        email: input.email,
        password: tempPassword,
        fullName: input.full_name,
        role: input.role,
      })
    ).uid;
  } catch (e) {
    return { error: e instanceof AccountError ? e.message : "Could not create the login. Try again." };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      agent_code: agentCode,
      team_id: input.team_id ?? null,
      client_id: input.client_id ?? null,
      timezone: input.timezone,
    })
    .eq("id", uid);
  if (updateError) return { error: `Created the login but couldn't save the profile details: ${updateError.message}` };

  await admin.from("credential_events").insert([
    { workspace_id: workspace.id, user_id: uid, actor_id: caller.id, event: "created" },
    { workspace_id: workspace.id, user_id: uid, actor_id: caller.id, event: "temp_issued" },
  ]);

  revalidatePath("/admin/people");
  return { tempPassword, fullName: input.full_name };
}

export interface ResetPasswordResult {
  error?: string;
  tempPassword?: string;
}

export async function resetPassword(_prev: ResetPasswordResult, formData: FormData): Promise<ResetPasswordResult> {
  const caller = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(caller.role)) return { error: "Only admins can reset passwords." };

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Missing user." };

  const admin = createServiceClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .eq("workspace_id", caller.workspace_id)
    .maybeSingle();
  if (!target) return { error: "Unknown user." };
  if (target.role === "super_admin" && caller.role !== "super_admin") {
    return { error: "Only a super admin can reset another super admin's password." };
  }

  const tempPassword = generateTempPassword();
  try {
    await accounts().setPassword(userId, tempPassword);
    await accounts().updateMember(userId, { mustChangePassword: true });
  } catch (e) {
    return { error: e instanceof AccountError ? e.message : "Could not reset the password." };
  }

  await admin
    .from("credential_events")
    .insert({ workspace_id: caller.workspace_id, user_id: userId, actor_id: caller.id, event: "reset_by_admin" });
  return { tempPassword };
}

export interface AssignResult {
  error?: string;
  ok?: boolean;
}

// People row menu: put an agent on a campaign's roster.
export async function assignPersonToCampaign(campaignId: string, userId: string): Promise<AssignResult> {
  const caller = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(caller.role)) return { error: "Only admins can assign people to campaigns." };

  const supabase = await createRealClient();
  const [{ data: campaign }, { data: person }] = await Promise.all([
    supabase.from("campaigns").select("id").eq("id", campaignId).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", userId).maybeSingle(),
  ]);
  if (!campaign || !person) return { error: "Unknown campaign or person." };
  if (person.role !== "agent") return { error: "Only agents are assigned to campaigns." };

  const { error } = await supabase
    .from("campaign_assignments")
    .upsert(
      { workspace_id: caller.workspace_id, campaign_id: campaignId, user_id: userId },
      { onConflict: "campaign_id,user_id", ignoreDuplicates: true },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/people");
  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export interface TeamResult {
  error?: string;
  team?: { id: string; name: string };
}

// Inline "+ Create team" in the user forms.
export async function createTeam(name: string): Promise<TeamResult> {
  const caller = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(caller.role)) return { error: "Only admins can create teams." };
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2) return { error: "Give the team a name (at least 2 characters)." };
  if (clean.length > 60) return { error: "Team names are at most 60 characters." };
  const admin = createServiceClient();
  const { data: dup } = await admin.from("teams").select("id").eq("workspace_id", caller.workspace_id).ilike("name", clean).maybeSingle();
  if (dup) return { error: "A team with that name already exists." };
  const { data, error } = await admin.from("teams").insert({ workspace_id: caller.workspace_id, name: clean }).select("id, name").single();
  if (error || !data) return { error: error?.message ?? "Could not create the team." };
  revalidatePath("/admin/people");
  return { team: data };
}

export interface UpdateUserResult {
  error?: string;
  // See CreateUserResult.seatLimit.
  seatLimit?: boolean;
  ok?: boolean;
}

const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1, "Name is required.").max(120),
  role: z.enum(ROLES),
  agent_code: z.string().trim().max(32).optional(),
  team_id: z.string().uuid().optional(),
  timezone: z.string().trim().refine(isValidTimezone, "Choose a time zone from the list."),
});

// People row menu > Edit user: name, role, team, agent code and time zone.
export async function updateUser(_prev: UpdateUserResult, formData: FormData): Promise<UpdateUserResult> {
  const caller = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(caller.role)) return { error: "Only admins can edit users." };
  const parsed = updateSchema.safeParse({
    user_id: formData.get("user_id"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    agent_code: blankToUndefined(formData.get("agent_code")),
    team_id: blankToUndefined(formData.get("team_id")),
    timezone: blankToUndefined(formData.get("timezone")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const input = parsed.data;

  const admin = createServiceClient();
  const workspace = await getCurrentWorkspace();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", input.user_id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!target) return { error: "Unknown user." };

  const roleChanged = target.role !== input.role;
  if (roleChanged) {
    if (target.id === caller.id) return { error: "You can't change your own role." };
    if (target.id === workspace.created_by) return { error: "The workspace owner's role can't be changed." };
    if (input.role === "super_admin" && caller.role !== "super_admin") return { error: "Only a super admin can make another super admin." };
    if (target.role === "super_admin" && caller.role !== "super_admin") return { error: "Only a super admin can change another super admin." };
    if (input.role === "client") return { error: "Create a new client login instead: it has to be tied to a client." };
    if (input.role === "agent" && target.is_active && seatsFull(await activeAgentCount(admin, workspace.id), workspace.seat_limit)) {
      return { error: seatLimitMessage(workspace.seat_limit), seatLimit: true };
    }
  } else if (target.role === "super_admin" && caller.role !== "super_admin") {
    return { error: "Only a super admin can edit another super admin." };
  }
  if (input.team_id) {
    const { data } = await admin.from("teams").select("id").eq("id", input.team_id).eq("workspace_id", workspace.id).maybeSingle();
    if (!data) return { error: "Unknown team." };
  }

  try {
    await accounts().updateMember(input.user_id, { fullName: input.full_name, role: input.role });
  } catch (e) {
    return { error: e instanceof AccountError ? e.message : "Could not save the changes." };
  }
  const { error } = await admin
    .from("profiles")
    .update({ agent_code: input.agent_code ?? null, team_id: input.team_id ?? null, timezone: input.timezone })
    .eq("id", input.user_id);
  if (error) return { error: error.code === "23505" ? "That agent code is already used by someone else." : error.message };

  revalidatePath("/admin/people");
  return { ok: true };
}

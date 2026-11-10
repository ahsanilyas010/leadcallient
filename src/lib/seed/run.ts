import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";
import { DEMO_PASSWORD, DEMO_PERSONAS } from "./personas";
import { UNLIMITED_SEATS } from "@/lib/plan";

type Admin = SupabaseClient<RealDatabase>;

async function findAuthUserByEmail(admin: Admin, email: string): Promise<User | null> {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) throw error ?? new Error(`seed: could not list users while resolving ${email}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
}

async function ensureAuthUser(admin: Admin, email: string, password: string, fullName: string): Promise<User> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!error && data.user) return data.user;
  if (error && error.code !== "email_exists") throw error;

  const existing = await findAuthUserByEmail(admin, email);
  if (!existing) throw new Error(`seed: could not create or find auth user ${email}`);
  return existing;
}

// Platform admins (Assorted's own staff) are provisioned deliberately, not
// auto-created with a shared password — invite them first (Supabase
// Dashboard -> Authentication, or auth.admin.inviteUserByEmail), then this
// just attaches the platform_admins row to their existing auth user.
export async function seedPlatformAdmins(admin: Admin): Promise<number> {
  const emails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  let count = 0;
  for (const email of emails) {
    const user = await findAuthUserByEmail(admin, email);
    if (!user) {
      console.warn(`seed: platform admin ${email} has no auth user yet - invite them, then re-run seed.`);
      continue;
    }
    const { error } = await admin
      .from("platform_admins")
      .upsert({ id: user.id, email, full_name: (user.user_metadata?.full_name as string | undefined) ?? null });
    if (error) throw error;
    count++;
  }
  return count;
}

// The vendor's own live workspace, seeded once from env vars — the only
// workspace that ever reads ASSORTED_ADMIN_* directly. After this
// runs it behaves like any other workspace (spec: "This is the only
// workspace that reads env vars, and only at seed time").
export async function seedAssortedWorkspace(admin: Admin): Promise<string | null> {
  const email = process.env.ASSORTED_ADMIN_EMAIL;
  const password = process.env.ASSORTED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("seed: ASSORTED_ADMIN_EMAIL/ASSORTED_ADMIN_PASSWORD not set - skipping the assorted workspace.");
    return null;
  }

  const { data: existing } = await admin.from("workspaces").select("id").eq("slug", "assorted").maybeSingle();
  if (existing) {
    console.log("seed: assorted workspace already exists - skipping creation.");
    return existing.id;
  }

  const user = await ensureAuthUser(admin, email, password, "Assorted Admin");
  // Dogfoods the exact RPC production signup uses.
  const { error } = await admin.rpc("create_workspace_with_owner", {
    p_user_id: user.id,
    p_email: email,
    p_full_name: "Assorted Admin",
    p_workspace_name: "Assorted",
    p_slug: "assorted",
  });
  if (error) throw error;

  const { data: ws, error: wsErr } = await admin.from("workspaces").select("id").eq("slug", "assorted").single();
  if (wsErr || !ws) throw wsErr ?? new Error("seed: assorted workspace not found after creation");

  // The vendor's own workspace never hits the agent seat cap (see migration 115).
  await admin.from("workspaces").update({ status: "active", seat_limit: UNLIMITED_SEATS, trial_ends_at: null }).eq("id", ws.id);

  return ws.id;
}

// Filler leads sit on a disjoint number range from anything an operator
// would plausibly put in DEMO_ALLOWED_NUMBERS, so they can never
// accidentally become real-callable.
function fillerPhone(n: number): string {
  return `+1555000${String(n).padStart(4, "0")}`;
}

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

async function clearDemoWorkspaceContent(admin: Admin, workspaceId: string) {
  // Children first. Profiles are left alone — they're upserted back onto
  // the same 6 fixed auth ids below, not recreated.
  // Profiles point at their team/client; detach them so those can be deleted.
  await admin.from("profiles").update({ team_id: null, client_id: null }).eq("workspace_id", workspaceId);
  await admin.from("call_transfers").delete().eq("workspace_id", workspaceId);
  await admin.from("callbacks").delete().eq("workspace_id", workspaceId);
  await admin.from("calls").delete().eq("workspace_id", workspaceId);
  await admin.from("campaign_assignments").delete().eq("workspace_id", workspaceId);
  await admin.from("leads").delete().eq("workspace_id", workspaceId);
  await admin.from("lead_batches").delete().eq("workspace_id", workspaceId);
  await admin.from("campaigns").delete().eq("workspace_id", workspaceId);
  await admin.from("clients").delete().eq("workspace_id", workspaceId);
  await admin.from("teams").delete().eq("workspace_id", workspaceId);
}

export interface SeedDemoOptions {
  reset?: boolean;
}

// The demo workspace: is_demo=true, 3 campaigns, 6 users (one per role),
// 500 fake leads on a disjoint number range, plus one real lead per
// DEMO_ALLOWED_NUMBERS entry so test calls can be placed once Phase 3
// wires up the dialer. Idempotent — safe to call repeatedly, and
// { reset: true } wipes campaign/lead/team/client content first (never
// profiles, which just get upserted back onto their fixed auth ids).
export async function seedDemoWorkspace(admin: Admin, opts: SeedDemoOptions = {}): Promise<string> {
  const allowedNumbers = (process.env.DEMO_ALLOWED_NUMBERS ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  let { data: workspace } = await admin.from("workspaces").select("*").eq("slug", "demo").maybeSingle();

  if (!workspace) {
    const { data: created, error } = await admin
      .from("workspaces")
      .insert({ slug: "demo", name: "Demo", is_demo: true, status: "active", plan: "free", seat_limit: 50, trial_ends_at: null })
      .select("*")
      .single();
    if (error || !created) throw error ?? new Error("seed: failed to create demo workspace");
    workspace = created;
  } else if (opts.reset) {
    await clearDemoWorkspaceContent(admin, workspace.id);
  }

  const profileByRole = new Map<AppRole, string>();
  for (const persona of DEMO_PERSONAS) {
    const user = await ensureAuthUser(admin, persona.email, DEMO_PASSWORD, persona.fullName);
    const { error } = await admin.from("profiles").upsert({
      id: user.id,
      workspace_id: workspace.id,
      email: persona.email,
      full_name: persona.fullName,
      role: persona.role,
      must_change_password: false,
    });
    if (error) throw error;
    profileByRole.set(persona.role, user.id);
  }

  // Idempotent: the demo content (team, client, campaigns, leads) is only
  // created once. Re-running the seed without --reset must not stack copies.
  if (!opts.reset) {
    const { count } = await admin.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id);
    if ((count ?? 0) > 0) return workspace.id;
  }

  const superAdminId = profileByRole.get("super_admin")!;
  const teamLeadId = profileByRole.get("team_lead")!;
  const agentId = profileByRole.get("agent")!;
  const clientProfileId = profileByRole.get("client")!;

  const { data: team } = await admin
    .from("teams")
    .insert({ workspace_id: workspace.id, name: "Falcons", team_lead_id: teamLeadId })
    .select("id")
    .single();
  if (team) {
    await admin.from("profiles").update({ team_id: team.id }).in("id", [teamLeadId, agentId]);
  }

  const { data: client } = await admin
    .from("clients")
    .insert({ workspace_id: workspace.id, name: "Northgate Home Services", country: "US" })
    .select("id")
    .single();
  if (client) {
    await admin.from("profiles").update({ client_id: client.id }).eq("id", clientProfileId);
  }

  const campaignSeeds = [
    { name: "Home Insulation - Northeast", vertical: "home_improvement", country: "US", timezone: "America/New_York" },
    { name: "Solar Consultation - Southwest", vertical: "solar", country: "US", timezone: "America/Phoenix" },
    { name: "Boiler Cover Renewal - UK", vertical: "home_services", country: "GB", timezone: "Europe/London" },
  ];
  const campaignIds: string[] = [];
  for (const c of campaignSeeds) {
    const { data: campaign } = await admin
      .from("campaigns")
      .insert({
        workspace_id: workspace.id,
        client_id: client?.id ?? null,
        name: c.name,
        vertical: c.vertical,
        country: c.country,
        timezone: c.timezone,
        max_attempts: 6,
        cooling_off_hours: 24,
        disclosure_script:
          "Hi, this is {agent_name} calling on behalf of {client_name} about {campaign_topic}. Is now a good time?",
      })
      .select("id")
      .single();
    if (campaign) campaignIds.push(campaign.id);
  }

  if (campaignIds[0]) {
    await admin.from("campaign_assignments").insert([
      { workspace_id: workspace.id, campaign_id: campaignIds[0], user_id: agentId },
      { workspace_id: workspace.id, campaign_id: campaignIds[0], user_id: teamLeadId },
    ]);
  }

  const { data: batch } = await admin
    .from("lead_batches")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaignIds[0] ?? null,
      source: "demo seed",
      uploaded_by: superAdminId,
      row_count: 500 + allowedNumbers.length,
      status: "ready",
      screened_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // Pre-screened (screening_status='passed') so the compliance gate
  // (next_lead_for_agent, migration 050) has something dialable to
  // demonstrate immediately, rather than every demo lead starting
  // 'pending' and never surfacing until someone runs the screening step.
  const now = new Date().toISOString();
  const fillerLeads = Array.from({ length: 500 }, (_, i) => ({
    workspace_id: workspace!.id,
    campaign_id: campaignIds[0] ?? null,
    batch_id: batch?.id ?? null,
    phone_e164: fillerPhone(i + 1),
    full_name: `Demo Lead ${i + 1}`,
    screening_status: "passed" as const,
    screened_at: now,
  }));
  const allowedLeads = allowedNumbers.map((phone, i) => ({
    workspace_id: workspace!.id,
    campaign_id: campaignIds[0] ?? null,
    batch_id: batch?.id ?? null,
    phone_e164: phone,
    full_name: `Callable Test Lead ${i + 1}`,
    screening_status: "passed" as const,
    screened_at: now,
  }));

  for (const chunk of chunks([...fillerLeads, ...allowedLeads], 200)) {
    const { error } = await admin.from("leads").insert(chunk);
    if (error) throw error;
  }

  return workspace.id;
}

type AppRole = RealDatabase["public"]["Enums"]["app_role"];

// `npm run test:callsheet` (tsx scripts/callsheet-proof.ts).
//
// Proves the call sheet against the live database: call_sheet() visibility per
// role (agents see their own + unassigned leads, never another agent's; lead
// gen / QA denied; managers see everything), the urgency bucket, the exact
// reason a lead cannot be dialled (lead_dial_block_reason), and
// claim_lead_for_call (allowed, refused with the same reason, held by someone
// else, and a two-agent race on the same lead where exactly one wins).
// next_lead_for_agent is not touched by this feature: run `npm run
// test:compliance` for that gate.
//
// Runs in the throwaway "ZZ Signup Test Co" workspace (status set to 'active'
// for the run and restored). Everything it creates is removed by id.

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";
import { DEMO_PASSWORD } from "@/lib/seed/personas";
import { createHash } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc = createClient<RealDatabase>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
const check = (c: boolean, label: string, detail?: unknown) => {
  if (c) console.log(`  ok    ${label}`);
  else {
    console.error(`  FAIL  ${label}${detail !== undefined ? ` - ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
    failures++;
  }
};
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function signIn(email: string, password: string) {
  const c: SupabaseClient<RealDatabase> = createClient<RealDatabase>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in ${email}: ${error?.message}`);
  return { c, id: data.user.id };
}

async function main() {
  const { data: zz } = await svc.from("profiles").select("id, email, workspace_id").like("email", "zz-signup-%").limit(1).single();
  if (!zz) throw new Error("ZZ Signup Test Co owner not found");
  const wsId = zz.workspace_id;
  const { data: ws } = await svc.from("workspaces").select("status, is_demo, require_screening").eq("id", wsId).single();
  if (!ws || ws.is_demo) throw new Error("expected a non-demo ZZ workspace");
  const originalStatus = ws.status;
  // The "Not screened yet" assertions below describe the gate with screening
  // required (migration 113 made it optional per workspace); restored at the end.
  const originalRequireScreening = ws?.require_screening ?? false;
  await svc.from("workspaces").update({ status: "active", require_screening: true }).eq("id", wsId);

  const tag = `cs-${Date.now()}`;
  const stamp = String(Date.now()).slice(-6);
  const phone = (n: number) => `+447700${`9${stamp.slice(0, 3)}${String(n).padStart(2, "0")}`}`;
  const created = { users: [] as string[], campaigns: [] as string[], leads: [] as string[], clients: [] as string[], contacts: [] as string[], supp: [] as string[] };

  try {
    const mkUser = async (role: "agent" | "lead_gen" | "qa_analyst" | "ops_manager") => {
      const email = `${tag}-${role}-${created.users.length}@leadcallient.demo`;
      const { data: u, error } = await svc.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
      if (error || !u.user) throw new Error(`temp ${role}: ${error?.message}`);
      created.users.push(u.user.id);
      const { error: pe } = await svc.from("profiles").insert({ id: u.user.id, workspace_id: wsId, email, full_name: `Proof ${role}`, role, must_change_password: false });
      if (pe) throw new Error(`temp ${role} profile: ${pe.message}`);
      return { ...(await signIn(email, DEMO_PASSWORD)) };
    };
    const agA = await mkUser("agent");
    const agB = await mkUser("agent");
    const lg = await mkUser("lead_gen");
    const qa = await mkUser("qa_analyst");
    const mgr = await mkUser("ops_manager");

    const { data: client } = await svc.from("clients").insert({ workspace_id: wsId, name: `${tag} client` }).select("id").single();
    created.clients.push(client!.id);
    const mkCampaign = async (name: string, status: "active" | "paused", extra: Record<string, unknown> = {}) => {
      const { data, error } = await svc
        .from("campaigns")
        .insert({ workspace_id: wsId, client_id: client!.id, name, country: "GB", timezone: "Europe/London", status, max_attempts: 3, cooling_off_hours: 24, ...extra })
        .select("id")
        .single();
      if (error || !data) throw new Error(`campaign ${name}: ${error?.message}`);
      created.campaigns.push(data.id);
      return data.id;
    };
    const live = await mkCampaign(`${tag} live`, "active");
    const paused = await mkCampaign(`${tag} paused`, "paused");
    for (const c of [live, paused]) {
      for (const a of [agA, agB]) {
        const { error } = await svc.from("campaign_assignments").insert({ workspace_id: wsId, campaign_id: c, user_id: a.id });
        if (error) throw new Error(`roster: ${error.message}`);
      }
    }

    const hour = 3_600_000;
    const mkLead = async (n: number, over: Record<string, unknown> = {}) => {
      const { data, error } = await svc
        .from("leads")
        .insert({
          workspace_id: wsId,
          campaign_id: live,
          phone_e164: phone(n),
          full_name: `${tag} lead ${n}`,
          source: "proof",
          screening_status: "passed",
          screened_at: new Date().toISOString(),
          ...over,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`lead ${n}: ${error?.message}`);
      created.leads.push(data.id);
      return data.id;
    };
    const overdue = await mkLead(1, { appointment_at: new Date(Date.now() - 5 * hour).toISOString() });
    const pending = await mkLead(2, { screening_status: "pending", screened_at: null });
    const theirs = await mkLead(3, { assigned_to: agB.id });
    const inPaused = await mkLead(4, { campaign_id: paused });
    const exhausted = await mkLead(5, { attempts: 3 });
    const supNum = phone(6);
    const suppressed = await mkLead(6);
    const { data: sp } = await svc.from("suppression_list").insert({ workspace_id: wsId, phone_hash: sha(supNum), reason: "proof" }).select("id").single();
    if (sp) created.supp.push(sp.id);
    const cooling = await mkLead(7, { last_attempt_at: new Date().toISOString(), attempts: 1 });
    const free = await mkLead(8);
    const race = await mkLead(9);
    const { data: contact } = await svc
      .from("unphoned_contacts")
      .insert({ workspace_id: wsId, campaign_id: live, full_name: `${tag} contact`, email: "c@example.test", country_hint: "GB", assigned_to: agA.id })
      .select("id")
      .single();
    if (contact) created.contacts.push(contact.id);

    console.log("\n1. Who can open the call sheet");
    for (const [label, who] of [["lead gen", lg], ["QA analyst", qa]] as const) {
      const r = await who.c.rpc("call_sheet", { p_limit: 100 });
      check(!!r.error, `${label} is refused`, r.error?.message);
    }

    console.log("\n2. Agent A's view");
    const a = await agA.c.rpc("call_sheet", { p_limit: 500 });
    check(!a.error, "agent can read the sheet", a.error?.message);
    const rows = a.data ?? [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    check(byId.has(overdue) && byId.has(free) && byId.has(pending), "sees unassigned leads of a campaign they are on");
    check(!byId.has(theirs), "does NOT see a lead assigned to another agent");
    check(byId.get(overdue)?.bucket === "overdue", "a past appointment is 'overdue'", byId.get(overdue)?.bucket);
    check(byId.get(free)?.bucket === "new", "a never-called lead is 'new'", byId.get(free)?.bucket);
    check(byId.get(overdue)?.dial_block_reason === null, "an eligible lead has no block reason", byId.get(overdue)?.dial_block_reason);
    check(/Not screened/i.test(byId.get(pending)?.dial_block_reason ?? ""), "unscreened lead: 'Not screened yet'", byId.get(pending)?.dial_block_reason);
    check(/paused/i.test(byId.get(inPaused)?.dial_block_reason ?? ""), "paused campaign: reason says paused", byId.get(inPaused)?.dial_block_reason);
    check(/Maximum attempts/i.test(byId.get(exhausted)?.dial_block_reason ?? ""), "attempts used up", byId.get(exhausted)?.dial_block_reason);
    check(/suppression/i.test(byId.get(suppressed)?.dial_block_reason ?? ""), "suppressed number", byId.get(suppressed)?.dial_block_reason);
    check(/Cooling-off/i.test(byId.get(cooling)?.dial_block_reason ?? ""), "cooling-off", byId.get(cooling)?.dial_block_reason);
    const c = contact ? byId.get(contact.id) : undefined;
    check(c?.kind === "contact" && c?.phone_e164 === null, "a phone-less contact appears as a contact card with no number", c);
    check(rows.every((r) => r.total_count === rows[0].total_count), "total_count is consistent");

    console.log("\n3. Manager's view");
    const m = await mgr.c.rpc("call_sheet", { p_limit: 500 });
    const mIds = new Set((m.data ?? []).map((r) => r.id));
    check(mIds.has(theirs) && mIds.has(overdue), "a manager sees every lead, including another agent's");

    console.log("\n4. claim_lead_for_call");
    const ok = await agA.c.rpc("claim_lead_for_call", { p_lead_id: overdue });
    check(!ok.error, "claim an eligible lead", ok.error?.message);
    const { data: claimed } = await svc.from("leads").select("claimed_by").eq("id", overdue).single();
    check(claimed?.claimed_by === agA.id, "the lead is claimed by the caller");
    const stolen = await agB.c.rpc("claim_lead_for_call", { p_lead_id: overdue });
    check(!!stolen.error, "another agent cannot claim a lead that is on a call", stolen.error?.message);
    const bad = await agA.c.rpc("claim_lead_for_call", { p_lead_id: pending });
    check(!!bad.error && /Not screened/i.test(bad.error.message), "an unscreened lead is refused with the reason", bad.error?.message);
    const pausedTry = await agA.c.rpc("claim_lead_for_call", { p_lead_id: inPaused });
    check(!!pausedTry.error && /paused/i.test(pausedTry.error.message), "a paused campaign is refused", pausedTry.error?.message);
    const notMine = await agA.c.rpc("claim_lead_for_call", { p_lead_id: theirs });
    check(!!notMine.error, "a lead assigned to someone else is refused", notMine.error?.message);
    const lgTry = await lg.c.rpc("claim_lead_for_call", { p_lead_id: free });
    check(!!lgTry.error, "lead gen cannot claim", lgTry.error?.message);

    console.log("\n5. Two agents race for one lead");
    const [r1, r2] = await Promise.all([
      agA.c.rpc("claim_lead_for_call", { p_lead_id: race }),
      agB.c.rpc("claim_lead_for_call", { p_lead_id: race }),
    ]);
    const wins = [r1, r2].filter((r) => !r.error).length;
    check(wins === 1, "exactly one of two simultaneous claims wins", [r1.error?.message, r2.error?.message]);
    const { data: raced } = await svc.from("leads").select("claimed_by").eq("id", race).single();
    check(raced?.claimed_by === (r1.error ? agB.id : agA.id), "the winner is the one holding the claim");
    void free;
  } finally {
    console.log("\n[cleanup]");
    try {
      if (created.contacts.length) await svc.from("unphoned_contacts").delete().in("id", created.contacts);
      if (created.leads.length) {
        await svc.from("calls").delete().in("lead_id", created.leads);
        await svc.from("callbacks").delete().in("lead_id", created.leads);
        await svc.from("leads").delete().in("id", created.leads);
      }
      if (created.campaigns.length) {
        await svc.from("campaign_assignments").delete().in("campaign_id", created.campaigns);
        await svc.from("leads").delete().in("campaign_id", created.campaigns);
        await svc.from("campaigns").delete().in("id", created.campaigns);
      }
      if (created.clients.length) await svc.from("clients").delete().in("id", created.clients);
      if (created.supp.length) await svc.from("suppression_list").delete().in("id", created.supp);
      if (created.users.length) await svc.from("profiles").delete().in("id", created.users);
      for (const u of created.users) await svc.auth.admin.deleteUser(u);
      await svc.from("workspaces").update({ status: originalStatus, require_screening: originalRequireScreening }).eq("id", wsId);
      const { count } = await svc.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId);
      console.log(`  ZZ workspace restored to '${originalStatus}'; leads left in it: ${count}`);
    } catch (e) {
      console.error("  cleanup problem:", e);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll call sheet checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

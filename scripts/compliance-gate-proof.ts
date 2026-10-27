// `npm run test:compliance` (tsx scripts/compliance-gate-proof.ts).
//
// Proves next_lead_for_agent() (supabase/migrations/00000000000050) and
// record_call_attempt() (00000000000051) enforce every condition in the
// spec's COMPLIANCE GATE section, plus the FOR UPDATE SKIP LOCKED
// concurrency guarantee. Runs against the seeded demo workspace's agent
// persona, in a throwaway campaign/lead set created and torn down by this
// script — isolated from the demo's own 500 seeded leads so results are
// deterministic regardless of what else has happened in that workspace.
//
// Run this only against a disposable/staging Supabase project seeded via
// `npm run seed`, never production.

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";
import { DEMO_PASSWORD, DEMO_PERSONAS } from "@/lib/seed/personas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok    ${label}`);
  else {
    console.error(`  FAIL  ${label}${detail ? ` - ${String(detail)}` : ""}`);
    failures++;
  }
}

async function main() {
  if (!url || !anonKey || !serviceKey) {
    console.error("compliance-gate-proof: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const admin: SupabaseClient<RealDatabase> = createClient<RealDatabase>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: workspace } = await admin.from("workspaces").select("id, demo_allowed_numbers, require_screening").eq("slug", "demo").single();
  if (!workspace) {
    console.error("compliance-gate-proof: run `npm run seed` first - demo workspace not found.");
    process.exit(1);
  }

  const agentPersona = DEMO_PERSONAS.find((p) => p.role === "agent")!;
  const { data: agentProfile } = await admin.from("profiles").select("id").eq("workspace_id", workspace.id).eq("email", agentPersona.email).single();
  if (!agentProfile) {
    console.error("compliance-gate-proof: demo agent persona not found - run `npm run seed` first.");
    process.exit(1);
  }
  const agentId = agentProfile.id;

  // The demo workspace only ever dials DEMO_ALLOWED_NUMBERS (enforced inside
  // next_lead_for_agent), so the throwaway numbers below are allow-listed for
  // the duration of the run and the original list is restored afterwards.
  const originalAllowed = workspace.demo_allowed_numbers ?? [];
  const testNumbers = Array.from({ length: 8 }, (_, i) => `+1555999000${i + 1}`);
  // Screening is optional per workspace (migration 113); the "unscreened lead is
  // never returned" assertion below is about the gate WITH screening required,
  // so it is switched on for the run and restored afterwards.
  const originalRequireScreening = workspace.require_screening;
  await admin
    .from("workspaces")
    .update({ demo_allowed_numbers: [...originalAllowed, ...testNumbers], require_screening: true })
    .eq("id", workspace.id);

  console.log("Setting up an isolated test campaign...");
  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .insert({
      workspace_id: workspace.id,
      name: "Compliance Gate Proof (throwaway)",
      max_attempts: 3,
      cooling_off_hours: 24,
    })
    .select("*")
    .single();
  if (campaignError || !campaign) throw campaignError ?? new Error("could not create test campaign");

  await admin.from("campaign_assignments").insert({ workspace_id: workspace.id, campaign_id: campaign.id, user_id: agentId });

  async function insertLead(overrides: Partial<RealDatabase["public"]["Tables"]["leads"]["Insert"]>, phone: string) {
    const { data, error } = await admin
      .from("leads")
      .insert({ workspace_id: workspace!.id, campaign_id: campaign!.id, phone_e164: phone, full_name: "Test Lead", ...overrides })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("could not insert test lead");
    // Suppression rows are keyed by a deterministic phone hash and outlive the
    // leads, so clear any left by a previous run of this script.
    await admin.from("suppression_list").delete().eq("workspace_id", workspace!.id).eq("phone_hash", data.phone_hash!);
    return data;
  }

  const unscreened = await insertLead({ screening_status: "pending" }, "+15559990001");
  const maxedOut = await insertLead({ screening_status: "passed", screened_at: new Date().toISOString(), attempts: 3 }, "+15559990002");
  const inCoolingOff = await insertLead(
    { screening_status: "passed", screened_at: new Date().toISOString(), attempts: 1, last_attempt_at: new Date().toISOString() },
    "+15559990003",
  );
  const eligible = await insertLead({ screening_status: "passed", screened_at: new Date().toISOString() }, "+15559990004");
  const suppressed = await insertLead({ screening_status: "passed", screened_at: new Date().toISOString() }, "+15559990005");
  await admin
    .from("suppression_list")
    .upsert({ workspace_id: workspace.id, phone_hash: suppressed.phone_hash!, reason: "test", added_by: agentId });

  const agentClient = createClient<RealDatabase>(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await agentClient.auth.signInWithPassword({ email: agentPersona.email, password: DEMO_PASSWORD });
  if (signInError) throw new Error(`could not sign in as ${agentPersona.email}: ${signInError.message}`);

  console.log("\n1. Compliance gate filtering");
  const { data: firstPull } = await agentClient.rpc("next_lead_for_agent", { p_agent_id: agentId });
  check("unscreened lead is never returned", firstPull?.id !== unscreened.id);
  check("a lead at max_attempts is never returned", firstPull?.id !== maxedOut.id);
  check("a lead still in its cooling-off window is never returned", firstPull?.id !== inCoolingOff.id);
  check("a suppressed lead is never returned", firstPull?.id !== suppressed.id);
  check("the one eligible lead is returned", firstPull?.id === eligible.id, firstPull?.id);

  console.log("\n2. Claim prevents re-pulling the same lead");
  const { data: secondPull } = await agentClient.rpc("next_lead_for_agent", { p_agent_id: agentId });
  // A composite-returning RPC yields an all-null row (not null) when empty.
  check("pulling again returns nothing else eligible", !secondPull?.id, secondPull?.id);

  console.log("\n3. record_call_attempt() releases the claim and increments attempts");
  const { error: recordError } = await agentClient.rpc("record_call_attempt", {
    p_lead_id: eligible.id,
    p_disposition_code: "no_answer",
  });
  check("recording an attempt succeeds", !recordError, recordError?.message);
  const { data: afterAttempt } = await admin.from("leads").select("attempts, claimed_by, last_attempt_at").eq("id", eligible.id).single();
  check("attempts incremented", afterAttempt?.attempts === 1, afterAttempt?.attempts);
  check("claim released", afterAttempt?.claimed_by === null);
  check("last_attempt_at set", Boolean(afterAttempt?.last_attempt_at));

  console.log("\n4. A DNC disposition suppresses the number in the same transaction as the call row");
  const dncTarget = await insertLead({ screening_status: "passed", screened_at: new Date().toISOString() }, "+15559990006");
  const { data: pullForDnc } = await agentClient.rpc("next_lead_for_agent", { p_agent_id: agentId });
  check("the DNC test lead is claimed", pullForDnc?.id === dncTarget.id, pullForDnc?.id);
  const { error: dncError } = await agentClient.rpc("record_call_attempt", { p_lead_id: dncTarget.id, p_disposition_code: "do_not_call", p_notes: "asked to be removed" });
  check("recording the DNC disposition succeeds", !dncError, dncError?.message);
  const { data: suppressionRow } = await admin.from("suppression_list").select("id").eq("workspace_id", workspace.id).eq("phone_hash", dncTarget.phone_hash!).maybeSingle();
  check("the number is now in suppression_list", Boolean(suppressionRow));

  console.log("\n5. Concurrency: two simultaneous pulls never return the same lead");
  const concurrentA = await insertLead({ screening_status: "passed", screened_at: new Date().toISOString() }, "+15559990007");
  const concurrentB = await insertLead({ screening_status: "passed", screened_at: new Date().toISOString() }, "+15559990008");
  void concurrentA;
  void concurrentB;
  const [pullA, pullB] = await Promise.all([
    agentClient.rpc("next_lead_for_agent", { p_agent_id: agentId }),
    agentClient.rpc("next_lead_for_agent", { p_agent_id: agentId }),
  ]);
  const idA = pullA.data?.id;
  const idB = pullB.data?.id;
  check("both concurrent pulls succeeded", Boolean(idA) && Boolean(idB), { idA, idB });
  check("the two concurrent pulls returned different leads", Boolean(idA) && Boolean(idB) && idA !== idB, { idA, idB });

  console.log("\nCleaning up the throwaway campaign and its leads...");
  // Same reason as in insertLead: don't leave this run's suppressions behind.
  const { data: testLeads } = await admin.from("leads").select("phone_hash").eq("campaign_id", campaign.id);
  const testHashes = (testLeads ?? []).map((l) => l.phone_hash).filter((h): h is string => Boolean(h));
  if (testHashes.length) await admin.from("suppression_list").delete().eq("workspace_id", workspace.id).in("phone_hash", testHashes);
  await admin.from("leads").delete().eq("campaign_id", campaign.id);
  await admin.from("campaign_assignments").delete().eq("campaign_id", campaign.id);
  await admin.from("campaigns").delete().eq("id", campaign.id);
  await admin.from("workspaces").update({ demo_allowed_numbers: originalAllowed, require_screening: originalRequireScreening }).eq("id", workspace.id);

  console.log(`\n${failures} failed.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("compliance-gate-proof: crashed", err);
  process.exit(1);
});

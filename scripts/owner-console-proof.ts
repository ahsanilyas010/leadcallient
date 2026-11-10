// Proof for the owner console (/platform) against a live (staging) DB:
// tenants can't read or change any owner data, and the console's RPCs answer
// nobody but a platform admin. Uses the seeded demo personas; changes
// nothing it doesn't restore.
// Run: npm run test:owner
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";
import { DEMO_PASSWORD } from "@/lib/seed/personas";
import { isOwnerEmail, OWNER_EMAILS } from "@/lib/owner/allowlist";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc = createClient<RealDatabase>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

let failures = 0;
const check = (c: boolean, l: string, d?: unknown) => {
  if (c) console.log(`  ok    ${l}`);
  else {
    console.error(`  FAIL  ${l}${d ? ` - ${JSON.stringify(d)}` : ""}`);
    failures++;
  }
};

async function as(email: string) {
  const c: SupabaseClient<RealDatabase> = createClient<RealDatabase>(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error || !data.user) throw new Error(`sign-in ${email}: ${error?.message}`);
  const { data: p } = await c.from("profiles").select("*").eq("id", data.user.id).single();
  return { c, profile: p! };
}

async function main() {
  console.log("allowlist");
  check(OWNER_EMAILS.length === 2 && OWNER_EMAILS.every(isOwnerEmail), "two owner emails");
  check(!isOwnerEmail("admin@leadcallient.demo"), "a tenant admin is not an owner");

  const admin = await as("admin@leadcallient.demo");
  const ws = admin.profile.workspace_id;
  const now = new Date();

  console.log("owner RPCs return nothing to a tenant super admin");
  const m = await admin.c.rpc("platform_workspace_metrics");
  check(!m.error && (m.data ?? []).length === 0, "platform_workspace_metrics", m.error?.message);
  const u = await admin.c.rpc("platform_users", {});
  check(!u.error && (u.data ?? []).length === 0, "platform_users", u.error?.message);
  const a = await admin.c.rpc("platform_agent_usage", { p_from: new Date(now.getTime() - 30 * 864e5).toISOString(), p_to: now.toISOString() });
  check(!a.error && (a.data ?? []).length === 0, "platform_agent_usage", a.error?.message);
  const s = await admin.c.rpc("platform_daily_series", { p_days: 7 });
  check(!s.error && (s.data ?? []).length === 0, "platform_daily_series", s.error?.message);

  console.log("owner tables are invisible to a tenant");
  for (const t of ["platform_ledger", "platform_audit", "platform_workspace_notes"] as const) {
    const { data, error } = await admin.c.from(t).select("*").limit(1);
    check(!error && (data ?? []).length === 0, `${t} returns no rows`, error?.message);
  }
  const ins = await admin.c.from("platform_ledger").insert({ workspace_id: ws, kind: "payment", amount: 1 });
  check(!!ins.error, "tenant cannot write the ledger", ins.error?.message);

  console.log("tenant cannot change trial or billing fields on its own workspace");
  const { data: before } = await svc.from("workspaces").select("trial_ends_at, billing_amount, next_due_date").eq("id", ws).single();
  for (const [label, patch] of [
    ["trial_ends_at", { trial_ends_at: new Date(now.getTime() + 365 * 864e5).toISOString() }],
    ["billing_amount", { billing_amount: 0 }],
    ["next_due_date", { next_due_date: "2099-01-01" }],
  ] as const) {
    const { error } = await admin.c.from("workspaces").update(patch).eq("id", ws);
    check(!!error, `update ${label} is refused`, error?.message);
  }
  const { data: after } = await svc.from("workspaces").select("trial_ends_at, billing_amount, next_due_date").eq("id", ws).single();
  check(JSON.stringify(before) === JSON.stringify(after), "workspace row unchanged");

  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

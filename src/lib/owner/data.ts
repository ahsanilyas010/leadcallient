import "server-only";
import { createRealClient } from "@/lib/supabase/real";
import type { RealTables } from "@/lib/supabase/real-types";
import {
  attentionFlags,
  billingState,
  monthlyValue,
  trialState,
  type AttentionFlag,
  type BillingState,
  type TrialState,
} from "@/lib/owner/status";

// Server-side loaders for the owner console. Reads use the signed-in
// owner's RLS-governed client: platform_* RPCs and owner tables only answer
// a platform admin, and none of them return lead or call content.

type Workspace = RealTables<"workspaces">;
type Metrics = Awaited<ReturnType<typeof loadMetrics>>[number];

async function loadMetrics() {
  const supabase = await createRealClient();
  const { data, error } = await supabase.rpc("platform_workspace_metrics");
  if (error) throw new Error(`platform_workspace_metrics: ${error.message}`);
  return data ?? [];
}

export interface Company {
  ws: Workspace;
  m: Metrics;
  trial: TrialState;
  billing: BillingState;
  flags: AttentionFlag[];
  mrr: number;
  lastActivityAt: string | null;
}

const EMPTY_METRICS: Omit<Metrics, "workspace_id"> = {
  owner_email: null,
  owner_name: null,
  users_total: 0,
  users_active: 0,
  agents_active: 0,
  data_seats_used: 0,
  campaigns: 0,
  leads: 0,
  clients: 0,
  calls_today: 0,
  calls_7d: 0,
  calls_30d: 0,
  calls_total: 0,
  talk_seconds_30d: 0,
  talk_seconds_total: 0,
  last_call_at: null,
  last_sign_in_at: null,
  agents_active_today: 0,
  zoom_connected: false,
  emails_sent_30d: 0,
  balance: 0,
  paid_total: 0,
  last_payment_on: null,
};

function latest(...dates: (string | null)[]): string | null {
  const t = dates.filter((d): d is string => !!d).sort();
  return t.length ? t[t.length - 1] : null;
}

export function toCompany(ws: Workspace, metrics: Metrics | undefined, now = Date.now()): Company {
  const m = metrics ?? { workspace_id: ws.id, ...EMPTY_METRICS };
  const balance = Number(m.balance) || 0;
  const trial = trialState(ws.trial_ends_at, Number(m.paid_total) || 0, now);
  const billing = billingState(balance, ws.next_due_date, ws.billing_amount === null ? null : Number(ws.billing_amount), now);
  return {
    ws,
    m: { ...m, balance },
    trial,
    billing,
    mrr: ws.status === "active" || ws.status === "onboarding" ? monthlyValue(ws.billing_amount === null ? null : Number(ws.billing_amount), ws.billing_cycle) : 0,
    lastActivityAt: latest(m.last_call_at, m.last_sign_in_at),
    flags: attentionFlags(
      {
        status: ws.status,
        isDemo: ws.is_demo,
        trial,
        billing,
        callsTotal: Number(m.calls_total),
        calls7d: Number(m.calls_7d),
        createdAt: ws.created_at,
        agentsActive: Number(m.agents_active),
        seatLimit: ws.seat_limit,
      },
      now,
    ),
  };
}

export async function loadCompanies(): Promise<Company[]> {
  const supabase = await createRealClient();
  const [{ data: workspaces, error }, metrics] = await Promise.all([
    supabase.from("workspaces").select("*").order("created_at", { ascending: false }),
    loadMetrics(),
  ]);
  if (error) throw new Error(`workspaces: ${error.message}`);
  const byId = new Map(metrics.map((m) => [m.workspace_id, m]));
  const now = Date.now();
  return (workspaces ?? []).map((w) => toCompany(w, byId.get(w.id), now));
}

export async function loadCompany(id: string): Promise<Company | null> {
  return (await loadCompanies()).find((c) => c.ws.id === id) ?? null;
}

export async function loadUsers(workspaceId?: string) {
  const supabase = await createRealClient();
  const { data, error } = await supabase.rpc("platform_users", workspaceId ? { p_workspace_id: workspaceId } : {});
  if (error) throw new Error(`platform_users: ${error.message}`);
  return data ?? [];
}
export type OwnerUser = Awaited<ReturnType<typeof loadUsers>>[number];

export async function loadAgentUsage(from: Date, to: Date, workspaceId?: string) {
  const supabase = await createRealClient();
  const { data, error } = await supabase.rpc("platform_agent_usage", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    ...(workspaceId ? { p_workspace_id: workspaceId } : {}),
  });
  if (error) throw new Error(`platform_agent_usage: ${error.message}`);
  return data ?? [];
}
export type AgentUsage = Awaited<ReturnType<typeof loadAgentUsage>>[number];

export async function loadDailySeries(days: number, workspaceId?: string) {
  const supabase = await createRealClient();
  const { data, error } = await supabase.rpc("platform_daily_series", { p_days: days, ...(workspaceId ? { p_workspace_id: workspaceId } : {}) });
  if (error) throw new Error(`platform_daily_series: ${error.message}`);
  return (data ?? []).map((d) => ({ day: d.day, calls: Number(d.calls), talkMinutes: Number(d.talk_minutes), signups: Number(d.signups) }));
}

export async function loadLedger(workspaceId?: string, limit = 200) {
  const supabase = await createRealClient();
  let q = supabase.from("platform_ledger").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data, error } = await q;
  if (error) throw new Error(`platform_ledger: ${error.message}`);
  return data ?? [];
}

export async function loadAudit(workspaceId?: string, limit = 200) {
  const supabase = await createRealClient();
  let q = supabase.from("platform_audit").select("*").order("created_at", { ascending: false }).limit(limit);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data, error } = await q;
  if (error) throw new Error(`platform_audit: ${error.message}`);
  return data ?? [];
}

export async function loadNotes(workspaceId: string): Promise<string> {
  const supabase = await createRealClient();
  const { data } = await supabase.from("platform_workspace_notes").select("notes").eq("workspace_id", workspaceId).maybeSingle();
  return data?.notes ?? "";
}

// Date range presets shared by the dialer page and its CSV export.
export function rangeFromParam(range: string | undefined, from?: string, to?: string): { from: Date; to: Date; key: string } {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === "custom" && from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const f = new Date(`${from}T00:00:00Z`);
    const t = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000);
    if (f < t) return { from: f, to: t, key: "custom" };
  }
  const days = range === "today" ? 0 : range === "7d" ? 7 : range === "90d" ? 90 : range === "all" ? 3650 : 30;
  const key = range === "today" || range === "7d" || range === "90d" || range === "all" ? range : "30d";
  return { from: days === 0 ? startOfToday : new Date(now.getTime() - days * 86_400_000), to: now, key };
}

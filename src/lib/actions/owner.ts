"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner, type PlatformAdmin } from "@/lib/auth/current-profile";
import { createServiceClient } from "@/lib/supabase/service";
import { advanceDueDate } from "@/lib/owner/status";
import type { RealJson } from "@/lib/supabase/real-types";

// Every write the owner console can make. Each one: checks requireOwner(),
// validates input, writes with the service role (the workspace guard and the
// owner-only tables accept nothing else), and appends to platform_audit.

export interface OwnerResult {
  error?: string;
}

// Same lenient id check the rest of the app uses (zod v4's uuid() rejects
// ids whose version nibble isn't 1-8).
const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-01.");

async function audit(
  owner: PlatformAdmin,
  action: string,
  workspaceId: string | null,
  details: Record<string, unknown> = {},
  targetUserId: string | null = null,
) {
  await createServiceClient()
    .from("platform_audit")
    .insert({
      actor_id: owner.id,
      actor_email: owner.email,
      action,
      workspace_id: workspaceId,
      target_user_id: targetUserId,
      details: details as RealJson,
    });
}

function refresh(workspaceId?: string) {
  revalidatePath("/platform", "layout");
  if (workspaceId) revalidatePath(`/platform/companies/${workspaceId}`);
}

async function loadWorkspace(id: string) {
  const { data } = await createServiceClient().from("workspaces").select("*").eq("id", id).maybeSingle();
  return data;
}

// ---------------------------------------------------------------- status
export async function ownerSetStatus(workspaceId: string, status: "active" | "suspended" | "canceled"): Promise<OwnerResult> {
  const owner = await requireOwner();
  if (!uuid.safeParse(workspaceId).success || !["active", "suspended", "canceled"].includes(status)) return { error: "Invalid request." };
  const ws = await loadWorkspace(workspaceId);
  if (!ws) return { error: "Unknown company." };
  const { error } = await createServiceClient().from("workspaces").update({ status }).eq("id", workspaceId);
  if (error) return { error: error.message };
  await audit(owner, "company.status", workspaceId, { from: ws.status, to: status });
  refresh(workspaceId);
  return {};
}

// ---------------------------------------------------------------- trial
const trialSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("extend"), days: z.coerce.number().int().min(1).max(365) }),
  z.object({ mode: z.literal("set"), date: isoDate }),
  z.object({ mode: z.literal("end") }),
  z.object({ mode: z.literal("clear") }),
]);

export async function ownerSetTrial(workspaceId: string, input: z.input<typeof trialSchema>): Promise<OwnerResult> {
  const owner = await requireOwner();
  const parsed = trialSchema.safeParse(input);
  if (!uuid.safeParse(workspaceId).success || !parsed.success) return { error: parsed.error?.issues[0]?.message ?? "Invalid request." };
  const ws = await loadWorkspace(workspaceId);
  if (!ws) return { error: "Unknown company." };

  let next: string | null;
  const v = parsed.data;
  if (v.mode === "extend") {
    const from = Math.max(Date.now(), ws.trial_ends_at ? Date.parse(ws.trial_ends_at) : 0);
    next = new Date(from + v.days * 86_400_000).toISOString();
  } else if (v.mode === "set") {
    next = new Date(`${v.date}T23:59:59Z`).toISOString();
  } else if (v.mode === "end") {
    next = new Date().toISOString();
  } else {
    next = null;
  }
  const { error } = await createServiceClient().from("workspaces").update({ trial_ends_at: next }).eq("id", workspaceId);
  if (error) return { error: error.message };
  await audit(owner, "company.trial", workspaceId, { from: ws.trial_ends_at, to: next, mode: v.mode });
  refresh(workspaceId);
  return {};
}

// ---------------------------------------------------------------- seats
const seatsSchema = z.object({
  agentSeats: z.coerce.number().int().min(0).max(100000),
  dataSeats: z.coerce.number().int().min(0).max(100000),
});

export async function ownerSetSeats(workspaceId: string, input: z.input<typeof seatsSchema>): Promise<OwnerResult> {
  const owner = await requireOwner();
  const parsed = seatsSchema.safeParse(input);
  if (!uuid.safeParse(workspaceId).success || !parsed.success) return { error: "Enter whole numbers of seats (0 or more)." };
  const ws = await loadWorkspace(workspaceId);
  if (!ws) return { error: "Unknown company." };
  const { error } = await createServiceClient()
    .from("workspaces")
    .update({ seat_limit: parsed.data.agentSeats, data_seat_limit: parsed.data.dataSeats })
    .eq("id", workspaceId);
  if (error) return { error: error.message };
  await audit(owner, "company.seats", workspaceId, {
    from: { agent: ws.seat_limit, data: ws.data_seat_limit },
    to: { agent: parsed.data.agentSeats, data: parsed.data.dataSeats },
  });
  refresh(workspaceId);
  return {};
}

// ---------------------------------------------------------------- billing plan
const planSchema = z.object({
  amount: z.union([z.literal(""), z.coerce.number().min(0).max(10_000_000)]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD."),
  cycle: z.enum(["monthly", "quarterly", "yearly"]),
  nextDueDate: z.union([z.literal(""), isoDate]),
});

export async function ownerSetBillingPlan(workspaceId: string, input: z.input<typeof planSchema>): Promise<OwnerResult> {
  const owner = await requireOwner();
  const parsed = planSchema.safeParse(input);
  if (!uuid.safeParse(workspaceId).success) return { error: "Unknown company." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the values." };
  const ws = await loadWorkspace(workspaceId);
  if (!ws) return { error: "Unknown company." };
  const update = {
    billing_amount: parsed.data.amount === "" ? null : parsed.data.amount,
    billing_currency: parsed.data.currency,
    billing_cycle: parsed.data.cycle,
    next_due_date: parsed.data.nextDueDate === "" ? null : parsed.data.nextDueDate,
    plan: (parsed.data.amount === "" || parsed.data.amount === 0 ? "free" : "paid") as "free" | "paid",
  };
  const { error } = await createServiceClient().from("workspaces").update(update).eq("id", workspaceId);
  if (error) return { error: error.message };
  await audit(owner, "company.billing_plan", workspaceId, {
    from: { amount: ws.billing_amount, currency: ws.billing_currency, cycle: ws.billing_cycle, next_due_date: ws.next_due_date },
    to: update,
  });
  refresh(workspaceId);
  return {};
}

// ---------------------------------------------------------------- ledger
const ledgerSchema = z.object({
  kind: z.enum(["charge", "payment", "credit"]),
  amount: z.coerce.number().positive("Enter an amount above 0.").max(10_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  occurredOn: isoDate,
  method: z.enum(["bank_transfer", "cash", "card", "gateway", "other"]).optional(),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
  advanceDue: z.boolean().optional(),
});

export async function ownerAddLedgerEntry(workspaceId: string, input: z.input<typeof ledgerSchema>): Promise<OwnerResult> {
  const owner = await requireOwner();
  const parsed = ledgerSchema.safeParse(input);
  if (!uuid.safeParse(workspaceId).success) return { error: "Unknown company." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the values." };
  const ws = await loadWorkspace(workspaceId);
  if (!ws) return { error: "Unknown company." };
  const v = parsed.data;
  const admin = createServiceClient();
  const { error } = await admin.from("platform_ledger").insert({
    workspace_id: workspaceId,
    kind: v.kind,
    amount: v.amount,
    currency: v.currency,
    occurred_on: v.occurredOn,
    method: v.kind === "payment" ? (v.method ?? "bank_transfer") : null,
    reference: v.reference || null,
    note: v.note || null,
    created_by: owner.id,
  });
  if (error) return { error: error.message };

  // Recording a payment rolls the next due date forward one cycle, and a
  // first payment marks the plan as paid.
  if (v.kind === "payment") {
    const update: { next_due_date?: string; plan?: "paid" } = { plan: "paid" };
    if (v.advanceDue && ws.next_due_date) update.next_due_date = advanceDueDate(ws.next_due_date, ws.billing_cycle);
    await admin.from("workspaces").update(update).eq("id", workspaceId);
  }
  await audit(owner, `ledger.${v.kind}`, workspaceId, { amount: v.amount, currency: v.currency, occurred_on: v.occurredOn, method: v.method, reference: v.reference });
  refresh(workspaceId);
  return {};
}

export async function ownerDeleteLedgerEntry(entryId: string): Promise<OwnerResult> {
  const owner = await requireOwner();
  if (!uuid.safeParse(entryId).success) return { error: "Unknown entry." };
  const admin = createServiceClient();
  const { data: entry } = await admin.from("platform_ledger").select("*").eq("id", entryId).maybeSingle();
  if (!entry) return { error: "Unknown entry." };
  if (entry.provider) return { error: "Gateway payments can't be deleted here." };
  const { error } = await admin.from("platform_ledger").delete().eq("id", entryId);
  if (error) return { error: error.message };
  await audit(owner, "ledger.delete", entry.workspace_id, { kind: entry.kind, amount: entry.amount, currency: entry.currency, occurred_on: entry.occurred_on });
  refresh(entry.workspace_id);
  return {};
}

// ---------------------------------------------------------------- notes
export async function ownerSaveNotes(workspaceId: string, notes: string): Promise<OwnerResult> {
  const owner = await requireOwner();
  if (!uuid.safeParse(workspaceId).success) return { error: "Unknown company." };
  if (notes.length > 20000) return { error: "Notes are limited to 20,000 characters." };
  const { error } = await createServiceClient()
    .from("platform_workspace_notes")
    .upsert({ workspace_id: workspaceId, notes, updated_by: owner.id, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
  if (error) return { error: error.message };
  await audit(owner, "company.notes", workspaceId, { length: notes.length });
  refresh(workspaceId);
  return {};
}

// ---------------------------------------------------------------- users
// Same effect as a workspace admin deactivating someone: the profile is
// switched off and the Supabase login is banned (or un-banned). Seat limits
// are the owner's call here, so they aren't enforced.
export async function ownerSetUserActive(userId: string, isActive: boolean): Promise<OwnerResult> {
  const owner = await requireOwner();
  if (!uuid.safeParse(userId).success) return { error: "Unknown user." };
  const admin = createServiceClient();
  const { data: target } = await admin.from("profiles").select("id, workspace_id, email, role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Unknown user." };
  const { error } = await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (error) return { error: error.message };
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? "none" : "87600h" });
  await audit(owner, isActive ? "user.reactivate" : "user.deactivate", target.workspace_id, { email: target.email, role: target.role }, userId);
  refresh(target.workspace_id);
  if (authError) return { error: `Profile updated, but the login couldn't be ${isActive ? "re-enabled" : "disabled"}: ${authError.message}` };
  return {};
}

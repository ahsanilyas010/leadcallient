"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parsePhoneNumberWithError } from "libphonenumber-js";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { manualScreeningProvider } from "@/lib/compliance/screening";
import { SUPPRESSION_REASONS } from "@/lib/compliance/reasons";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  screened?: number;
}

const addSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required."),
  country: z.string().trim().length(2).default("GB"),
  reason: z.enum(SUPPRESSION_REASONS.map((r) => r.value) as [string, ...string[]]),
  note: z.string().trim().max(500).optional(),
});

// Same algorithm as compute_phone_hash() (migration 047): sha256 hex of the
// E.164 string.
function phoneHash(e164: string): string {
  return createHash("sha256").update(e164).digest("hex");
}

// Suppression is instant and global for the workspace: next_lead_for_agent
// excludes any lead whose phone_hash is on this list, so inserting the row
// is the whole gate - no per-lead update is needed.
export async function addSuppressionEntry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await requireRealProfile();
  if (!["super_admin", "ops_manager", "team_lead", "qa_analyst"].includes(profile.role)) {
    return { error: "Not authorized." };
  }
  const parsed = addSchema.safeParse({
    phone: formData.get("phone"),
    country: formData.get("country") || "GB",
    reason: formData.get("reason") || "internal_optout",
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  let e164: string;
  try {
    const p = parsePhoneNumberWithError(parsed.data.phone, parsed.data.country as never);
    if (!p.isValid()) throw new Error("invalid");
    e164 = p.number;
  } catch {
    return { error: `"${parsed.data.phone}" doesn't parse as a valid phone number.` };
  }

  const supabase = await createRealClient();
  const { error } = await supabase.from("suppression_list").insert({
    workspace_id: profile.workspace_id,
    phone_hash: phoneHash(e164),
    reason: parsed.data.reason,
    added_by: profile.id,
    phone_hint: `${e164.slice(0, 3)}${"•".repeat(Math.max(0, e164.length - 6))}${e164.slice(-3)}`,
    note: parsed.data.note ?? null,
  });
  if (error) return { error: error.code === "23505" ? "Already suppressed." : error.message };

  revalidatePath("/admin/compliance");
  return { ok: true };
}

// Removing a number from the DNC list is deliberate and manager-only; the
// audit trigger on suppression_list records who did it.
export async function removeSuppressionEntry(id: string): Promise<ActionResult> {
  const profile = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(profile.role)) return { error: "Only an admin can remove a suppression." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid entry." };
  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("suppression_list")
    .delete()
    .eq("id", id)
    .eq("workspace_id", profile.workspace_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Entry not found." };
  revalidatePath("/admin/compliance");
  return { ok: true };
}

// Runs the (stub) screening provider on one batch. The manual provider only
// stamps pending leads as passed and records the evidence file the admin
// attaches - it does NOT query TPS/CTPS/National DNC. Numbers on the
// suppression list stay undialable regardless, via the gate.
export async function screenBatch(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(profile.role)) return { error: "Only an admin can screen a batch." };

  const batchId = String(formData.get("batch_id") ?? "");
  if (!z.string().uuid().safeParse(batchId).success) return { error: "Pick a batch." };
  const file = formData.get("evidence");

  const supabase = await createRealClient();
  const { data: batch } = await supabase
    .from("lead_batches")
    .select("id")
    .eq("id", batchId)
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle();
  if (!batch) return { error: "Batch not found." };

  let evidenceUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const path = `${profile.workspace_id}/${batchId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("screening-evidence")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
    if (upErr) return { error: `Could not store the evidence file: ${upErr.message}` };
    evidenceUrl = path;
  }

  try {
    const { screenedCount } = await manualScreeningProvider.screenBatch(supabase, { batchId, evidenceUrl });
    revalidatePath("/admin/compliance");
    revalidatePath("/admin/settings/leads");
    return { ok: true, screened: screenedCount };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not screen the batch." };
  }
}

export interface ScreenAllResult {
  error?: string;
  ok?: boolean;
  screened?: number;
  batches?: number;
}

// Screens every lead in the workspace that is still pending, wherever it came
// from: batches are stamped through screen_lead_batch() (so Screening history
// shows the date), and leads outside any batch (added by hand, by webhook or
// promoted from a contact) go through screen_leads(). Same manual stub as the
// per-batch action: numbers on the suppression list fail, everything else
// passes. Manager-only.
export async function screenAllPending(): Promise<ScreenAllResult> {
  const profile = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(profile.role)) return { error: "Only an admin can screen leads." };

  const supabase = await createRealClient();
  const { data: pending, error } = await supabase
    .from("leads")
    .select("id, batch_id")
    .eq("workspace_id", profile.workspace_id)
    .eq("screening_status", "pending")
    .limit(20000);
  if (error) return { error: error.message };
  if (!pending || pending.length === 0) return { ok: true, screened: 0, batches: 0 };

  const batchIds = [...new Set(pending.map((l) => l.batch_id).filter((b): b is string => Boolean(b)))];
  const loose = pending.filter((l) => !l.batch_id).map((l) => l.id);

  let screened = 0;
  try {
    for (const batchId of batchIds) {
      const r = await manualScreeningProvider.screenBatch(supabase, { batchId, evidenceUrl: null });
      screened += r.screenedCount;
    }
    for (let i = 0; i < loose.length; i += 500) {
      const { data, error: sErr } = await supabase.rpc("screen_leads", { p_lead_ids: loose.slice(i, i + 500) });
      if (sErr) throw sErr;
      screened += data ?? 0;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not screen the pending leads." };
  }

  revalidatePath("/admin/compliance");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/campaigns", "layout");
  revalidatePath("/callsheet");
  revalidatePath("/dial");
  return { ok: true, screened, batches: batchIds.length };
}

// Screening before dialing is a workspace choice (migration 113). Off: leads
// can be dialled as soon as they are uploaded and assigned; the suppression
// list still blocks. On: every lead must pass screening first.
export async function setRequireScreening(on: boolean): Promise<ActionResult> {
  const profile = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(profile.role)) return { error: "Only an admin or ops manager can change this." };
  const supabase = await createRealClient();
  const { error } = await supabase.from("workspaces").update({ require_screening: on }).eq("id", profile.workspace_id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

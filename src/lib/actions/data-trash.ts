"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parsePhoneNumberWithError, type CountryCode } from "libphonenumber-js";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";
import { phoneHash } from "@/lib/leads/mapped-import";
import { captureException } from "@/lib/error-tracking";
import { ERASE_CONFIRM_WORD, PURGE_CONFIRM_WORD } from "@/lib/data-delete";

// Deleting data: move to trash (recoverable for the workspace's retention
// period, 30 days unless the super admin changes it), restore, delete
// permanently, undo an import, and data-subject requests. The database
// functions (migration 117) do the work and re-check every permission; these
// actions only shape input and refresh the pages.

export interface DeleteResult {
  error?: string;
  ok?: boolean;
  count?: number;
}

const DATA_ADMINS = ["super_admin", "ops_manager", "data_manager"];
const MAX_IDS = 5000;
const uuid = z.string().uuid();

function cleanIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS) return null;
  const out = [...new Set(ids.map(String))];
  return out.every((id) => uuid.safeParse(id).success) ? out : null;
}

function touch() {
  for (const p of ["/admin/leads", "/admin/leads/trash", "/admin/data", "/admin/import", "/admin/compliance", "/admin/security", "/callsheet", "/dial", "/leadgen/leads"]) {
    revalidatePath(p);
  }
  revalidatePath("/admin/campaigns", "layout");
}

function dbError(message: string): string {
  // Permission messages from the database are already written for people.
  return message.replace(/^.*?ERROR:\s*/, "");
}

async function callCount(fn: "trash_leads" | "trash_contacts" | "restore_leads" | "restore_contacts" | "purge_leads" | "purge_contacts", ids: string[]): Promise<DeleteResult> {
  const supabase = await createRealClient();
  const { data, error } = await supabase.rpc(fn, { p_ids: ids });
  if (error) return { error: dbError(error.message) };
  touch();
  return { ok: true, count: data ?? 0 };
}

export async function trashLeads(leadIds: string[]): Promise<DeleteResult> {
  const profile = await requireRealProfile();
  if (!DATA_ADMINS.includes(profile.role)) return { error: "Only an admin, ops manager or Data-only user can delete leads." };
  const ids = cleanIds(leadIds);
  if (!ids) return { error: `Pick at least one lead (up to ${MAX_IDS.toLocaleString("en-GB")} at a time).` };
  return callCount("trash_leads", ids);
}

export async function trashContacts(contactIds: string[]): Promise<DeleteResult> {
  const profile = await requireRealProfile();
  if (!DATA_ADMINS.includes(profile.role)) return { error: "Only an admin, ops manager or Data-only user can delete contacts." };
  const ids = cleanIds(contactIds);
  if (!ids) return { error: `Pick at least one contact (up to ${MAX_IDS.toLocaleString("en-GB")} at a time).` };
  return callCount("trash_contacts", ids);
}

export async function restoreLeads(leadIds: string[]): Promise<DeleteResult> {
  const profile = await requireRealProfile();
  if (!DATA_ADMINS.includes(profile.role)) return { error: "Only an admin, ops manager or Data-only user can restore leads." };
  const ids = cleanIds(leadIds);
  if (!ids) return { error: "Pick at least one lead to restore." };
  return callCount("restore_leads", ids);
}

export async function restoreContacts(contactIds: string[]): Promise<DeleteResult> {
  const profile = await requireRealProfile();
  if (!DATA_ADMINS.includes(profile.role)) return { error: "Only an admin, ops manager or Data-only user can restore contacts." };
  const ids = cleanIds(contactIds);
  if (!ids) return { error: "Pick at least one contact to restore." };
  return callCount("restore_contacts", ids);
}

// Permanent delete. More than one record needs the confirmation word typed;
// the database decides who may do it at all (the super admin, and ops
// managers when the super admin allows it).
export async function purgeLeads(leadIds: string[], confirmText: string): Promise<DeleteResult> {
  const ids = cleanIds(leadIds);
  if (!ids) return { error: `Pick at least one lead (up to ${MAX_IDS.toLocaleString("en-GB")} at a time).` };
  if (ids.length > 1 && confirmText.trim() !== PURGE_CONFIRM_WORD) return { error: `Type ${PURGE_CONFIRM_WORD} to confirm.` };
  return callCount("purge_leads", ids);
}

export async function purgeContacts(contactIds: string[], confirmText: string): Promise<DeleteResult> {
  const ids = cleanIds(contactIds);
  if (!ids) return { error: `Pick at least one contact (up to ${MAX_IDS.toLocaleString("en-GB")} at a time).` };
  if (ids.length > 1 && confirmText.trim() !== PURGE_CONFIRM_WORD) return { error: `Type ${PURGE_CONFIRM_WORD} to confirm.` };
  return callCount("purge_contacts", ids);
}

// Deletes everything in the trash for good.
export async function emptyTrash(confirmText: string): Promise<DeleteResult & { leads?: number; contacts?: number }> {
  if (confirmText.trim() !== PURGE_CONFIRM_WORD) return { error: `Type ${PURGE_CONFIRM_WORD} to confirm.` };
  const supabase = await createRealClient();
  let leads = 0;
  let contacts = 0;
  for (let round = 0; round < 50; round++) {
    const { data: l, error: le } = await supabase.rpc("trashed_leads", { p_limit: 2000 });
    if (le) return { error: dbError(le.message) };
    const { data: c, error: ce } = await supabase.rpc("trashed_contacts", { p_limit: 2000 });
    if (ce) return { error: dbError(ce.message) };
    if ((l ?? []).length === 0 && (c ?? []).length === 0) break;
    if ((l ?? []).length > 0) {
      const { data, error } = await supabase.rpc("purge_leads", { p_ids: (l ?? []).map((r) => r.id) });
      if (error) return { error: dbError(error.message) };
      leads += data ?? 0;
    }
    if ((c ?? []).length > 0) {
      const { data, error } = await supabase.rpc("purge_contacts", { p_ids: (c ?? []).map((r) => r.id) });
      if (error) return { error: dbError(error.message) };
      contacts += data ?? 0;
    }
  }
  touch();
  return { ok: true, count: leads + contacts, leads, contacts };
}

// Undo an import (within 7 days): what it created goes to the trash.
export async function undoImport(runId: string): Promise<DeleteResult & { leads?: number; contacts?: number }> {
  const profile = await requireRealProfile();
  if (!DATA_ADMINS.includes(profile.role)) return { error: "Only an admin, ops manager or Data-only user can undo an import." };
  if (!uuid.safeParse(runId).success) return { error: "Import not found." };
  const supabase = await createRealClient();
  const { data, error } = await supabase.rpc("undo_import", { p_run_id: runId });
  if (error) return { error: dbError(error.message) };
  const r = (data ?? {}) as { leads?: number; contacts?: number };
  touch();
  return { ok: true, count: (r.leads ?? 0) + (r.contacts ?? 0), leads: r.leads ?? 0, contacts: r.contacts ?? 0 };
}

// --------------------------------------------------------------- settings

const policySchema = z.object({
  opsCanPurge: z.boolean(),
  retentionDays: z.number().int().min(1, "Keep trash for at least 1 day.").max(365, "Keep trash for at most 365 days."),
});

// Who may permanently delete, and how long the trash keeps things. Super
// admin only (the database refuses anyone else too).
export async function setDeletePolicy(input: z.input<typeof policySchema>): Promise<DeleteResult> {
  const profile = await requireRealProfile();
  if (profile.role !== "super_admin") return { error: "Only a super admin can change this." };
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings." };
  const supabase = await createRealClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ ops_can_purge: parsed.data.opsCanPurge, trash_retention_days: parsed.data.retentionDays })
    .eq("id", profile.workspace_id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin/settings/leads");
  revalidatePath("/admin/leads/trash");
  return { ok: true };
}

// ---------------------------------------------------- data-subject requests

export interface PersonData {
  leads: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    email: string | null;
    phone_e164: string | null;
    status: string;
    created_at: string;
    deleted_at: string | null;
    calls: number;
    recordings: number;
    callbacks: number;
  }[];
  contacts: { id: string; full_name: string | null; company_name: string | null; email: string | null; created_at: string; deleted_at: string | null }[];
  emails_sent: number;
  suppressed: boolean;
}

const personSchema = z.object({
  email: z.string().trim().max(254).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  country: z.string().trim().length(2).optional().default("GB"),
});

function personKeys(input: z.input<typeof personSchema>): { email: string | null; hash: string | null; error?: string } {
  const p = personSchema.safeParse(input);
  if (!p.success) return { email: null, hash: null, error: "Check the email and phone number." };
  const email = p.data.email ? p.data.email.toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { email: null, hash: null, error: "That email address doesn't look right." };
  let hash: string | null = null;
  if (p.data.phone) {
    try {
      const parsed = parsePhoneNumberWithError(p.data.phone, p.data.country.toUpperCase() as CountryCode);
      if (!parsed.isPossible()) return { email, hash: null, error: "That phone number doesn't look right. Include the country code." };
      hash = phoneHash(parsed.number);
    } catch {
      return { email, hash: null, error: "That phone number doesn't look right. Include the country code." };
    }
  }
  if (!email && !hash) return { email: null, hash: null, error: "Give an email address, a phone number, or both." };
  return { email, hash };
}

// Everything held about one person (trashed records included).
export async function findPersonData(input: z.input<typeof personSchema>): Promise<{ error?: string; data?: PersonData }> {
  const profile = await requireRealProfile();
  if (!["super_admin", "ops_manager"].includes(profile.role)) return { error: "Only an admin or ops manager can search for a person's data." };
  const keys = personKeys(input);
  if (keys.error) return { error: keys.error };
  const supabase = await createRealClient();
  const { data, error } = await supabase.rpc("find_person_data", { p_email: keys.email ?? "", p_phone_hash: keys.hash ?? "" });
  if (error) return { error: dbError(error.message) };
  return { data: data as unknown as PersonData };
}

// Erases one person's data for good: call recordings (from Storage), leads
// with their calls and callbacks, contacts, emails sent, and the audit log's
// copies. Optionally keeps the number on the suppression list so they are
// never loaded again.
export async function erasePerson(
  input: z.input<typeof personSchema> & { suppress?: boolean; confirm: string },
): Promise<{ error?: string; result?: { leads: number; calls: number; contacts: number; emails: number; suppressed: boolean; recordings: number } }> {
  const profile = await requireRealProfile();
  if (input.confirm.trim() !== ERASE_CONFIRM_WORD) return { error: `Type ${ERASE_CONFIRM_WORD} to confirm.` };
  const keys = personKeys(input);
  if (keys.error) return { error: keys.error };
  const supabase = await createRealClient();

  // Recording files first: SQL can't remove Storage objects. The list comes
  // from the database, which checks the caller may erase.
  const { data: paths, error: pathErr } = await supabase.rpc("person_recording_paths", { p_email: keys.email ?? "", p_phone_hash: keys.hash ?? "" });
  if (pathErr) return { error: dbError(pathErr.message) };
  const files = (paths ?? [])
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((p) => p.replace(/^call-recordings\//, ""))
    .filter((p) => p.startsWith(`${profile.workspace_id}/`));
  if (files.length > 0) {
    const { error: rmErr } = await createServiceClient().storage.from("call-recordings").remove(files);
    if (rmErr) {
      captureException(rmErr, { action: "erasePerson.recordings" });
      return { error: "The call recordings couldn't be deleted, so nothing was erased. Try again in a minute." };
    }
  }

  const { data, error } = await supabase.rpc("erase_person", {
    p_email: keys.email ?? "",
    p_phone_hash: keys.hash ?? "",
    p_suppress: Boolean(input.suppress),
  });
  if (error) return { error: dbError(error.message) };
  touch();
  const r = data as unknown as { leads: number; calls: number; contacts: number; emails: number; suppressed: boolean };
  return { result: { ...r, recordings: files.length } };
}

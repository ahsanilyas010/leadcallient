"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { NEW_CLIENT } from "@/lib/campaign-options";

export interface CreateCampaignResult {
  error?: string;
  ok?: boolean;
  id?: string;
}

export interface CreateClientResult {
  error?: string;
  ok?: boolean;
}

const MANAGER_ROLES = ["super_admin", "ops_manager"];
// Creating and editing campaigns, and adding a client while doing so, are
// open to the Data-only role too; editing an existing client is not.
const CAMPAIGN_ROLES = [...MANAGER_ROLES, "data_manager"];

const timeOrNull = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a valid time")
  .or(z.literal(""))
  .transform((v) => (v ? v.slice(0, 5) : null));

const textOrNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : null));

const campaignSchema = z
  .object({
    name: z.string().trim().min(2, "Campaign name is required.").max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .max(24)
      .regex(/^[A-Z0-9_-]*$/, "Code may only contain letters, numbers, - and _.")
      .transform((v) => (v ? v : null)),
    client_id: z.string().uuid("Choose a client."),
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, "Choose a country.")
      .transform((v) => v.toUpperCase()),
    audience: z.enum(["B2C", "B2B"]),
    vertical: textOrNull(60),
    timezone: z.string().trim().min(1).max(64),
    caller_id: z
      .string()
      .trim()
      .max(32)
      .refine((v) => v === "" || /^\+[1-9]\d{6,14}$/.test(v), "Caller ID must be an E.164 number such as +14155550123.")
      .transform((v) => (v ? v : null)),
    calling_window_start: timeOrNull,
    calling_window_end: timeOrNull,
    max_attempts: z.coerce.number().int().min(1, "Max attempts must be at least 1.").max(50),
    cooling_off_hours: z.coerce.number().int().min(0).max(720),
    recording_enabled: z.boolean(),
    disclosure_script: textOrNull(4000),
    objection_notes: textOrNull(4000),
  })
  .refine((v) => (v.calling_window_start === null) === (v.calling_window_end === null), {
    message: "Set both calling window times, or neither.",
    path: ["calling_window_end"],
  })
  .refine(
    (v) =>
      v.calling_window_start === null ||
      v.calling_window_end === null ||
      v.calling_window_start < v.calling_window_end,
    { message: "Calling window must end after it starts.", path: ["calling_window_end"] },
  );

function campaignInput(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return campaignSchema.safeParse({
    name: get("name"),
    code: get("code"),
    client_id: get("client_id"),
    country: get("country"),
    audience: get("audience") || "B2C",
    vertical: get("vertical"),
    timezone: get("timezone") || "UTC",
    caller_id: get("caller_id"),
    calling_window_start: get("calling_window_start"),
    calling_window_end: get("calling_window_end"),
    max_attempts: get("max_attempts") || "6",
    cooling_off_hours: get("cooling_off_hours") || "24",
    recording_enabled: formData.get("recording_enabled") === "on",
    disclosure_script: get("disclosure_script"),
    objection_notes: get("objection_notes"),
  });
}

function dbMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Another campaign already uses that code.";
  return error.message;
}

export async function createCampaign(
  _prev: CreateCampaignResult,
  formData: FormData,
): Promise<CreateCampaignResult> {
  const profile = await requireProfile();
  if (!CAMPAIGN_ROLES.includes(profile.role)) return { error: "Only an admin can create campaigns." };

  // "+ Create a new client" in the campaign form: the client is made together
  // with the campaign. The campaign is validated first (against a stand-in client
  // id) so a bad form never leaves a stray client behind.
  const creatingClient = formData.get("client_id") === NEW_CLIENT;
  let newClient: z.infer<typeof clientSchema> | null = null;
  if (creatingClient) {
    const c = clientSchema.safeParse({
      name: String(formData.get("new_client_name") ?? ""),
      country: "",
      contact_name: "",
      contact_email: String(formData.get("new_client_email") ?? ""),
      is_data_controller: false,
      dpa_signed_on: "",
    });
    if (!c.success) return { error: c.error.issues[0]?.message ?? "Invalid client." };
    newClient = c.data;
    formData.set("client_id", "00000000-0000-4000-8000-000000000000");
  }

  const parsed = campaignInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid campaign." };

  const supabase = await createRealClient();
  let clientId = parsed.data.client_id;
  if (newClient) {
    const { data: created, error: cErr } = await supabase
      .from("clients")
      .insert({ ...newClient, workspace_id: profile.workspace_id })
      .select("id")
      .single();
    if (cErr || !created) return { error: cErr?.message ?? "Couldn't create the client." };
    clientId = created.id;
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      ...parsed.data,
      client_id: clientId,
      workspace_id: profile.workspace_id,
      // A new campaign starts paused: it only becomes dialable once a
      // manager deliberately activates it.
      status: "paused",
    })
    .select("id")
    .single();
  if (error) {
    if (newClient) await supabase.from("clients").delete().eq("id", clientId).eq("workspace_id", profile.workspace_id);
    return { error: dbMessage(error) };
  }

  revalidatePath("/admin/campaigns", "layout");
  return { ok: true, id: data.id };
}

export async function updateCampaign(
  _prev: CreateCampaignResult,
  formData: FormData,
): Promise<CreateCampaignResult> {
  const profile = await requireProfile();
  if (!CAMPAIGN_ROLES.includes(profile.role)) return { error: "Only an admin can edit campaigns." };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Missing campaign." };
  const parsed = campaignInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  const status = z.enum(["active", "paused", "archived"]).safeParse(formData.get("status"));
  if (!status.success) return { error: "Choose a status." };

  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ ...parsed.data, status: status.data })
    .eq("id", id.data)
    .eq("workspace_id", profile.workspace_id)
    .select("id");
  if (error) return { error: dbMessage(error) };
  if (!data || data.length === 0) return { error: "Campaign not found, or you don't have access to it." };

  revalidatePath("/admin/campaigns", "layout");
  return { ok: true, id: id.data };
}

const clientSchema = z.object({
  name: z.string().trim().min(2, "Client name is required.").max(120),
  country: textOrNull(80),
  contact_name: textOrNull(120),
  contact_email: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid contact email."),
  is_data_controller: z.boolean(),
  dpa_signed_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

function clientInput(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return clientSchema.safeParse({
    name: get("name"),
    country: get("country"),
    contact_name: get("contact_name"),
    contact_email: get("contact_email"),
    is_data_controller: formData.get("is_data_controller") === "on",
    dpa_signed_on: get("dpa_signed_on"),
  });
}

export async function createClientRecord(
  _prev: CreateClientResult,
  formData: FormData,
): Promise<CreateClientResult> {
  const profile = await requireProfile();
  if (!CAMPAIGN_ROLES.includes(profile.role)) return { error: "Only an admin can add clients." };
  const parsed = clientInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid client." };

  const supabase = await createRealClient();
  const { error } = await supabase.from("clients").insert({ ...parsed.data, workspace_id: profile.workspace_id });
  if (error) return { error: error.message };

  revalidatePath("/admin/campaigns", "layout");
  return { ok: true };
}

export async function updateClientRecord(
  _prev: CreateClientResult,
  formData: FormData,
): Promise<CreateClientResult> {
  const profile = await requireProfile();
  if (!MANAGER_ROLES.includes(profile.role)) return { error: "Only an admin can edit clients." };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Missing client id." };
  const parsed = clientInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid client." };

  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("workspace_id", profile.workspace_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Client not found, or you don't have access to it." };

  revalidatePath("/admin/campaigns", "layout");
  return { ok: true };
}

// One of a campaign's on/off settings, saved as soon as it is switched:
// whether its leads must pass screening before dialling (null: follow the
// workspace setting under Compliance), and whether new leads imported into it
// are shared out to its roster automatically.
export async function setCampaignSetting(
  campaignId: string,
  setting: "require_screening" | "auto_assign_new",
  value: boolean | null,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!CAMPAIGN_ROLES.includes(profile.role)) return { error: "Only an admin, ops manager or Data-only user can change campaign settings." };
  if (!z.string().uuid().safeParse(campaignId).success) return { error: "Campaign not found." };
  if (setting === "auto_assign_new" && value === null) return { error: "Choose on or off." };
  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update(setting === "require_screening" ? { require_screening: value } : { auto_assign_new: value === true })
    .eq("id", campaignId)
    .eq("workspace_id", profile.workspace_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Campaign not found." };
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/settings/campaigns");
  return {};
}

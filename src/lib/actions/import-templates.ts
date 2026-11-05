"use server";

import { z } from "zod";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { DUPLICATE_MODES, splitTags, type ColumnMapping, type DuplicateMode } from "@/lib/leads/mapped-import-shared";
import { CRM_SOURCES } from "@/lib/leads/crm-sources";

// Saved column mappings ("templates") for the importer and the CRM migration
// wizard, so a repeat import takes one click. A template keeps the column
// mapping plus the import options chosen with it. Row-level security limits
// them to the workspace and to the roles that can import.

export interface TemplateOptions {
  duplicateMode?: DuplicateMode;
  tags?: string;
  list?: string;
}

export interface ImportTemplate {
  id: string;
  name: string;
  kind: "import" | "migration";
  source: string | null;
  headers: string[];
  mapping: ColumnMapping;
  options: TemplateOptions;
  updatedAt: string;
  mine: boolean;
}

const IMPORTERS = ["super_admin", "ops_manager", "data_manager", "lead_gen"];
const kindSchema = z.enum(["import", "migration"]);

function fromRow(r: { id: string; name: string; kind: string; source: string | null; headers: string[]; mapping: unknown; updated_at: string; created_by: string | null }, me: string): ImportTemplate {
  const stored = (r.mapping ?? {}) as { mapping?: ColumnMapping; options?: TemplateOptions };
  return {
    id: r.id,
    name: r.name,
    kind: r.kind === "migration" ? "migration" : "import",
    source: r.source,
    headers: r.headers ?? [],
    mapping: stored.mapping ?? {},
    options: stored.options ?? {},
    updatedAt: r.updated_at,
    mine: r.created_by === me,
  };
}

export async function listImportTemplates(kind: "import" | "migration"): Promise<{ error?: string; templates?: ImportTemplate[] }> {
  const profile = await requireRealProfile();
  if (!IMPORTERS.includes(profile.role)) return { error: "Only people who import leads have saved mappings." };
  const supabase = await createRealClient();
  const { data, error } = await supabase
    .from("import_templates")
    .select("id, name, kind, source, headers, mapping, updated_at, created_by")
    .eq("workspace_id", profile.workspace_id)
    .eq("kind", kindSchema.parse(kind))
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return { error: error.message };
  return { templates: (data ?? []).map((r) => fromRow(r, profile.id)) };
}

const saveSchema = z.object({
  name: z.string().trim().min(1, "Give the mapping a name.").max(80, "Names are at most 80 characters."),
  kind: kindSchema,
  source: z.string().nullable().optional(),
  headers: z.array(z.string().max(200)).max(500),
  mapping: z.record(z.string(), z.unknown()),
  options: z
    .object({
      duplicateMode: z.enum(DUPLICATE_MODES).optional(),
      tags: z.string().max(500).optional(),
      list: z.string().max(80).optional(),
    })
    .optional(),
});

// Saves (or, with the same name, replaces) a mapping.
export async function saveImportTemplate(input: z.input<typeof saveSchema>): Promise<{ error?: string; template?: ImportTemplate }> {
  const profile = await requireRealProfile();
  if (!IMPORTERS.includes(profile.role)) return { error: "Only people who import leads can save a mapping." };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the mapping." };
  const v = parsed.data;
  if (v.source && !CRM_SOURCES.some((c) => c.key === v.source)) return { error: "Unknown CRM." };
  if (JSON.stringify(v.mapping).length > 100_000) return { error: "That mapping is too large to save." };
  const options: TemplateOptions = {
    ...(v.options?.duplicateMode ? { duplicateMode: v.options.duplicateMode } : {}),
    ...(v.options?.tags ? { tags: splitTags(v.options.tags).join(", ") } : {}),
    ...(v.options?.list ? { list: v.options.list.trim() } : {}),
  };
  // Owners are people in this workspace; a template never carries them, so
  // an import always asks who should get the leads.
  const { ownerMap: _owners, ...mapping } = v.mapping as ColumnMapping;
  void _owners;

  const supabase = await createRealClient();
  const { data: existing } = await supabase
    .from("import_templates")
    .select("id")
    .eq("workspace_id", profile.workspace_id)
    .eq("kind", v.kind)
    .ilike("name", v.name.replace(/[%_\\]/g, (c) => `\\${c}`))
    .maybeSingle();
  const row = {
    workspace_id: profile.workspace_id,
    name: v.name,
    kind: v.kind,
    source: v.source ?? null,
    headers: v.headers,
    mapping: { mapping, options } as never,
  };
  const { data, error } = existing
    ? await supabase.from("import_templates").update(row).eq("id", existing.id).select("id, name, kind, source, headers, mapping, updated_at, created_by").single()
    : await supabase
        .from("import_templates")
        .insert({ ...row, created_by: profile.id })
        .select("id, name, kind, source, headers, mapping, updated_at, created_by")
        .single();
  if (error || !data) {
    return { error: error?.code === "42501" ? "Only the person who saved this mapping (or an admin) can replace it." : (error?.message ?? "Couldn't save the mapping.") };
  }
  return { template: fromRow(data, profile.id) };
}

export async function deleteImportTemplate(id: string): Promise<{ error?: string }> {
  const profile = await requireRealProfile();
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown mapping." };
  const supabase = await createRealClient();
  const { data, error } = await supabase.from("import_templates").delete().eq("id", id).eq("workspace_id", profile.workspace_id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Only the person who saved this mapping (or an admin) can delete it." };
  return {};
}

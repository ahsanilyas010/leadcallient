"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { captureException } from "@/lib/error-tracking";
import {
  ImportError,
  buildPlan,
  loadCampaigns,
  parseTabular,
  problemsToCsv,
  runMappedImport,
  type ImportContext,
} from "@/lib/leads/mapped-import";
import {
  DUPLICATE_MODES,
  IMPORT_LIMITS,
  splitTags,
  type ColumnMapping,
  type DuplicateMode,
  type ImportPreview,
  type ImportResult,
} from "@/lib/leads/mapped-import-shared";
import { CRM_SOURCES } from "@/lib/leads/crm-sources";

// Server side of the mapped lead importer (src/lib/leads/mapped-import.ts).
// Two steps, both stateless: the review step (a dry run that saves nothing)
// and the import itself. Each call re-uploads the file and re-validates the
// mapping, so nothing the browser says about counts is ever trusted.

export type PreviewResponse = { error: string } | { ok: true; preview: ImportPreview };
export type ImportResponse =
  | { error: string }
  | { ok: true; result: ImportResult; campaignName: string; sourceName: string | null };

const IMPORTERS = ["super_admin", "ops_manager", "data_manager", "lead_gen"];
const uuid = z.string().uuid();

async function prepare(formData: FormData) {
  const profile = await requireRealProfile();
  if (!IMPORTERS.includes(profile.role)) throw new ImportError("Only an admin, ops manager, Data-only user or lead gen can import leads.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ImportError("Choose a CSV or Excel file.");
  if (file.size > IMPORT_LIMITS.maxBytes) throw new ImportError("That file is larger than 10 MB. Split it and import the parts one at a time.");

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!uuid.safeParse(campaignId).success) throw new ImportError("Choose the campaign these leads belong to.");

  let mapping: ColumnMapping;
  try {
    mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as ColumnMapping;
  } catch {
    throw new ImportError("The column mapping was not understood. Go back and map the columns again.");
  }

  const supabase = await createRealClient();
  const ctx: ImportContext = { supabase, workspaceId: profile.workspace_id, userId: profile.id, role: profile.role };
  const campaigns = await loadCampaigns(ctx);
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new ImportError("Campaign not found.");
  // Dates with no timezone are read in the campaign's timezone (managers can
  // read it; lead gen cannot, so theirs fall back to UTC).
  const { data: tzRow } = await supabase.from("campaigns").select("timezone").eq("id", campaignId).maybeSingle();
  const timezone = tzRow?.timezone ?? null;

  // EVERY import names a data source, and a data source carries the lawful
  // basis the list is held under. This is enforced here (and again by the
  // database: migration 108), never only by the form, so no list can be loaded
  // without a recorded basis.
  const dataSourceId = String(formData.get("data_source_id") ?? "");
  if (!dataSourceId) throw new ImportError("Choose the data source for this list.");
  if (!uuid.safeParse(dataSourceId).success) throw new ImportError("Choose the data source for this list.");
  const { data: sourceRow } = await supabase
    .from("data_sources")
    .select("id, name, lawful_basis, is_active")
    .eq("id", dataSourceId)
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle();
  if (!sourceRow) throw new ImportError("Data source not found.");
  if (!sourceRow.is_active) throw new ImportError("This data source is inactive.");
  // 'unspecified' only labels old uploads from before this rule; a list can't
  // be imported under it. Open the source and set the real basis first.
  if (!sourceRow.lawful_basis || sourceRow.lawful_basis === "unspecified") {
    throw new ImportError("This data source has no lawful basis on file yet. Open it under Data, set the real basis, then import.");
  }
  const source: { id: string; name: string } = { id: sourceRow.id, name: sourceRow.name };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseTabular(bytes, file.name);

  // Import options: what to do with existing leads, an owner, tags and a list
  // for every lead, and (CRM migration) a test-run sample or the rows it took.
  const modeRaw = String(formData.get("duplicate_mode") ?? "skip");
  const duplicateMode: DuplicateMode = (DUPLICATE_MODES as readonly string[]).includes(modeRaw) ? (modeRaw as DuplicateMode) : "skip";
  const assignToRaw = String(formData.get("assign_to") ?? "");
  if (assignToRaw && !uuid.safeParse(assignToRaw).success) throw new ImportError("Choose who owns these leads.");
  const assignTo = assignToRaw || null;
  if (assignTo && !["super_admin", "ops_manager", "data_manager"].includes(profile.role)) {
    throw new ImportError("Only an admin, ops manager or Data-only user can give imported leads an owner.");
  }
  const tags = splitTags(String(formData.get("tags") ?? ""));
  const listLabel = String(formData.get("list") ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || null;
  const int = (k: string, max: number) => {
    const n = Number(formData.get(k) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : 0;
  };
  const sampleSize = int("sample_size", 500);
  const skipRows = int("skip_rows", IMPORT_LIMITS.maxRows);
  const crmRaw = String(formData.get("crm_source") ?? "");
  const crmSource = CRM_SOURCES.some((c) => c.key === crmRaw) ? crmRaw : null;
  const options = { duplicateMode, assignTo, tags, listLabel, sampleSize, skipRows };
  return { profile, ctx, file, bytes, parsed, mapping, campaign, campaigns, timezone, source, options, crmSource };
}

function fail(e: unknown, label: string): { error: string } {
  if (e instanceof ImportError) return { error: e.message };
  captureException(e, { action: label });
  return { error: "Something went wrong reading that file. Please try again." };
}

export async function previewLeadImport(formData: FormData): Promise<PreviewResponse> {
  try {
    const { ctx, parsed, mapping, campaign, campaigns, timezone, options } = await prepare(formData);
    const plan = await buildPlan(ctx, {
      parsed,
      mapping,
      campaigns,
      defaultCampaignId: campaign.id,
      timezone,
      holdPhoneless: true,
      ...options,
    });
    return { ok: true, preview: plan.preview };
  } catch (e) {
    return fail(e, "previewLeadImport");
  }
}

// The review step's "Download the rows that won't import": the same dry run,
// returned as a CSV of every problem row exactly as it was in the file.
export async function previewProblemsCsv(formData: FormData): Promise<{ error: string } | { ok: true; csv: string | null; rows: number }> {
  try {
    const { ctx, parsed, mapping, campaign, campaigns, timezone, options } = await prepare(formData);
    const plan = await buildPlan(ctx, {
      parsed,
      mapping,
      campaigns,
      defaultCampaignId: campaign.id,
      timezone,
      holdPhoneless: true,
      ...options,
    });
    const out = problemsToCsv(parsed, plan.problems);
    return { ok: true, csv: out?.csv ?? null, rows: out?.rows ?? 0 };
  } catch (e) {
    return fail(e, "previewProblemsCsv");
  }
}

export async function runLeadImport(formData: FormData): Promise<ImportResponse> {
  try {
    const { profile, ctx, file, bytes, parsed, mapping, campaign, campaigns, timezone, source, options, crmSource } = await prepare(formData);
    const callMyself = formData.get("call_myself") === "1";
    const screenNow = formData.get("screen_now") === "1";

    const out = await runMappedImport(ctx, {
      parsed,
      mapping,
      campaigns,
      defaultCampaignId: campaign.id,
      timezone,
      holdPhoneless: true,
      filename: file.name,
      fileBytes: bytes,
      contentType: file.type,
      dataSourceId: source.id,
      batchLabel: `${source.name}: ${file.name}`,
      callMyself,
      screenNow,
      ...options,
    });

    // Every import keeps a provenance run (shown under Data > Import history),
    // and rows with a name or email but no number are held as contacts to be
    // promoted later.
    const supabase = ctx.supabase;
    const { data: run } = await supabase
      .from("source_fetch_runs")
      .insert({
        workspace_id: profile.workspace_id,
        data_source_id: source.id,
        campaign_id: campaign.id,
        triggered_by: profile.id,
        params: {
          filename: file.name,
          mapping,
          country: out.preview.country,
          duplicate_mode: options.duplicateMode,
          updated: out.updated,
          ...(crmSource ? { kind: "migration", crm_source: crmSource } : {}),
          ...(options.sampleSize ? { test_run: true, sample_size: options.sampleSize } : {}),
          ...(options.skipRows ? { skipped_rows: options.skipRows } : {}),
        } as never,
        records_found: out.preview.totalRows,
        records_imported: out.imported + out.updated,
        records_rejected:
          out.skippedInvalid +
          out.skippedDuplicates +
          out.skippedEmailDuplicates +
          out.skippedExisting +
          out.skippedSuppressed +
          out.skippedUnknownCampaign +
          out.skippedTrashed,
        records_unphoned: out.phonelessHeld,
        batch_id: out.batchId || null,
        finished_at: new Date().toISOString(),
        status: "complete",
      })
      .select("id")
      .single();
    if (out.phonelessRows.length > 0) {
      for (let i = 0; i < out.phonelessRows.length; i += 500) {
        await supabase.from("unphoned_contacts").insert(
          out.phonelessRows.slice(i, i + 500).map((p) => ({
            workspace_id: profile.workspace_id,
            campaign_id: p.campaignId,
            data_source_id: source.id,
            run_id: run?.id ?? null,
            full_name: p.name,
            email: p.email,
            company_name: p.company,
            custom: p.custom,
            country_hint: p.region,
            // "I will call these myself" covers the phone-less rows too.
            assigned_to: callMyself ? profile.id : null,
          })),
        );
      }
    }

    revalidatePath("/admin/import");
    revalidatePath("/admin/data");
    revalidatePath("/admin/compliance");
    revalidatePath("/admin/campaigns", "layout");
    revalidatePath("/leadgen", "layout");
    revalidatePath("/live");
    revalidatePath("/dial");

    const { phonelessRows: _p, preview: _v, problems, ...rest } = out;
    void _p;
    void _v;
    const problemFile = problemsToCsv(parsed, problems);
    const result: ImportResult = { ...rest, runId: run?.id ?? null, problemsCsv: problemFile?.csv ?? null };
    return { ok: true, result, campaignName: campaign.name, sourceName: source.name };
  } catch (e) {
    return fail(e, "runLeadImport");
  }
}

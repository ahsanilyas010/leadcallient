import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { parsePhoneNumberWithError, type CountryCode } from "libphonenumber-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealDatabase } from "@/lib/supabase/real-types";
import { countryToRegion } from "@/lib/campaign-options";
import { manualScreeningProvider } from "@/lib/compliance/screening";
import { ensureOnRosters } from "./roster";
import {
  IMPORT_LIMITS,
  LEAD_STAGE_OPTIONS,
  PROBLEM_FILE_MAX,
  TAGS_PER_LEAD,
  extraColumnsOf,
  normValue,
  normalizeHeaders,
  splitTags,
  suggestStage,
  validateMapping,
  type ColumnMapping,
  type ColumnPick,
  type DuplicateMode,
  type ImportPreview,
  type ImportResult,
  type PreviewIssue,
} from "./mapped-import-shared";

// The one lead importer. Parses a CSV/Excel file, applies a user-confirmed
// column mapping (Name, Phone number, Company, Email), normalises numbers to
// E.164 using the campaign's country, skips duplicates / existing leads /
// suppressed numbers, and (only on a real import) creates a lead_batches row
// and the leads. It takes a Supabase client acting as the signed-in user, so
// row-level security still applies; it has no Next.js dependency so
// scripts/import-proof.ts can call it directly.
//
// Compliance: phone_hash is the same sha256-of-E.164 the database computes;
// suppressed numbers are never imported; leads always enter as
// screening_status 'pending'. The only way this module changes screening is
// the explicit `screenNow` option, which calls the existing manual
// screen_lead_batch RPC (a manual check against the workspace suppression
// list, not a live TPS/DNC lookup) and is manager-only.

export class ImportError extends Error {}

export type Db = SupabaseClient<RealDatabase>;

export interface ImportContext {
  supabase: Db;
  workspaceId: string;
  userId: string;
  role: string; // profiles.role of the signed-in user
}

export interface ParsedFile {
  headers: string[];
  rows: string[][]; // data rows only
  // Spreadsheet row number of each data row (the header is row 1). Absent:
  // row i is spreadsheet row i + 2.
  rowNumbers?: number[];
  emptyRows?: number; // blank rows between data rows
}

const MANAGER_ROLES = ["super_admin", "ops_manager"];
// Everyone who may change lead data: managers and the Data-only role.
const DATA_ADMIN_ROLES = [...MANAGER_ROLES, "data_manager"];
const IMPORT_ROLES = [...DATA_ADMIN_ROLES, "lead_gen"];
const isManagerRole = (role: string) => MANAGER_ROLES.includes(role);
const isDataAdminRole = (role: string) => DATA_ADMIN_ROLES.includes(role);
// Roles a lead can be owned by (guard_lead_assignment enforces it too).
const OWNER_ROLES = ["agent", "team_lead", "super_admin", "ops_manager"];
const STAGES: string[] = LEAD_STAGE_OPTIONS.map((o) => o.value);

export function phoneHash(e164: string): string {
  return createHash("sha256").update(e164).digest("hex");
}

// ---------------------------------------------------------------- parsing

export function parseTabular(data: Buffer | Uint8Array, filename: string): ParsedFile {
  if (data.byteLength === 0) throw new ImportError("That file is empty.");
  if (data.byteLength > IMPORT_LIMITS.maxBytes) {
    throw new ImportError("That file is larger than 10 MB. Split it into smaller files and import them one at a time.");
  }
  if (!/\.(csv|xlsx|xls)$/i.test(filename)) {
    throw new ImportError("Upload a .csv or .xlsx file.");
  }
  let aoa: unknown[][];
  try {
    // raw: true keeps CSV cells as the original text (so "07700 900123" keeps
    // its leading zero); sheet_to_json(raw: false) then gives Excel cells as
    // the text Excel displays.
    const wb = XLSX.read(data, { type: "buffer", raw: true, cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error("no sheet");
    // blankrows: true keeps empty rows in place, so every row keeps its real
    // spreadsheet row number and the empty ones can be reported.
    aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: true });
    while (aoa.length > 0 && isBlankRow(aoa[0])) aoa.shift();
    while (aoa.length > 0 && isBlankRow(aoa[aoa.length - 1])) aoa.pop();
  } catch {
    throw new ImportError("Couldn't read that file. Check it is a real .csv or .xlsx file.");
  }
  if (aoa.length === 0) throw new ImportError("That file has no rows.");

  const width = Math.max(...aoa.slice(0, 50).map((r) => r.length));
  const headers = normalizeHeaders(Array.from({ length: width }, (_, i) => aoa[0][i]));
  const rows: string[][] = [];
  const rowNumbers: number[] = [];
  let emptyRows = 0;
  aoa.slice(1).forEach((r, i) => {
    const cells = headers.map((_, c) => (r[c] === null || r[c] === undefined ? "" : String(r[c]).trim()));
    if (cells.some((c) => c !== "")) {
      rows.push(cells);
      rowNumbers.push(i + 2);
    } else {
      emptyRows += 1;
    }
  });
  if (rows.length === 0) throw new ImportError("That file has a header row but no data rows.");
  if (rows.length > IMPORT_LIMITS.maxRows) {
    throw new ImportError(
      `That file has ${rows.length.toLocaleString("en-GB")} rows. The limit is ${IMPORT_LIMITS.maxRows.toLocaleString("en-GB")} per import: split it and import the parts one at a time.`,
    );
  }
  return { headers, rows, rowNumbers, emptyRows };
}

function isBlankRow(r: unknown[] | undefined): boolean {
  return !r || r.every((c) => c === null || c === undefined || String(c).trim() === "");
}

// ------------------------------------------------------------ cleaning

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function toE164(raw: string, region: string): { e164: string } | { reason: string } {
  const v = raw.trim();
  if (!v) return { reason: "No phone number in this row" };
  if (/^\d(\.\d+)?e[+-]?\d+$/i.test(v)) {
    return { reason: "Excel turned this number into scientific notation: format the column as Text and save again" };
  }
  try {
    const p = parsePhoneNumberWithError(v, region as CountryCode);
    if (!p.isPossible()) return { reason: `Not a possible phone number for ${region}` };
    return { e164: p.number };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "TOO_SHORT") return { reason: "Too short to be a phone number" };
    if (code === "TOO_LONG") return { reason: "Too long to be a phone number" };
    if (code === "INVALID_COUNTRY") return { reason: "Unknown country code" };
    return { reason: "Not a phone number" };
  }
}

// ---- dates ------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function tzOffsetMs(utcMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// Wall-clock time in a timezone -> UTC instant.
function wallToUtc(y: number, mo: number, d: number, h: number, mi: number, sec: number, tz: string | null): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi, sec);
  const check = new Date(guess);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null; // e.g. 31 Feb
  if (!tz) return check;
  try {
    let ms = guess - tzOffsetMs(guess, tz);
    ms = guess - tzOffsetMs(ms, tz);
    return new Date(ms);
  } catch {
    return check;
  }
}

// Reads the date formats that show up in lead lists: ISO ("2026-03-04",
// "2026-03-04 14:30", with or without a zone), day-first "04/03/2026 14:30"
// (month-first for US campaigns), "4 Mar 2026 2:30pm", "March 4, 2026", and
// Excel serial numbers. A time with no zone is read in the campaign's
// timezone (UTC when that isn't known). Returns null when it can't be read.
export function parseDateTime(raw: string, region: string, tz: string | null): Date | null {
  // Drop a trailing remark such as "Oct 22 11:00 (today)".
  const v = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!v) return null;
  const time = (h?: string, m?: string, sec?: string, ap?: string) => {
    let hh = h ? +h : 0;
    if (ap) {
      const pm = ap.toLowerCase() === "pm";
      if (hh < 1 || hh > 12) return null;
      hh = (hh % 12) + (pm ? 12 : 0);
    }
    return { h: hh, mi: m ? +m : 0, s: sec ? +sec : 0 };
  };

  // Excel serial number (days since 1899-12-30), read as UTC.
  if (/^\d{4,6}(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n >= 20000 && n <= 80000) return new Date(Math.round((n - 25569) * 86400000));
    return null;
  }

  // ISO: 2026-03-04, 2026-03-04 14:30, 2026-03-04T14:30:00Z, +01:00
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const t = time(m[4], m[5], m[6]);
    if (!t) return null;
    if (m[7]) {
      const z = m[7].toUpperCase() === "Z" ? "+00:00" : m[7].length === 5 ? m[7].slice(0, 3) + ":" + m[7].slice(3) : m[7];
      const pad = (n: number) => String(n).padStart(2, "0");
      const d = new Date(`${m[1]}-${pad(+m[2])}-${pad(+m[3])}T${pad(t.h)}:${pad(t.mi)}:${pad(t.s)}${z}`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return wallToUtc(+m[1], +m[2], +m[3], t.h, t.mi, t.s, tz);
  }

  // 04/03/2026, 4-3-26, 04.03.2026 (+ optional time, am/pm). Day-first except for US/CA.
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
    const usFirst = region === "US" || region === "CA";
    let day = usFirst ? +m[2] : +m[1];
    let mon = usFirst ? +m[1] : +m[2];
    if (mon > 12 && day <= 12) [day, mon] = [mon, day];
    const t = time(m[4], m[5], m[6], m[7]);
    if (!t) return null;
    return wallToUtc(y, mon, day, t.h, t.mi, t.s, tz);
  }

  // "4 Mar 2026 2:30pm", "Wed 4th March 2026", "March 4, 2026 at 14:30"
  const dayFirst = v.match(
    /^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})(?:[ ,]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?)?$/i,
  );
  const monthFirst = dayFirst
    ? null
    : v.match(
        /^(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:[ ,]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?)?$/i,
      );
  const mm = dayFirst ?? monthFirst;
  if (mm) {
    const dayStr = dayFirst ? mm[1] : mm[2];
    const monStr = (dayFirst ? mm[2] : mm[1]).slice(0, 3).toLowerCase();
    const mon = MONTHS.indexOf(monStr) + 1;
    if (mon === 0) return null;
    const t = time(mm[4], mm[5], mm[6], mm[7]);
    if (!t) return null;
    return wallToUtc(+mm[3], mon, +dayStr, t.h, t.mi, t.s, tz);
  }

  // No year ("Oct 8 13:00", "Sep 23", "23 Sep"): call sheets are written this
  // way. Use whichever year lands the date nearest to today.
  const yearless =
    v.match(/^(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:[ ,]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i) ??
    v.match(/^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:[ ,]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if (yearless) {
    const monthFirstForm = /^\s*(?:[A-Za-z]{3,9},?\s+)?[A-Za-z]{3,9}\.?\s+\d/.test(v);
    const monStr = (monthFirstForm ? yearless[1] : yearless[2]).slice(0, 3).toLowerCase();
    const dayNum = +(monthFirstForm ? yearless[2] : yearless[1]);
    const mon = MONTHS.indexOf(monStr) + 1;
    if (mon === 0) return null;
    const t = time(yearless[3], yearless[4], undefined, yearless[5]);
    if (!t) return null;
    const thisYear = new Date().getUTCFullYear();
    let best: Date | null = null;
    for (const y of [thisYear - 1, thisYear, thisYear + 1]) {
      const d = wallToUtc(y, mon, dayNum, t.h, t.mi, t.s, tz);
      if (d && (!best || Math.abs(d.getTime() - Date.now()) < Math.abs(best.getTime() - Date.now()))) best = d;
    }
    return best;
  }
  return null;
}

export interface CleanRow {
  row: number;
  campaignId: string;
  campaignName: string;
  name: string | null;
  phone: string;
  hash: string;
  company: string | null;
  email: string | null;
  contact: string | null;
  website: string | null;
  notes: string | null;
  nextStep: string | null;
  appointment: Date | null;
  lastContact: Date | null;
  custom: Record<string, string>;
  status: string | null; // from the stage column, when mapped
  ownerId: string | null; // from the owner column or the import's owner
  tags: string[];
}
export interface PhonelessRow {
  row: number;
  name: string | null;
  email: string | null;
  company: string | null;
  custom: Record<string, string>; // every other column, so nothing is lost
  campaignId: string;
  region: string;
}

export interface AdoptRow {
  leadId: string;
  campaignId: string;
}

export interface UpdateRow {
  leadId: string;
  row: CleanRow;
}

export interface Plan {
  preview: ImportPreview;
  toImport: CleanRow[];
  toUpdate: UpdateRow[];
  phoneless: PhonelessRow[];
  adopt: AdoptRow[];
  // Every row that won't import, or imports with a warning (row = spreadsheet row).
  problems: PreviewIssue[];
}

export interface PlanInput {
  parsed: ParsedFile;
  mapping: ColumnMapping;
  campaigns: CampaignInfo[]; // every campaign in the workspace (for the Campaign column)
  defaultCampaignId: string; // the campaign chosen in step 1
  timezone?: string | null; // default campaign's timezone, for dates with no zone
  holdPhoneless?: boolean; // vendor imports keep name/email-only rows as contacts
  // What to do with a row matching an existing lead (default "skip"). Only a
  // data admin may update or duplicate.
  duplicateMode?: DuplicateMode;
  // Owner for every imported lead (an owner column wins for its rows).
  assignTo?: string | null;
  tags?: string[]; // added to every imported (or updated) lead
  listLabel?: string | null; // the lead's list (group_label)
  // CRM migration: a test run imports the first sampleSize rows; the full run
  // then skips them with skipRows.
  sampleSize?: number;
  skipRows?: number;
}

const INVALID_CAP = 50;

const CUSTOM_MAX_KEYS = 40;
const CUSTOM_KEY_MAX = 60;
const CUSTOM_VALUE_MAX = 500;

const normCampaign = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

export async function buildPlan(ctx: ImportContext, input: PlanInput): Promise<Plan> {
  if (!IMPORT_ROLES.includes(ctx.role)) throw new ImportError("Only an admin, ops manager, Data-only user or lead gen can import leads.");
  const dataAdmin = isDataAdminRole(ctx.role);
  const mode: DuplicateMode = input.duplicateMode ?? "skip";
  if (mode !== "skip" && !dataAdmin) throw new ImportError("Only an admin, ops manager or Data-only user can update or duplicate existing leads.");
  const check = validateMapping(input.parsed.headers, input.mapping);
  if (!check.ok) {
    throw new ImportError(Object.values(check.errors)[0] ?? "The column mapping is incomplete.");
  }
  const defaultCampaign = input.campaigns.find((c) => c.id === input.defaultCampaignId);
  if (!defaultCampaign) throw new ImportError("Campaign not found.");
  const tz = input.timezone ?? null;
  const idx = new Map(input.parsed.headers.map((h, i) => [h, i]));
  const at = (r: string[], col: string | undefined) => (col === undefined ? "" : (r[idx.get(col) ?? -1] ?? ""));
  const m = input.mapping;
  const nameCols = m.name && "first" in m.name ? { first: m.name.first, last: m.name.last } : null;
  const nameCol = m.name && "column" in m.name ? m.name.column : undefined;
  const optCol = (p: ColumnPick | undefined) => (p && "column" in p ? p.column : undefined);
  // No phone column at all: every row is held as a contact without a number.
  const phoneCol = optCol(m.phone);
  const noPhoneColumn = phoneCol === undefined;
  const companyCol = optCol(m.company);
  const emailCol = optCol(m.email);
  const contactCol = optCol(m.contact);
  const websiteCol = optCol(m.website);
  const notesCol = optCol(m.notes);
  const nextStepCol = optCol(m.nextStep);
  const apptCol = optCol(m.appointment);
  const lastCol = optCol(m.lastContact);
  const campaignCol = optCol(m.campaign);
  const statusCol = optCol(m.status);
  const tagsCol = optCol(m.tags);
  // Lead gen can't give leads an owner; for them an owner column is kept as
  // extra information instead.
  const ownerCol = dataAdmin ? optCol(m.owner) : undefined;
  const ownerAsExtra = !dataAdmin ? optCol(m.owner) : undefined;

  // People a lead can be handed to, for the owner column and the import's owner.
  const owners = new Map<string, { id: string; name: string; email: string }>();
  if (dataAdmin && (ownerCol || input.assignTo)) {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .eq("workspace_id", ctx.workspaceId);
    if (error) throw new ImportError(`Couldn't load your team: ${error.message}`);
    for (const p of data ?? []) {
      if (p.is_active && OWNER_ROLES.includes(p.role)) owners.set(p.id, { id: p.id, name: p.full_name, email: p.email });
    }
  }
  if (input.assignTo && !owners.has(input.assignTo)) {
    throw new ImportError("The person chosen as owner can't take leads: pick an active agent, team lead or manager.");
  }
  const ownerMap = new Map<string, string>();
  // Lead gen can't give leads an owner: any owner mapping is ignored for them.
  for (const [raw, id] of Object.entries(dataAdmin ? (m.ownerMap ?? {}) : {})) {
    if (!id) continue;
    if (!owners.has(id)) throw new ImportError(`"${raw}" is matched to someone who can't take leads. Pick an active agent, team lead or manager.`);
    ownerMap.set(normValue(raw), id);
  }
  const statusMap = new Map<string, string>();
  for (const [raw, st] of Object.entries(m.statusMap ?? {})) {
    if (!st) continue;
    if (!STAGES.includes(st)) throw new ImportError(`"${st}" isn't a LeadCallient stage.`);
    statusMap.set(normValue(raw), st);
  }
  const importTags = splitTags((input.tags ?? []).join(","));

  const byName = new Map<string, CampaignInfo>();
  for (const c of input.campaigns) if (!byName.has(normCampaign(c.name))) byName.set(normCampaign(c.name), c);

  // Columns not used by any mapping: kept on the lead as extra information
  // under the label the admin chose (default: the column header).
  const keepExtra = m.keepExtra !== false;
  const extraCols = extraColumnsOf(input.parsed.headers, m).slice(0, CUSTOM_MAX_KEYS);
  if (ownerAsExtra && !extraCols.some((e) => e.column === ownerAsExtra)) extraCols.push({ column: ownerAsExtra, label: "Owner" });
  const extraLabels = extraCols.map((e) => e.label);

  const invalid: PreviewIssue[] = [];
  let invalidCount = 0;
  const dupes: PreviewIssue[] = [];
  let dupeCount = 0;
  const emailDupes: PreviewIssue[] = [];
  let emailDupeCount = 0;
  const badDates: PreviewIssue[] = [];
  let badDateCount = 0;
  const unmatched: PreviewIssue[] = [];
  let unmatchedCount = 0;
  let ignoredEmails = 0;
  const problems: PreviewIssue[] = [];
  const problem = (row: number, value: string, reason: string) => {
    if (problems.length < IMPORT_LIMITS.maxRows) problems.push({ row, value, reason });
  };
  const phoneless: PhonelessRow[] = [];
  const firstSeenRow = new Map<string, number>();
  const firstSeenEmail = new Map<string, number>();
  const unique: CleanRow[] = [];
  const stageCounts = new Map<string, { value: string; count: number }>();
  const ownerCounts = new Map<string, { value: string; count: number }>();
  const text = (r: string[], col: string | undefined, max: number) => at(r, col).replace(/\s+/g, " ").trim().slice(0, max) || null;

  // A test run takes the first rows; the full run after it skips them.
  const skip = Math.max(0, input.skipRows ?? 0);
  const take = input.sampleSize && input.sampleSize > 0 ? input.sampleSize : Infinity;
  const rowNo = (i: number) => input.parsed.rowNumbers?.[i] ?? i + 2;

  input.parsed.rows.forEach((r, i) => {
    if (i < skip || i >= skip + take) return;
    const row = rowNo(i);

    // Which campaign this row belongs to.
    let campaign = defaultCampaign;
    const rawCampaign = at(r, campaignCol).replace(/\s+/g, " ").trim();
    if (campaignCol && rawCampaign) {
      const hit = byName.get(normCampaign(rawCampaign));
      if (hit) campaign = hit;
      else if (!m.fallbackToDefault) {
        unmatchedCount += 1;
        if (unmatched.length < INVALID_CAP) {
          unmatched.push({ row, value: rawCampaign, reason: "No campaign with this name in your workspace" });
        }
        problem(row, rawCampaign, "No campaign with this name in your workspace");
        return;
      }
    }
    const region = countryToRegion(campaign.country);

    const name =
      (nameCols ? [at(r, nameCols.first), at(r, nameCols.last)].filter(Boolean).join(" ") : at(r, nameCol))
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200) || null;
    const company = text(r, companyCol, 200);
    let email: string | null = at(r, emailCol).trim().slice(0, 254) || null;
    if (email && !EMAIL_RE.test(email)) {
      ignoredEmails += 1;
      problem(row, email, "Doesn't look like an email address: imported with the email left empty");
      email = null;
    }
    const custom: Record<string, string> = {};
    for (const e of extraCols) {
      const v = at(r, e.column).trim();
      if (v) custom[e.label.slice(0, CUSTOM_KEY_MAX)] = v.slice(0, CUSTOM_VALUE_MAX);
    }

    // Stage and owner, from the file.
    const rawStage = at(r, statusCol).trim();
    if (statusCol && rawStage) {
      const k = normValue(rawStage);
      const c = stageCounts.get(k) ?? { value: rawStage, count: 0 };
      c.count += 1;
      stageCounts.set(k, c);
    }
    const status = rawStage ? (statusMap.get(normValue(rawStage)) ?? null) : null;
    if (statusCol && rawStage && !status) {
      // Unmapped stages are kept on the lead so nothing from the old system is lost.
      custom[(m.status && "column" in m.status ? m.status.column : "Stage").slice(0, CUSTOM_KEY_MAX)] = rawStage.slice(0, CUSTOM_VALUE_MAX);
    }
    const rawOwner = at(r, ownerCol).trim();
    if (ownerCol && rawOwner) {
      const k = normValue(rawOwner);
      const c = ownerCounts.get(k) ?? { value: rawOwner, count: 0 };
      c.count += 1;
      ownerCounts.set(k, c);
    }
    const ownerId = (rawOwner ? ownerMap.get(normValue(rawOwner)) : undefined) ?? input.assignTo ?? null;
    if (ownerCol && rawOwner && !ownerMap.get(normValue(rawOwner))) {
      custom["Owner"] = rawOwner.slice(0, CUSTOM_VALUE_MAX);
    }
    const tags = splitTags([...(tagsCol ? splitTags(at(r, tagsCol)) : []), ...importTags].join(",")).slice(0, TAGS_PER_LEAD);

    const rawPhone = at(r, phoneCol);
    const parsed = noPhoneColumn ? { reason: "No phone column in this file" } : toE164(rawPhone, region);
    if ("reason" in parsed) {
      // A row with no number but something else worth keeping (a name, email,
      // company or any extra column) is held as a contact; its other mapped
      // details ride along in custom so nothing in the file is lost.
      const hasContent = Boolean(name || email || company || Object.keys(custom).length > 0);
      if ((noPhoneColumn || !rawPhone.trim()) && (input.holdPhoneless || noPhoneColumn) && hasContent) {
        const held = { ...custom };
        const keep = (label: string, col: string | undefined, max: number) => {
          const v = text(r, col, max);
          if (v) held[label] = v;
        };
        keep("Contact person", contactCol, 200);
        keep("Website", websiteCol, 300);
        keep("Notes", notesCol, 500);
        keep("Next step", nextStepCol, 500);
        keep("Appointment / follow-up", apptCol, 100);
        keep("Last contact", lastCol, 100);
        if (tags.length > 0) held["Tags"] = tags.join(", ");
        phoneless.push({ row, name, email, company, custom: held, campaignId: campaign.id, region });
        return;
      }
      invalidCount += 1;
      if (invalid.length < INVALID_CAP) invalid.push({ row, value: rawPhone, reason: parsed.reason });
      problem(row, rawPhone, parsed.reason);
      return;
    }
    const hash = phoneHash(parsed.e164);
    const first = firstSeenRow.get(hash);
    if (first !== undefined && mode !== "create") {
      dupeCount += 1;
      if (dupes.length < INVALID_CAP) dupes.push({ row, value: parsed.e164, reason: `Same number as row ${first}` });
      problem(row, parsed.e164, `Same number as row ${first}`);
      return;
    }
    if (first === undefined) firstSeenRow.set(hash, row);
    // The same person under a second number: skipped like a repeated number.
    const emailKey = email ? email.toLowerCase() : null;
    const firstEmail = emailKey ? firstSeenEmail.get(emailKey) : undefined;
    if (firstEmail !== undefined && mode !== "create") {
      emailDupeCount += 1;
      if (emailDupes.length < INVALID_CAP) emailDupes.push({ row, value: email ?? "", reason: `Same email as row ${firstEmail}` });
      problem(row, email ?? "", `Same email as row ${firstEmail}`);
      return;
    }
    if (emailKey && firstEmail === undefined) firstSeenEmail.set(emailKey, row);

    const date = (col: string | undefined, label: string): Date | null => {
      const raw = at(r, col).trim();
      if (!raw) return null;
      const d = parseDateTime(raw, region, tz);
      if (!d) {
        badDateCount += 1;
        if (badDates.length < INVALID_CAP) badDates.push({ row, value: raw, reason: `${label} isn't a date we can read` });
        problem(row, raw, `${label} isn't a date we can read: imported with the date left empty`);
        // Keep the original text so nothing in the file is lost.
        if (keepExtra && col) custom[col.slice(0, CUSTOM_KEY_MAX)] = raw.slice(0, CUSTOM_VALUE_MAX);
      }
      return d;
    };

    unique.push({
      row,
      campaignId: campaign.id,
      campaignName: campaign.name,
      name,
      phone: parsed.e164,
      hash,
      company,
      email,
      contact: text(r, contactCol, 200),
      website: text(r, websiteCol, 300),
      notes: at(r, notesCol).trim().slice(0, 4000) || null,
      nextStep: text(r, nextStepCol, 500),
      appointment: date(apptCol, "Appointment / follow-up"),
      lastContact: date(lastCol, "Last contact"),
      custom,
      status,
      ownerId,
      tags,
    });
  });

  // Already in the workspace (by number, then by email), in the trash, or
  // suppressed. import_find_existing() answers for every importing role; lead
  // ids come back only to roles that may update leads.
  const existingByHash = new Map<string, { ids: string[]; trashed: boolean }>();
  const existingByEmail = new Map<string, { ids: string[]; trashed: boolean }>();
  const suppressed = new Set<string>();
  const note = (map: Map<string, { ids: string[]; trashed: boolean }>, key: string, id: string | null, trashed: boolean) => {
    const e = map.get(key) ?? { ids: [], trashed: true };
    if (!trashed) {
      e.trashed = false;
      if (id) e.ids.push(id);
    }
    map.set(key, e);
  };
  const hashes = unique.map((u) => u.hash);
  const emails = [...new Set(unique.map((u) => u.email?.toLowerCase()).filter((e): e is string => Boolean(e)))];
  for (let i = 0; i < Math.max(hashes.length, emails.length); i += 500) {
    const { data, error } = await ctx.supabase.rpc("import_find_existing", {
      p_hashes: hashes.slice(i, i + 500),
      p_emails: emails.slice(i, i + 500),
    });
    if (error) throw new ImportError(`Couldn't check for existing leads: ${error.message}`);
    for (const k of data ?? []) {
      if (!k.match_value) continue;
      if (k.suppressed) suppressed.add(k.match_value);
      else if (k.match_on === "phone") note(existingByHash, k.match_value, k.lead_id, k.trashed);
      else note(existingByEmail, k.match_value, k.lead_id, k.trashed);
    }
  }
  // Existing leads with no campaign are invisible to every campaign and the
  // dial queue. Managers can read them, so a re-import (skip mode) rescues them.
  const orphans = new Map<string, string>(); // phone_hash -> lead id
  if (isManagerRole(ctx.role) && mode === "skip" && existingByHash.size > 0) {
    const known = [...existingByHash.keys()];
    for (let i = 0; i < known.length; i += 200) {
      const { data, error } = await ctx.supabase
        .from("leads")
        .select("id, phone_hash")
        .eq("workspace_id", ctx.workspaceId)
        .is("campaign_id", null)
        .in("phone_hash", known.slice(i, i + 200));
      if (error) throw new ImportError(`Couldn't check for existing leads: ${error.message}`);
      for (const l of data ?? []) if (l.phone_hash && !orphans.has(l.phone_hash)) orphans.set(l.phone_hash, l.id);
    }
  }
  let alreadyInWorkspace = 0;
  let existingEmailCount = 0;
  let inTrash = 0;
  let suppressedCount = 0;
  const toImport: CleanRow[] = [];
  const toUpdate: UpdateRow[] = [];
  const adopt: AdoptRow[] = [];
  const updating = new Set<string>();
  for (const u of unique) {
    if (suppressed.has(u.hash)) {
      suppressedCount += 1;
      problem(u.row, u.phone, "On your suppression (do-not-call) list");
      continue;
    }
    const byPhone = existingByHash.get(u.hash);
    const byEmail = !byPhone && u.email ? existingByEmail.get(u.email.toLowerCase()) : undefined;
    const match = byPhone ?? byEmail;
    if (match && match.trashed) {
      inTrash += 1;
      problem(u.row, byPhone ? u.phone : (u.email ?? ""), "Matches a lead in the trash: restore it from the trash instead");
      continue;
    }
    if (!match || mode === "create") {
      toImport.push(u);
      continue;
    }
    if (mode === "update") {
      const leadId = match.ids.find((id) => !updating.has(id));
      if (leadId) {
        updating.add(leadId);
        toUpdate.push({ leadId, row: u });
      } else {
        alreadyInWorkspace += 1;
        problem(u.row, u.phone, "Already updated by an earlier row in this file");
      }
      continue;
    }
    if (byPhone && orphans.has(u.hash)) {
      adopt.push({ leadId: orphans.get(u.hash)!, campaignId: u.campaignId });
      continue;
    }
    alreadyInWorkspace += 1;
    if (!byPhone) existingEmailCount += 1;
    problem(u.row, byPhone ? u.phone : (u.email ?? ""), byPhone ? "Already a lead in your workspace (same number)" : "Already a lead in your workspace (same email)");
  }

  const perCampaign = new Map<string, { campaignId: string; name: string; count: number }>();
  for (const t of toImport) {
    const e = perCampaign.get(t.campaignId) ?? { campaignId: t.campaignId, name: t.campaignName, count: 0 };
    e.count += 1;
    perCampaign.set(t.campaignId, e);
  }

  // Owner suggestions: a value that matches someone's name or email.
  const byOwnerName = new Map<string, string>();
  for (const o of owners.values()) {
    byOwnerName.set(normValue(o.name), o.id);
    byOwnerName.set(normValue(o.email), o.id);
    byOwnerName.set(normValue(o.email.split("@")[0]), o.id);
  }
  problems.sort((a, b) => a.row - b.row);

  return {
    toImport,
    toUpdate,
    phoneless,
    adopt,
    problems,
    preview: {
      totalRows: Math.min(input.parsed.rows.length - skip, take === Infinity ? Number.MAX_SAFE_INTEGER : take),
      willImport: toImport.length,
      adoptable: adopt.length,
      invalid,
      invalidCount,
      duplicatesInFile: dupes,
      duplicatesInFileCount: dupeCount,
      alreadyInWorkspace,
      suppressed: suppressedCount,
      ignoredEmails,
      phonelessHeld: phoneless.length,
      invalidDates: badDates,
      invalidDateCount: badDateCount,
      campaignBreakdown: [...perCampaign.values()].sort((a, b) => b.count - a.count),
      unmatchedCampaigns: unmatched,
      unmatchedCampaignCount: unmatchedCount,
      extraColumns: extraLabels,
      noPhoneColumn,
      heldSample: phoneless.slice(0, 6).map((p) => ({ row: p.row, name: p.name, company: p.company, email: p.email })),
      sample: toImport.slice(0, 6).map((c) => ({
        row: c.row,
        name: c.name,
        phone: c.phone,
        company: c.company,
        email: c.email,
        contact: c.contact,
        website: c.website,
        campaign: c.campaignName,
        notes: c.notes,
        nextStep: c.nextStep,
        appointment: c.appointment ? c.appointment.toISOString() : null,
        lastContact: c.lastContact ? c.lastContact.toISOString() : null,
      })),
      country: countryToRegion(defaultCampaign.country),
      timezone: tz,
      emptyRows: skip > 0 || take !== Infinity ? 0 : (input.parsed.emptyRows ?? 0),
      duplicateEmailsInFile: emailDupes,
      duplicateEmailsInFileCount: emailDupeCount,
      duplicateMode: mode,
      willUpdate: toUpdate.length,
      existingByEmail: existingEmailCount,
      inTrash,
      stageValues: [...stageCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 200)
        .map((v) => ({ ...v, suggested: suggestStage(v.value) })),
      ownerValues: [...ownerCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 200)
        .map((v) => ({ ...v, suggested: byOwnerName.get(normValue(v.value)) ?? "" })),
    },
  };
}

// Every problem row as a CSV the admin can fix and import again: the row
// number and reason, then the row exactly as it was in the file.
export function problemsToCsv(parsed: ParsedFile, problems: PreviewIssue[]): { csv: string; rows: number } | null {
  if (problems.length === 0) return null;
  const byRow = new Map<number, string[]>();
  parsed.rows.forEach((r, i) => byRow.set(parsed.rowNumbers?.[i] ?? i + 2, r));
  // Quote when needed; a cell that would start a spreadsheet formula gets a
  // leading apostrophe (phone numbers like +44 7700 900123 are left alone).
  const esc = (v: string) => {
    const formula = /^[=+\-@\t\r]/.test(v) && !/^[+\-]?[\d\s().-]+$/.test(v);
    const out = (formula ? "'" : "") + v;
    return /[",\n\r]/.test(out) || formula ? `"${out.replace(/"/g, '""')}"` : out;
  };
  const lines = [["Row", "Problem", ...parsed.headers].map(esc).join(",")];
  const shown = problems.slice(0, PROBLEM_FILE_MAX);
  for (const p of shown) lines.push([String(p.row), p.reason, ...(byRow.get(p.row) ?? [])].map(esc).join(","));
  if (problems.length > shown.length) lines.push(esc(`...and ${problems.length - shown.length} more rows not listed`));
  return { csv: lines.join("\r\n"), rows: problems.length };
}

// ---------------------------------------------------------------- import

export interface CampaignInfo {
  id: string;
  name: string;
  country: string | null;
}

// Name-only campaign list that works for managers and lead gen alike, and is
// always scoped to the caller's workspace by the RPC.
export async function loadCampaigns(ctx: ImportContext): Promise<CampaignInfo[]> {
  const { data, error } = await ctx.supabase.rpc("leadgen_campaigns");
  if (error) throw new ImportError(error.message);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, country: c.country }));
}

export interface ImportOptions extends PlanInput {
  filename: string;
  fileBytes: Uint8Array;
  contentType?: string;
  dataSourceId?: string | null;
  batchLabel?: string; // defaults to the file name
  callMyself?: boolean; // managers only: assign to me + put me on the roster
  screenNow?: boolean; // data admins only: run the manual screening check now
  // set by the caller when it already ran buildPlan (avoids doing it twice)
  plan?: Plan;
}

export async function runMappedImport(
  ctx: ImportContext,
  opts: ImportOptions,
): Promise<Omit<ImportResult, "runId" | "problemsCsv"> & { phonelessRows: PhonelessRow[]; preview: ImportPreview; problems: PreviewIssue[] }> {
  const manager = isManagerRole(ctx.role);
  const dataAdmin = isDataAdminRole(ctx.role);
  if (opts.callMyself && !manager) {
    throw new ImportError("Only an admin or ops manager can assign leads to themselves to call.");
  }
  if (opts.screenNow && !dataAdmin) {
    throw new ImportError("Only an admin, ops manager or Data-only user can screen leads.");
  }
  if (opts.callMyself && opts.assignTo) {
    throw new ImportError("Choose either \"I will call these myself\" or an owner for the leads, not both.");
  }
  const plan = opts.plan ?? (await buildPlan(ctx, opts));
  if (plan.toImport.length === 0 && plan.toUpdate.length === 0 && plan.phoneless.length === 0 && plan.adopt.length === 0) {
    throw new ImportError("Nothing to import: every row was invalid, a duplicate, already in your workspace, suppressed or had an unknown campaign.");
  }

  const sb = ctx.supabase;
  const ws = ctx.workspaceId;
  const p = plan.preview;
  const campaignIds = [...new Set([...plan.toImport.map((t) => t.campaignId), ...plan.adopt.map((a) => a.campaignId)])];

  // 1. Call-myself roster membership first, so a failure creates nothing.
  let rosteredMe = false;
  if (opts.callMyself) {
    for (const campaignId of campaignIds) {
      const { error } = await sb.from("campaign_assignments").upsert(
        { workspace_id: ws, campaign_id: campaignId, user_id: ctx.userId },
        { onConflict: "campaign_id,user_id", ignoreDuplicates: true },
      );
      if (error) throw new ImportError(`Couldn't put you on this campaign's roster: ${error.message}`);
    }
    rosteredMe = campaignIds.length > 0;
  }

  // 1b. Attach campaign-less existing leads to their campaign. Only rows still
  // without a campaign are touched, so this can't move a lead between campaigns.
  let adopted = 0;
  for (const campaignId of new Set(plan.adopt.map((a) => a.campaignId))) {
    const ids = plan.adopt.filter((a) => a.campaignId === campaignId).map((a) => a.leadId);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await sb
        .from("leads")
        .update({ campaign_id: campaignId })
        .eq("workspace_id", ws)
        .is("campaign_id", null)
        .in("id", ids.slice(i, i + 200))
        .select("id");
      if (error) throw new ImportError(`Couldn't attach existing leads to the campaign: ${error.message}`);
      adopted += data?.length ?? 0;
    }
  }

  // 2. Keep the original file (same bucket/path convention as before).
  let storagePath: string | null = null;
  if (plan.toImport.length > 0) {
    const path = `${ws}/${Date.now()}-${opts.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await sb.storage
      .from("lead-uploads")
      .upload(path, opts.fileBytes, { contentType: opts.contentType || "text/csv" });
    if (upErr) throw new ImportError(`Couldn't store the file: ${upErr.message}`);
    storagePath = path;
  }

  // 3. Batch + leads.
  let batchId = "";
  let screened = 0;
  const listLabel = opts.listLabel?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
  if (plan.toImport.length > 0) {
    const { data: batch, error: bErr } = await sb
      .from("lead_batches")
      .insert({
        workspace_id: ws,
        campaign_id: opts.defaultCampaignId,
        data_source_id: opts.dataSourceId ?? null,
        source: opts.batchLabel ?? opts.filename,
        uploaded_by: ctx.userId,
        row_count: plan.toImport.length,
        status: "uploaded",
        storage_path: storagePath,
      })
      .select("id")
      .single();
    if (bErr || !batch) throw new ImportError(bErr?.message ?? "Couldn't create the batch.");
    batchId = batch.id;

    try {
      for (let i = 0; i < plan.toImport.length; i += 500) {
        const chunk = plan.toImport.slice(i, i + 500).map((r) => ({
          workspace_id: ws,
          campaign_id: r.campaignId,
          batch_id: batchId,
          data_source_id: opts.dataSourceId ?? null,
          phone_e164: r.phone,
          full_name: r.name,
          company_name: r.company,
          email: r.email,
          contact_name: r.contact,
          website: r.website,
          agent_notes: r.notes,
          next_step: r.nextStep,
          appointment_at: r.appointment ? r.appointment.toISOString() : null,
          last_contact_at: r.lastContact ? r.lastContact.toISOString() : null,
          custom: r.custom,
          tags: r.tags,
          group_label: listLabel,
          source: "upload",
          screening_status: "pending",
          ...(r.status ? { status: r.status } : {}),
          ...(opts.callMyself
            ? { assigned_to: ctx.userId, assigned_by: ctx.userId }
            : r.ownerId
              ? { assigned_to: r.ownerId, assigned_by: ctx.userId }
              : {}),
        }));
        const { error } = await sb.from("leads").insert(chunk);
        if (error) throw new ImportError(error.message);
      }
    } catch (e) {
      // A half-finished import is rolled back: managers delete it outright; the
      // Data-only role (which can't delete permanently) moves it to the trash.
      if (manager) {
        await sb.from("leads").delete().eq("batch_id", batchId).eq("workspace_id", ws);
        await sb.from("lead_batches").delete().eq("id", batchId).eq("workspace_id", ws);
      } else if (dataAdmin) {
        const { data: half } = await sb.from("leads").select("id").eq("batch_id", batchId).eq("workspace_id", ws);
        const ids = (half ?? []).map((l) => l.id);
        for (let i = 0; i < ids.length; i += 5000) await sb.rpc("trash_leads", { p_ids: ids.slice(i, i + 5000) });
      }
      throw e instanceof ImportError ? e : new ImportError("The import failed part-way through.");
    }

    // 4. Optional manual screening of just this batch.
    if (opts.screenNow) {
      try {
        const r = await manualScreeningProvider.screenBatch(sb, { batchId, evidenceUrl: null });
        screened = r.screenedCount;
      } catch (e) {
        throw new ImportError(
          `The leads were imported but screening failed: ${e instanceof Error ? e.message : "unknown error"}. You can screen the batch from Compliance.`,
        );
      }
    }
  }

  // 5. "Update existing": one statement per 500 leads. Empty cells never
  // overwrite; tags and extra information are merged.
  let updated = 0;
  if (plan.toUpdate.length > 0) {
    if (!dataAdmin) throw new ImportError("Only an admin, ops manager or Data-only user can update existing leads.");
    for (let i = 0; i < plan.toUpdate.length; i += 500) {
      const rows = plan.toUpdate.slice(i, i + 500).map(({ leadId, row: r }) => ({
        id: leadId,
        full_name: r.name,
        company_name: r.company,
        email: r.email,
        contact_name: r.contact,
        website: r.website,
        agent_notes: r.notes,
        next_step: r.nextStep,
        appointment_at: r.appointment ? r.appointment.toISOString() : null,
        last_contact_at: r.lastContact ? r.lastContact.toISOString() : null,
        status: r.status,
        group_label: listLabel,
        tags: r.tags.length > 0 ? r.tags : null,
        custom: Object.keys(r.custom).length > 0 ? r.custom : null,
        campaign_id: r.campaignId,
        assigned_to: opts.callMyself ? ctx.userId : r.ownerId,
      }));
      const { data, error } = await sb.rpc("import_update_leads", { p_rows: rows as never });
      if (error) throw new ImportError(`Some existing leads couldn't be updated: ${error.message}`);
      updated += data ?? 0;
    }
  }

  // 6. Owners join the rosters of the campaigns their leads are in, so the
  // leads actually reach them (same rule as assigning from the Leads page).
  const ownerCampaigns = new Map<string, Set<string>>();
  for (const r of [...plan.toImport, ...plan.toUpdate.map((u) => u.row)]) {
    if (!r.ownerId || opts.callMyself) continue;
    const set = ownerCampaigns.get(r.ownerId) ?? new Set<string>();
    set.add(r.campaignId);
    ownerCampaigns.set(r.ownerId, set);
  }
  for (const [owner, camps] of ownerCampaigns) {
    try {
      await ensureOnRosters(sb, ws, owner, [...camps]);
    } catch (e) {
      throw new ImportError(`The leads were imported, but an owner couldn't be put on the campaign roster: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }
  const ownersAssigned = opts.callMyself ? 0 : [...plan.toImport, ...plan.toUpdate.map((u) => u.row)].filter((r) => r.ownerId).length;
  const stagesSet = [...plan.toImport, ...plan.toUpdate.map((u) => u.row)].filter((r) => r.status).length;

  // 7. Campaigns set to auto-assign new leads share them out to the roster now
  // (same rules as the Auto-assign button: screened leads, up to each agent's
  // daily target). Lead gen's imports wait for a manager.
  let autoAssigned = 0;
  if (dataAdmin && plan.toImport.length > 0) {
    const { data: auto } = await sb
      .from("campaigns")
      .select("id")
      .eq("workspace_id", ws)
      .eq("auto_assign_new", true)
      .in("id", campaignIds);
    for (const c of auto ?? []) {
      const { data } = await sb.rpc("auto_assign_campaign_leads", { p_campaign_id: c.id });
      autoAssigned += data ?? 0;
    }
  }

  return {
    batchId,
    imported: plan.toImport.length,
    skippedInvalid: p.invalidCount,
    skippedDuplicates: p.duplicatesInFileCount,
    skippedExisting: p.alreadyInWorkspace,
    skippedSuppressed: p.suppressed,
    skippedUnknownCampaign: p.unmatchedCampaignCount,
    adopted,
    assignedToMe: opts.callMyself ? plan.toImport.length : 0,
    screened,
    rosteredMe,
    phonelessHeld: plan.phoneless.length,
    campaignId: opts.defaultCampaignId,
    campaigns: p.campaignBreakdown,
    updated,
    skippedTrashed: p.inTrash,
    skippedEmailDuplicates: p.duplicateEmailsInFileCount,
    ownersAssigned,
    stagesSet,
    autoAssigned,
    problemRows: plan.problems.length,
    phonelessRows: plan.phoneless,
    preview: p,
    problems: plan.problems,
  };
}

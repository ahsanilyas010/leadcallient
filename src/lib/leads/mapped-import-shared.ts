// Client-safe half of the mapped lead importer: the four target fields, header
// auto-suggestion and mapping validation. No Node or server imports, so the
// browser (mapping step) and the server (mapped-import.ts) share one source of
// truth. The server never trusts a client-side validation: it re-runs
// validateMapping() on the mapping it receives.

export const TARGET_FIELDS = ["name", "phone", "company", "email"] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];

export const FIELD_LABELS: Record<TargetField, string> = {
  name: "Name",
  phone: "Phone number",
  company: "Company",
  email: "Email",
};

// A field is either read from one column, or explicitly declared absent
// ("This file has no <field>"). Name can also be built from two columns.
export type ColumnPick = { column: string } | { none: true };
export type NamePick = ColumnPick | { first: string; last: string };

// Optional targets: absent / { none: true } means "not in this file".
export const OPTIONAL_FIELDS = ["contact", "website", "campaign", "notes", "nextStep", "appointment", "lastContact", "status", "owner", "tags"] as const;
export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

export const OPTIONAL_LABELS: Record<OptionalField, string> = {
  contact: "Contact person",
  website: "Website",
  campaign: "Campaign",
  notes: "Notes",
  nextStep: "Next step",
  appointment: "Appointment / follow-up date and time",
  lastContact: "Last contact date",
  status: "Stage / status",
  owner: "Owner (agent)",
  tags: "Tags",
};

export const OPTIONAL_HINTS: Record<OptionalField, string> = {
  contact: "A person to ask for, when it is different from the name above.",
  website: "The company's website.",
  campaign: "A column of campaign names, so one file can feed several campaigns. Names must match a campaign you already have; unmatched rows are listed on the review step and skipped unless you choose to use the campaign from step 1.",
  notes: "Saved as the lead's notes.",
  nextStep: "What should happen next with this lead.",
  appointment: "When to call back or meet. Common date formats are understood (2026-03-04 14:30, 04/03/2026, 4 Mar 2026).",
  lastContact: "When this person was last spoken to.",
  status: "The lead's stage in your old system (New, Contacted, Won...). You match each value to a LeadCallient stage on the review step.",
  owner: "Who owns the lead in your old system. You match each name to one of your agents on the review step.",
  tags: "Labels separated by commas, semicolons or |. Each one becomes a tag you can filter and bulk-edit by.",
};

// What to do with a column that isn't mapped to a field: keep it as extra
// information under a label of the admin's choosing (default: the column
// header), or leave it out of the import.
export type ExtraPick = { label?: string; skip?: boolean };
export const EXTRA_LABEL_MAX = 60;

export interface ColumnMapping {
  name?: NamePick;
  // { none: true } = this file has no phone numbers. Every row is then kept as
  // a contact (with all its other columns) for an agent to find a number for;
  // nothing can be dialled until a number is added and screened.
  phone?: ColumnPick;
  company?: ColumnPick;
  email?: ColumnPick;
  contact?: ColumnPick;
  website?: ColumnPick;
  campaign?: ColumnPick;
  notes?: ColumnPick;
  nextStep?: ColumnPick;
  appointment?: ColumnPick;
  lastContact?: ColumnPick;
  status?: ColumnPick;
  owner?: ColumnPick;
  tags?: ColumnPick;
  // Save every column that isn't mapped above on the lead as extra
  // information (leads.custom). Default true.
  keepExtra?: boolean;
  // Per-column override for unmapped columns: a display label, or skip.
  // Columns not listed here follow keepExtra.
  extra?: Record<string, ExtraPick>;
  // Rows whose campaign name matches no campaign go to the step-1 campaign
  // instead of being skipped. Default false.
  fallbackToDefault?: boolean;
  // Stage column: raw value (normalised with normValue) -> LeadCallient
  // status. Values not listed, or mapped to "", keep the default status.
  statusMap?: Record<string, string>;
  // Owner column: raw value (normalised with normValue) -> profile id. Values
  // not listed, or mapped to "", leave the lead unassigned.
  ownerMap?: Record<string, string>;
}

// What happens to a row whose phone number (or email) is already a lead.
export const DUPLICATE_MODES = ["skip", "update", "create"] as const;
export type DuplicateMode = (typeof DUPLICATE_MODES)[number];
export const DUPLICATE_MODE_LABELS: Record<DuplicateMode, { label: string; hint: string }> = {
  skip: { label: "Skip it", hint: "The existing lead is left as it is. Safest for lists you may have loaded before." },
  update: {
    label: "Update the existing lead",
    hint: "Fills in and changes fields from the file. Empty cells never overwrite what is there; tags and extra information are added to.",
  },
  create: { label: "Create a new lead anyway", hint: "Keeps both. Use only when the same number really belongs to different people." },
};

// LeadCallient's lead stages, as a stage mapping offers them.
export const LEAD_STAGE_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Won / converted" },
  { value: "rejected", label: "Lost / not interested" },
] as const;

// Raw cell values are compared case- and space-insensitively.
export const normValue = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

// First guess at a LeadCallient stage for a CRM stage or status name.
export function suggestStage(raw: string): string {
  const v = normValue(raw);
  if (!v) return "";
  if (/\b(won|closed ?won|customer|converted|sale|sold|signed|deal won|client)\b/.test(v)) return "converted";
  if (/\b(lost|closed ?lost|unqualified|disqualified|not interested|junk|bad|dead|do not call|dnc|rejected|declined|recycled)\b/.test(v)) return "rejected";
  if (/\b(qualified|interested|hot|meeting|demo|appointment|opportunity|proposal|negotiation|quote|sql|mql)\b/.test(v)) return "qualified";
  if (/\b(contacted|attempted|working|in progress|connected|follow ?up|callback|nurturing|engaged|left message|voicemail)\b/.test(v)) return "contacted";
  if (/\b(new|open|not contacted|fresh|lead|subscriber|prospect|untouched|unassigned)\b/.test(v)) return "new";
  return "";
}

// Splits a tags cell ("vip, uk; spring|webinar") into clean, unique tags.
export const TAG_MAX = 40;
export const TAGS_PER_LEAD = 30;
export function splitTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.split(/[,;|]/)) {
    const c = t.replace(/\s+/g, " ").trim().slice(0, TAG_MAX);
    if (c && !out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c);
    if (out.length >= TAGS_PER_LEAD) break;
  }
  return out;
}

export interface MappingCheck {
  ok: boolean;
  // field -> plain-language problem
  errors: Partial<Record<TargetField, string>>;
}

function isNone(p: unknown): p is { none: true } {
  return !!p && typeof p === "object" && (p as { none?: unknown }).none === true;
}
function colOf(p: unknown): string | null {
  if (!p || typeof p !== "object") return null;
  const c = (p as { column?: unknown }).column;
  return typeof c === "string" && c !== "" ? c : null;
}

// Every field must be consciously given: a column, or an explicit "no such
// column". A file with no phone column is accepted (its rows become contacts
// without a number), but the mapping must still say so explicitly.
export function validateMapping(headers: string[], mapping: ColumnMapping): MappingCheck {
  const errors: MappingCheck["errors"] = {};
  const has = (c: string) => headers.includes(c);

  const phone = colOf(mapping.phone);
  if (!mapping.phone) errors.phone = "Choose the column that holds the phone number, or say this file has no phone numbers.";
  else if (isNone(mapping.phone)) {
    // Allowed, as long as the file carries something worth keeping.
    if (!anythingKept(headers, mapping)) {
      errors.phone = "This file has no phone column and nothing else is being imported. Map at least one column or keep the extra columns.";
    }
  } else if (!phone) errors.phone = "Choose the column that holds the phone number, or say this file has no phone numbers.";
  else if (!has(phone)) errors.phone = `The column "${phone}" isn't in this file.`;

  const name = mapping.name as unknown;
  if (!name) errors.name = "Choose the name column, or say this file has no names.";
  else if (name && typeof name === "object" && "first" in name && "last" in name) {
    const { first, last } = name as { first: unknown; last: unknown };
    if (typeof first !== "string" || typeof last !== "string" || !first || !last) {
      errors.name = "Choose both the first-name and the last-name column.";
    } else if (!has(first) || !has(last)) {
      errors.name = "One of the chosen name columns isn't in this file.";
    } else if (first === last) {
      errors.name = "First name and last name must be different columns.";
    }
  } else if (!isNone(name)) {
    const c = colOf(name);
    if (!c) errors.name = "Choose the name column, or say this file has no names.";
    else if (!has(c)) errors.name = `The column "${c}" isn't in this file.`;
  }

  for (const f of ["company", "email"] as const) {
    const p = mapping[f] as unknown;
    if (!p) errors[f] = `Choose the ${FIELD_LABELS[f].toLowerCase()} column, or say this file has no ${FIELD_LABELS[f].toLowerCase()}.`;
    else if (!isNone(p)) {
      const c = colOf(p);
      if (!c) errors[f] = `Choose the ${FIELD_LABELS[f].toLowerCase()} column, or say this file has no ${FIELD_LABELS[f].toLowerCase()}.`;
      else if (!has(c)) errors[f] = `The column "${c}" isn't in this file.`;
    }
  }

  return { ok: Object.keys(errors).length === 0 && Object.keys(optionalErrors(headers, mapping)).length === 0, errors: { ...errors, ...optionalErrors(headers, mapping) } };
}

// True when the mapping imports at least one thing besides the phone number.
function anythingKept(headers: string[], mapping: ColumnMapping): boolean {
  const m = mapping as Record<string, unknown>;
  for (const f of [...TARGET_FIELDS, ...OPTIONAL_FIELDS]) {
    if (f === "phone") continue;
    const p = m[f];
    if (p && !isNone(p)) return true;
  }
  return extraColumnsOf(headers, mapping).length > 0;
}

// Columns the mapping doesn't use for a field. Each is kept under its label
// unless skipped (mapping.extra) or keepExtra is off.
export function mappedColumns(mapping: ColumnMapping): Set<string> {
  const used = new Set<string>();
  const m = mapping as Record<string, unknown>;
  for (const f of [...TARGET_FIELDS, ...OPTIONAL_FIELDS]) {
    const p = m[f];
    const c = colOf(p);
    if (c) used.add(c);
    if (p && typeof p === "object" && "first" in p && "last" in p) {
      const { first, last } = p as { first: unknown; last: unknown };
      if (typeof first === "string" && first) used.add(first);
      if (typeof last === "string" && last) used.add(last);
    }
  }
  return used;
}

export function extraColumnsOf(headers: string[], mapping: ColumnMapping): { column: string; label: string }[] {
  const used = mappedColumns(mapping);
  const keepExtra = mapping.keepExtra !== false;
  const out: { column: string; label: string }[] = [];
  for (const h of headers) {
    if (used.has(h)) continue;
    const pick = mapping.extra?.[h];
    if (pick?.skip) continue;
    if (!pick && !keepExtra) continue;
    const label = (pick?.label ?? "").replace(/\s+/g, " ").trim().slice(0, EXTRA_LABEL_MAX) || h.slice(0, EXTRA_LABEL_MAX);
    out.push({ column: h, label });
  }
  return out;
}

function optionalErrors(headers: string[], mapping: ColumnMapping): Partial<Record<TargetField, string>> {
  const out: Record<string, string> = {};
  for (const f of OPTIONAL_FIELDS) {
    const p = mapping[f] as unknown;
    if (p === undefined || p === null || isNone(p)) continue;
    const c = colOf(p);
    if (!c) out[f] = `Choose a column for ${OPTIONAL_LABELS[f].toLowerCase()}, or leave it as not in this file.`;
    else if (!headers.includes(c)) out[f] = `The column "${c}" isn't in this file.`;
  }
  return out;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Header names -> a first guess at the mapping. Each column is used once.
// Returns only the fields it could guess; the user still confirms every field.
export function suggestMapping(headers: string[]): ColumnMapping {
  const used = new Set<string>();
  const take = (tests: RegExp[], skip?: RegExp): string | null => {
    for (const t of tests) {
      const h = headers.find((x) => !used.has(x) && t.test(norm(x)) && !(skip && skip.test(norm(x))));
      if (h) {
        used.add(h);
        return h;
      }
    }
    return null;
  };

  const out: ColumnMapping = {};
  const phone = take([
    /\b(mobile|cell|cellphone|gsm|msisdn)\b/,
    /\b(phone|telephone|tel|telephone no|phone no|phone number|contact number|contact no|whatsapp)\b/,
    /^(number|no|num)$/,
    /\b(number|numbers)\b/,
  ]);
  if (phone) out.phone = { column: phone };

  const email = take([/\be ?mail\b/, /\bemail\b/, /\bmail\b/]);
  if (email) out.email = { column: email };

  const company = take([
    /\b(company|companies|organi[sz]ation|organi[sz]ations|business|employer|firm|account name|org)\b/,
  ]);
  if (company) out.company = { column: company };

  // Stage, owner and tags first, so "Contact owner" or "Lead status" isn't
  // taken as the person's name below.
  const status = take([/\b(lead status|deal stage|pipeline stage|lifecycle stage|status|stage)\b/]);
  if (status) out.status = { column: status };
  const owner = take([/\b(lead owner|contact owner|account owner|record owner|deal owner|owner|assigned to|assignee|sales rep|rep|user name)\b/]);
  if (owner) out.owner = { column: owner };
  const tags = take([/\b(tags?|labels?)\b/]);
  if (tags) out.tags = { column: tags };

  const NOT_NAME = /\b(first|last|given|fore|sur|family|file|user|company|business|organi[sz]ation|campaign|source|product|domain|job|title|role|agent|owner|status|stage)\b/;
  const single = take(
    [
      /^(full )?name$/,
      /^(contact|customer|client|lead|prospect|person|owner|decision maker) ?(name|person)?$/,
      /\b(full name|contact name|customer name|client name|lead name|contact person|person|contact)\b/,
      /\bname\b/,
    ],
    NOT_NAME,
  );
  if (single) {
    out.name = { column: single };
  } else {
    const first = take([/\b(first name|firstname|first|given name|forename)\b/]);
    const last = take([/\b(last name|lastname|last|surname|family name)\b/]);
    if (first && last) out.name = { first, last };
    else {
      // Give back a lone first/last column rather than hide it.
      if (first) used.delete(first);
      if (last) used.delete(last);
    }
  }

  // Optional targets, from whatever columns are left.
  const contact = take([/\b(contact person|contact name|primary contact|decision maker|key contact|point of contact)\b/]);
  if (contact) out.contact = { column: contact };
  const website = take([/\b(web ?site|url|web|domain|www)\b/]);
  if (website) out.website = { column: website };
  const campaign = take([/\b(campaign|campaigns|project)\b/]);
  if (campaign) out.campaign = { column: campaign };
  const notes = take([/\b(notes?|comments?|remarks?)\b/]);
  if (notes) out.notes = { column: notes };
  const nextStep = take([/\b(next step|next steps|next action|action)\b/]);
  if (nextStep) out.nextStep = { column: nextStep };
  const lastContact = take([/\b(last (contact|contacted|called|call|spoken|touch)|date of last)\b/]);
  if (lastContact) out.lastContact = { column: lastContact };
  const appointment = take([/\b(appointment|follow ?up|callback|call back|meeting|scheduled|next call|due)\b/]);
  if (appointment) out.appointment = { column: appointment };
  return out;
}

// Column names as the importer sees them: trimmed, blanks become "Column N",
// repeats get " (2)", " (3)". Used by the browser preview and the server parse
// so a mapping chosen in the browser refers to the same names on the server.
export function normalizeHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((cell, i) => {
    let h = cell === null || cell === undefined ? "" : String(cell).trim();
    if (!h) h = `Column ${i + 1}`;
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    return n === 1 ? h : `${h} (${n})`;
  });
}

export interface FirstRowsPreview {
  headers: string[];
  rows: string[][];
}

export const IMPORT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 20_000,
} as const;

export interface PreviewIssue {
  row: number; // spreadsheet row number (header is row 1)
  value: string;
  reason: string;
}

export interface ImportPreview {
  totalRows: number;
  willImport: number;
  invalid: PreviewIssue[]; // capped; see invalidCount
  invalidCount: number;
  duplicatesInFile: PreviewIssue[];
  duplicatesInFileCount: number;
  alreadyInWorkspace: number;
  // Existing leads that belong to no campaign (so no campaign shows them);
  // a manager's import attaches them to the chosen campaign.
  adoptable: number;
  suppressed: number;
  ignoredEmails: number; // emails that didn't look like an email: left empty
  phonelessHeld: number;
  invalidDates: PreviewIssue[]; // dates that couldn't be read: the lead is still imported, the date left empty
  invalidDateCount: number;
  campaignBreakdown: { campaignId: string; name: string; count: number }[]; // where the leads will go
  unmatchedCampaigns: PreviewIssue[]; // campaign names matching no campaign
  unmatchedCampaignCount: number;
  extraColumns: string[]; // labels of the columns kept on the lead as extra information
  noPhoneColumn: boolean; // the mapping declares the file has no phone numbers
  heldSample: { row: number; name: string | null; company: string | null; email: string | null }[]; // first phone-less rows
  sample: {
    row: number;
    name: string | null;
    phone: string;
    company: string | null;
    email: string | null;
    contact: string | null;
    website: string | null;
    campaign: string | null;
    notes: string | null;
    nextStep: string | null;
    appointment: string | null; // ISO string
    lastContact: string | null;
  }[];
  country: string;
  timezone: string | null;
  // Spreadsheet rows with nothing in them (between data rows).
  emptyRows: number;
  // Rows whose email appears earlier in the file (and whose number was new).
  duplicateEmailsInFile: PreviewIssue[];
  duplicateEmailsInFileCount: number;
  // How rows matching an existing lead are handled.
  duplicateMode: DuplicateMode;
  willUpdate: number; // existing leads an "update" import changes
  existingByEmail: number; // of alreadyInWorkspace, matched on email rather than number
  inTrash: number; // match a lead in the trash: always skipped (restore it instead)
  // Distinct values in the stage and owner columns, for the mapping tables.
  stageValues: { value: string; count: number; suggested: string }[];
  ownerValues: { value: string; count: number; suggested: string }[];
}

export interface ImportResult {
  batchId: string;
  imported: number;
  skippedInvalid: number;
  skippedDuplicates: number;
  skippedExisting: number;
  skippedSuppressed: number;
  skippedUnknownCampaign: number;
  adopted: number; // existing leads with no campaign, now attached to one
  assignedToMe: number;
  screened: number; // leads that became dialable via the screening option
  rosteredMe: boolean;
  phonelessHeld: number;
  campaignId: string;
  campaigns: { campaignId: string; name: string; count: number }[];
  updated: number; // existing leads changed by an "update" import
  skippedTrashed: number;
  skippedEmailDuplicates: number;
  ownersAssigned: number; // leads given an owner from the file or the import's owner
  stagesSet: number; // leads whose stage came from the file
  autoAssigned: number; // shared out to the roster by the campaign's auto-assign
  runId: string | null;
  // CSV of every row that didn't import (or imported with a warning), capped.
  problemsCsv: string | null;
  problemRows: number;
}

// Rows in the problems file, at most.
export const PROBLEM_FILE_MAX = 5000;

// ------------------------------------------------------------ column roles
//
// The mapping step is column-centric: every column in the file gets one role.
// These helpers translate between that view and ColumnMapping, so the server
// contract stays the same while the admin decides, column by column, what the
// data is.

export type ColumnRole = TargetField | "first" | "last" | OptionalField | "extra" | "skip";
export interface ColumnChoice {
  role: ColumnRole;
  label?: string; // for "extra": how the value is labelled on the lead
}

// Roles a file may use at most once.
export const SINGLE_USE_ROLES: ColumnRole[] = ["name", "first", "last", "phone", "company", "email", ...OPTIONAL_FIELDS];

export const ROLE_LABELS: Record<ColumnRole, string> = {
  name: "Name (full)",
  first: "First name",
  last: "Last name",
  phone: "Phone number",
  company: "Company",
  email: "Email",
  contact: "Contact person",
  website: "Website",
  campaign: "Campaign",
  notes: "Notes",
  nextStep: "Next step",
  appointment: "Appointment / follow-up date",
  lastContact: "Last contact date",
  status: "Stage / status",
  owner: "Owner (agent)",
  tags: "Tags",
  extra: "Extra information (keep as is)",
  skip: "Don't import this column",
};

export const ROLE_ORDER: ColumnRole[] = [
  "phone",
  "name",
  "first",
  "last",
  "company",
  "email",
  "contact",
  "website",
  "campaign",
  "notes",
  "nextStep",
  "appointment",
  "lastContact",
  "status",
  "owner",
  "tags",
  "extra",
  "skip",
];

// Starting point for the mapping step: suggestMapping()'s guesses, every
// other column kept as extra information.
export function rolesFromMapping(headers: string[], mapping: ColumnMapping): Record<string, ColumnChoice> {
  const out: Record<string, ColumnChoice> = {};
  for (const h of headers) out[h] = { role: "extra", label: h.slice(0, EXTRA_LABEL_MAX) };
  const m = mapping as Record<string, unknown>;
  for (const f of [...TARGET_FIELDS, ...OPTIONAL_FIELDS]) {
    const p = m[f];
    const c = colOf(p);
    if (c && headers.includes(c)) out[c] = { role: f };
    if (f === "name" && p && typeof p === "object" && "first" in p && "last" in p) {
      const { first, last } = p as { first: string; last: string };
      if (headers.includes(first)) out[first] = { role: "first" };
      if (headers.includes(last)) out[last] = { role: "last" };
    }
  }
  for (const [h, pick] of Object.entries(mapping.extra ?? {})) {
    if (!headers.includes(h) || out[h].role !== "extra") continue;
    out[h] = pick.skip ? { role: "skip" } : { role: "extra", label: pick.label ?? h };
  }
  return out;
}

// Roles given to more than one column (not allowed for single-use roles).
export function duplicateRoles(roles: Record<string, ColumnChoice>): ColumnRole[] {
  const seen = new Map<ColumnRole, number>();
  for (const c of Object.values(roles)) seen.set(c.role, (seen.get(c.role) ?? 0) + 1);
  return SINGLE_USE_ROLES.filter((r) => (seen.get(r) ?? 0) > 1);
}

// Builds the mapping the server expects. Fields with no column are declared
// absent explicitly; a lone first- or last-name column is used as the name.
export function mappingFromRoles(headers: string[], roles: Record<string, ColumnChoice>): ColumnMapping {
  const first = (role: ColumnRole) => headers.find((h) => roles[h]?.role === role);
  const pick = (role: ColumnRole): ColumnPick => {
    const c = first(role);
    return c ? { column: c } : { none: true };
  };
  const m: ColumnMapping = {};
  const nameCol = first("name");
  const firstCol = first("first");
  const lastCol = first("last");
  if (nameCol) m.name = { column: nameCol };
  else if (firstCol && lastCol) m.name = { first: firstCol, last: lastCol };
  else if (firstCol || lastCol) m.name = { column: (firstCol ?? lastCol)! };
  else m.name = { none: true };
  m.phone = pick("phone");
  m.company = pick("company");
  m.email = pick("email");
  for (const f of OPTIONAL_FIELDS) {
    const c = first(f);
    if (c) m[f] = { column: c };
  }
  m.keepExtra = true;
  const extra: Record<string, ExtraPick> = {};
  for (const h of headers) {
    const r = roles[h];
    if (!r) continue;
    if (r.role === "skip") extra[h] = { skip: true };
    else if (r.role === "extra") extra[h] = { label: (r.label ?? "").trim() || h };
  }
  m.extra = extra;
  return m;
}

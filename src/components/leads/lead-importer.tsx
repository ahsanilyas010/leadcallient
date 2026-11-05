"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Bookmark, CheckCircle2, Download, FlaskConical, Headset, Loader2, Undo2, Upload } from "lucide-react";
import { previewLeadImport, previewProblemsCsv, runLeadImport, type ImportResponse } from "@/lib/actions/lead-import";
import { screenLeadBatch } from "@/lib/actions/lead-upload";
import { deleteImportTemplate, listImportTemplates, saveImportTemplate, type ImportTemplate } from "@/lib/actions/import-templates";
import { undoImport } from "@/lib/actions/data-trash";
import { RegisterSourceDialog } from "@/components/leads/register-source-dialog";
import {
  DUPLICATE_MODES,
  DUPLICATE_MODE_LABELS,
  EXTRA_LABEL_MAX,
  IMPORT_LIMITS,
  LEAD_STAGE_OPTIONS,
  OPTIONAL_HINTS,
  ROLE_LABELS,
  ROLE_ORDER,
  duplicateRoles,
  mappingFromRoles,
  normValue,
  normalizeHeaders,
  rolesFromMapping,
  suggestMapping,
  validateMapping,
  type ColumnChoice,
  type ColumnMapping,
  type ColumnRole,
  type DuplicateMode,
  type FirstRowsPreview,
  type ImportPreview,
} from "@/lib/leads/mapped-import-shared";
import { CRM_SOURCES, crmSource, presetRoles, type CrmSourceKey } from "@/lib/leads/crm-sources";
import { IMPORT_UNDO_DAYS } from "@/lib/data-delete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";
import { TableWrap } from "@/components/ui/data-table";

interface CampaignOption {
  id: string;
  name: string;
  country: string | null;
}

export interface OwnerOption {
  id: string;
  name: string;
  role: string;
}

interface Props {
  campaigns: CampaignOption[];
  // Every import names a data source (the lawful basis the list is held
  // under). `needsReview` marks the auto-created legacy source, which cannot be
  // used until its real basis is set under Data.
  dataSources: { id: string; name: string; needsReview?: boolean }[];
  // Managers (super_admin / ops_manager) get the dial-it-myself option.
  isManager: boolean;
  // Managers and the Data-only role: owners, tags, lists, updating existing
  // leads and screening. Defaults to isManager. Lead gen gets none of these.
  canManageData?: boolean;
  // People who can own a lead (for "give every lead an owner" and the owner column).
  owners?: OwnerOption[];
  // Whether this workspace makes leads pass screening before they can be
  // dialled (Compliance). Off: imported leads are dialable straight away.
  screeningRequired?: boolean;
  // Pre-select a campaign (the importer on a campaign's own page).
  initialCampaignId?: string;
  // "migration": the guided CRM migration wizard (choose source, test run, report).
  mode?: "import" | "migration";
  onFinished?: () => void;
}

type StepId = "source" | "file" | "map" | "review" | "test" | "done";
type Done = Extract<ImportResponse, { ok: true }>;

const selectCls =
  "h-9 w-full rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";
const inputCls = "h-9 w-full rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";
const SAMPLE_SIZES = [10, 25, 50, 100];

// What each role means, shown under the chosen role.
const ROLE_HINTS: Partial<Record<ColumnRole, string>> = {
  name: "Who you are calling.",
  first: "Combined with the last-name column into the lead's name.",
  last: "Combined with the first-name column into the lead's name.",
  phone: "Numbers are cleaned to international format using the campaign's country.",
  company: "The company or organisation the person works for.",
  email: "Used for follow-up emails and to spot duplicates. Values that don't look like an email are left empty.",
  contact: OPTIONAL_HINTS.contact,
  website: OPTIONAL_HINTS.website,
  campaign: OPTIONAL_HINTS.campaign,
  notes: OPTIONAL_HINTS.notes,
  nextStep: OPTIONAL_HINTS.nextStep,
  appointment: OPTIONAL_HINTS.appointment,
  lastContact: OPTIONAL_HINTS.lastContact,
  status: OPTIONAL_HINTS.status,
  owner: OPTIONAL_HINTS.owner,
  tags: OPTIONAL_HINTS.tags,
  extra: "Kept on the lead exactly as it is in the file, under the label you give it. Agents see it on the call sheet.",
  skip: "Left out of the import.",
};

async function readHead(file: File): Promise<FirstRowsPreview> {
  // Dynamic import: the spreadsheet parser is only downloaded when someone
  // actually picks a file. Only the header and the first rows are read here;
  // the server parses the whole file.
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true, sheetRows: 7 });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = sheet
    ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false })
    : [];
  if (aoa.length === 0) return { headers: [], rows: [] };
  const width = Math.max(...aoa.map((r) => r.length));
  const headers = normalizeHeaders(Array.from({ length: width }, (_, i) => aoa[0][i]));
  const rows = aoa.slice(1, 6).map((r) => headers.map((_, i) => (r[i] === null || r[i] === undefined ? "" : String(r[i]).trim())));
  return { headers, rows };
}

// Saves a CSV the person can open in Excel (the byte-order mark keeps accents).
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const sameHeaders = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

export function LeadImporter({
  campaigns,
  dataSources,
  isManager,
  canManageData = isManager,
  owners = [],
  screeningRequired = false,
  initialCampaignId,
  mode = "import",
  onFinished,
}: Props) {
  const migration = mode === "migration";
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<StepId>(migration ? "source" : "file");
  const [crmKey, setCrmKey] = useState<CrmSourceKey | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [head, setHead] = useState<FirstRowsPreview | null>(null);
  const [campaignId, setCampaignId] = useState(initialCampaignId ?? "");
  const [dataSourceId, setDataSourceId] = useState("");
  // One role per column of the file (the mapping step), plus the first
  // guess, so a column can say "suggested, please check".
  const [roles, setRoles] = useState<Record<string, ColumnChoice>>({});
  const [suggestedRoles, setSuggestedRoles] = useState<Record<string, ColumnChoice>>({});
  const [fallback, setFallback] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [callMyself, setCallMyself] = useState(false);
  const [screenNow, setScreenNow] = useState(screeningRequired);
  // Import options.
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [assignTo, setAssignTo] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [listText, setListText] = useState("");
  // Stage and owner columns: raw value (normalised) -> LeadCallient stage / person.
  const [stageMap, setStageMap] = useState<Record<string, string>>({});
  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({});
  // Saved mappings.
  const [templates, setTemplates] = useState<ImportTemplate[] | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  // CRM migration: test run, then the rest.
  const [sampleSize, setSampleSize] = useState(25);
  const [testRun, setTestRun] = useState<Done | null>(null);
  const [testUndone, setTestUndone] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [undone, setUndone] = useState(false);
  const [screenedLater, setScreenedLater] = useState(0);
  const [pending, startTransition] = useTransition();

  const campaign = campaigns.find((c) => c.id === campaignId);
  const source = crmKey ? crmSource(crmKey) : undefined;
  const roleOptions = ROLE_ORDER.filter((r) => canManageData || r !== "owner");

  const mapping: ColumnMapping = useMemo(() => {
    if (!head) return {};
    const m = mappingFromRoles(head.headers, roles);
    m.fallbackToDefault = fallback;
    return m;
  }, [head, roles, fallback]);

  const check = useMemo(() => (head ? validateMapping(head.headers, mapping) : null), [head, mapping]);
  const dupes = useMemo(() => duplicateRoles(roles), [roles]);
  const errors: Record<string, string> = { ...(check?.errors ?? {}) };
  for (const d of dupes) errors[d] = `Two columns are set as "${ROLE_LABELS[d]}". Only one column can be the ${ROLE_LABELS[d].toLowerCase()}.`;
  const hasPhone = Object.values(roles).some((r) => r.role === "phone");
  const hasCampaignCol = Object.values(roles).some((r) => r.role === "campaign");
  const keptCount = Object.values(roles).filter((r) => r.role === "extra").length;
  const matchingTemplate = head && templates ? templates.find((t) => sameHeaders(t.headers, head.headers)) : undefined;

  const sampleLabels = {
    contact: "Contact person",
    website: "Website",
    campaign: "Campaign",
    notes: "Notes",
    nextStep: "Next step",
    appointment: "Appointment",
    lastContact: "Last contact",
  } as const;
  const sampleExtras = (Object.keys(sampleLabels) as (keyof typeof sampleLabels)[]).filter((k) =>
    k === "campaign" ? hasCampaignCol : (preview?.sample ?? []).some((r) => r[k]),
  );

  // Saved mappings load once the file's columns are known.
  useEffect(() => {
    if (step !== "map" || templates !== null) return;
    let cancelled = false;
    void listImportTemplates(migration ? "migration" : "import").then((r) => {
      if (!cancelled) setTemplates(r.templates ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [step, templates, migration]);

  function fullMapping(): ColumnMapping {
    return { ...mapping, statusMap: stageMap, ownerMap: canManageData ? ownerMap : {} };
  }

  function makeForm(extra?: { sample?: number; skip?: number }) {
    const fd = new FormData();
    if (file) fd.set("file", file);
    fd.set("campaign_id", campaignId);
    fd.set("mapping", JSON.stringify(fullMapping()));
    fd.set("data_source_id", dataSourceId);
    fd.set("duplicate_mode", canManageData ? duplicateMode : "skip");
    if (canManageData && assignTo && !callMyself) fd.set("assign_to", assignTo);
    if (canManageData && tagsText.trim()) fd.set("tags", tagsText);
    if (canManageData && listText.trim()) fd.set("list", listText);
    if (migration && crmKey) fd.set("crm_source", crmKey);
    if (extra?.sample) fd.set("sample_size", String(extra.sample));
    if (extra?.skip) fd.set("skip_rows", String(extra.skip));
    return fd;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    await handleFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files;
    if (dropped.length === 0) return;
    if (fileRef.current) fileRef.current.files = dropped;
    void handleFile(dropped[0]);
  }

  async function handleFile(f: File | null) {
    setError(null);
    setHead(null);
    setFile(null);
    if (!f) return;
    if (f.size > IMPORT_LIMITS.maxBytes) {
      setError("That file is larger than 10 MB. Split it into smaller files and import them one at a time.");
      return;
    }
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      setError("Upload a .csv or .xlsx file.");
      return;
    }
    try {
      const h = await readHead(f);
      if (h.headers.length === 0 || h.rows.length === 0) {
        setError("That file has no data rows. Check you picked the right file.");
        return;
      }
      setFile(f);
      setHead(h);
      const initial = migration && crmKey ? presetRoles(h.headers, crmKey) : rolesFromMapping(h.headers, suggestMapping(h.headers));
      if (!canManageData) for (const k of Object.keys(initial)) if (initial[k].role === "owner") initial[k] = { role: "extra", label: k };
      setRoles(initial);
      setSuggestedRoles(initial);
      setFallback(false);
      setTouched(false);
      setAppliedTemplate(null);
    } catch {
      setError("Couldn't read that file. Check it is a real .csv or .xlsx file.");
    }
  }

  function toMapping() {
    setError(null);
    if (!file || !head) return setError("Choose a file first.");
    if (!campaignId) return setError("Choose the campaign these leads belong to.");
    if (!dataSourceId) return setError("Choose the data source this list came from.");
    setTouched(false);
    setStep("map");
  }

  function applyTemplate(t: ImportTemplate) {
    if (!head) return;
    const next = rolesFromMapping(head.headers, t.mapping);
    if (!canManageData) for (const k of Object.keys(next)) if (next[k].role === "owner") next[k] = { role: "extra", label: k };
    setRoles(next);
    setFallback(Boolean(t.mapping.fallbackToDefault));
    setStageMap(t.mapping.statusMap ?? {});
    if (t.options.duplicateMode && canManageData) setDuplicateMode(t.options.duplicateMode);
    if (t.options.tags && canManageData) setTagsText(t.options.tags);
    if (t.options.list && canManageData) setListText(t.options.list);
    setAppliedTemplate(t.id);
    setTemplateName(t.name);
    toast.success(`Applied "${t.name}". Check the columns, then continue.`);
  }

  function saveTemplate() {
    if (!head) return;
    const name = templateName.trim();
    if (!name) {
      toast.error("Give the mapping a name first.");
      return;
    }
    startTransition(async () => {
      const r = await saveImportTemplate({
        name,
        kind: migration ? "migration" : "import",
        source: migration && crmKey ? crmKey : null,
        headers: head.headers,
        mapping: fullMapping() as Record<string, unknown>,
        options: canManageData ? { duplicateMode, tags: tagsText || undefined, list: listText || undefined } : undefined,
      });
      if (r.error || !r.template) {
        toast.error(r.error ?? "Couldn't save the mapping.");
        return;
      }
      setTemplates((ts) => [r.template!, ...(ts ?? []).filter((t) => t.id !== r.template!.id)]);
      setAppliedTemplate(r.template.id);
      toast.success(`Saved "${r.template.name}". Next time a file with these columns comes in, it is one click.`);
    });
  }

  function removeTemplate(t: ImportTemplate) {
    if (!window.confirm(`Delete the saved mapping "${t.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteImportTemplate(t.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setTemplates((ts) => (ts ?? []).filter((x) => x.id !== t.id));
      if (appliedTemplate === t.id) setAppliedTemplate(null);
    });
  }

  // Fills in stage and owner suggestions for values the person hasn't set.
  function seedMaps(p: ImportPreview) {
    setStageMap((cur) => {
      const next = { ...cur };
      for (const v of p.stageValues) {
        const k = normValue(v.value);
        if (!(k in next)) next[k] = v.suggested;
      }
      return next;
    });
    setOwnerMap((cur) => {
      const next = { ...cur };
      for (const v of p.ownerValues) {
        const k = normValue(v.value);
        if (!(k in next)) next[k] = v.suggested;
      }
      return next;
    });
  }

  function runPreview(onOk?: () => void) {
    startTransition(async () => {
      const res = await previewLeadImport(makeForm());
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      setPreview(res.preview);
      seedMaps(res.preview);
      onOk?.();
    });
  }

  function toReview() {
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    runPreview(() => setStep("review"));
  }

  function changeDuplicateMode(m: DuplicateMode) {
    setDuplicateMode(m);
  }
  // Counts depend on the duplicate rule, so the review is re-checked.
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    if (step === "review") runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateMode]);

  function downloadPreviewProblems() {
    startTransition(async () => {
      const r = await previewProblemsCsv(makeForm());
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (!r.csv) {
        toast.success("Every row will import cleanly: there is nothing to download.");
        return;
      }
      downloadCsv(`${(file?.name ?? "import").replace(/\.[^.]+$/, "")}-rows-to-check.csv`, r.csv);
    });
  }

  function doImport(opts?: { sample?: number; skip?: number; test?: boolean }) {
    setError(null);
    if (callMyself && assignTo) return setError("Choose either \"I will call these myself\" or an owner, not both.");
    const fd = makeForm(opts);
    if (isManager && callMyself) fd.set("call_myself", "1");
    if (canManageData && screenNow) fd.set("screen_now", "1");
    startTransition(async () => {
      const res = await runLeadImport(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if (opts?.test) {
        setTestRun(res);
        setTestUndone(false);
        setStep("test");
        toast.success(`Test run: ${res.result.imported + res.result.updated} lead${res.result.imported + res.result.updated === 1 ? "" : "s"} moved. Check them before the full migration.`);
      } else {
        setDone(res);
        setStep("done");
        const changed = res.result.imported + res.result.updated;
        toast.success(
          res.result.updated > 0
            ? `Imported ${res.result.imported} and updated ${res.result.updated} lead${changed === 1 ? "" : "s"}.`
            : `Imported ${res.result.imported} lead${res.result.imported === 1 ? "" : "s"}.`,
        );
      }
      router.refresh();
    });
  }

  function undo(run: Done, after: () => void) {
    if (!run.result.runId) return;
    if (!window.confirm("Undo this import? Every lead and contact it created goes to the trash (you can restore them from there). Leads it updated keep their changes.")) return;
    startTransition(async () => {
      const r = await undoImport(run.result.runId!);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Undone: ${r.leads ?? 0} lead${r.leads === 1 ? "" : "s"} and ${r.contacts ?? 0} contact${r.contacts === 1 ? "" : "s"} moved to the trash.`);
      after();
      router.refresh();
    });
  }

  function screenAfter() {
    if (!done) return;
    startTransition(async () => {
      const res = await screenLeadBatch(done.result.batchId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setScreenedLater(res.screenedCount ?? 0);
      toast.success(`Screened ${res.screenedCount ?? 0} lead(s).`);
      router.refresh();
    });
  }

  function reset() {
    setStep(migration ? "source" : "file");
    setFile(null);
    setHead(null);
    setPreview(null);
    setDone(null);
    setTestRun(null);
    setTestUndone(false);
    setUndone(false);
    setScreenedLater(0);
    setCallMyself(false);
    setScreenNow(screeningRequired);
    setError(null);
    setRoles({});
    setSuggestedRoles({});
    setFallback(false);
    setStageMap({});
    setOwnerMap({});
    setAppliedTemplate(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const stepList: { id: StepId; label: string }[] = migration
    ? [
        { id: "source", label: "Choose your CRM" },
        { id: "file", label: "Upload the export" },
        { id: "map", label: "Match fields" },
        { id: "review", label: "Preview" },
        { id: "test", label: "Test run" },
        { id: "done", label: "Report" },
      ]
    : [
        { id: "file", label: "File" },
        { id: "map", label: "Match columns" },
        { id: "review", label: "Review" },
        { id: "done", label: "Done" },
      ];
  const stepIndex = stepList.findIndex((s) => s.id === step);
  const nothingToImport = preview ? preview.willImport === 0 && preview.willUpdate === 0 && preview.phonelessHeld === 0 && preview.adoptable === 0 : true;
  const testSkip = testRun && !testUndone ? sampleSize : 0;

  return (
    <div className="flex flex-col gap-4" data-testid="lead-importer">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {stepList.map((s, i) => (
          <li
            key={s.id}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              i === stepIndex
                ? "border-brand-blue bg-brand-blue-tint font-semibold text-brand-blue"
                : i < stepIndex
                  ? "border-line bg-white text-ink"
                  : "border-line bg-canvas text-muted"
            }`}
            aria-current={i === stepIndex ? "step" : undefined}
          >
            <span className="font-semibold">{i + 1}</span> {s.label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {step === "source" && (
        <section className="flex flex-col gap-4" data-testid="migration-source">
          <p className="text-sm text-muted">
            Choose the system you are moving from. You export a file from it and upload it here: your old CRM is only read, never changed,
            and nothing is saved here until you run the test or the full migration.
          </p>
          <fieldset>
            <legend className="sr-only">Your current CRM</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CRM_SOURCES.map((c) => (
                <label
                  key={c.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm focus-within:ring-2 focus-within:ring-brand-blue ${
                    crmKey === c.key ? "border-brand-blue bg-brand-blue-tint font-semibold text-brand-blue" : "border-line bg-white text-ink hover:border-brand-blue"
                  }`}
                >
                  <input type="radio" name="crm" value={c.key} checked={crmKey === c.key} onChange={() => setCrmKey(c.key)} className="sr-only" />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          {source && (
            <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-ink">
              <div className="mb-1 font-semibold">Export from {source.name}</div>
              <ol className="list-decimal space-y-0.5 pl-5 text-muted">
                {source.exportSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted">
                Menus differ between plans and versions, so these steps are a guide. Connecting {source.key === "csv" ? "a CRM" : source.name} directly
                isn&apos;t available yet: a file export moves the same data.
              </p>
            </div>
          )}
          <div className="rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink">
            <span className="font-semibold">What moves across:</span>{" "}
            <span className="text-muted">
              contacts and leads (name, phone, email, company, website), owners, stages, notes, tags and any custom fields (kept as extra
              information). Past calls come across as the last contact date and notes, not as individual call records.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setStep("file")} disabled={!crmKey}>
              Next: upload the export <ArrowRight className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted">
              Enterprise plan? We can do the move for you.{" "}
              <Link href="/contact" className="font-medium text-brand-blue hover:underline">
                Ask for an assisted migration
              </Link>
              .
            </span>
          </div>
        </section>
      )}

      {step === "file" && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {migration
              ? `Upload the file you exported from ${source?.name ?? "your CRM"}, and choose the campaign the records go into. Up to 10 MB and 20,000 rows per file: split a bigger export into parts.`
              : "Choose a CSV or Excel file of the people to call and the campaign they belong to. Up to 10 MB and 20,000 rows. Nothing is saved until you press Import on the review step."}
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              {migration ? "Export file (.csv or .xlsx)" : "Lead file (.csv or .xlsx)"} <span aria-hidden className="text-danger">*</span>
            </span>
            <label
              htmlFor="li-file"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-brand-blue ${
                dragging ? "border-brand-blue bg-brand-blue-tint/40" : "border-line bg-canvas hover:border-brand-blue"
              }`}
            >
              <Upload className="h-5 w-5 text-muted" aria-hidden />
              {file ? (
                <span className="font-medium text-ink">
                  {file.name} <span className="font-normal text-muted">({(file.size / 1024).toFixed(0)} KB) ready</span>
                </span>
              ) : (
                <span className="text-ink">
                  <span className="font-medium text-brand-blue">Choose a file</span> or drop it here
                </span>
              )}
              <span className="text-xs text-muted">{file ? "Choose another to replace it" : "CSV or Excel, up to 10 MB"}</span>
              <input id="li-file" ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={onFile} className="sr-only" />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="li-campaign" className="text-sm font-medium text-ink">
              Campaign
            </label>
            <select id="li-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={selectCls}>
              <option value="">Choose a campaign...</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              {campaign
                ? `Local-format phone numbers are read as ${campaign.country ?? "GB"} numbers.`
                : "The campaign's country decides how numbers without a country code are read."}
              {campaigns.length === 0 && " You have no campaigns yet: create one first under Campaigns."}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-end justify-between gap-2">
              <label htmlFor="li-source" className="text-sm font-medium text-ink">
                Data source <span aria-hidden className="text-danger">*</span>
              </label>
              <RegisterSourceDialog label="Register a new source" variant="secondary" onCreated={(id) => setDataSourceId(id)} />
            </div>
            <select id="li-source" value={dataSourceId} onChange={(e) => setDataSourceId(e.target.value)} className={selectCls} aria-required="true">
              <option value="">Choose a data source...</option>
              {dataSources.map((d) => (
                <option key={d.id} value={d.id} disabled={d.needsReview}>
                  {d.needsReview ? `${d.name} (set its lawful basis under Data first)` : d.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              A source records where the list came from and the lawful basis it is held under. Every import needs one.
              {migration && ` For a migration, register "${source?.name ?? "your old CRM"}" as a client-supplied source with the basis you held the data under.`}
              {dataSources.filter((d) => !d.needsReview).length === 0 && " You don't have a usable source yet: register one above."}
            </p>
          </div>
          <div className="flex gap-2">
            {migration && (
              <Button variant="secondary" onClick={() => setStep("source")}>
                Back
              </Button>
            )}
            <Button onClick={toMapping} disabled={!file || !campaignId || !dataSourceId}>
              Next: match {migration ? "fields" : "columns"}
            </Button>
          </div>
        </section>
      )}

      {step === "map" && head && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Every column in your file is listed below. Tell us what each one is. We made a first guess
            {migration && source ? ` from ${source.name}'s usual column names` : " from the column names"}: please check each row. Anything you
            don&apos;t match to a field is kept as extra information under the label you give it, so whatever is in your file comes through.
          </p>

          <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm" data-testid="saved-mappings">
            <div className="flex flex-wrap items-center gap-2">
              <Bookmark className="h-4 w-4 text-brand-blue" aria-hidden />
              <span className="font-medium text-ink">Saved mappings</span>
              {templates === null ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" aria-label="Loading saved mappings" />
              ) : templates.length === 0 ? (
                <span className="text-xs text-muted">None yet. Save this one below so the next file like it takes one click.</span>
              ) : (
                <select
                  aria-label="Use a saved mapping"
                  className="h-8 rounded-md border border-line bg-white px-2 text-xs"
                  value={appliedTemplate ?? ""}
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) applyTemplate(t);
                  }}
                >
                  <option value="">Use a saved mapping...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {head && sameHeaders(t.headers, head.headers) ? " (matches this file)" : ""}
                    </option>
                  ))}
                </select>
              )}
              {appliedTemplate && templates?.find((t) => t.id === appliedTemplate)?.mine && (
                <button type="button" className="text-xs text-danger underline" onClick={() => removeTemplate(templates.find((t) => t.id === appliedTemplate)!)}>
                  Delete this saved mapping
                </button>
              )}
            </div>
            {matchingTemplate && appliedTemplate !== matchingTemplate.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-brand-blue-tint px-2.5 py-1.5 text-xs text-ink">
                This file has the same columns as your saved mapping <strong>{matchingTemplate.name}</strong>.
                <Button size="sm" onClick={() => applyTemplate(matchingTemplate)}>
                  Use it
                </Button>
              </div>
            )}
          </div>

          <TableWrap label="Columns in your file">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Column in your file</th>
                  <th className="px-3 py-2 font-medium">First values</th>
                  <th className="w-[260px] px-3 py-2 font-medium">Import as</th>
                  <th className="w-[220px] px-3 py-2 font-medium">Label on the lead</th>
                </tr>
              </thead>
              <tbody>
                {head.headers.map((h, idx) => {
                  const choice = roles[h] ?? { role: "extra", label: h };
                  const isSuggested = suggestedRoles[h]?.role === choice.role && choice.role !== "extra" && choice.role !== "skip";
                  const dup = dupes.includes(choice.role);
                  const samples = head.rows.map((r) => r[idx]).filter(Boolean).slice(0, 3);
                  return (
                    <tr key={h} className={`border-b border-line align-top last:border-0 ${choice.role === "skip" ? "opacity-60" : ""}`}>
                      <td className="px-3 py-2 font-medium text-ink">{h}</td>
                      <td className="max-w-[260px] px-3 py-2 text-xs text-muted">
                        {samples.length > 0 ? (
                          samples.map((v, i) => (
                            <div key={i} className="truncate" title={v}>
                              {v}
                            </div>
                          ))
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Import "${h}" as`}
                          value={choice.role}
                          onChange={(e) => {
                            const role = e.target.value as ColumnRole;
                            setRoles((r) => ({ ...r, [h]: role === "extra" ? { role, label: r[h]?.label || h.slice(0, EXTRA_LABEL_MAX) } : { role } }));
                          }}
                          className={selectCls}
                          aria-invalid={dup || (touched && choice.role === "phone" && Boolean(errors.phone)) ? true : undefined}
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-muted">
                          {isSuggested ? "Suggested from the column name: check it's right. " : ""}
                          {ROLE_HINTS[choice.role]}
                        </p>
                        {dup && <p className="mt-1 text-xs font-medium text-danger">{errors[choice.role]}</p>}
                      </td>
                      <td className="px-3 py-2">
                        {choice.role === "extra" ? (
                          <input
                            type="text"
                            aria-label={`Label for "${h}"`}
                            value={choice.label ?? ""}
                            maxLength={EXTRA_LABEL_MAX}
                            onChange={(e) => setRoles((r) => ({ ...r, [h]: { role: "extra", label: e.target.value } }))}
                            placeholder={h}
                            className={inputCls}
                          />
                        ) : (
                          <span className="text-xs text-muted">{choice.role === "skip" ? "Not imported" : ROLE_LABELS[choice.role]}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>

          {touched && errors.phone && (
            <p className="text-xs font-medium text-danger" role="alert">
              {errors.phone}
            </p>
          )}
          {touched && errors.name && (
            <p className="text-xs font-medium text-danger" role="alert">
              {errors.name}
            </p>
          )}
          {!hasPhone && (
            <div className="rounded-lg border border-gold/40 bg-gold-tint px-3 py-2 text-sm text-ink" data-testid="no-phone-notice">
              <strong>No column is set as the phone number.</strong> That&apos;s fine: every row will be kept as a contact without a
              number, with all its other details, so you can assign it to an agent who finds and adds the number. Nothing can be dialled
              until a number is added and screened. If the file does have phone numbers, set that column to <em>Phone number</em> above.
            </div>
          )}
          <p className="text-xs text-muted">
            {keptCount > 0
              ? `${keptCount} column${keptCount === 1 ? "" : "s"} will be kept as extra information.`
              : "No columns are kept as extra information."}
          </p>

          {hasCampaignCol && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
              <span>
                If a campaign name in the file doesn&apos;t match one of your campaigns, put that row in{" "}
                <strong>{campaign?.name ?? "the campaign from step 1"}</strong> instead of skipping it.
              </span>
            </label>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <label htmlFor="li-template-name" className="text-xs font-medium text-ink">
                Save this mapping for next time
              </label>
              <input
                id="li-template-name"
                className={inputCls}
                value={templateName}
                maxLength={80}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={migration && source ? `${source.name} export` : "Weekly lead list"}
              />
            </div>
            <Button variant="secondary" onClick={saveTemplate} disabled={pending || !templateName.trim()}>
              <Bookmark className="h-4 w-4" /> Save mapping
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("file")} disabled={pending}>
              Back
            </Button>
            <Button onClick={toReview} disabled={pending || dupes.length > 0}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Next: {migration ? "preview" : "review"}
            </Button>
          </div>
        </section>
      )}

      {step === "review" && preview && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">This is a check only: nothing has been saved yet.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Rows in file" value={preview.totalRows} />
            <Stat label="Will be imported" value={preview.willImport} tone="good" testId="will-import" />
            {preview.duplicateMode === "update" && <Stat label="Existing leads to update" value={preview.willUpdate} tone="good" testId="will-update" />}
            <Stat label="Invalid numbers" value={preview.invalidCount} tone={preview.invalidCount ? "warn" : undefined} />
            <Stat
              label="Repeated in the file"
              value={preview.duplicatesInFileCount + preview.duplicateEmailsInFileCount}
              tone={preview.duplicatesInFileCount + preview.duplicateEmailsInFileCount ? "warn" : undefined}
            />
            <Stat label={preview.duplicateMode === "skip" ? "Already in your workspace (skipped)" : "Already in your workspace"} value={preview.alreadyInWorkspace} />
            <Stat label="On the suppression list (skipped)" value={preview.suppressed} tone={preview.suppressed ? "warn" : undefined} />
            {preview.inTrash > 0 && <Stat label="Match a lead in the trash (skipped)" value={preview.inTrash} tone="warn" />}
            {preview.emptyRows > 0 && <Stat label="Empty rows (ignored)" value={preview.emptyRows} />}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {preview.existingByEmail > 0 && <span>{preview.existingByEmail} of the existing matches were found by email rather than phone number.</span>}
            {preview.ignoredEmails > 0 && (
              <span>
                {preview.ignoredEmails} email address{preview.ignoredEmails === 1 ? "" : "es"} didn&apos;t look valid and will be left empty.
              </span>
            )}
            <Button size="sm" variant="secondary" onClick={downloadPreviewProblems} disabled={pending}>
              <Download className="h-3.5 w-3.5" /> Download the rows to check
            </Button>
          </div>
          {preview.phonelessHeld > 0 && (
            <div className="rounded-lg border border-gold/40 bg-gold-tint px-3 py-2 text-sm text-ink" data-testid="held-contacts">
              <strong>
                {preview.phonelessHeld} row{preview.phonelessHeld === 1 ? "" : "s"} will be kept as contacts without a number
              </strong>
              {preview.noPhoneColumn ? " (this file has no phone column)." : " (no phone number in the row)."} They keep every other
              detail, show up under Leads and on the call sheet of the agent you assign them to, and become dialable leads once a
              number is added and screened.
              {preview.heldSample.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                  {preview.heldSample.map((r) => (
                    <li key={r.row}>
                      Row {r.row}: {[r.name, r.company, r.email].filter(Boolean).join(" · ") || "extra information only"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {preview.campaignBreakdown.length > 1 || preview.unmatchedCampaignCount > 0 ? (
            <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Where the leads will go</div>
              <ul className="list-disc pl-5 text-xs">
                {preview.campaignBreakdown.map((c) => (
                  <li key={c.campaignId}>
                    {c.name}: {c.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.unmatchedCampaigns.length > 0 && (
            <Issues
              title={`Rows skipped: campaign not found (${preview.unmatchedCampaignCount})`}
              items={preview.unmatchedCampaigns}
              total={preview.unmatchedCampaignCount}
              tone="danger"
            />
          )}
          {preview.invalidDates.length > 0 && (
            <Issues
              title={`Dates we couldn't read (${preview.invalidDateCount}): these leads are still imported, with the date left empty`}
              items={preview.invalidDates}
              total={preview.invalidDateCount}
            />
          )}
          {preview.extraColumns.length > 0 && (
            <p className="text-xs text-muted">
              Kept as extra information on each lead: {preview.extraColumns.slice(0, 12).join(", ")}
              {preview.extraColumns.length > 12 ? ` and ${preview.extraColumns.length - 12} more` : ""}.
            </p>
          )}

          {preview.invalid.length > 0 && (
            <Issues title={`Rows with invalid numbers (${preview.invalidCount})`} items={preview.invalid} total={preview.invalidCount} />
          )}
          {preview.duplicatesInFile.length > 0 && (
            <Issues title={`Repeated numbers in the file (${preview.duplicatesInFileCount})`} items={preview.duplicatesInFile} total={preview.duplicatesInFileCount} />
          )}
          {preview.duplicateEmailsInFile.length > 0 && (
            <Issues
              title={`Repeated emails in the file (${preview.duplicateEmailsInFileCount})`}
              items={preview.duplicateEmailsInFile}
              total={preview.duplicateEmailsInFileCount}
            />
          )}

          {preview.stageValues.length > 0 && (
            <ValueMapTable
              title={migration ? "Stage mapping" : "Stages in your file"}
              hint="Match each stage from your file to a LeadCallient stage. A stage left as 'Keep as extra information' is saved on the lead under its column name."
              values={preview.stageValues}
              current={stageMap}
              onChange={(k, v) => setStageMap((m) => ({ ...m, [k]: v }))}
              options={LEAD_STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              emptyLabel="Keep as extra information"
              testId="stage-map"
            />
          )}
          {canManageData && preview.ownerValues.length > 0 && (
            <ValueMapTable
              title={migration ? "User mapping" : "Owners in your file"}
              hint="Match each owner from your file to someone here. Their leads are assigned to them and they join the campaign's roster. Anyone left unmatched has their leads imported unassigned, with the old owner kept on the lead."
              values={preview.ownerValues}
              current={ownerMap}
              onChange={(k, v) => setOwnerMap((m) => ({ ...m, [k]: v }))}
              options={owners.map((o) => ({ value: o.id, label: `${o.name}${o.role !== "agent" ? ` (${o.role.replace(/_/g, " ")})` : ""}` }))}
              emptyLabel="Leave unassigned"
              testId="owner-map"
            />
          )}

          {preview.sample.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">How the first leads will look</p>
              <TableWrap label="Sample rows">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left text-muted">
                      <th className="px-3 py-1.5 font-medium">Name</th>
                      <th className="px-3 py-1.5 font-medium">Phone number</th>
                      <th className="px-3 py-1.5 font-medium">Company</th>
                      <th className="px-3 py-1.5 font-medium">Email</th>
                      {sampleExtras.map((k) => (
                        <th key={k} className="px-3 py-1.5 font-medium">
                          {sampleLabels[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((s) => (
                      <tr key={s.row} className="border-b border-line last:border-0">
                        <td className="px-3 py-1.5 text-ink">{s.name ?? <em className="text-muted">empty</em>}</td>
                        <td className="tabular px-3 py-1.5 text-ink">{s.phone}</td>
                        <td className="px-3 py-1.5 text-ink">{s.company ?? <em className="text-muted">empty</em>}</td>
                        <td className="px-3 py-1.5 text-ink">{s.email ?? <em className="text-muted">empty</em>}</td>
                        {sampleExtras.map((k) => (
                          <td key={k} className="px-3 py-1.5 text-ink">
                            {s[k] ? k === "appointment" || k === "lastContact" ? fmtDateTime(s[k] as string) : s[k] : <em className="text-muted">empty</em>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          )}

          {canManageData && (
            <fieldset className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3" data-testid="import-options">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Import options</legend>
              <div role="radiogroup" aria-labelledby="li-dup-label" className="flex flex-col gap-1.5">
                <span id="li-dup-label" className="text-sm font-medium text-ink">
                  When a row matches a lead you already have (same phone number or email)
                </span>
                {DUPLICATE_MODES.map((m) => (
                  <label key={m} className="flex items-start gap-2 text-sm text-ink">
                    <input type="radio" name="li-dup" className="mt-1" checked={duplicateMode === m} onChange={() => changeDuplicateMode(m)} disabled={pending} />
                    <span>
                      <span className="font-medium">{DUPLICATE_MODE_LABELS[m].label}</span>
                      <span className="block text-xs text-muted">{DUPLICATE_MODE_LABELS[m].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="li-owner" className="text-sm font-medium text-ink">
                    Owner
                  </label>
                  <select id="li-owner" className={selectCls} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} disabled={callMyself}>
                    <option value="">No owner (assign later)</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.role !== "agent" ? ` (${o.role.replace(/_/g, " ")})` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-muted">For every lead without an owner from the file.</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="li-tags" className="text-sm font-medium text-ink">
                    Tags
                  </label>
                  <input id="li-tags" className={inputCls} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="spring-2026, webinar" maxLength={500} />
                  <span className="text-[11px] text-muted">Added to every lead. Separate tags with commas.</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="li-list" className="text-sm font-medium text-ink">
                    List
                  </label>
                  <input id="li-list" className={inputCls} value={listText} onChange={(e) => setListText(e.target.value)} placeholder="March events" maxLength={80} />
                  <span className="text-[11px] text-muted">Groups these leads under one list name.</span>
                </div>
              </div>
              {isManager && (
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" className="mt-1" checked={callMyself} onChange={(e) => setCallMyself(e.target.checked)} disabled={Boolean(assignTo)} />
                  <span>
                    <span className="font-medium">I will call these myself</span>
                    <span className="block text-xs text-muted">
                      Assigns the imported leads to you and puts you on this campaign&apos;s roster, so they appear in your Dial workspace.
                      Other agents will not be served these leads.
                    </span>
                  </span>
                </label>
              )}
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" className="mt-1" checked={screenNow} onChange={(e) => setScreenNow(e.target.checked)} />
                <span>
                  <span className="font-medium">Run screening now</span>
                  <span className="block text-xs text-muted">
                    {screeningRequired
                      ? "Your workspace requires screening before dialing, so these leads can only be dialled after this runs. "
                      : "Optional: screening is not required in your workspace, so these leads can be dialled either way. "}
                    Numbers on your suppression (do-not-call) list are never imported. This check runs against that list only: it is not a
                    live TPS or National DNC lookup.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          {migration ? (
            <div className="flex flex-col gap-3 rounded-lg border border-brand-blue/30 bg-brand-blue-tint/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <FlaskConical className="h-4 w-4 text-brand-blue" aria-hidden />
                <span className="font-medium">Start with a test run</span>
                <span className="text-muted">of the first</span>
                <select aria-label="Rows in the test run" className="h-8 rounded-md border border-line bg-white px-2 text-xs" value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value))}>
                  {SAMPLE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} rows
                    </option>
                  ))}
                </select>
                <span className="text-muted">: check them, then migrate the rest. A test run can be undone.</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setStep("map")} disabled={pending}>
                  Back
                </Button>
                <Button onClick={() => doImport({ sample: sampleSize, test: true })} disabled={pending || nothingToImport} data-testid="run-test-migration">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Run the test migration
                </Button>
                <Button variant="secondary" onClick={() => doImport()} disabled={pending || nothingToImport}>
                  Skip the test and migrate everything
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("map")} disabled={pending}>
                Back
              </Button>
              <Button onClick={() => doImport()} disabled={pending || nothingToImport}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import {preview.willImport} lead
                {preview.willImport === 1 ? "" : "s"}
                {preview.willUpdate > 0 && ` and update ${preview.willUpdate}`}
                {preview.adoptable > 0 && ` and fix ${preview.adoptable} existing`}
              </Button>
            </div>
          )}
          {preview.adoptable > 0 && (
            <p className="text-xs text-muted">
              {preview.adoptable} of these numbers are already leads in your workspace but belong to no campaign, so no campaign or Dial queue shows them.
              Importing attaches them to {campaign?.name ?? "the chosen campaign"}.
            </p>
          )}
          {nothingToImport && (
            <p className="text-xs text-danger">
              {preview.alreadyInWorkspace > 0 && preview.alreadyInWorkspace + preview.suppressed + preview.duplicatesInFileCount >= preview.totalRows - preview.invalidCount
                ? `Nothing new to import: ${preview.alreadyInWorkspace} of these numbers are already leads in your workspace (probably from an earlier import of this file). Find them under Leads, choose "Update the existing lead" above, or upload a file with new numbers.`
                : "Nothing can be imported from this file. Go back and check the column choices."}
            </p>
          )}
        </section>
      )}

      {step === "test" && testRun && (
        <section className="flex flex-col gap-4" data-testid="migration-test">
          <div className="flex items-center gap-2 text-base font-semibold text-ink">
            <FlaskConical className="h-5 w-5 text-brand-blue" />
            {testUndone ? "Test run undone" : `Test run: ${testRun.result.imported + testRun.result.updated} of the first ${sampleSize} rows moved`}
          </div>
          <ResultList result={testRun.result} campaignName={testRun.campaignName} />
          {!testUndone && (
            <p className="text-sm text-muted">
              Open the test records and check names, numbers, owners, stages and notes look right. If they don&apos;t, undo the test run, go back and
              change the mapping. If they do, migrate the rest: the {sampleSize} rows already moved are skipped.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!testUndone && testRun.result.batchId && (
              <Button asChild variant="secondary">
                <Link href={`/admin/leads?batch=${testRun.result.batchId}`} target="_blank">
                  Check the test records
                </Link>
              </Button>
            )}
            {testRun.result.problemsCsv && (
              <Button variant="secondary" onClick={() => downloadCsv("test-run-rows-to-check.csv", testRun.result.problemsCsv!)}>
                <Download className="h-4 w-4" /> Rows that didn&apos;t move ({testRun.result.problemRows})
              </Button>
            )}
            {!testUndone && testRun.result.runId && (
              <Button variant="secondary" onClick={() => undo(testRun, () => setTestUndone(true))} disabled={pending}>
                <Undo2 className="h-4 w-4" /> Undo the test run
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStep("map")} disabled={pending}>
              Change the mapping
            </Button>
            <Button onClick={() => doImport({ skip: testSkip })} disabled={pending} data-testid="run-full-migration">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {testUndone ? "Migrate everything" : "Migrate the rest"}
            </Button>
          </div>
        </section>
      )}

      {step === "done" && done && (
        <section className="flex flex-col gap-4" data-testid="import-result">
          <div className="flex items-center gap-2 text-base font-semibold text-ink">
            <CheckCircle2 className="h-5 w-5 text-brand-green-text" />
            {undone
              ? "Import undone: what it created is in the trash"
              : migration
                ? `Migration from ${source?.name ?? "your CRM"} complete`
                : done.result.imported > 0 || done.result.updated > 0
                  ? `Imported ${done.result.imported} lead${done.result.imported === 1 ? "" : "s"}${done.result.updated > 0 ? ` and updated ${done.result.updated}` : ""} into ${done.campaignName}`
                  : `Kept ${done.result.phonelessHeld} contact${done.result.phonelessHeld === 1 ? "" : "s"} in ${done.campaignName}`}
          </div>
          {migration && testRun && !testUndone && (
            <p className="text-sm text-muted">
              Test run: {testRun.result.imported} created and {testRun.result.updated} updated. Full run below.
            </p>
          )}
          <ResultList result={done.result} campaignName={done.campaignName} screenedLater={screenedLater} />
          {migration && (
            <MigrationReport runs={[testRun && !testUndone ? testRun : null, done].filter((r): r is Done => Boolean(r))} />
          )}

          {canManageData && screeningRequired && done.result.imported > 0 && done.result.screened + screenedLater === 0 && !undone && (
            <div className="rounded-lg border border-gold/40 bg-gold-tint px-3 py-2 text-sm text-ink">
              These leads are <strong>pending screening</strong>, so nobody can dial them yet.
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={screenAfter} disabled={pending}>
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Run screening now
                </Button>
                <span className="ml-2 text-xs text-muted">Manual check against your suppression list, not a live TPS/DNC lookup.</span>
              </div>
            </div>
          )}
          {!canManageData && (
            <p className="text-sm text-muted">
              {screeningRequired
                ? "The leads are in your inbox. A manager screens them before they can be dialled."
                : "The leads are in your inbox, ready to be assigned to an agent."}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {isManager && !undone && (
              <Button asChild>
                <Link href="/dial">
                  <Headset className="h-4 w-4" /> Start dialing
                </Link>
              </Button>
            )}
            {canManageData && !undone && (
              <Button asChild variant="secondary">
                <Link href={done.result.batchId ? `/admin/leads?batch=${done.result.batchId}` : `/admin/leads?campaign=${done.result.campaignId}&kind=contact`}>
                  View and assign this data
                </Link>
              </Button>
            )}
            {done.result.problemsCsv && (
              <Button variant="secondary" onClick={() => downloadCsv(`${(file?.name ?? "import").replace(/\.[^.]+$/, "")}-rows-not-imported.csv`, done.result.problemsCsv!)}>
                <Download className="h-4 w-4" /> Download the rows that didn&apos;t import ({done.result.problemRows})
              </Button>
            )}
            {canManageData && done.result.runId && !undone && (
              <Button variant="secondary" onClick={() => undo(done, () => setUndone(true))} disabled={pending} data-testid="undo-import">
                <Undo2 className="h-4 w-4" /> Undo this import
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href={canManageData ? `/admin/campaigns/${done.result.campaignId}` : "/leadgen/leads"}>{canManageData ? "Open the campaign" : "View lead inbox"}</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                reset();
                onFinished?.();
              }}
            >
              {migration ? "Migrate another file" : "Import another file"}
            </Button>
          </div>
          {canManageData && done.result.runId && !undone && (
            <p className="text-xs text-muted">
              You can undo this import for {IMPORT_UNDO_DAYS} days, here or from Data &gt; Import history. Undoing moves what it created to the trash.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function ResultList({ result, campaignName, screenedLater = 0 }: { result: Done["result"]; campaignName: string; screenedLater?: number }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
      <li>{result.imported} created</li>
      {result.updated > 0 && <li>{result.updated} existing leads updated</li>}
      <li>{result.skippedInvalid} skipped: invalid or missing phone number</li>
      <li>{result.skippedDuplicates + result.skippedEmailDuplicates} skipped: repeated in the file</li>
      <li>{result.skippedExisting} skipped: already in your workspace</li>
      {result.skippedTrashed > 0 && <li>{result.skippedTrashed} skipped: match a lead in the trash (restore it from the trash instead)</li>}
      {result.adopted > 0 && <li>{result.adopted} existing leads with no campaign were attached to {campaignName}</li>}
      <li>{result.skippedSuppressed} skipped: on the suppression list</li>
      {result.skippedUnknownCampaign > 0 && <li>{result.skippedUnknownCampaign} skipped: campaign name not found</li>}
      {result.campaigns.length > 1 &&
        result.campaigns.map((c) => (
          <li key={c.campaignId}>
            {c.count} into {c.name}
          </li>
        ))}
      {result.phonelessHeld > 0 && <li>{result.phonelessHeld} kept as contacts without a number (assign them under Leads; the agent adds the number)</li>}
      {result.ownersAssigned > 0 && <li>{result.ownersAssigned} given an owner (owners were added to the campaign roster)</li>}
      {result.stagesSet > 0 && <li>{result.stagesSet} given a stage from the file</li>}
      {result.autoAssigned > 0 && <li>{result.autoAssigned} shared out to the campaign&apos;s agents (auto-assign is on)</li>}
      {result.assignedToMe > 0 && <li>{result.assignedToMe} assigned to you, and you are on this campaign&apos;s roster</li>}
      {result.screened + screenedLater > 0 && <li>{result.screened + screenedLater} screened (manual check against your suppression list): ready to dial</li>}
    </ul>
  );
}

// The migration report: what moved per kind of record, across the test run
// and the full run.
function MigrationReport({ runs }: { runs: Done[] }) {
  const sum = (f: (r: Done["result"]) => number) => runs.reduce((n, r) => n + f(r.result), 0);
  const rows: [string, number][] = [
    ["Leads created", sum((r) => r.imported)],
    ["Existing leads updated", sum((r) => r.updated)],
    ["Contacts kept without a number", sum((r) => r.phonelessHeld)],
    ["Owners matched", sum((r) => r.ownersAssigned)],
    ["Stages mapped", sum((r) => r.stagesSet)],
    [
      "Not moved",
      sum((r) => r.skippedInvalid + r.skippedDuplicates + r.skippedEmailDuplicates + r.skippedExisting + r.skippedSuppressed + r.skippedUnknownCampaign + r.skippedTrashed),
    ],
  ];
  return (
    <div className="rounded-lg border border-line bg-white" data-testid="migration-report">
      <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Migration report</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 text-sm sm:grid-cols-3">
        {rows.map(([label, n]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 border-b border-line/60 py-1 last:border-0">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular font-semibold text-ink">{n.toLocaleString("en-GB")}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        Every record that didn&apos;t move is in the downloadable file with the reason. Your old CRM was not changed.
      </p>
    </div>
  );
}

function ValueMapTable({
  title,
  hint,
  values,
  current,
  onChange,
  options,
  emptyLabel,
  testId,
}: {
  title: string;
  hint: string;
  values: { value: string; count: number }[];
  current: Record<string, string>;
  onChange: (key: string, value: string) => void;
  options: { value: string; label: string }[];
  emptyLabel: string;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white" data-testid={testId}>
      <div className="border-b border-line px-3 py-2">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <TableWrap label={title}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
              <th className="px-3 py-1.5 font-medium">In your file</th>
              <th className="px-3 py-1.5 font-medium">Rows</th>
              <th className="w-[260px] px-3 py-1.5 font-medium">In LeadCallient</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v) => {
              const k = normValue(v.value);
              return (
                <tr key={k} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 text-ink">{v.value}</td>
                  <td className="tabular px-3 py-1.5 text-muted">{v.count}</td>
                  <td className="px-3 py-1.5">
                    <select aria-label={`${title}: ${v.value}`} className={selectCls} value={current[k] ?? ""} onChange={(e) => onChange(k, e.target.value)}>
                      <option value="">{emptyLabel}</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

function Stat({ label, value, tone, testId }: { label: string; value: number; tone?: "good" | "warn"; testId?: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone === "good" ? "border-brand-green/40 bg-white" : tone === "warn" ? "border-gold/40 bg-gold-tint" : "border-line bg-white"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-display text-xl font-semibold text-ink" data-testid={testId}>
        {value.toLocaleString("en-GB")}
      </div>
    </div>
  );
}

function Issues({ title, items, total, tone }: { title: string; items: { row: number; value: string; reason: string }[]; total: number; tone?: "danger" }) {
  return (
    <details className={`rounded-lg border bg-white ${tone === "danger" ? "border-danger/40" : "border-line"}`} open={items.length <= 5}>
      <summary className="disclosure px-3 py-2 text-sm font-medium text-ink">{title}</summary>
      <ul className="max-h-48 divide-y divide-line overflow-y-auto border-t border-line text-xs">
        {items.map((it, i) => (
          <li key={i} className="flex flex-wrap gap-x-3 px-3 py-1.5">
            <span className="font-medium text-ink">Row {it.row}</span>
            <span className="tabular text-muted">{it.value || "(empty)"}</span>
            <span className="text-danger">{it.reason}</span>
          </li>
        ))}
        {total > items.length && <li className="px-3 py-1.5 text-muted">...and {total - items.length} more.</li>}
      </ul>
    </details>
  );
}

// The same importer in a dialog, for pages that already have a toolbar
// (Lead inbox, Data).
export function LeadImporterDialog(props: Props & { label?: string }) {
  const [open, setOpen] = useState(false);
  const { label, ...rest } = props;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" /> {label ?? "Import leads"}
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>Upload a CSV or Excel file and say what each of its columns is. Everything in the file comes through.</DialogDescription>
        </DialogHeader>
        <LeadImporter {...rest} onFinished={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Headset, Loader2, Upload } from "lucide-react";
import { previewLeadImport, runLeadImport, type ImportResponse } from "@/lib/actions/lead-import";
import { screenLeadBatch } from "@/lib/actions/lead-upload";
import { RegisterSourceDialog } from "@/components/leads/register-source-dialog";
import {
  EXTRA_LABEL_MAX,
  IMPORT_LIMITS,
  OPTIONAL_HINTS,
  ROLE_LABELS,
  ROLE_ORDER,
  duplicateRoles,
  mappingFromRoles,
  normalizeHeaders,
  rolesFromMapping,
  suggestMapping,
  validateMapping,
  type ColumnChoice,
  type ColumnMapping,
  type ColumnRole,
  type FirstRowsPreview,
  type ImportPreview,
} from "@/lib/leads/mapped-import-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";
import { TableWrap } from "@/components/ui/data-table";

interface CampaignOption {
  id: string;
  name: string;
  country: string | null;
}

interface Props {
  campaigns: CampaignOption[];
  // Every import names a data source (the lawful basis the list is held
  // under). `needsReview` marks the auto-created legacy source, which cannot be
  // used until its real basis is set under Data.
  dataSources: { id: string; name: string; needsReview?: boolean }[];
  // Managers (super_admin / ops_manager) get the dial-it-myself and
  // screen-now options. Lead gen never sees them.
  isManager: boolean;
  // Whether this workspace makes leads pass screening before they can be
  // dialled (Compliance). Off: imported leads are dialable straight away.
  screeningRequired?: boolean;
  // Pre-select a campaign (the importer on a campaign's own page).
  initialCampaignId?: string;
  onFinished?: () => void;
}

const selectCls =
  "h-9 w-full rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

// What each role means, shown under the chosen role.
const ROLE_HINTS: Partial<Record<ColumnRole, string>> = {
  name: "Who you are calling.",
  first: "Combined with the last-name column into the lead's name.",
  last: "Combined with the first-name column into the lead's name.",
  phone: "Numbers are cleaned to international format using the campaign's country.",
  company: "The company or organisation the person works for.",
  email: "Used for follow-up emails. Values that don't look like an email are left empty.",
  contact: OPTIONAL_HINTS.contact,
  website: OPTIONAL_HINTS.website,
  campaign: OPTIONAL_HINTS.campaign,
  notes: OPTIONAL_HINTS.notes,
  nextStep: OPTIONAL_HINTS.nextStep,
  appointment: OPTIONAL_HINTS.appointment,
  lastContact: OPTIONAL_HINTS.lastContact,
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

export function LeadImporter({ campaigns, dataSources, isManager, screeningRequired = false, initialCampaignId, onFinished }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
  const [done, setDone] = useState<Extract<ImportResponse, { ok: true }> | null>(null);
  const [screenedLater, setScreenedLater] = useState(0);
  const [pending, startTransition] = useTransition();

  const campaign = campaigns.find((c) => c.id === campaignId);

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

  function makeForm() {
    const fd = new FormData();
    if (file) fd.set("file", file);
    fd.set("campaign_id", campaignId);
    fd.set("mapping", JSON.stringify(mapping));
    fd.set("data_source_id", dataSourceId);
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
      const initial = rolesFromMapping(h.headers, suggestMapping(h.headers));
      setRoles(initial);
      setSuggestedRoles(initial);
      setFallback(false);
      setTouched(false);
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
    setStep(2);
  }

  function toReview() {
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    startTransition(async () => {
      const res = await previewLeadImport(makeForm());
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setPreview(res.preview);
      setStep(3);
    });
  }

  function doImport() {
    setError(null);
    const fd = makeForm();
    if (isManager && callMyself) fd.set("call_myself", "1");
    if (isManager && screenNow) fd.set("screen_now", "1");
    startTransition(async () => {
      const res = await runLeadImport(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(res);
      setStep(4);
      toast.success(`Imported ${res.result.imported} lead${res.result.imported === 1 ? "" : "s"}.`);
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
    setStep(1);
    setFile(null);
    setHead(null);
    setPreview(null);
    setDone(null);
    setScreenedLater(0);
    setCallMyself(false);
    setScreenNow(screeningRequired);
    setError(null);
    setRoles({});
    setSuggestedRoles({});
    setFallback(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const steps = ["File", "Match columns", "Review", "Done"];

  return (
    <div className="flex flex-col gap-4" data-testid="lead-importer">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              step === i + 1
                ? "border-brand-blue bg-brand-blue-tint font-semibold text-brand-blue"
                : step > i + 1
                  ? "border-line bg-white text-ink"
                  : "border-line bg-canvas text-muted"
            }`}
            aria-current={step === i + 1 ? "step" : undefined}
          >
            <span className="font-semibold">{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Choose a CSV or Excel file of the people to call and the campaign they belong to. Up to 10 MB and 20,000 rows.
            Nothing is saved until you press Import on the review step.
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              Lead file (.csv or .xlsx) <span aria-hidden className="text-danger">*</span>
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
              <RegisterSourceDialog
                label="Register a new source"
                variant="secondary"
                onCreated={(id) => setDataSourceId(id)}
              />
            </div>
            <select
              id="li-source"
              value={dataSourceId}
              onChange={(e) => setDataSourceId(e.target.value)}
              className={selectCls}
              aria-required="true"
            >
              <option value="">Choose a data source...</option>
              {dataSources.map((d) => (
                <option key={d.id} value={d.id} disabled={d.needsReview}>
                  {d.needsReview ? `${d.name} (set its lawful basis under Data first)` : d.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              A source records where the list came from and the lawful basis it is held under. Every import needs one.
              {dataSources.filter((d) => !d.needsReview).length === 0 && " You don't have a usable source yet: register one above."}
            </p>
          </div>
          <div>
            <Button onClick={toMapping} disabled={!file || !campaignId || !dataSourceId}>
              Next: match columns
            </Button>
          </div>
        </section>
      )}

      {step === 2 && head && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Every column in your file is listed below. Tell us what each one is. We made a first guess from the column names:
            please check each row. Anything you don&apos;t match to a field is kept as extra information under the label you
            give it, so whatever is in your file comes through and is shown to you and to the agent you assign it to.
          </p>

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
                          {ROLE_ORDER.map((r) => (
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
                            className="h-9 w-full rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
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
              until a number is added and screened. If the file does have phone numbers, set that column to{" "}
              <em>Phone number</em> above.
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

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} disabled={pending}>
              Back
            </Button>
            <Button onClick={toReview} disabled={pending || dupes.length > 0}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Next: review
            </Button>
          </div>
        </section>
      )}

      {step === 3 && preview && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            This is a check only: nothing has been saved yet.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Rows in file" value={preview.totalRows} />
            <Stat label="Will be imported" value={preview.willImport} tone="good" testId="will-import" />
            <Stat label="Invalid numbers" value={preview.invalidCount} tone={preview.invalidCount ? "warn" : undefined} />
            <Stat label="Repeated in the file" value={preview.duplicatesInFileCount} tone={preview.duplicatesInFileCount ? "warn" : undefined} />
            <Stat label="Already in your workspace" value={preview.alreadyInWorkspace} />
            <Stat label="On the suppression list (skipped)" value={preview.suppressed} tone={preview.suppressed ? "warn" : undefined} />
          </div>
          {preview.ignoredEmails > 0 && (
            <p className="text-xs text-muted">
              {preview.ignoredEmails} email address{preview.ignoredEmails === 1 ? "" : "es"} didn&apos;t look valid and will be left empty.
            </p>
          )}
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
                            {s[k] ? (
                              k === "appointment" || k === "lastContact" ? fmtDateTime(s[k] as string) : s[k]
                            ) : (
                              <em className="text-muted">empty</em>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          )}

          {isManager && (
            <fieldset className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Before you import (optional)</legend>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={callMyself}
                  onChange={(e) => setCallMyself(e.target.checked)}
                />
                <span>
                  <span className="font-medium">I will call these myself</span>
                  <span className="block text-xs text-muted">
                    Assigns the imported leads to you and puts you on this campaign&apos;s roster, so they appear in your Dial workspace.
                    Other agents will not be served these leads.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" className="mt-1" checked={screenNow} onChange={(e) => setScreenNow(e.target.checked)} />
                <span>
                  <span className="font-medium">Run screening now</span>
                  <span className="block text-xs text-muted">
                    {screeningRequired
                      ? "Your workspace requires screening before dialing, so these leads can only be dialled after this runs. "
                      : "Optional: screening is not required in your workspace, so these leads can be dialled either way. "}
                    This runs the manual screening check on this batch: it checks the numbers against your workspace suppression list
                    only. It is not a live TPS or National DNC lookup.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={pending}>
              Back
            </Button>
            <Button onClick={doImport} disabled={pending || (preview.willImport === 0 && preview.phonelessHeld === 0 && preview.adoptable === 0)}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import {preview.willImport} lead
              {preview.willImport === 1 ? "" : "s"}
              {preview.adoptable > 0 && ` and fix ${preview.adoptable} existing`}
            </Button>
          </div>
          {preview.adoptable > 0 && (
            <p className="text-xs text-muted">
              {preview.adoptable} of these numbers are already leads in your workspace but belong to no campaign, so no campaign or Dial queue shows them.
              Importing attaches them to {campaign?.name ?? "the chosen campaign"}.
            </p>
          )}
          {preview.willImport === 0 && preview.phonelessHeld === 0 && preview.adoptable === 0 && (
            <p className="text-xs text-danger">
              {preview.alreadyInWorkspace > 0 && preview.alreadyInWorkspace + preview.suppressed + preview.duplicatesInFileCount >= preview.totalRows - preview.invalidCount
                ? `Nothing new to import: ${preview.alreadyInWorkspace} of these numbers are already leads in your workspace (probably from an earlier import of this file). Find them under Leads, or upload a file with new numbers.`
                : "Nothing can be imported from this file. Go back and check the column choices."}
            </p>
          )}
        </section>
      )}

      {step === 4 && done && (
        <section className="flex flex-col gap-4" data-testid="import-result">
          <div className="flex items-center gap-2 text-base font-semibold text-ink">
            <CheckCircle2 className="h-5 w-5 text-brand-green-text" />
            {done.result.imported > 0
              ? `Imported ${done.result.imported} lead${done.result.imported === 1 ? "" : "s"} into ${done.campaignName}`
              : `Kept ${done.result.phonelessHeld} contact${done.result.phonelessHeld === 1 ? "" : "s"} in ${done.campaignName}`}
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
            <li>{done.result.skippedInvalid} skipped: invalid or missing phone number</li>
            <li>{done.result.skippedDuplicates} skipped: repeated in the file</li>
            <li>{done.result.skippedExisting} skipped: already in your workspace</li>
            {done.result.adopted > 0 && <li>{done.result.adopted} existing leads with no campaign were attached to {done.campaignName}</li>}
            <li>{done.result.skippedSuppressed} skipped: on the suppression list</li>
            {done.result.skippedUnknownCampaign > 0 && <li>{done.result.skippedUnknownCampaign} skipped: campaign name not found</li>}
            {done.result.campaigns.length > 1 &&
              done.result.campaigns.map((c) => (
                <li key={c.campaignId}>
                  {c.count} into {c.name}
                </li>
              ))}
            {done.result.phonelessHeld > 0 && (
              <li>{done.result.phonelessHeld} kept as contacts without a number (assign them under Leads; the agent adds the number)</li>
            )}
            {done.result.assignedToMe > 0 && <li>{done.result.assignedToMe} assigned to you, and you are on this campaign&apos;s roster</li>}
            {done.result.screened + screenedLater > 0 && (
              <li>{done.result.screened + screenedLater} screened (manual check against your suppression list): ready to dial</li>
            )}
          </ul>

          {isManager && screeningRequired && done.result.imported > 0 && done.result.screened + screenedLater === 0 && (
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
          {!isManager && (
            <p className="text-sm text-muted">
              {screeningRequired
                ? "The leads are in your inbox. A manager screens them before they can be dialled."
                : "The leads are in your inbox, ready to be assigned to an agent."}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {isManager && (
              <Button asChild>
                <Link href="/dial">
                  <Headset className="h-4 w-4" /> Start dialing
                </Link>
              </Button>
            )}
            {isManager && (
              <Button asChild variant="secondary">
                <Link href={done.result.batchId ? `/admin/leads?batch=${done.result.batchId}` : `/admin/leads?campaign=${done.result.campaignId}&kind=contact`}>
                  View and assign this data
                </Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href={isManager ? `/admin/campaigns/${done.result.campaignId}` : "/leadgen/leads"}>
                {isManager ? "Open the campaign" : "View lead inbox"}
              </Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                reset();
                onFinished?.();
              }}
            >
              Import another file
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone, testId }: { label: string; value: number; tone?: "good" | "warn"; testId?: string }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        tone === "good" ? "border-brand-green/40 bg-white" : tone === "warn" ? "border-gold/40 bg-gold-tint" : "border-line bg-white"
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="font-display text-xl font-semibold text-ink" data-testid={testId}>
        {value.toLocaleString("en-GB")}
      </div>
    </div>
  );
}

function Issues({
  title,
  items,
  total,
  tone,
}: {
  title: string;
  items: { row: number; value: string; reason: string }[];
  total: number;
  tone?: "danger";
}) {
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

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { STICKY_FIRST, STICKY_LAST, TableWrap } from "@/components/ui/data-table";
import { EMPTY, fmtDateTime } from "@/lib/format";
import { SCREENING_BADGE } from "@/lib/lead-status";
import type { RealTables } from "@/lib/supabase/real-types";
import { bulkAssignLeads, bulkMoveLeadsToCampaign, bulkScreenLeads } from "@/lib/actions/lead-admin";
import { purgeLeads, trashLeads } from "@/lib/actions/data-trash";
import { DeleteRecordsDialog } from "@/components/leads/delete-records-dialog";
import { BulkBar, customKeys, customValue, type BulkAgent } from "./bulk-bar";
import { BulkEditDialog } from "./bulk-edit-dialog";
import { ColumnPicker } from "./column-picker";

export type LeadRow = RealTables<"leads">;

const cell = "max-w-[220px] truncate px-3 py-1.5";

// Columns a person can hide (the name and the row tick-box always show).
export const LEAD_COLUMNS = [
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "contact", label: "Contact person" },
  { key: "campaign", label: "Campaign" },
  { key: "assigned", label: "Assigned to" },
  { key: "screening", label: "Screening" },
  { key: "status", label: "Stage" },
  { key: "tags", label: "Tags" },
  { key: "list", label: "List" },
  { key: "website", label: "Website" },
  { key: "nextStep", label: "Next step" },
  { key: "appointment", label: "Appointment" },
  { key: "notes", label: "Notes" },
  { key: "extra", label: "Extra information from your files" },
  { key: "upload", label: "Upload" },
  { key: "added", label: "Added" },
] as const;
type ColumnKey = (typeof LEAD_COLUMNS)[number]["key"];

export function LeadsTable({
  rows,
  total,
  limit,
  agents,
  campaigns,
  nameById,
  campaignName,
  batchName,
  timezone,
  canPurge,
  trashDays,
  hiddenColumns,
  lists,
}: {
  rows: LeadRow[];
  total: number;
  limit: number;
  agents: BulkAgent[];
  campaigns: { id: string; name: string }[];
  nameById: Record<string, string>;
  campaignName: Record<string, string>;
  batchName: Record<string, string>;
  timezone: string | null;
  canPurge: boolean;
  trashDays: number;
  hiddenColumns: string[];
  lists: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<string[]>(hiddenColumns);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);
  const extraKeys = useMemo(() => customKeys(rows), [rows]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = [...selected];
  const show = (k: ColumnKey) => !hidden.includes(k);
  const shownExtra = show("extra") ? extraKeys : [];
  const visibleCount = 3 + LEAD_COLUMNS.filter((c) => c.key !== "extra" && show(c.key)).length + shownExtra.length;

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const name = (l: LeadRow) => [l.first_name, l.last_name].filter(Boolean).join(" ") || l.full_name || "";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <BulkBar
            count={selected.size}
            agents={agents}
            campaigns={campaigns}
            noun="lead"
            onAssign={(u) => bulkAssignLeads(ids, u)}
            onScreen={() => bulkScreenLeads(ids)}
            onMove={(c) => bulkMoveLeadsToCampaign(ids, c)}
            onEdit={() => setEditing(true)}
            onDelete={() => setDeleting(ids)}
            onClear={() => setSelected(new Set())}
          />
        </div>
        <ColumnPicker list="leads" columns={[...LEAD_COLUMNS]} hidden={hidden} onChange={setHidden} />
      </div>
      <TableWrap label="Uploaded leads">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
              <th className={`${STICKY_FIRST} w-8 bg-canvas px-3 py-2`}>
                <Checkbox aria-label="Select all leads shown" checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="px-3 py-2 font-medium">Name</th>
              {show("phone") && <th className="px-3 py-2 font-medium">Phone</th>}
              {show("company") && <th className="px-3 py-2 font-medium">Company</th>}
              {show("email") && <th className="px-3 py-2 font-medium">Email</th>}
              {show("contact") && <th className="px-3 py-2 font-medium">Contact person</th>}
              {show("campaign") && <th className="px-3 py-2 font-medium">Campaign</th>}
              {show("assigned") && <th className="px-3 py-2 font-medium">Assigned to</th>}
              {show("screening") && <th className="px-3 py-2 font-medium">Screening</th>}
              {show("status") && <th className="px-3 py-2 font-medium">Stage</th>}
              {show("tags") && <th className="px-3 py-2 font-medium">Tags</th>}
              {show("list") && <th className="px-3 py-2 font-medium">List</th>}
              {show("website") && <th className="px-3 py-2 font-medium">Website</th>}
              {show("nextStep") && <th className="px-3 py-2 font-medium">Next step</th>}
              {show("appointment") && <th className="px-3 py-2 font-medium">Appointment</th>}
              {show("notes") && <th className="px-3 py-2 font-medium">Notes</th>}
              {shownExtra.map((k) => (
                <th key={k} className="px-3 py-2 font-medium" title="Extra information from your file">
                  {k}
                </th>
              ))}
              {show("upload") && <th className="px-3 py-2 font-medium">Upload</th>}
              {show("added") && <th className="px-3 py-2 font-medium">Added</th>}
              <th className={`${STICKY_LAST} bg-canvas px-3 py-2 text-right font-medium`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const on = selected.has(l.id);
              const label = name(l) || l.phone_e164 || "lead";
              return (
                <tr key={l.id} className={`h-[38px] border-b border-line bg-surface last:border-0 ${on ? "bg-brand-blue-tint/40" : ""}`} data-testid="lead-row">
                  <td className={`${STICKY_FIRST} px-3 py-1.5`}>
                    <Checkbox aria-label={`Select ${label}`} checked={on} onCheckedChange={() => toggle(l.id)} />
                  </td>
                  <td className={`${cell} font-medium text-ink`} title={name(l)}>
                    {name(l) || EMPTY}
                  </td>
                  {show("phone") && <td className="tabular px-3 py-1.5">{l.phone_e164 ?? EMPTY}</td>}
                  {show("company") && (
                    <td className={`${cell} text-muted`} title={l.company_name ?? undefined}>
                      {l.company_name ?? EMPTY}
                    </td>
                  )}
                  {show("email") && (
                    <td className={`${cell} text-muted`} title={l.email ?? undefined}>
                      {l.email ?? EMPTY}
                    </td>
                  )}
                  {show("contact") && <td className={`${cell} text-muted`}>{l.contact_name ?? EMPTY}</td>}
                  {show("campaign") && (
                    <td className="px-3 py-1.5 text-muted">
                      {l.campaign_id ? (
                        <Link href={`/admin/campaigns/${l.campaign_id}`} className="hover:underline">
                          {campaignName[l.campaign_id] ?? EMPTY}
                        </Link>
                      ) : (
                        <Badge variant="warning">No campaign</Badge>
                      )}
                    </td>
                  )}
                  {show("assigned") && (
                    <td className="px-3 py-1.5 text-muted">
                      {l.assigned_to ? (nameById[l.assigned_to] ?? EMPTY) : <span className="text-warning">Unassigned</span>}
                    </td>
                  )}
                  {show("screening") && (
                    <td className="px-3 py-1.5">
                      <Badge variant={SCREENING_BADGE[l.screening_status] ?? "neutral"}>{l.screening_status}</Badge>
                    </td>
                  )}
                  {show("status") && (
                    <td className="px-3 py-1.5">
                      <Badge variant="neutral">{l.status.replace(/_/g, " ")}</Badge>
                    </td>
                  )}
                  {show("tags") && (
                    <td className="max-w-[240px] px-3 py-1.5">
                      {(l.tags ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(l.tags ?? []).slice(0, 4).map((t) => (
                            <Link key={t} href={`/admin/leads?tag=${encodeURIComponent(t)}`} className="rounded bg-brand-blue-tint px-1.5 py-0.5 text-[11px] text-brand-blue hover:underline">
                              {t}
                            </Link>
                          ))}
                          {(l.tags ?? []).length > 4 && <span className="text-[11px] text-muted">+{(l.tags ?? []).length - 4}</span>}
                        </div>
                      ) : (
                        <span className="text-muted">{EMPTY}</span>
                      )}
                    </td>
                  )}
                  {show("list") && (
                    <td className={`${cell} text-muted`}>
                      {l.group_label ? (
                        <Link href={`/admin/leads?list=${encodeURIComponent(l.group_label)}`} className="hover:underline">
                          {l.group_label}
                        </Link>
                      ) : (
                        EMPTY
                      )}
                    </td>
                  )}
                  {show("website") && (
                    <td className={`${cell} text-muted`} title={l.website ?? undefined}>
                      {l.website ?? EMPTY}
                    </td>
                  )}
                  {show("nextStep") && (
                    <td className={`${cell} text-muted`} title={l.next_step ?? undefined}>
                      {l.next_step ?? EMPTY}
                    </td>
                  )}
                  {show("appointment") && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted">{l.appointment_at ? fmtDateTime(l.appointment_at, timezone) : EMPTY}</td>
                  )}
                  {show("notes") && (
                    <td className={`${cell} text-muted`} title={l.agent_notes ?? undefined}>
                      {l.agent_notes ?? EMPTY}
                    </td>
                  )}
                  {shownExtra.map((k) => {
                    const v = customValue(l.custom, k);
                    return (
                      <td key={k} className={`${cell} text-muted`} title={v || undefined}>
                        {v || EMPTY}
                      </td>
                    );
                  })}
                  {show("upload") && (
                    <td className={`${cell} text-xs text-muted`} title={l.batch_id ? batchName[l.batch_id] : undefined}>
                      {l.batch_id ? (batchName[l.batch_id] ?? "Batch") : (l.source ?? EMPTY)}
                    </td>
                  )}
                  {show("added") && <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted">{fmtDateTime(l.created_at, timezone)}</td>}
                  <td className={`${STICKY_LAST} px-2 py-1 text-right`}>
                    <button
                      type="button"
                      onClick={() => setDeleting([l.id])}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger-tint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                      aria-label={`Delete ${label}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleCount} className="px-3 py-8 text-center text-sm text-muted">
                  No leads match these filters. Upload a file under Upload leads, or clear the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <p className="mt-2 text-xs text-muted">
        Showing {rows.length} of {total}.{total > limit ? ` Only the newest ${limit} are listed: narrow the filters to see the rest.` : ""}
      </p>

      <DeleteRecordsDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        count={deleting?.length ?? 0}
        noun="lead"
        canPurge={canPurge}
        trashDays={trashDays}
        onTrash={() => trashLeads(deleting ?? [])}
        onPurge={(word) => purgeLeads(deleting ?? [], word)}
        onDone={(r, permanent) => {
          toast.success(
            permanent
              ? `Deleted ${r.count ?? 0} lead${r.count === 1 ? "" : "s"} permanently.`
              : `Moved ${r.count ?? 0} lead${r.count === 1 ? "" : "s"} to the trash. Restore them from Leads > Trash for ${trashDays} days.`,
          );
          setSelected((s) => {
            const n = new Set(s);
            for (const id of deleting ?? []) n.delete(id);
            return n;
          });
          setDeleting(null);
          router.refresh();
        }}
      />
      <BulkEditDialog
        open={editing}
        onOpenChange={setEditing}
        ids={ids}
        lists={lists}
        onDone={(r) => {
          toast.success(`Updated ${r.count ?? 0} lead${r.count === 1 ? "" : "s"}.`);
          router.refresh();
        }}
      />
    </div>
  );
}

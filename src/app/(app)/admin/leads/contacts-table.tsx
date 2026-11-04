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
import { bulkAssignContacts } from "@/lib/actions/lead-admin";
import { purgeContacts, trashContacts } from "@/lib/actions/data-trash";
import { DeleteRecordsDialog } from "@/components/leads/delete-records-dialog";
import { BulkBar, customKeys, customValue, type BulkAgent } from "./bulk-bar";

// unphoned_contacts rows that have not been promoted yet.
export interface ContactRow {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  city: string | null;
  campaign_id: string | null;
  data_source_id: string | null;
  assigned_to: string | null;
  custom: unknown;
  created_at: string;
}

const cell = "max-w-[220px] truncate px-3 py-1.5";

export function ContactsTable({
  rows,
  total,
  limit,
  agents,
  nameById,
  campaignName,
  timezone,
  canPurge,
  trashDays,
}: {
  rows: ContactRow[];
  total: number;
  limit: number;
  agents: BulkAgent[];
  nameById: Record<string, string>;
  campaignName: Record<string, string>;
  timezone: string | null;
  canPurge: boolean;
  trashDays: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const extraKeys = useMemo(() => customKeys(rows), [rows]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = [...selected];
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <BulkBar
        count={selected.size}
        agents={agents}
        noun="contact"
        onAssign={(u) => bulkAssignContacts(ids, u)}
        onDelete={() => setDeleting(ids)}
        onClear={() => setSelected(new Set())}
      />
      <TableWrap label="Contacts without a phone number">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
              <th className={`${STICKY_FIRST} w-8 bg-canvas px-3 py-2`}>
                <Checkbox aria-label="Select all contacts shown" checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">City</th>
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Assigned to</th>
              {extraKeys.map((k) => (
                <th key={k} className="px-3 py-2 font-medium" title="Extra information from your file">
                  {k}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Added</th>
              <th className={`${STICKY_LAST} bg-canvas px-3 py-2 text-right font-medium`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const on = selected.has(c.id);
              return (
                <tr key={c.id} className={`h-[38px] border-b border-line bg-surface last:border-0 ${on ? "bg-brand-blue-tint/40" : ""}`} data-testid="contact-row">
                  <td className={`${STICKY_FIRST} px-3 py-1.5`}>
                    <Checkbox aria-label={`Select ${c.full_name || c.company_name || c.email || "contact"}`} checked={on} onCheckedChange={() => toggle(c.id)} />
                  </td>
                  <td className={`${cell} font-medium text-ink`}>{c.full_name ?? EMPTY}</td>
                  <td className={`${cell} text-muted`}>{c.company_name ?? EMPTY}</td>
                  <td className={`${cell} text-muted`}>{c.email ?? EMPTY}</td>
                  <td className={`${cell} text-muted`}>{c.city ?? EMPTY}</td>
                  <td className="px-3 py-1.5 text-muted">
                    {c.campaign_id ? (
                      <Link href={`/admin/campaigns/${c.campaign_id}`} className="hover:underline">
                        {campaignName[c.campaign_id] ?? EMPTY}
                      </Link>
                    ) : (
                      <Badge variant="warning">No campaign</Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted">
                    {c.assigned_to ? (nameById[c.assigned_to] ?? EMPTY) : <span className="text-warning">Unassigned</span>}
                  </td>
                  {extraKeys.map((k) => {
                    const v = customValue(c.custom, k);
                    return (
                      <td key={k} className={`${cell} text-muted`} title={v || undefined}>
                        {v || EMPTY}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted">{fmtDateTime(c.created_at, timezone)}</td>
                  <td className={`${STICKY_LAST} px-2 py-1 text-right`}>
                    <button
                      type="button"
                      onClick={() => setDeleting([c.id])}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger-tint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                      aria-label={`Delete ${c.full_name || c.company_name || c.email || "contact"}`}
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
                <td colSpan={9 + extraKeys.length} className="px-3 py-8 text-center text-sm text-muted">
                  No contacts without a number match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <p className="mt-2 text-xs text-muted">
        Showing {rows.length} of {total}.{total > limit ? ` Only the newest ${limit} are listed.` : ""} The assigned agent adds the number from
        their call sheet; the contact then becomes a lead pending screening.
      </p>
      <DeleteRecordsDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        count={deleting?.length ?? 0}
        noun="contact"
        canPurge={canPurge}
        trashDays={trashDays}
        onTrash={() => trashContacts(deleting ?? [])}
        onPurge={(word) => purgeContacts(deleting ?? [], word)}
        onDone={(r, permanent) => {
          toast.success(
            permanent
              ? `Deleted ${r.count ?? 0} contact${r.count === 1 ? "" : "s"} permanently.`
              : `Moved ${r.count ?? 0} contact${r.count === 1 ? "" : "s"} to the trash.`,
          );
          setSelected(new Set());
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

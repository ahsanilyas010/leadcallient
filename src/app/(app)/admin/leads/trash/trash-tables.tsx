"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { STICKY_FIRST, TableWrap } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteRecordsDialog } from "@/components/leads/delete-records-dialog";
import { emptyTrash, purgeContacts, purgeLeads, restoreContacts, restoreLeads, type DeleteResult } from "@/lib/actions/data-trash";
import { PURGE_CONFIRM_WORD } from "@/lib/data-delete";
import { EMPTY, fmtDate, fmtDateTime } from "@/lib/format";

interface TrashedLead {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone_e164: string | null;
  email: string | null;
  campaign_name: string | null;
  deleted_at: string;
  deleted_by_name: string | null;
  expires_at: string;
}
interface TrashedContact {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  campaign_name: string | null;
  deleted_at: string;
  deleted_by_name: string | null;
  expires_at: string;
}

export function TrashTables({
  leads,
  contacts,
  canPurge,
  timezone,
}: {
  leads: TrashedLead[];
  contacts: TrashedContact[];
  canPurge: boolean;
  timezone: string | null;
}) {
  const router = useRouter();
  const [emptying, setEmptying] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const total = leads.length + contacts.length;

  return (
    <div className="flex flex-col gap-6">
      {canPurge && total > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" className="text-danger" onClick={() => setEmptying(true)} data-testid="empty-trash">
            <Trash2 className="h-4 w-4" /> Empty trash
          </Button>
        </div>
      )}
      <Section
        title="Leads"
        noun="lead"
        rows={leads.map((l) => ({ ...l, detail: l.phone_e164 }))}
        canPurge={canPurge}
        timezone={timezone}
        restore={restoreLeads}
        purge={purgeLeads}
      />
      <Section
        title="Contacts without a number"
        noun="contact"
        rows={contacts.map((c) => ({ ...c, detail: null }))}
        canPurge={canPurge}
        timezone={timezone}
        restore={restoreContacts}
        purge={purgeContacts}
      />

      <Dialog open={emptying} onOpenChange={(o) => !pending && setEmptying(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty the trash?</DialogTitle>
            <DialogDescription>
              Every record in the trash ({total.toLocaleString("en-GB")} shown here) is deleted for good, with its call history. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="empty-confirm" className="text-sm text-ink">
            Type <strong>{PURGE_CONFIRM_WORD}</strong> to confirm
          </label>
          <input
            id="empty-confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="h-9 rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-danger"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEmptying(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending || typed.trim() !== PURGE_CONFIRM_WORD}
              onClick={() =>
                start(async () => {
                  const r = await emptyTrash(typed);
                  if (r.error) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success(`Deleted ${r.leads ?? 0} leads and ${r.contacts ?? 0} contacts permanently.`);
                  setEmptying(false);
                  setTyped("");
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Empty trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  noun,
  rows,
  canPurge,
  timezone,
  restore,
  purge,
}: {
  title: string;
  noun: string;
  rows: { id: string; full_name: string | null; company_name: string | null; email: string | null; detail: string | null; campaign_name: string | null; deleted_at: string; deleted_by_name: string | null; expires_at: string }[];
  canPurge: boolean;
  timezone: string | null;
  restore: (ids: string[]) => Promise<DeleteResult>;
  purge: (ids: string[], confirm: string) => Promise<DeleteResult>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purging, setPurging] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const ids = [...selected];
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function doRestore(list: string[]) {
    start(async () => {
      const r = await restore(list);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Restored ${r.count ?? 0} ${noun}${r.count === 1 ? "" : "s"}.`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">
          {title} <span className="font-normal text-muted">· {rows.length.toLocaleString("en-GB")}</span>
        </h2>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" disabled={pending || selected.size === 0} onClick={() => doRestore(ids)} data-testid={`restore-${noun}`}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore{selected.size > 0 ? ` ${selected.size}` : ""}
          </Button>
          {canPurge && (
            <Button size="sm" variant="secondary" className="text-danger" disabled={pending || selected.size === 0} onClick={() => setPurging(ids)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
            </Button>
          )}
        </div>
      </div>
      <TableWrap label={`Trashed ${title.toLowerCase()}`}>
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
              <th className={`${STICKY_FIRST} w-8 bg-canvas px-3 py-2`}>
                <Checkbox aria-label={`Select all trashed ${noun}s`} checked={all} onCheckedChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} />
              </th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">{noun === "lead" ? "Phone / email" : "Email"}</th>
              <th className="px-3 py-2 font-medium">Was in campaign</th>
              <th className="px-3 py-2 font-medium">Deleted</th>
              <th className="px-3 py-2 font-medium">Deleted by</th>
              <th className="px-3 py-2 font-medium">Deleted for good on</th>
              <th className="px-3 py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const label = r.full_name || r.company_name || r.detail || r.email || noun;
              return (
                <tr key={r.id} className="h-[38px] border-b border-line bg-surface last:border-0">
                  <td className={`${STICKY_FIRST} px-3 py-1.5`}>
                    <Checkbox
                      aria-label={`Select ${label}`}
                      checked={selected.has(r.id)}
                      onCheckedChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(r.id)) n.delete(r.id);
                          else n.add(r.id);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 font-medium text-ink">{r.full_name ?? EMPTY}</td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 text-muted">{r.company_name ?? EMPTY}</td>
                  <td className="tabular max-w-[220px] truncate px-3 py-1.5 text-muted">{r.detail ?? r.email ?? EMPTY}</td>
                  <td className="px-3 py-1.5 text-muted">{r.campaign_name ?? EMPTY}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted">{fmtDateTime(r.deleted_at, timezone)}</td>
                  <td className="px-3 py-1.5 text-xs text-muted">{r.deleted_by_name ?? EMPTY}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted">{fmtDate(r.expires_at, timezone)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => doRestore([r.id])} aria-label={`Restore ${label}`}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted">
                  No {noun}s in the trash.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <DeleteRecordsDialog
        open={purging !== null}
        onOpenChange={(o) => !o && setPurging(null)}
        count={purging?.length ?? 0}
        noun={noun}
        canPurge={canPurge}
        permanentOnly
        onPurge={(word) => purge(purging ?? [], word)}
        onDone={(r) => {
          toast.success(`Deleted ${r.count ?? 0} ${noun}${r.count === 1 ? "" : "s"} permanently.`);
          setSelected(new Set());
          setPurging(null);
          router.refresh();
        }}
      />
    </section>
  );
}

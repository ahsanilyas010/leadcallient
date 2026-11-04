"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { bulkEditLeads, type BulkEdit, type BulkResult } from "@/lib/actions/lead-admin";
import { LEAD_STAGE_OPTIONS } from "@/lib/leads/mapped-import-shared";

const inputCls = "h-9 w-full rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

// Bulk edit for the ticked leads: add or remove tags, put them on a list (or
// take them off one), set their stage. Fields left alone are not changed.
export function BulkEditDialog({
  open,
  onOpenChange,
  ids,
  lists,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  lists: string[];
  onDone: (r: BulkResult) => void;
}) {
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  const [listMode, setListMode] = useState<"keep" | "set" | "clear">("keep");
  const [list, setList] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nothing = !addTags.trim() && !removeTags.trim() && listMode === "keep" && !status;

  function save() {
    setError(null);
    const edit: BulkEdit = {
      ...(addTags.trim() ? { addTags } : {}),
      ...(removeTags.trim() ? { removeTags } : {}),
      ...(listMode === "set" ? { list } : listMode === "clear" ? { list: null } : {}),
      ...(status ? { status } : {}),
    };
    start(async () => {
      const r = await bulkEditLeads(ids, edit);
      if (r.error) {
        setError(r.error);
        return;
      }
      onDone(r);
      onOpenChange(false);
      setAddTags("");
      setRemoveTags("");
      setListMode("keep");
      setList("");
      setStatus("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit {ids.length.toLocaleString("en-GB")} lead{ids.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>Only what you fill in here changes. Everything else on the leads stays as it is.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="be-add" className="text-sm font-medium text-ink">
                Add tags
              </label>
              <input id="be-add" className={inputCls} value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="vip, follow-up" maxLength={500} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="be-remove" className="text-sm font-medium text-ink">
                Remove tags
              </label>
              <input id="be-remove" className={inputCls} value={removeTags} onChange={(e) => setRemoveTags(e.target.value)} placeholder="old-list" maxLength={500} />
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-muted">Separate tags with commas.</p>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium text-ink">List</legend>
            <div className="flex flex-wrap gap-3 text-sm text-ink">
              {(
                [
                  ["keep", "Leave as is"],
                  ["set", "Put on a list"],
                  ["clear", "Take off their list"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" name="be-list" checked={listMode === v} onChange={() => setListMode(v)} /> {l}
                </label>
              ))}
            </div>
            {listMode === "set" && (
              <>
                <input aria-label="List name" list="be-lists" className={inputCls} value={list} onChange={(e) => setList(e.target.value)} placeholder="March events" maxLength={80} />
                <datalist id="be-lists">
                  {lists.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </>
            )}
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor="be-status" className="text-sm font-medium text-ink">
              Stage
            </label>
            <select id="be-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Leave as is</option>
              {LEAD_STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || nothing || (listMode === "set" && !list.trim())}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

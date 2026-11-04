"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_TRASH_DAYS, PURGE_CONFIRM_WORD } from "@/lib/data-delete";
import type { DeleteResult } from "@/lib/actions/data-trash";

// Two-step delete for leads and contacts. Moving to the trash is the default
// and always available to people who can change data; deleting permanently is
// offered only to those allowed to (the super admin, and ops managers the
// super admin allows), and more than one record needs the confirmation word
// typed. The count is always stated.
export function DeleteRecordsDialog({
  open,
  onOpenChange,
  count,
  noun,
  canPurge,
  trashDays = DEFAULT_TRASH_DAYS,
  onTrash,
  onPurge,
  onDone,
  permanentOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  canPurge: boolean;
  trashDays?: number;
  onTrash?: () => Promise<DeleteResult>;
  onPurge: (confirm: string) => Promise<DeleteResult>;
  onDone: (r: DeleteResult, permanent: boolean) => void;
  // From the trash itself, the only choice left is permanent.
  permanentOnly?: boolean;
}) {
  const [permanent, setPermanent] = useState(permanentOnly);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const plural = `${count.toLocaleString("en-GB")} ${noun}${count === 1 ? "" : "s"}`;
  const needsWord = permanent && count > 1;
  const blocked = pending || count === 0 || (permanent && !canPurge) || (needsWord && typed.trim() !== PURGE_CONFIRM_WORD);

  function close(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setTyped("");
      setError(null);
      setPermanent(permanentOnly);
    }
  }

  function go() {
    setError(null);
    start(async () => {
      const r = permanent ? await onPurge(typed) : await (onTrash ?? (() => Promise.resolve({ error: "Not available." })))();
      if (r.error) {
        setError(r.error);
        return;
      }
      onDone(r, permanent);
      close(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {permanentOnly ? `Delete ${plural} permanently?` : `Delete ${plural}?`}
          </DialogTitle>
          <DialogDescription>
            {permanentOnly
              ? "They are removed for good, with their call history. This can't be undone."
              : `This affects ${plural}.`}
          </DialogDescription>
        </DialogHeader>

        {!permanentOnly && (
          <fieldset className="flex flex-col gap-2" aria-label="How to delete">
            <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm text-ink has-[:checked]:border-brand-blue has-[:checked]:bg-brand-blue-tint/40">
              <input type="radio" name="delete-kind" className="mt-1" checked={!permanent} onChange={() => setPermanent(false)} />
              <span>
                <span className="font-medium">Move to trash</span>
                <span className="block text-xs text-muted">
                  Taken off every campaign, call sheet and dial queue straight away. You can restore them from the trash for {trashDays} days;
                  after that they are deleted for good.
                </span>
              </span>
            </label>
            <label
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${canPurge ? "border-line text-ink has-[:checked]:border-danger has-[:checked]:bg-danger-tint/40" : "border-line text-muted opacity-70"}`}
            >
              <input type="radio" name="delete-kind" className="mt-1" checked={permanent} onChange={() => setPermanent(true)} disabled={!canPurge} />
              <span>
                <span className="font-medium">Delete permanently</span>
                <span className="block text-xs text-muted">
                  {canPurge
                    ? "Removed for good, including their calls and callbacks. This can't be undone."
                    : "Only the super admin (or an ops manager they allow) can delete permanently. Move to trash instead."}
                </span>
              </span>
            </label>
          </fieldset>
        )}

        {needsWord && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="purge-confirm" className="text-sm text-ink">
              Type <strong>{PURGE_CONFIRM_WORD}</strong> to permanently delete {plural}
            </label>
            <input
              id="purge-confirm"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-9 rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-danger"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant={permanent ? "danger" : "primary"} onClick={go} disabled={blocked} data-testid="confirm-delete">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {permanent ? `Delete ${plural} permanently` : `Move ${plural} to trash`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

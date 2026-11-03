"use client";

import Link from "next/link";
import { Lock, Sparkles, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Shown the moment an admin tries to add (or reactivate, or convert someone
// into) an agent while every seat is taken: a plain explanation that more
// agents mean purchasing seats, with the way to do it. Super admins get the
// billing link; anyone else is told who to ask. Unlimited workspaces never
// get here because seatsFull() is always false for them.
export function SeatLimitDialog({
  open,
  onOpenChange,
  seatLimit,
  isSuperAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatLimit: number;
  isSuperAdmin: boolean;
}) {
  const seats = `${seatLimit} agent seat${seatLimit === 1 ? "" : "s"}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-gold-text" /> All {seats} are in use
          </DialogTitle>
          <DialogDescription>
            Your plan includes {seats}, and every one of them is taken by an active agent. To add more agents you need to
            purchase additional seats.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-muted">
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-blue" />
            Only sales agents use a seat. Super admins, ops managers, team leads, lead gen, QA and client logins are free and
            can still be created.
          </li>
          <li className="flex items-start gap-2">
            <UserX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-blue" />
            Deactivating an agent who has left frees their seat straight away.
          </li>
        </ul>

        {!isSuperAdmin && (
          <p className="text-xs text-muted">
            Only a super admin can purchase seats. Ask yours to add more under <span className="font-medium text-ink">Agents &amp; billing</span>.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {isSuperAdmin ? "Not now" : "OK"}
          </Button>
          {isSuperAdmin && (
            <Button asChild variant="gold">
              <Link href="/admin/billing">
                <Sparkles className="h-4 w-4" /> Purchase seats
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

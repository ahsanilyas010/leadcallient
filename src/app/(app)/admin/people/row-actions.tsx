"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, KeyRound, UserX, UserCheck, Copy, Check, Megaphone, Pencil, Trash2 } from "lucide-react";
import { resetPassword, type ResetPasswordResult } from "@/lib/actions/users";
import { deactivateUser, reactivateUser } from "@/lib/actions/deactivate";
import { deleteUser } from "@/lib/actions/delete-user";
import { AssignToCampaignDialog } from "./assign-campaign-dialog";
import { EditUserDialog, type EditableUser } from "./edit-user-dialog";
import { SeatLimitDialog } from "./seat-limit-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const initialState: ResetPasswordResult = {};

export function PeopleRowActions({
  userId,
  userName,
  isActive,
  canDeactivate,
  campaigns,
  teams,
  seatsLeft,
  seatLimit,
  dataSeatsLeft = 0,
  dataSeatLimit = 0,
  isSuperAdmin,
  editable,
}: {
  userId: string;
  userName: string;
  isActive: boolean;
  // False for yourself and the workspace owner: the server refuses those too.
  // Delete shares the same rule.
  canDeactivate: boolean;
  campaigns: { id: string; name: string; code?: string | null }[];
  teams: { id: string; name: string }[];
  seatsLeft: number;
  seatLimit: number;
  dataSeatsLeft?: number;
  dataSeatLimit?: number;
  isSuperAdmin: boolean;
  editable: EditableUser;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [seatLimitOpen, setSeatLimitOpen] = useState(false);
  const [seatKind, setSeatKind] = useState<"agent" | "data">("agent");
  const [deleting, setDeleting] = useState(false);
  const [state, formAction] = useActionState(resetPassword, initialState);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`More actions for ${userName}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit user
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound className="mr-2 h-3.5 w-3.5" /> Reset password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
            <Megaphone className="mr-2 h-3.5 w-3.5" /> Assign to campaign
          </DropdownMenuItem>
          {isActive ? (
            canDeactivate && (
              <DropdownMenuItem
                variant="danger"
                onSelect={async () => {
                  if (!window.confirm(`Deactivate ${userName}? They will be signed out and unable to sign in until reactivated.`)) return;
                  const res = await deactivateUser(userId);
                  if (res.error) toast.error(res.error);
                  else toast.success(`${userName} deactivated.`);
                  router.refresh();
                }}
              >
                <UserX className="mr-2 h-3.5 w-3.5" /> Deactivate
              </DropdownMenuItem>
            )
          ) : (
            <DropdownMenuItem
              onSelect={async () => {
                const res = await reactivateUser(userId);
                if (res.seatLimit) {
                  setSeatKind(res.seatKind ?? "agent");
                  setSeatLimitOpen(true);
                  return;
                }
                if (res.error) toast.error(res.error);
                else toast.success(`${userName} reactivated.`);
                router.refresh();
              }}
            >
              <UserCheck className="mr-2 h-3.5 w-3.5" /> Reactivate
            </DropdownMenuItem>
          )}
          {canDeactivate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="danger" onSelect={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SeatLimitDialog
        open={seatLimitOpen}
        onOpenChange={setSeatLimitOpen}
        kind={seatKind}
        seatLimit={seatKind === "data" ? dataSeatLimit : seatLimit}
        isSuperAdmin={isSuperAdmin}
      />

      {editOpen && (
        <EditUserDialog
          user={editable}
          teams={teams}
          seatsLeft={seatsLeft}
          seatLimit={seatLimit}
          dataSeatsLeft={dataSeatsLeft}
          dataSeatLimit={dataSeatLimit}
          isSuperAdmin={isSuperAdmin}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={(next) => !deleting && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {userName}?</DialogTitle>
            <DialogDescription>
              This permanently removes their login and profile. It can&apos;t be undone. If they have made calls or have QA or meeting
              history the delete is refused: deactivate them instead so that history stays intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                const res = await deleteUser(userId);
                setDeleting(false);
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                toast.success(`${userName} deleted.`);
                setDeleteOpen(false);
                router.refresh();
              }}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignToCampaignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        userId={userId}
        userName={userName}
        campaigns={campaigns}
      />

      <Dialog
        open={resetOpen}
        onOpenChange={(next) => {
          if (!next && state.tempPassword && !confirmed) return;
          setResetOpen(next);
          if (!next) router.refresh();
        }}
      >
        <DialogContent>
          {!state.tempPassword ? (
            <form action={formAction}>
              <input type="hidden" name="user_id" value={userId} />
              <DialogHeader>
                <DialogTitle>Reset password</DialogTitle>
                <DialogDescription>
                  Issues a new one-time temporary password. Their old password stops working
                  immediately.
                </DialogDescription>
              </DialogHeader>
              {state.error && (
                <p className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger">
                  {state.error}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Reset</Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>New temporary password</DialogTitle>
                <DialogDescription>Shown once. No email is sent with it: give it to them yourself.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2.5">
                <code className="tabular flex-1 text-base font-medium tracking-wide">
                  {state.tempPassword}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(state.tempPassword!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4 text-brand-green-text" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <label className="mt-4 flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                  className="mt-0.5"
                />
                I have recorded this password and will hand it to them in person.
              </label>
              <DialogFooter>
                <Button
                  disabled={!confirmed}
                  onClick={() => {
                    setResetOpen(false);
                    router.refresh();
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

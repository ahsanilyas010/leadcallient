"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateUser, type UpdateUserResult } from "@/lib/actions/users";
import { BRAND } from "@/lib/brand";
import { isValidTimezone } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Req, RoleField, TeamField, TimezoneField } from "./user-fields";
import { SeatLimitDialog } from "./seat-limit-dialog";

const initialState: UpdateUserResult = {};

export interface EditableUser {
  id: string;
  full_name: string;
  role: string;
  team_id: string | null;
  agent_code: string | null;
  timezone: string;
  // You can't change your own role or the workspace owner's.
  roleLocked: boolean;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
    </Button>
  );
}

export function EditUserDialog({
  user,
  teams,
  seatsLeft,
  seatLimit,
  isSuperAdmin,
  open,
  onOpenChange,
}: {
  user: EditableUser;
  teams: { id: string; name: string }[];
  seatsLeft: number;
  seatLimit: number;
  isSuperAdmin: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [state, formAction] = useActionState(updateUser, initialState);
  const [role, setRole] = useState(user.role);
  const [timezone, setTimezone] = useState(user.timezone);
  const [teamList, setTeamList] = useState(teams);
  const [teamId, setTeamId] = useState(user.team_id ?? "");
  const [confirmAdmin, setConfirmAdmin] = useState(user.role === "super_admin");
  const [seatLimitOpen, setSeatLimitOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      toast.success(`${user.full_name} updated.`);
      onOpenChange(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // The server is the final word on seats (another admin may have filled the
  // last one meanwhile): its refusal opens the same popup.
  useEffect(() => {
    if (state.seatLimit) setSeatLimitOpen(true);
  }, [state]);

  const seatChange = role === "agent" && user.role !== "agent";
  const noSeat = seatChange && seatsLeft <= 0;
  const blocked = !isValidTimezone(timezone) || (role === "super_admin" && !confirmAdmin);
  const idp = `eu-${user.id.slice(0, 8)}-`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.full_name}</DialogTitle>
          <DialogDescription>Change their name, role, team or time zone. Their email and password are unchanged.</DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            if (!noSeat) return;
            e.preventDefault();
            setSeatLimitOpen(true);
          }}
        >
          <input type="hidden" name="user_id" value={user.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${idp}name`}>
                Full name
                <Req />
              </Label>
              <Input id={`${idp}name`} name="full_name" defaultValue={user.full_name} required aria-required="true" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${idp}code`}>Agent code</Label>
              <Input id={`${idp}code`} name="agent_code" mono defaultValue={user.agent_code ?? ""} placeholder={`e.g. ${BRAND.agentCodePlaceholder}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {user.roleLocked ? (
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <p className="rounded-md border border-line bg-canvas px-3 py-2 text-sm capitalize text-ink">{user.role.replace("_", " ")}</p>
                <input type="hidden" name="role" value={user.role} />
                <p className="text-xs text-muted">This role can&apos;t be changed here (it is your own, or the workspace owner&apos;s).</p>
              </div>
            ) : (
              <RoleField
                idPrefix={idp}
                value={role}
                onChange={setRole}
                seatsLeft={seatsLeft}
                confirmAdmin={confirmAdmin}
                onConfirmAdmin={setConfirmAdmin}
                canMakeSuperAdmin={isSuperAdmin}
                allowClient={false}
              />
            )}
            <TimezoneField idPrefix={idp} value={timezone} onChange={setTimezone} />
          </div>
          <TeamField idPrefix={idp} teams={teamList} onTeams={setTeamList} value={teamId} onChange={setTeamId} />
          {state.error && !state.seatLimit && (
            <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton disabled={blocked} />
          </DialogFooter>
        </form>
      </DialogContent>
      <SeatLimitDialog open={seatLimitOpen} onOpenChange={setSeatLimitOpen} seatLimit={seatLimit} isSuperAdmin={isSuperAdmin} />
    </Dialog>
  );
}

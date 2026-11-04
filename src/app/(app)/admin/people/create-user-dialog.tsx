"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Loader2, UserPlus, ShieldAlert } from "lucide-react";
import { createUser, type CreateUserResult } from "@/lib/actions/users";
import { BRAND } from "@/lib/brand";
import { isValidTimezone } from "@/lib/timezones";
import { Req, RoleField, TeamField, TimezoneField } from "./user-fields";
import { SeatLimitDialog } from "./seat-limit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const initialState: CreateUserResult = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
    </Button>
  );
}

type DialogProps = {
  teams: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  // Agent seats still free, emails already in this workspace, and whether the
  // signed-in admin may mint another super admin / open billing.
  seatsLeft: number;
  seatLimit: number;
  existingEmails: string[];
  isSuperAdmin: boolean;
  label?: string;
  hideTrigger?: boolean;
  openEvent?: string;
};

// Remounted after each successful create so the next one starts from a
// blank form (useActionState can't be reset in place).
export function CreateUserDialog(props: DialogProps) {
  const [round, setRound] = useState(0);
  const [reopen, setReopen] = useState(false);
  return (
    <CreateUserDialogRound
      key={round}
      {...props}
      startOpen={reopen}
      onFinished={(again) => {
        setReopen(again);
        setRound((r) => r + 1);
      }}
    />
  );
}

function CreateUserDialogRound({
  teams,
  clients,
  seatsLeft,
  seatLimit,
  existingEmails,
  isSuperAdmin,
  label = "Create user",
  hideTrigger = false,
  openEvent,
  startOpen,
  onFinished,
}: DialogProps & { onFinished: (again: boolean) => void; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [state, formAction] = useActionState(createUser, initialState);
  const [role, setRole] = useState("agent");
  const [timezone, setTimezone] = useState(() => {
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return guess && isValidTimezone(guess) ? guess : "Europe/London";
  });
  const [teamList, setTeamList] = useState(teams);
  const [teamId, setTeamId] = useState("");
  const [email, setEmail] = useState("");
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [clientId, setClientId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seatLimitOpen, setSeatLimitOpen] = useState(false);
  const router = useRouter();

  // The server is the final word on seats (another admin may have filled the
  // last one meanwhile): its refusal opens the same popup.
  useEffect(() => {
    if (state.seatLimit) setSeatLimitOpen(true);
  }, [state]);

  useEffect(() => {
    if (!openEvent) return;
    const onOpen = () => setOpen(true);
    window.addEventListener(openEvent, onOpen);
    return () => window.removeEventListener(openEvent, onOpen);
  }, [openEvent]);

  useEffect(() => {
    if (state.tempPassword) {
      setConfirmed(false);
      setCopied(false);
    }
  }, [state.tempPassword]);

  function handleClose(next: boolean, again = false) {
    if (!next && state.tempPassword && !confirmed) return; // can't dismiss without confirming
    setOpen(next);
    if (!next) {
      router.refresh();
      if (state.tempPassword) onFinished(again);
    }
  }

  const emailTaken = email.trim() !== "" && existingEmails.includes(email.trim().toLowerCase());
  const noSeat = role === "agent" && seatsLeft <= 0;
  const blocked = emailTaken || (role === "super_admin" && !confirmAdmin) || !isValidTimezone(timezone) || (role === "client" && !clientId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {!hideTrigger && (
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> {label}
        </Button>
      )}
      <DialogContent>
        <AnimatePresence mode="wait">
          {!state.tempPassword ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle>Create user</DialogTitle>
                <DialogDescription>
                  One login per human. The system generates the password.
                </DialogDescription>
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
                <p className="text-xs text-muted">
                  Fields marked <span aria-hidden>*</span> are required.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="full_name">
                      Full name
                      <Req />
                    </Label>
                    <Input id="full_name" name="full_name" required aria-required="true" autoComplete="off" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="agent_code">Agent code</Label>
                    <Input id="agent_code" name="agent_code" placeholder={`e.g. ${BRAND.agentCodePlaceholder}`} mono autoComplete="off" />
                    <p className="text-xs text-muted">{role === "agent" ? "Leave blank to generate the next one." : "Optional."}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">
                    Email
                    <Req />
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    aria-required="true"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) => setEmail(e.target.value.trim().toLowerCase())}
                    aria-invalid={emailTaken}
                    aria-describedby={emailTaken ? "email-taken" : undefined}
                  />
                  {emailTaken && (
                    <p id="email-taken" role="alert" className="text-xs text-danger">
                      Someone in this workspace already uses that email.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <RoleField
                    value={role}
                    onChange={setRole}
                    seatsLeft={seatsLeft}
                    confirmAdmin={confirmAdmin}
                    onConfirmAdmin={setConfirmAdmin}
                    canMakeSuperAdmin={isSuperAdmin}
                  />
                  <TimezoneField value={timezone} onChange={setTimezone} />
                </div>
                {role !== "client" && <TeamField teams={teamList} onTeams={setTeamList} value={teamId} onChange={setTeamId} />}
                {role === "client" && (
                  <div className="flex flex-col gap-1.5">
                    <Label id="client-label" htmlFor="client_id">
                      Client
                      <Req />
                    </Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger id="client_id" aria-labelledby="client-label" aria-required="true">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="client_id" value={clientId} />
                  </div>
                )}
                <AnimatePresence>
                  {state.error && !state.seatLimit && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger"
                    >
                      {state.error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <SubmitButton disabled={blocked} />
                </DialogFooter>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-warning" /> Temporary password
                </DialogTitle>
                <DialogDescription>
                  Shown once, for {state.fullName}. No email is sent with it: give them this password and the
                  address you sign in at. It cannot be retrieved again.
                </DialogDescription>
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
                I have recorded this password and will hand it to the agent in person.
              </label>

              <DialogFooter>
                <Button variant="secondary" disabled={!confirmed} onClick={() => handleClose(false, true)}>
                  Add another
                </Button>
                <Button disabled={!confirmed} onClick={() => handleClose(false)}>
                  Done
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
      <SeatLimitDialog open={seatLimitOpen} onOpenChange={setSeatLimitOpen} seatLimit={seatLimit} isSuperAdmin={isSuperAdmin} />
    </Dialog>
  );
}

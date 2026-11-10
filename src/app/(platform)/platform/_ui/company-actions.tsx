"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ownerAddLedgerEntry,
  ownerDeleteLedgerEntry,
  ownerSaveNotes,
  ownerSetBillingPlan,
  ownerSetSeats,
  ownerSetStatus,
  ownerSetTrial,
  ownerSetUserActive,
  type OwnerResult,
} from "@/lib/actions/owner";

const selectClass = "h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

function useOwnerAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<OwnerResult>, success: string, onDone?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(success);
        onDone?.();
        router.refresh();
      }
    });
  return { pending, run };
}

function Spin({ on }: { on: boolean }) {
  return on ? <Loader2 className="h-4 w-4 animate-spin" /> : null;
}

export function StatusActions({ workspaceId, status }: { workspaceId: string; status: string }) {
  const { pending, run } = useOwnerAction();
  const set = (s: "active" | "suspended" | "canceled", label: string) => {
    if (s !== "active" && !window.confirm(`${label} this company? Its users can still sign in but can't dial while suspended or canceled.`)) return;
    run(() => ownerSetStatus(workspaceId, s), `Company ${s === "active" ? "reactivated" : s}.`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && (
        <Button size="sm" variant="confirm" disabled={pending} onClick={() => set("active", "Reactivate")}>
          <Spin on={pending} /> Reactivate
        </Button>
      )}
      {status !== "suspended" && (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => set("suspended", "Suspend")}>
          Suspend
        </Button>
      )}
      {status !== "canceled" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("canceled", "Cancel")}>
          Mark canceled
        </Button>
      )}
    </div>
  );
}

export function TrialForm({ workspaceId, trialEndsAt }: { workspaceId: string; trialEndsAt: string | null }) {
  const { pending, run } = useOwnerAction();
  const [days, setDays] = useState("7");
  const [date, setDate] = useState(trialEndsAt ? trialEndsAt.slice(0, 10) : "");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="extend-days">Extend by (days)</Label>
          <Input id="extend-days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="w-28" />
        </div>
        <Button size="sm" disabled={pending} onClick={() => run(() => ownerSetTrial(workspaceId, { mode: "extend", days: Number(days) }), "Trial extended.")}>
          <Spin on={pending} /> Extend
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trial-date">Trial ends on</Label>
          <Input id="trial-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <Button size="sm" variant="secondary" disabled={pending || !date} onClick={() => run(() => ownerSetTrial(workspaceId, { mode: "set", date }), "Trial date set.")}>
          Set date
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => window.confirm("End the trial now?") && run(() => ownerSetTrial(workspaceId, { mode: "end" }), "Trial ended.")}
        >
          End trial now
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => window.confirm("Remove the trial entirely (no trial tracking for this company)?") && run(() => ownerSetTrial(workspaceId, { mode: "clear" }), "Trial removed.")}
        >
          Remove trial
        </Button>
      </div>
    </div>
  );
}

export function SeatsForm({ workspaceId, agentSeats, dataSeats }: { workspaceId: string; agentSeats: number; dataSeats: number }) {
  const { pending, run } = useOwnerAction();
  const [a, setA] = useState(String(agentSeats));
  const [d, setD] = useState(String(dataSeats));
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-seats">Agent seats</Label>
        <Input id="agent-seats" type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="data-seats">Data-only seats</Label>
        <Input id="data-seats" type="number" min={0} value={d} onChange={(e) => setD(e.target.value)} className="w-32" />
      </div>
      <Button size="sm" disabled={pending} onClick={() => run(() => ownerSetSeats(workspaceId, { agentSeats: Number(a), dataSeats: Number(d) }), "Seats updated.")}>
        <Spin on={pending} /> Save seats
      </Button>
      <p className="w-full text-xs text-muted">2147483647 means unlimited. Lowering seats never deactivates anyone; it only stops new agents being added.</p>
    </div>
  );
}

export function BillingPlanForm({
  workspaceId,
  amount,
  currency,
  cycle,
  nextDueDate,
}: {
  workspaceId: string;
  amount: number | null;
  currency: string;
  cycle: string;
  nextDueDate: string | null;
}) {
  const { pending, run } = useOwnerAction();
  const [v, setV] = useState({ amount: amount === null ? "" : String(amount), currency, cycle, nextDueDate: nextDueDate ?? "" });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="price">Price</Label>
        <Input id="price" type="number" min={0} step="0.01" value={v.amount} placeholder="e.g. 150" onChange={(e) => setV({ ...v, amount: e.target.value })} className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" value={v.currency} maxLength={3} onChange={(e) => setV({ ...v, currency: e.target.value.toUpperCase() })} className="w-20 uppercase" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cycle">Every</Label>
        <select id="cycle" className={selectClass} value={v.cycle} onChange={(e) => setV({ ...v, cycle: e.target.value })}>
          <option value="monthly">Month</option>
          <option value="quarterly">Quarter</option>
          <option value="yearly">Year</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="due">Next due date</Label>
        <Input id="due" type="date" value={v.nextDueDate} onChange={(e) => setV({ ...v, nextDueDate: e.target.value })} className="w-44" />
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          run(
            () => ownerSetBillingPlan(workspaceId, { amount: v.amount, currency: v.currency, cycle: v.cycle as "monthly", nextDueDate: v.nextDueDate }),
            "Billing plan saved.",
          )
        }
      >
        <Spin on={pending} /> Save plan
      </Button>
    </div>
  );
}

export function LedgerForm({ workspaceId, currency, defaultAmount }: { workspaceId: string; currency: string; defaultAmount: number | null }) {
  const { pending, run } = useOwnerAction();
  const today = new Date().toISOString().slice(0, 10);
  const blank = { kind: "payment", amount: defaultAmount ? String(defaultAmount) : "", occurredOn: today, method: "bank_transfer", reference: "", note: "", advanceDue: true };
  const [v, setV] = useState(blank);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kind">Type</Label>
        <select id="kind" className={selectClass} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
          <option value="payment">Payment received</option>
          <option value="charge">Charge (invoice)</option>
          <option value="credit">Credit / discount</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Amount ({currency})</Label>
        <Input id="amount" type="number" min={0} step="0.01" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="on">Date</Label>
        <Input id="on" type="date" value={v.occurredOn} onChange={(e) => setV({ ...v, occurredOn: e.target.value })} className="w-40" />
      </div>
      {v.kind === "payment" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="method">Method</Label>
          <select id="method" className={selectClass} value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ref">Reference</Label>
        <Input id="ref" value={v.reference} placeholder="Invoice / transfer ref" onChange={(e) => setV({ ...v, reference: e.target.value })} className="w-44" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Note</Label>
        <Input id="note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className="w-48" />
      </div>
      {v.kind === "payment" && (
        <label className="flex h-9 items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={v.advanceDue} onChange={(e) => setV({ ...v, advanceDue: e.target.checked })} />
          Move next due date forward one cycle
        </label>
      )}
      <Button
        size="sm"
        disabled={pending || !v.amount}
        onClick={() =>
          run(
            () =>
              ownerAddLedgerEntry(workspaceId, {
                kind: v.kind as "payment",
                amount: v.amount,
                currency,
                occurredOn: v.occurredOn,
                method: v.method as "bank_transfer",
                reference: v.reference,
                note: v.note,
                advanceDue: v.advanceDue,
              }),
            "Saved to the ledger.",
            () => setV(blank),
          )
        }
      >
        <Spin on={pending} /> Add
      </Button>
    </div>
  );
}

export function DeleteLedgerButton({ entryId }: { entryId: string }) {
  const { pending, run } = useOwnerAction();
  return (
    <button
      type="button"
      aria-label="Delete entry"
      disabled={pending}
      className="text-muted hover:text-danger disabled:opacity-50"
      onClick={() => window.confirm("Delete this ledger entry?") && run(() => ownerDeleteLedgerEntry(entryId), "Entry deleted.")}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

export function NotesForm({ workspaceId, notes }: { workspaceId: string; notes: string }) {
  const { pending, run } = useOwnerAction();
  const [v, setV] = useState(notes);
  return (
    <div className="flex flex-col gap-2">
      <Textarea value={v} onChange={(e) => setV(e.target.value)} rows={10} placeholder="Private notes about this customer: contacts, deals, promises, follow-ups. Only owners see these." />
      <div>
        <Button size="sm" disabled={pending || v === notes} onClick={() => run(() => ownerSaveNotes(workspaceId, v), "Notes saved.")}>
          <Spin on={pending} /> Save notes
        </Button>
      </div>
    </div>
  );
}

export function UserActiveButton({ userId, isActive, email }: { userId: string; isActive: boolean; email: string }) {
  const { pending, run } = useOwnerAction();
  return (
    <button
      type="button"
      disabled={pending}
      className={`text-xs font-semibold hover:underline disabled:opacity-50 ${isActive ? "text-danger" : "text-brand-green-text"}`}
      onClick={() => {
        if (isActive && !window.confirm(`Deactivate ${email}? They will be signed out and can't sign back in.`)) return;
        run(() => ownerSetUserActive(userId, !isActive), isActive ? "User deactivated." : "User reactivated.");
      }}
    >
      {pending ? "Working…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}

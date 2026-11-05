"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PencilLine, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BulkResult } from "@/lib/actions/lead-admin";

const selectCls = "h-8 rounded-md border border-line bg-white px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

export interface BulkAgent {
  id: string;
  name: string;
  role: string;
}

// The toolbar above a selectable table: assign / unassign the ticked rows,
// and (for leads) screen them or move them to a campaign. Each action reports
// what happened and refreshes the page.
export function BulkBar({
  count,
  agents,
  campaigns,
  onAssign,
  onScreen,
  onMove,
  onClear,
  onDelete,
  onEdit,
  noun,
}: {
  count: number;
  agents: BulkAgent[];
  campaigns?: { id: string; name: string }[];
  onAssign: (userId: string | null) => Promise<BulkResult>;
  onScreen?: () => Promise<BulkResult>;
  onMove?: (campaignId: string) => Promise<BulkResult>;
  onClear: () => void;
  // Open the delete dialog / bulk edit dialog for the ticked rows.
  onDelete?: () => void;
  onEdit?: () => void;
  noun: string;
}) {
  const [pending, startTransition] = useTransition();
  const [agent, setAgent] = useState("");
  const [campaign, setCampaign] = useState("");
  const router = useRouter();

  function run(label: string, fn: () => Promise<BulkResult>) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const extra = r.rostered ? ` The agent was also put on ${r.rostered} campaign roster${r.rostered === 1 ? "" : "s"}.` : "";
      toast.success(`${label}: ${r.count ?? 0} ${noun}${r.count === 1 ? "" : "s"}.${extra}`);
      onClear();
      router.refresh();
    });
  }

  const disabled = pending || count === 0;
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink"
      data-testid="bulk-bar"
      aria-live="polite"
    >
      <span className="font-medium">
        {count === 0 ? `Tick ${noun}s to act on them` : `${count} ${noun}${count === 1 ? "" : "s"} selected`}
      </span>
      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
      <select aria-label="Assign to" value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls} disabled={disabled}>
        <option value="">Choose an agent...</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.role !== "agent" ? ` (${a.role.replace(/_/g, " ")})` : ""}
          </option>
        ))}
      </select>
      <Button size="sm" disabled={disabled || !agent} onClick={() => run("Assigned", () => onAssign(agent))} data-testid="bulk-assign">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Assign
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => run("Unassigned", () => onAssign(null))}>
        Unassign
      </Button>
      {onScreen && (
        <>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => run("Passed screening", onScreen)} data-testid="bulk-screen">
            <ShieldCheck className="h-3.5 w-3.5" /> Screen
          </Button>
        </>
      )}
      {onMove && campaigns && campaigns.length > 0 && (
        <>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          <select aria-label="Move to campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} className={selectCls} disabled={disabled}>
            <option value="">Move to campaign...</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" disabled={disabled || !campaign} onClick={() => run("Moved", () => onMove(campaign))}>
            Move
          </Button>
        </>
      )}
      {onEdit && (
        <>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          <Button size="sm" variant="secondary" disabled={disabled} onClick={onEdit} data-testid="bulk-edit">
            <PencilLine className="h-3.5 w-3.5" /> Edit tags, list or stage
          </Button>
        </>
      )}
      {onDelete && (
        <>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          <Button size="sm" variant="secondary" className="text-danger" disabled={disabled} onClick={onDelete} data-testid="bulk-delete">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </>
      )}
      {count > 0 && (
        <button type="button" onClick={onClear} className="ml-auto text-brand-blue hover:underline" disabled={pending}>
          Clear selection
        </button>
      )}
    </div>
  );
}

// Keys of every non-empty custom field across the rows, in first-seen order,
// so the table can show one column per piece of extra information.
export function customKeys(rows: { custom: unknown }[], max = 30): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const c = r.custom;
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
      if (v === null || v === undefined || v === "" || seen.has(k)) continue;
      seen.add(k);
      keys.push(k);
      if (keys.length >= max) return keys;
    }
  }
  return keys;
}

export function customValue(custom: unknown, key: string): string {
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return "";
  const v = (custom as Record<string, unknown>)[key];
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

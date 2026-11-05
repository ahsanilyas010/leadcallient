"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableWrap } from "@/components/ui/data-table";
import { mergeLeads } from "@/lib/actions/lead-admin";
import { EMPTY, fmtDate } from "@/lib/format";

export interface DupLead {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone_e164: string | null;
  email: string | null;
  campaign_id: string | null;
  assigned_to: string | null;
  status: string;
  attempts: number;
  tags: string[];
  created_at: string;
}

// The lead most worth keeping: the one with the most filled-in details, then
// the most call attempts, then the oldest.
function bestOf(leads: DupLead[]): string {
  const score = (l: DupLead) =>
    [l.full_name, l.company_name, l.phone_e164, l.email, l.campaign_id, l.assigned_to].filter(Boolean).length * 10 + Math.min(l.attempts, 9);
  return [...leads].sort((a, b) => score(b) - score(a) || a.created_at.localeCompare(b.created_at))[0]?.id ?? "";
}

export function DuplicateGroups({
  groups,
  leads,
  campaignName,
  personName,
  timezone,
}: {
  groups: { matchOn: "phone" | "email"; value: string; ids: string[] }[];
  leads: DupLead[];
  campaignName: Record<string, string>;
  personName: Record<string, string>;
  timezone: string | null;
}) {
  const byId = new Map(leads.map((l) => [l.id, l]));
  if (groups.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted shadow-sm">No duplicates: every lead has its own phone number and email.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        {groups.length.toLocaleString("en-GB")} group{groups.length === 1 ? "" : "s"} found{groups.length >= 200 ? " (the first 200; merge these to see more)" : ""}.
      </p>
      {groups.map((g) => (
        <Group
          key={`${g.matchOn}:${g.value}`}
          group={g}
          leads={g.ids.map((id) => byId.get(id)).filter((l): l is DupLead => Boolean(l))}
          campaignName={campaignName}
          personName={personName}
          timezone={timezone}
        />
      ))}
    </div>
  );
}

function Group({
  group,
  leads,
  campaignName,
  personName,
  timezone,
}: {
  group: { matchOn: "phone" | "email"; value: string };
  leads: DupLead[];
  campaignName: Record<string, string>;
  personName: Record<string, string>;
  timezone: string | null;
}) {
  const router = useRouter();
  const [keep, setKeep] = useState(() => bestOf(leads));
  const [pending, start] = useTransition();
  const name = `dup-${group.matchOn}-${group.value}`;

  function merge() {
    const others = leads.filter((l) => l.id !== keep).map((l) => l.id);
    if (!window.confirm(`Merge ${others.length} lead${others.length === 1 ? "" : "s"} into the one you chose? The others go to the trash.`)) return;
    start(async () => {
      const r = await mergeLeads(keep, others);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Merged ${r.count ?? 0} lead${r.count === 1 ? "" : "s"}.`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-white shadow-sm" data-testid="dup-group">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold text-ink">
          Same {group.matchOn === "phone" ? "phone number" : "email"}: <span className="tabular">{group.value}</span>
        </span>
        <span className="text-xs text-muted">{leads.length} leads</span>
        <Button size="sm" className="ml-auto" onClick={merge} disabled={pending || !keep || leads.length < 2}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />} Merge into the one kept
        </Button>
      </div>
      <TableWrap label={`Duplicates: ${group.value}`}>
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
              <th className="w-16 px-3 py-2 font-medium">Keep</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Attempts</th>
              <th className="px-3 py-2 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className={`border-b border-line last:border-0 ${keep === l.id ? "bg-brand-blue-tint/40" : ""}`}>
                <td className="px-3 py-1.5">
                  <input type="radio" name={name} checked={keep === l.id} onChange={() => setKeep(l.id)} aria-label={`Keep ${l.full_name ?? l.phone_e164 ?? "this lead"}`} />
                </td>
                <td className="max-w-[200px] truncate px-3 py-1.5 font-medium text-ink">{l.full_name ?? EMPTY}</td>
                <td className="max-w-[200px] truncate px-3 py-1.5 text-muted">{l.company_name ?? EMPTY}</td>
                <td className="tabular px-3 py-1.5 text-muted">{l.phone_e164 ?? EMPTY}</td>
                <td className="max-w-[220px] truncate px-3 py-1.5 text-muted">{l.email ?? EMPTY}</td>
                <td className="px-3 py-1.5 text-muted">{l.campaign_id ? (campaignName[l.campaign_id] ?? EMPTY) : EMPTY}</td>
                <td className="px-3 py-1.5 text-muted">{l.assigned_to ? (personName[l.assigned_to] ?? EMPTY) : EMPTY}</td>
                <td className="tabular px-3 py-1.5 text-muted">{l.attempts}</td>
                <td className="px-3 py-1.5 text-xs text-muted">{fmtDate(l.created_at, timezone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </section>
  );
}

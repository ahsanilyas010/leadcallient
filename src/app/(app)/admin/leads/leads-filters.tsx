"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const selectCls = "h-9 rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

export interface Filters {
  batch: string;
  campaign: string;
  agent: string;
  screening: string;
  kind: string;
  q: string;
  tag: string;
  list: string;
}

// Filters live in the URL so a view can be shared (e.g. the link from an
// upload's Done step opens this page on that batch).
export function LeadsFilters({
  filters,
  campaigns,
  batches,
  agents,
  leadTotal,
  contactTotal,
  tags,
  lists,
}: {
  filters: Filters;
  campaigns: { id: string; name: string }[];
  batches: { id: string; name: string; rows: number }[];
  agents: { id: string; name: string; role: string }[];
  leadTotal: number;
  contactTotal: number;
  tags: string[];
  lists: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);

  function go(patch: Partial<Filters>) {
    const next = { ...filters, q, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "kind" && v === "lead")) sp.set(k, v);
    router.push(`/admin/leads${sp.toString() ? `?${sp}` : ""}`);
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => go({ kind: "lead", screening: filters.screening })}
          className={`rounded-full border px-3 py-1 font-medium ${filters.kind !== "contact" ? "border-brand-blue bg-brand-blue-tint text-brand-blue" : "border-line bg-white text-ink"}`}
        >
          Leads with a number · {leadTotal}
        </button>
        <button
          type="button"
          onClick={() => go({ kind: "contact", screening: "", batch: "" })}
          className={`rounded-full border px-3 py-1 font-medium ${filters.kind === "contact" ? "border-brand-blue bg-brand-blue-tint text-brand-blue" : "border-line bg-white text-ink"}`}
        >
          Contacts without a number · {contactTotal}
        </button>
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({});
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company, email, phone"
          aria-label="Search"
          className={`${selectCls} w-56`}
        />
        {filters.kind !== "contact" && (
          <select aria-label="Upload batch" value={filters.batch} onChange={(e) => go({ batch: e.target.value })} className={selectCls}>
            <option value="">All uploads</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.rows})
              </option>
            ))}
          </select>
        )}
        <select aria-label="Campaign" value={filters.campaign} onChange={(e) => go({ campaign: e.target.value })} className={selectCls}>
          <option value="">All campaigns</option>
          <option value="none">No campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Assigned to" value={filters.agent} onChange={(e) => go({ agent: e.target.value })} className={selectCls}>
          <option value="">Anyone / unassigned</option>
          <option value="unassigned">Unassigned only</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {filters.kind !== "contact" && (
          <select aria-label="Screening" value={filters.screening} onChange={(e) => go({ screening: e.target.value })} className={selectCls}>
            <option value="">Any screening state</option>
            <option value="pending">Pending screening</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="expired">Expired</option>
          </select>
        )}
        {filters.kind !== "contact" && (tags.length > 0 || filters.tag) && (
          <select aria-label="Tag" value={filters.tag} onChange={(e) => go({ tag: e.target.value })} className={selectCls}>
            <option value="">Any tag</option>
            {[...new Set([...(filters.tag ? [filters.tag] : []), ...tags])].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {filters.kind !== "contact" && (lists.length > 0 || filters.list) && (
          <select aria-label="List" value={filters.list} onChange={(e) => go({ list: e.target.value })} className={selectCls}>
            <option value="">Any list</option>
            {[...new Set([...(filters.list ? [filters.list] : []), ...lists])].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="h-9 rounded-md border border-line bg-white px-3 text-sm text-ink shadow-sm hover:bg-canvas">
          Apply
        </button>
        {(filters.batch || filters.campaign || filters.agent || filters.screening || filters.q || filters.tag || filters.list) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              go({ batch: "", campaign: "", agent: "", screening: "", q: "", tag: "", list: "" });
            }}
            className="text-xs text-brand-blue hover:underline"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}

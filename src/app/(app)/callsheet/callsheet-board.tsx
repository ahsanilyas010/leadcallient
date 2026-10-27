"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { claimLeadForCall, loadCallSheet } from "@/lib/actions/callsheet";
import { startCall } from "@/lib/actions/zoom-calls";
import { usePhone } from "@/components/zoom-phone/zoom-phone-provider";
import type { RealTables } from "@/lib/supabase/real-types";
import {
  BUCKET_HEADING,
  bucketOf,
  buildColumns,
  fmtHeaderDate,
  matchesFilters,
  type Filters,
  type SheetItem,
} from "@/lib/callsheet/derive";
import { LeadCard } from "./lead-card";
import "./call-sheet.css";

type Disposition = RealTables<"dispositions">;
type Chip = "overdue" | "upcoming" | "callbacks" | "never";

const CHIPS: { id: Chip; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "callbacks", label: "Callbacks" },
  { id: "never", label: "Never contacted" },
];

// Cards drawn per column before "Show more": keeps a few hundred leads quick.
const PAGE = 20;

export function CallSheetBoard({
  initialItems,
  total,
  dispositions,
  timezone,
  emailTemplates,
}: {
  initialItems: SheetItem[];
  total: number;
  dispositions: Disposition[];
  timezone: string;
  emailTemplates: { id: string; name: string }[];
}) {
  const [items, setItems] = useState(initialItems);
  const [now, setNow] = useState(() => Date.now());
  const [q, setQ] = useState("");
  const [campaign, setCampaign] = useState("");
  const [chips, setChips] = useState<Set<Chip>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialBusy, setDialBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { activeCall, status, makeCall, clearCall } = usePhone();

  // A router.refresh() (status change, promote, edit dialog) hands us fresh rows.
  useEffect(() => {
    setItems(initialItems);
    setNow(Date.now());
  }, [initialItems]);

  const reload = useCallback(async () => {
    const res = await loadCallSheet();
    if (res.error) {
      setError(res.error);
      return;
    }
    setItems(res.items);
    setNow(Date.now());
  }, []);

  const patch = useCallback((id: string, p: Partial<SheetItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const campaigns = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) m.set(i.campaign_id ?? "none", i.campaign_name ?? "No campaign");
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filters: Filters = useMemo(() => ({ q, campaign, chips }), [q, campaign, chips]);
  const visible = useMemo(() => items.filter((i) => matchesFilters(i, filters, now)), [items, filters, now]);
  const columns = useMemo(() => buildColumns(visible, now), [visible, now]);

  const counts = useMemo(() => {
    let overdue = 0;
    let upcoming = 0;
    for (const i of items) {
      const b = bucketOf(i, now);
      if (b === "overdue") overdue++;
      else if (b === "upcoming") upcoming++;
    }
    return { overdue, upcoming };
  }, [items, now]);

  const callLive = activeCall !== null && activeCall.state !== "ended";

  async function dial(item: SheetItem) {
    setError(null);
    setDialBusy(item.id);
    try {
      // Same gate as the dial queue: claim re-checks screening, suppression,
      // roster, cooling-off and calling hours before a number is released.
      const claim = await claimLeadForCall(item.id);
      if (claim.error) {
        setError(claim.error);
        void reload();
        return;
      }
      const res = await startCall(item.id);
      if (res.error || !res.callId || !res.number) {
        setError(res.error ?? "Could not start the call.");
        return;
      }
      clearCall();
      makeCall(res.number, res.callId, res.callerId ?? null);
      setActiveId(item.id);
    } finally {
      setDialBusy(null);
    }
  }

  function toggleChip(c: Chip) {
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  const filtering = q.trim() !== "" || campaign !== "" || chips.size > 0;
  let counter = 0;

  return (
    <div className="callsheet">
      <div className="cs-wrap">
        <div className="cs-head">
          <div>
            <h1>Call sheet</h1>
            <p className="cs-sub">
              {fmtHeaderDate(now, timezone)} · {items.length} item{items.length === 1 ? "" : "s"} · press a green bar to dial through Zoom
            </p>
          </div>
          <div className="cs-summary">
            {counts.overdue > 0 && <span className="tag od">{counts.overdue} overdue</span>}
            {counts.upcoming > 0 && <span className="tag up">{counts.upcoming} upcoming</span>}
            {campaigns.map(([id, name]) => (
              <span key={id} className="tag">
                {name} {items.filter((i) => (i.campaign_id ?? "none") === id).length}
              </span>
            ))}
          </div>
        </div>

        {total > items.length && (
          <p className="cs-msg err" role="status">
            Showing the {items.length} most urgent of {total} items. Use search or the filters to find the rest, or finish some of these first.
          </p>
        )}
        {error && (
          <p className="cs-msg err" role="alert">
            {error}
          </p>
        )}
        {status === "sign-in" && (
          <p className="cs-msg err" role="status">
            Sign in to Zoom in the Zoom Phone panel before dialing. Open the panel from the bar at the bottom right.
          </p>
        )}
        {status === "unavailable" && (
          <p className="cs-msg err" role="status">
            The Zoom Phone panel is unavailable, so calls cannot start yet. Open Integrations &gt; Zoom for the setup checklist.
          </p>
        )}

        <div className="cs-filters" role="search">
          <label className="sr-only-cs" htmlFor="cs-q">
            Search the call sheet
          </label>
          <input id="cs-q" className="cs-input" type="search" placeholder="Search name, company, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
          {campaigns.length > 1 && (
            <>
              <label className="sr-only-cs" htmlFor="cs-campaign">
                Campaign
              </label>
              <select id="cs-campaign" className="cs-select" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
                <option value="">All campaigns</option>
                {campaigns.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          )}
          {CHIPS.map((c) => (
            <button key={c.id} type="button" className="cs-chip" aria-pressed={chips.has(c.id)} onClick={() => toggleChip(c.id)}>
              {c.label}
            </button>
          ))}
          {filtering && (
            <button
              type="button"
              className="cs-clear"
              onClick={() => {
                setQ("");
                setCampaign("");
                setChips(new Set());
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="cs-empty">
            <strong>Nothing on your call sheet yet</strong>
            Leads appear here once they are assigned to you or sit on a campaign you are on. Ask your manager to upload a list and assign it to you.
          </div>
        ) : visible.length === 0 ? (
          <div className="cs-empty">
            <strong>No matches</strong>
            Nothing on the sheet matches those filters.
          </div>
        ) : (
          <div className="cs-grid">
            {columns.map((col) => {
              const limitHere = shown[col.id] ?? PAGE;
              let drawn = 0;
              return (
                <section key={col.id} className="col" aria-label={col.name}>
                  <div className="colhead">
                    <h2>{col.name}</h2>
                    <span>
                      {col.total}
                      {col.due > 0 ? ` · ${col.due} due` : ""}
                    </span>
                  </div>
                  {col.groups.map((g) => {
                    const room = limitHere - drawn;
                    if (room <= 0) return null;
                    const slice = g.items.slice(0, room);
                    drawn += slice.length;
                    return (
                      <div key={g.bucket} className="col" style={{ gap: 12 }}>
                        <div className="sub">
                          {BUCKET_HEADING[g.bucket]} · {g.items.length}
                        </div>
                        {slice.map((it) => {
                          counter += 1;
                          return (
                            <LeadCard
                              key={it.id}
                              item={it}
                              n={counter}
                              bucket={g.bucket}
                              tz={timezone}
                              now={now}
                              dispositions={dispositions}
                              emailTemplates={emailTemplates}
                              activeCall={activeCall}
                              isActive={activeId === it.id}
                              dialBusy={dialBusy === it.id}
                              anyCallLive={callLive || dialBusy !== null || status === "on-call"}
                              onDial={dial}
                              onPatch={patch}
                              onOutcomeSaved={(id) => {
                                if (activeId === id) {
                                  setActiveId(null);
                                  clearCall();
                                }
                                void reload();
                              }}
                              onCloseOutcome={() => setActiveId(null)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                  {col.total > limitHere && (
                    <button type="button" className="more-col" onClick={() => setShown((s) => ({ ...s, [col.id]: limitHere + PAGE }))}>
                      Show more ({col.total - limitHere} left)
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

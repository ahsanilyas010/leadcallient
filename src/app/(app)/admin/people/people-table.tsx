"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search, Video } from "lucide-react";
import { checkZoomUsers, type ZoomUserState } from "@/lib/actions/zoom-users";
import { ROLE_INFO, ROLE_LABEL } from "@/lib/roles";
import { EMPTY, fmtDateTime, plural } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STICKY_FIRST, STICKY_LAST, TableWrap } from "@/components/ui/data-table";
import { PeopleRowActions } from "./row-actions";

export interface PersonRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team_id: string | null;
  agent_code: string | null;
  is_active: boolean;
  must_change_password: boolean;
  timezone: string;
  created_at: string;
  last_sign_in: string | null | undefined;
  isSelf: boolean;
  isOwner: boolean;
}

const selectCls =
  "h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brand-blue";

const ZOOM_BADGE: Record<ZoomUserState, { label: string; variant: "confirm" | "danger" | "warning" }> = {
  found: { label: "Zoom user found", variant: "confirm" },
  missing: { label: "No Zoom user", variant: "danger" },
  inactive: { label: "Zoom user inactive", variant: "warning" },
};

export function PeopleTable({
  rows,
  teams,
  campaigns,
  canManage,
  seatsLeft,
  seatLimit,
  dataSeatsLeft = 0,
  dataSeatLimit = 0,
  isSuperAdmin,
  viewerTimezone,
  zoomConnected,
}: {
  rows: PersonRow[];
  teams: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  canManage: boolean;
  seatsLeft: number;
  seatLimit: number;
  dataSeatsLeft?: number;
  dataSeatLimit?: number;
  isSuperAdmin: boolean;
  viewerTimezone: string;
  zoomConnected: boolean;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [team, setTeam] = useState("");
  const [status, setStatus] = useState("");
  const [zoom, setZoom] = useState<Record<string, ZoomUserState> | null>(null);
  const [checking, startCheck] = useTransition();
  const [now] = useState(() => Date.now());

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (needle && !`${p.full_name} ${p.email} ${p.agent_code ?? ""}`.toLowerCase().includes(needle)) return false;
      if (role && p.role !== role) return false;
      if (team === "none" ? p.team_id !== null : team && p.team_id !== team) return false;
      if (status === "active" && !p.is_active) return false;
      if (status === "inactive" && p.is_active) return false;
      return true;
    });
  }, [rows, q, role, team, status]);
  const filtering = q.trim() !== "" || role !== "" || team !== "" || status !== "";

  function runZoomCheck() {
    startCheck(async () => {
      const res = await checkZoomUsers();
      if (res.error) toast.error(res.error);
      else {
        setZoom(res.users ?? {});
        toast.success("Checked against your Zoom account.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2" role="search">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <label htmlFor="people-q" className="sr-only">
            Search people
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
          <input
            id="people-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email or code"
            className={`${selectCls} w-full pl-8`}
          />
        </div>
        <label className="sr-only" htmlFor="people-role">
          Role
        </label>
        <select id="people-role" value={role} onChange={(e) => setRole(e.target.value)} className={selectCls}>
          <option value="">All roles</option>
          {ROLE_INFO.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="people-team">
          Team
        </label>
        <select id="people-team" value={team} onChange={(e) => setTeam(e.target.value)} className={selectCls}>
          <option value="">All teams</option>
          <option value="none">No team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="people-status">
          Status
        </label>
        <select id="people-status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </select>
        {filtering && (
          <button
            type="button"
            className="h-9 px-1 text-sm font-medium text-brand-blue underline"
            onClick={() => {
              setQ("");
              setRole("");
              setTeam("");
              setStatus("");
            }}
          >
            Clear filters
          </button>
        )}
        {canManage && zoomConnected && (
          <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={runZoomCheck} disabled={checking}>
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />} Check Zoom users
          </Button>
        )}
      </div>
      <p className="text-xs text-muted" role="status">
        {filtering ? `${filtered.length} of ${plural(rows.length, "person", "people")}` : plural(rows.length, "person", "people")}
      </p>

      <TableWrap label="People">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
              <th className={`px-3 py-2 font-medium bg-canvas ${STICKY_FIRST}`}>Name</th>
              <th className="px-3 py-2 font-medium">Login</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Agent code</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {zoom && <th className="px-3 py-2 font-medium">Zoom</th>}
              <th className="px-3 py-2 font-medium">Last sign-in</th>
              {canManage && (
                <th className={`px-3 py-2 text-right font-medium bg-canvas ${STICKY_LAST}`}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isNew = now - Date.parse(p.created_at) < 5 * 60_000;
              const z = zoom?.[p.id];
              return (
                <tr key={p.id} className={`h-[38px] border-b border-line last:border-0 ${isNew ? "bg-brand-blue-tint" : "bg-surface"} hover:bg-canvas`}>
                  <td className={`px-3 py-1.5 ${STICKY_FIRST}`}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {p.full_name
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-ink">{p.full_name}</span>
                      {isNew && <Badge variant="blue">New</Badge>}
                      {p.must_change_password && <Badge variant="warning">Must set password</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs text-muted">{p.email}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant="blue">{ROLE_LABEL[p.role] ?? p.role}</Badge>
                  </td>
                  <td className="px-3 py-1.5 text-muted">{(p.team_id && teamName.get(p.team_id)) || EMPTY}</td>
                  <td className="px-3 py-1.5 tabular text-muted">{p.agent_code ?? EMPTY}</td>
                  <td className="px-3 py-1.5">
                    {p.is_active ? <Badge variant="confirm">Active</Badge> : <Badge variant="danger">Deactivated</Badge>}
                  </td>
                  {zoom && (
                    <td className="px-3 py-1.5">
                      {z ? <Badge variant={ZOOM_BADGE[z].variant}>{ZOOM_BADGE[z].label}</Badge> : <span className="text-muted">{EMPTY}</span>}
                    </td>
                  )}
                  <td className="px-3 py-1.5 tabular text-xs text-muted">
                    {p.last_sign_in === undefined ? EMPTY : p.last_sign_in ? fmtDateTime(p.last_sign_in, viewerTimezone) : "Never"}
                  </td>
                  {canManage && (
                    <td className={`px-3 py-1.5 text-right ${STICKY_LAST}`}>
                      <PeopleRowActions
                        userId={p.id}
                        userName={p.full_name}
                        isActive={p.is_active}
                        canDeactivate={!p.isSelf && !p.isOwner}
                        campaigns={p.role === "agent" ? campaigns : []}
                        teams={teams}
                        seatsLeft={seatsLeft}
                        seatLimit={seatLimit}
                        dataSeatsLeft={dataSeatsLeft}
                        dataSeatLimit={dataSeatLimit}
                        isSuperAdmin={isSuperAdmin}
                        editable={{
                          id: p.id,
                          full_name: p.full_name,
                          role: p.role,
                          team_id: p.team_id,
                          agent_code: p.agent_code,
                          timezone: p.timezone,
                          roleLocked: p.isSelf || p.isOwner,
                        }}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-3 py-8 text-center text-sm text-muted">
                  {filtering ? "No one matches those filters." : "No one here yet. Create the first account above."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

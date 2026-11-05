"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { createTeam } from "@/lib/actions/users";
import { ROLE_INFO } from "@/lib/roles";
import { allTimezones } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Req() {
  return (
    <span aria-hidden className="ml-0.5 text-danger">
      *
    </span>
  );
}

// Role picker: one-line description, a "uses a seat" badge with how many are
// left, and an extra confirmation before anyone is made a super admin.
export function RoleField({
  value,
  onChange,
  seatsLeft,
  dataSeatsLeft = 0,
  confirmAdmin,
  onConfirmAdmin,
  canMakeSuperAdmin,
  allowClient = true,
  idPrefix = "",
}: {
  value: string;
  onChange: (v: string) => void;
  seatsLeft: number;
  dataSeatsLeft?: number;
  confirmAdmin: boolean;
  onConfirmAdmin: (v: boolean) => void;
  canMakeSuperAdmin: boolean;
  allowClient?: boolean;
  idPrefix?: string;
}) {
  const info = ROLE_INFO.find((r) => r.value === value);
  const options = ROLE_INFO.filter((r) => (allowClient || r.value !== "client") && (canMakeSuperAdmin || r.value !== "super_admin" || value === "super_admin"));
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={`${idPrefix}role-label`} htmlFor={`${idPrefix}role`}>
        Role
        <Req />
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`${idPrefix}role`} aria-labelledby={`${idPrefix}role-label`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="role" value={value} />
      {info && (
        <p className="text-xs text-muted">
          {info.description}{" "}
          <span
            className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
              info.usesSeat
                ? seatsLeft > 0
                  ? "bg-brand-blue-tint text-brand-blue"
                  : "bg-danger-tint text-danger"
                : info.dataSeat
                  ? dataSeatsLeft > 0
                    ? "bg-brand-blue-tint text-brand-blue"
                    : "bg-danger-tint text-danger"
                  : "bg-canvas text-muted"
            }`}
          >
            {info.usesSeat
              ? seatsLeft > 0
                ? `Uses a seat · ${seatsLeft} left`
                : "Uses a seat · none left"
              : info.dataSeat
                ? dataSeatsLeft > 0
                  ? `Uses a Data-only seat · ${dataSeatsLeft} left`
                  : "Uses a Data-only seat · none left"
                : "No seat used"}
          </span>
        </p>
      )}
      {value === "super_admin" && (
        <label className="mt-1 flex items-start gap-2 rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-ink">
          <Checkbox checked={confirmAdmin} onCheckedChange={(v) => onConfirmAdmin(v === true)} className="mt-0.5" />
          I understand a super admin can change billing, security and every other login.
        </label>
      )}
    </div>
  );
}

// Team picker with an inline "+ Create team" so the form never dead-ends.
export function TeamField({
  teams,
  onTeams,
  value,
  onChange,
  idPrefix = "",
}: {
  teams: { id: string; name: string }[];
  onTeams: (t: { id: string; name: string }[]) => void;
  value: string;
  onChange: (v: string) => void;
  idPrefix?: string;
}) {
  const [adding, setAdding] = useState(teams.length === 0);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await createTeam(name);
    setBusy(false);
    if (res.error || !res.team) return setError(res.error ?? "Could not create the team.");
    onTeams([...teams, res.team].sort((a, b) => a.name.localeCompare(b.name)));
    onChange(res.team.id);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={`${idPrefix}team-label`} htmlFor={`${idPrefix}team_id`}>
        Team
      </Label>
      {teams.length > 0 && (
        <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
          <SelectTrigger id={`${idPrefix}team_id`} aria-labelledby={`${idPrefix}team-label`}>
            <SelectValue placeholder="No team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <input type="hidden" name="team_id" value={value} />
      {adding ? (
        <div className="flex flex-col gap-1.5">
          {teams.length === 0 && <p className="text-xs text-muted">No teams yet. Create the first one:</p>}
          <div className="flex gap-2">
            <Input
              aria-label="New team name"
              placeholder="e.g. UK sales"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (name.trim()) void add();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={add} disabled={busy || name.trim().length < 2}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            {teams.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex w-fit items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
          <Plus className="h-3 w-3" /> Create team
        </button>
      )}
    </div>
  );
}

// Searchable time zone: type to filter the full IANA list (the datalist), and
// the server rejects anything that is not on it.
export function TimezoneField({ value, onChange, idPrefix = "" }: { value: string; onChange: (v: string) => void; idPrefix?: string }) {
  const zones = allTimezones();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}timezone`}>
        Timezone
        <Req />
      </Label>
      <Input
        id={`${idPrefix}timezone`}
        name="timezone"
        list={`${idPrefix}tz-list`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type to search, e.g. London"
        autoComplete="off"
        required
        aria-invalid={value !== "" && !zones.includes(value)}
      />
      <datalist id={`${idPrefix}tz-list`}>
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
      {value !== "" && !zones.includes(value) && <p className="text-xs text-danger">Pick a time zone from the list.</p>}
    </div>
  );
}

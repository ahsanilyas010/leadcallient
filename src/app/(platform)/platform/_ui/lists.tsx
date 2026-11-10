import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/format";
import { fmtDuration, fmtMoney } from "@/lib/owner/status";
import type { AgentUsage, OwnerUser } from "@/lib/owner/data";
import type { RealTables } from "@/lib/supabase/real-types";
import { OTable, OHead, OEmpty, td, tdNum } from "./table";
import { DeleteLedgerButton, UserActiveButton } from "./company-actions";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  ops_manager: "Ops manager",
  team_lead: "Team lead",
  agent: "Agent",
  qa_analyst: "QA analyst",
  client: "Client",
  lead_gen: "Lead gen",
  data_manager: "Data only",
};
export const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;

export function UsersTable({ users, companyNames }: { users: OwnerUser[]; companyNames?: Map<string, string> }) {
  return (
    <OTable>
      <OHead
        cols={[
          "User",
          ...(companyNames ? ["Company"] : []),
          "Role",
          "Status",
          "Joined",
          "Last sign-in",
          { label: "Calls 30d", right: true },
          { label: "Talk 30d", right: true },
          "Last call",
          "",
        ]}
      />
      <tbody className="divide-y divide-line">
        {users.map((u) => (
          <tr key={u.user_id}>
            <td className={td}>
              <p className="font-medium text-ink">{u.full_name}</p>
              <p className="text-xs text-muted">{u.email}</p>
            </td>
            {companyNames && (
              <td className={td}>
                <Link href={`/platform/companies/${u.workspace_id}`} className="hover:text-brand-blue hover:underline">
                  {companyNames.get(u.workspace_id) ?? "—"}
                </Link>
              </td>
            )}
            <td className={td}>{roleLabel(u.role)}</td>
            <td className={td}>
              {u.is_active ? <Badge variant="confirm">Active</Badge> : <Badge>Inactive</Badge>}
              {u.must_change_password && u.is_active && (
                <Badge variant="warning" className="ml-1">
                  Never signed in
                </Badge>
              )}
            </td>
            <td className={td}>{fmtDate(u.created_at)}</td>
            <td className={td} title={fmtDateTime(u.last_sign_in_at)}>
              {u.last_sign_in_at ? fmtRelative(u.last_sign_in_at) : "Never"}
            </td>
            <td className={tdNum}>{Number(u.calls_30d)}</td>
            <td className={tdNum}>{fmtDuration(Number(u.talk_seconds_30d))}</td>
            <td className={td}>{u.last_call_at ? fmtRelative(u.last_call_at) : "—"}</td>
            <td className={td}>
              <UserActiveButton userId={u.user_id} isActive={u.is_active} email={u.email} />
            </td>
          </tr>
        ))}
        {users.length === 0 && <OEmpty cols={companyNames ? 10 : 9}>No users.</OEmpty>}
      </tbody>
    </OTable>
  );
}

export function UsageTable({ rows, companyNames }: { rows: AgentUsage[]; companyNames?: Map<string, string> }) {
  return (
    <OTable>
      <OHead
        cols={[
          "Agent",
          ...(companyNames ? ["Company"] : []),
          "Role",
          { label: "Calls", right: true },
          { label: "Connects", right: true },
          { label: "Connect %", right: true },
          { label: "Sales", right: true },
          { label: "Talk time", right: true },
          { label: "Avg call", right: true },
          { label: "Hours clocked", right: true },
          { label: "Days active", right: true },
          "Last call",
          "Dialing since",
        ]}
      />
      <tbody className="divide-y divide-line">
        {rows.map((r) => {
          const calls = Number(r.calls);
          const connects = Number(r.connects);
          return (
            <tr key={r.user_id} className={r.is_active ? "" : "opacity-60"}>
              <td className={td}>
                <p className="font-medium text-ink">{r.full_name}</p>
                <p className="text-xs text-muted">{r.email}</p>
              </td>
              {companyNames && (
                <td className={td}>
                  <Link href={`/platform/companies/${r.workspace_id}`} className="hover:text-brand-blue hover:underline">
                    {companyNames.get(r.workspace_id) ?? "—"}
                  </Link>
                </td>
              )}
              <td className={td}>{roleLabel(r.role)}</td>
              <td className={tdNum}>{calls.toLocaleString()}</td>
              <td className={tdNum}>{connects.toLocaleString()}</td>
              <td className={tdNum}>{calls ? `${Math.round((connects / calls) * 100)}%` : "—"}</td>
              <td className={tdNum}>{Number(r.conversions)}</td>
              <td className={tdNum}>{fmtDuration(Number(r.talk_seconds))}</td>
              <td className={tdNum}>{calls ? fmtDuration(Number(r.talk_seconds) / calls) : "—"}</td>
              <td className={tdNum}>{(Number(r.clocked_seconds) / 3600).toFixed(1)}</td>
              <td className={tdNum}>{Number(r.days_active)}</td>
              <td className={td}>{r.last_call_at ? fmtRelative(r.last_call_at) : "—"}</td>
              <td className={td}>{r.first_call_ever ? fmtDate(r.first_call_ever) : "Never dialed"}</td>
            </tr>
          );
        })}
        {rows.length === 0 && <OEmpty cols={companyNames ? 13 : 12}>No agents in this range.</OEmpty>}
      </tbody>
    </OTable>
  );
}

type LedgerRow = RealTables<"platform_ledger">;
const KIND: Record<string, { label: string; variant: "blue" | "confirm" | "violet" }> = {
  charge: { label: "Charge", variant: "blue" },
  payment: { label: "Payment", variant: "confirm" },
  credit: { label: "Credit", variant: "violet" },
};
const METHOD: Record<string, string> = { bank_transfer: "Bank transfer", cash: "Cash", card: "Card", gateway: "Gateway", other: "Other" };

export function LedgerTable({ rows, companyNames }: { rows: LedgerRow[]; companyNames?: Map<string, string> }) {
  return (
    <OTable>
      <OHead cols={["Date", ...(companyNames ? ["Company"] : []), "Type", { label: "Amount", right: true }, "Method", "Reference", "Note", ""]} />
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td}>{fmtDate(r.occurred_on)}</td>
            {companyNames && (
              <td className={td}>
                <Link href={`/platform/companies/${r.workspace_id}?tab=billing`} className="hover:text-brand-blue hover:underline">
                  {companyNames.get(r.workspace_id) ?? "—"}
                </Link>
              </td>
            )}
            <td className={td}>
              <Badge variant={KIND[r.kind]?.variant ?? "neutral"}>{KIND[r.kind]?.label ?? r.kind}</Badge>
            </td>
            <td className={tdNum}>{(r.kind === "charge" ? "" : "−") + fmtMoney(Number(r.amount), r.currency)}</td>
            <td className={td}>{r.method ? METHOD[r.method] ?? r.method : "—"}</td>
            <td className={td}>{r.reference ?? "—"}</td>
            <td className="max-w-xs truncate px-3 py-2.5" title={r.note ?? ""}>
              {r.note ?? "—"}
            </td>
            <td className={td}>{!r.provider && <DeleteLedgerButton entryId={r.id} />}</td>
          </tr>
        ))}
        {rows.length === 0 && <OEmpty cols={companyNames ? 8 : 7}>No ledger entries yet.</OEmpty>}
      </tbody>
    </OTable>
  );
}

type AuditRow = RealTables<"platform_audit">;
const ACTION_LABEL: Record<string, string> = {
  "owner.sign_in": "Signed in to the owner console",
  "company.status": "Changed company status",
  "company.trial": "Changed trial",
  "company.seats": "Changed seats",
  "company.billing_plan": "Changed billing plan",
  "company.notes": "Edited notes",
  "ledger.charge": "Added a charge",
  "ledger.payment": "Recorded a payment",
  "ledger.credit": "Added a credit",
  "ledger.delete": "Deleted a ledger entry",
  "user.deactivate": "Deactivated a user",
  "user.reactivate": "Reactivated a user",
};

function describe(r: AuditRow): string {
  const d = (r.details ?? {}) as Record<string, unknown>;
  if (r.action === "company.status") return `${d.from} → ${d.to}`;
  if (r.action === "company.trial") return d.to ? `ends ${fmtDate(String(d.to))}` : "trial removed";
  if (r.action.startsWith("ledger.")) return d.amount ? fmtMoney(Number(d.amount), String(d.currency ?? "USD")) : "";
  if (r.action.startsWith("user.")) return String(d.email ?? "");
  if (r.action === "company.seats") {
    const to = d.to as { agent?: number; data?: number } | undefined;
    return to ? `${to.agent} agent / ${to.data} data seats` : "";
  }
  if (r.action === "company.billing_plan") {
    const to = d.to as { billing_amount?: number | null; billing_currency?: string; billing_cycle?: string } | undefined;
    return to?.billing_amount != null ? `${fmtMoney(Number(to.billing_amount), to.billing_currency)} ${to.billing_cycle}` : "price cleared";
  }
  return "";
}

export function AuditList({ rows, companyNames }: { rows: AuditRow[]; companyNames?: Map<string, string> }) {
  return (
    <OTable>
      <OHead cols={["When", "Who", "What", ...(companyNames ? ["Company"] : []), "Details"]} />
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td} title={fmtDateTime(r.created_at)}>
              {fmtRelative(r.created_at)}
            </td>
            <td className={td}>{r.actor_email ?? "—"}</td>
            <td className={td}>{ACTION_LABEL[r.action] ?? r.action}</td>
            {companyNames && (
              <td className={td}>
                {r.workspace_id ? (
                  <Link href={`/platform/companies/${r.workspace_id}`} className="hover:text-brand-blue hover:underline">
                    {companyNames.get(r.workspace_id) ?? "—"}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            )}
            <td className={td}>{describe(r)}</td>
          </tr>
        ))}
        {rows.length === 0 && <OEmpty cols={companyNames ? 5 : 4}>Nothing yet.</OEmpty>}
      </tbody>
    </OTable>
  );
}

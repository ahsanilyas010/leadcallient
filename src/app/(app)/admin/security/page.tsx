import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Security & audit" };

const DATA_ACTIONS = ["trash", "restore", "purge", "undo_import", "erase_person", "trash_expired"];

// One line per delete-type action, in words.
function describe(action: string, entity: string, data: unknown): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const n = (k: string) => Number(d[k] ?? 0);
  const things = (count: number, noun: string) => `${count.toLocaleString("en-GB")} ${noun}${count === 1 ? "" : "s"}`;
  const noun = entity === "unphoned_contact" ? "contact" : "lead";
  switch (action) {
    case "trash":
      return `moved ${things(n("count"), noun)} to the trash`;
    case "restore":
      return `restored ${things(n("count"), noun)} from the trash`;
    case "purge":
      return `permanently deleted ${things(n("count"), noun)}`;
    case "undo_import":
      return `undid an import (${things(n("leads"), "lead")} and ${things(n("contacts"), "contact")} to the trash)`;
    case "erase_person":
      return `erased one person's data on request (${things(n("leads"), "lead")}, ${things(n("calls"), "call")}, ${things(n("contacts"), "contact")}, ${things(n("emails"), "email record")}${d.suppressed ? ", number suppressed" : ""})`;
    case "trash_expired":
      return `deleted ${things(n("leads"), "lead")} and ${things(n("contacts"), "contact")} for good after ${n("retention_days")} days in the trash`;
    default:
      return action;
  }
}

export default async function SecurityPage() {
  const profile = await requireRole(["super_admin"]);

  const supabase = await createRealClient();
  const [{ data: auditRows }, { data: credentialEvents }, { data: people }, signIns, { data: deletions }] = await Promise.all([
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(25),
    supabase.from("credential_events").select("*").order("created_at", { ascending: false }).limit(25),
    supabase.from("profiles").select("id, full_name, role").eq("workspace_id", profile.workspace_id),
    // Supabase Auth's own record of who signed in recently (service role:
    // auth.users isn't reachable through RLS).
    createServiceClient().auth.admin.listUsers({ perPage: 1000 }),
    supabase
      .from("audit_log")
      .select("id, created_at, action, entity_type, actor_id, after_data")
      .in("action", DATA_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const recentSignIns = (signIns.data?.users ?? [])
    .filter((u) => names.has(u.id) && u.last_sign_in_at)
    .sort((a, b) => (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? ""))
    .slice(0, 25);

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      <Card className="animate-slide-up lg:col-span-3" data-testid="deletion-log">
        <CardHeader>
          <CardTitle>Deletes, restores and erasures</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <tbody>
              {(deletions ?? []).map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-1.5 tabular text-muted">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-ink">
                    <span className="font-medium">{row.action === "trash_expired" ? "Trash expiry" : (row.actor_id && names.get(row.actor_id)) || "System"}</span>{" "}
                    {describe(row.action, row.entity_type, row.after_data)}
                  </td>
                </tr>
              ))}
              {(deletions ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted" colSpan={2}>
                    Nothing has been deleted yet. Every move to the trash, restore, permanent delete, undone import and erasure is listed here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="animate-slide-up lg:col-span-2">
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <tbody>
              {(auditRows ?? []).map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-1.5 tabular text-muted">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="neutral">{row.action}</Badge>
                  </td>
                  <td className="px-2 py-1.5 text-ink">{row.entity_type}</td>
                  <td className="px-2 py-1.5 text-muted">{(row.actor_id && names.get(row.actor_id)) || "System"}</td>
                </tr>
              ))}
              {(auditRows ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={4}>
                    No audited changes yet — the log fills as profiles, teams, clients and campaigns change.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Recent sign-ins</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            {recentSignIns.map((u) => (
              <div key={u.id} className="flex items-center justify-between">
                <span className="text-ink">{names.get(u.id)}</span>
                <span className="tabular text-muted">{new Date(u.last_sign_in_at!).toLocaleString()}</span>
              </div>
            ))}
            {recentSignIns.length === 0 && <p className="text-muted">No sign-ins recorded yet.</p>}
          </CardContent>
        </Card>

        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Credential events</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            {(credentialEvents ?? []).map((e) => (
              <div key={e.id} className="flex items-center justify-between">
                <span className="text-ink">{names.get(e.user_id) ?? "Unknown"}</span>
                <Badge variant="neutral">{e.event.replace(/_/g, " ")}</Badge>
              </div>
            ))}
            {(credentialEvents ?? []).length === 0 && <p className="text-muted">No credential events yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

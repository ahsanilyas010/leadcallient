import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { SuspendButton } from "./platform-actions";
import { fmtSeats } from "@/lib/plan";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Read-only except for suspend/reactivate. RLS (supabase/migrations/00000000000044_rls.sql)
// is what actually enforces "never leads, recordings or
// call content" here — this page uses the RLS-governed client, not the
// service role, so that guarantee holds structurally.
export default async function PlatformDashboardPage() {
  const admin = await requirePlatformAdmin();
  const supabase = await createRealClient();

  const [{ data: workspaces }, { data: profiles }, { data: stats }] = await Promise.all([
    supabase.from("workspaces").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("workspace_id, role, is_active"),
    supabase.rpc("platform_workspace_stats"),
  ]);

  const seatsByWorkspace = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.role === "agent" && p.is_active) {
      seatsByWorkspace.set(p.workspace_id, (seatsByWorkspace.get(p.workspace_id) ?? 0) + 1);
    }
  }
  const statsByWorkspace = new Map((stats ?? []).map((s) => [s.workspace_id, s]));

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Workspaces</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as {admin.email}. This view never shows lead phone numbers, recordings or call content.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Workspace</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Seats used</th>
              <th className="px-4 py-3">Active today</th>
              <th className="px-4 py-3">Calls today</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(workspaces ?? []).map((w) => {
              const s = statsByWorkspace.get(w.id);
              return (
                <tr key={w.id}>
                  <td className="px-4 py-3 font-medium text-ink">
                    {w.name}
                    {w.is_demo && (
                      <span className="ml-2 rounded bg-gold-tint px-1.5 py-0.5 text-[10px] font-semibold text-gold-text">DEMO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{w.plan}</td>
                  <td className="px-4 py-3">
                    {seatsByWorkspace.get(w.id) ?? 0} / {fmtSeats(w.seat_limit)}
                  </td>
                  <td className="px-4 py-3">{s?.agents_active_today ?? 0}</td>
                  <td className="px-4 py-3">{s?.calls_today ?? 0}</td>
                  <td className="px-4 py-3 capitalize">{w.status}</td>
                  <td className="px-4 py-3">
                    <SuspendButton workspaceId={w.id} status={w.status} />
                  </td>
                </tr>
              );
            })}
            {(workspaces ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No workspaces yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { TrashTables } from "./trash-tables";

export const metadata: Metadata = { title: "Trash", robots: { index: false, follow: false } };

// Deleted leads and contacts, restorable until they expire. Anything past the
// workspace's retention period is deleted for good on the way in (the same
// expiry also runs on a daily schedule).
export default async function TrashPage() {
  const profile = await requireRole(["super_admin", "ops_manager", "data_manager"]);
  const workspace = await getCurrentWorkspace();
  const canPurge = profile.role === "super_admin" || (profile.role === "ops_manager" && workspace.ops_can_purge);
  const supabase = await createRealClient();

  await supabase.rpc("purge_expired_trash");
  const [{ data: leads, error: leadErr }, { data: contacts, error: contactErr }] = await Promise.all([
    supabase.rpc("trashed_leads", { p_limit: 1000 }),
    supabase.rpc("trashed_contacts", { p_limit: 1000 }),
  ]);
  const error = leadErr?.message ?? contactErr?.message ?? null;

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Trash</h1>
          <p className="max-w-3xl text-xs text-muted">
            Deleted leads and contacts stay here for {workspace.trash_retention_days} days, off every campaign, call sheet and dial queue.
            Restore puts a record back on its campaign and with its owner (if they still exist). After {workspace.trash_retention_days} days it
            is deleted for good.{" "}
            {canPurge
              ? "You can also delete records permanently now."
              : "Only the super admin (or an ops manager they allow) can delete permanently before then."}{" "}
            Every delete and restore is in the{" "}
            {profile.role === "super_admin" ? (
              <Link href="/admin/security" className="text-brand-blue hover:underline">
                audit log
              </Link>
            ) : (
              "audit log"
            )}
            .
          </p>
        </div>
        <Link href="/admin/leads" className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-canvas">
          Back to Leads
        </Link>
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <TrashTables leads={leads ?? []} contacts={contacts ?? []} canPurge={canPurge} timezone={profile.timezone} />
    </div>
  );
}

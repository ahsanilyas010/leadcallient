import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { DeletePolicy } from "./delete-policy";

export const metadata: Metadata = { title: "Data & deleting" };

export default async function DataSettingsPage() {
  const profile = await requireRole(["super_admin", "ops_manager"]);
  const workspace = await getCurrentWorkspace();
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Data &amp; deleting</h1>
        <p className="mt-1 text-sm text-muted">
          Deleted leads and contacts go to the{" "}
          <Link href="/admin/leads/trash" className="text-brand-blue hover:underline">
            trash
          </Link>{" "}
          first, where they can be restored. These settings decide how long they stay there and who can delete for good.
          {profile.role !== "super_admin" && " Only the super admin can change them."}
        </p>
      </div>
      <DeletePolicy
        canEdit={profile.role === "super_admin"}
        opsCanPurge={workspace.ops_can_purge}
        retentionDays={workspace.trash_retention_days}
      />
      <p className="text-xs text-muted">
        To find or erase everything held about one person, use{" "}
        <Link href="/admin/data/privacy" className="text-brand-blue hover:underline">
          Privacy requests
        </Link>
        .
      </p>
    </div>
  );
}

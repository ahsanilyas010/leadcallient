import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { PrivacyRequest } from "./privacy-request";

export const metadata: Metadata = { title: "Privacy requests", robots: { index: false, follow: false } };

// Data-subject requests: find everything held about one person, export it,
// and erase it on request.
export default async function PrivacyPage() {
  const profile = await requireRole(["super_admin", "ops_manager"]);
  const workspace = await getCurrentWorkspace();
  const canErase = profile.role === "super_admin" || (profile.role === "ops_manager" && workspace.ops_can_purge);
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Privacy requests</h1>
        <p className="mt-1 text-sm text-muted">
          When someone asks what you hold about them, or asks you to delete it, find them here by email address, phone number or both. You
          can export what is held and, if they ask, erase it: their leads, call history and recordings, contacts and the emails sent to them.
          The audit log records that an erasure happened and how much was removed, never who it was about.
        </p>
        <p className="mt-2 text-xs text-muted">
          Before taking on healthcare providers, confirm your retention and deletion obligations (for example a HIPAA business associate
          agreement or UK GDPR special-category rules): this tool erases on request, but doesn&apos;t decide what you must keep.{" "}
          <Link href="/admin/data" className="text-brand-blue hover:underline">
            Back to Data
          </Link>
        </p>
      </div>
      <PrivacyRequest canErase={canErase} />
    </div>
  );
}

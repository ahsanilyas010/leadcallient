import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { accessFromRow } from "@/lib/workspace/access";
import { isLocked } from "@/lib/access";
import { signOut } from "@/lib/actions/auth";
import { BrandMark } from "@/components/brand/mark";
import { PayToContinue } from "@/components/billing/pay-to-continue";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Free trial ended", robots: { index: false, follow: false } };

// Where everyone in a workspace lands once its 14-day trial is over and the
// owner hasn't approved it yet (see requireProfile()). Approving the company
// in the owner console is what lets them back in: this page then sends them
// straight on to the app.
export default async function TrialEndedPage() {
  const profile = await requireRealProfile();
  const workspace = await getCurrentWorkspace();
  const access = accessFromRow(workspace);
  if (!isLocked(access)) redirect("/start");

  const isAdmin = profile.role === "super_admin";
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-xl animate-slide-up">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BrandMark size={40} />
        </div>
        <div className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">Your free trial has ended</h1>
              <p className="text-xs text-muted">
                {workspace.name} · trial ended {fmtDate(access.endedAt)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            The free trial lasts 14 days and covers 3 agents. Access to {workspace.name} is paused until the company is approved to continue. Your leads, campaigns and
            call history are safe.
          </p>
          <div className="mt-6">
            <PayToContinue workspaceName={workspace.name} canPay={isAdmin} />
          </div>
          <form action={signOut} className="mt-6 border-t border-line pt-4">
            <button type="submit" className="text-sm font-medium text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { listDispositions, getDueCallbacks } from "@/lib/actions/dial-workspace";
import { DialWorkspaceClient } from "./dial-workspace-client";

export const metadata: Metadata = { title: "Dial workspace", robots: { index: false, follow: false } };

const STAFF_ROLES = ["super_admin", "ops_manager", "team_lead", "agent", "qa_analyst"];

// Real-workspace dial workspace — deliberately at its own path (not
// /workspace, which the pre-existing demo-store-backed dial screen still
// owns; see src/lib/supabase/server.ts's header comment for why that one
// is untouched). A real signed-up workspace's agents use this one, backed
// by the real compliance gate (next_lead_for_agent) and calls placed through
// Zoom Phone's Smart Embed.
export default async function DialWorkspacePage() {
  const profile = await requireRealProfile();
  if (!STAFF_ROLES.includes(profile.role)) redirect("/start");

  const [dispositions, dueCallbacks, workspace] = await Promise.all([listDispositions(), getDueCallbacks(), getCurrentWorkspace()]);

  return (
    <DialWorkspaceClient
      dispositions={dispositions}
      initialDueCallbacks={dueCallbacks}
      isDemo={workspace.is_demo}
      screeningRequired={workspace.require_screening}
      canManage={profile.role === "super_admin" || profile.role === "ops_manager"}
    />
  );
}

import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/current-profile";
import { navFor } from "@/lib/nav";
import { getMyLatestEvent } from "@/lib/actions/attendance-v2";
import { getMyCallbacks } from "@/lib/actions/callbacks";
import { AppChrome } from "@/components/shell/app-chrome";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { activeAgentCount } from "@/lib/workspace/limits";
import { createRealClient } from "@/lib/supabase/real";
import { fetchGuideState, fetchSetupProgress } from "@/lib/guide/server";
import { isManagerRole } from "@/lib/guide/tours";
import { worksShifts } from "@/lib/roles";
import type { GuideInit } from "@/components/guide/guide-provider";
import { stripeConfigured } from "@/lib/billing/stripe";

// The signed-in app is not for search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Roles that can place or receive calls (and so get the Zoom Phone dock).
const DIAL_ROLES = ["super_admin", "ops_manager", "team_lead", "agent", "qa_analyst"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const items = navFor(profile.role);

  // Attendance and callbacks are staff concepts — a client login has no
  // shift to clock into and no leads to follow up on, so skip the queries
  // and let Header hide that chrome entirely for this role.
  const isStaff = worksShifts(profile.role);
  const supabase = await createRealClient();
  const manager = isManagerRole(profile.role);
  const [workspace, event, callbacks, agentsUsed, guideState, setupProgress] = await Promise.all([
    getCurrentWorkspace(),
    isStaff ? getMyLatestEvent() : Promise.resolve(null),
    isStaff ? getMyCallbacks() : Promise.resolve([]),
    activeAgentCount(supabase, profile.workspace_id),
    fetchGuideState(profile.id),
    // One RPC per request, managers only (it refuses everyone else).
    manager ? fetchSetupProgress() : Promise.resolve(null),
  ]);

  const planInfo = {
    workspaceName: workspace.name,
    plan: workspace.plan,
    agentsUsed,
    agentSeats: workspace.seat_limit,
    canManageBilling: profile.role === "super_admin",
    isRealDemo: workspace.is_demo,
    // Without a payment provider an upgrade would dead-end, so the bar offers "Contact sales" instead.
    billingReady: stripeConfigured(),
  };

  const branding = { logoUrl: workspace.brand_logo_url ?? null, productName: workspace.brand_product_name ?? null };

  const guide: GuideInit = {
    role: profile.role,
    firstName: profile.full_name.trim().split(" ")[0] || "there",
    isDemo: workspace.is_demo,
    tourSeen: guideState.tourSeenAt !== null,
    checklistHidden: guideState.checklistDismissedAt !== null,
    progress: setupProgress,
  };

  return (
    <AppChrome
      guide={guide}
      profile={profile}
      initialEvent={event}
      initialCallbacks={callbacks}
      items={items}
      planInfo={planInfo}
      branding={branding}
      brandColor={workspace.brand_primary_color}
      enablePhone={DIAL_ROLES.includes(profile.role)}
    >
      {children}
    </AppChrome>
  );
}

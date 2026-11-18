"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar, type SidebarBranding } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { Suspense } from "react";
import { NavProgress } from "@/components/shell/nav-progress";
import { PageTransition } from "@/components/shell/page-transition";
import { PlanBar, type PlanInfo } from "@/components/shell/plan-bar";
import { TrialBanner } from "@/components/shell/trial-banner";
import { BANNER_DAYS } from "@/lib/access";
import { brandStyle } from "@/lib/branding";
import { CommandPalette } from "@/components/shell/command-palette";
import { GuideProvider, type GuideInit } from "@/components/guide/guide-provider";
import { ZoomPhoneProvider } from "@/components/zoom-phone/zoom-phone-provider";
import type { NavItem } from "@/lib/nav";
import type { Profile } from "@/lib/auth/current-profile";
import type { CallbackRow } from "@/lib/actions/callbacks";
import type { RealTables } from "@/lib/supabase/real-types";

// Phase 8 — "Mobile layout for attendance and follow-ups (agents will
// clock in on their phones)." The sidebar was always visible at 56-208px,
// permanently eating a third of a phone's width. Below the `md` breakpoint
// it's now an off-canvas drawer opened from a hamburger button in the
// header, so the clock-in control and follow-up tray — the two things an
// agent actually needs on a phone — get the full screen width.
export function AppChrome({
  items,
  profile,
  initialEvent,
  initialCallbacks,
  planInfo,
  branding,
  enablePhone,
  brandColor,
  guide,
  children,
}: {
  items: NavItem[];
  profile: Profile;
  initialEvent: RealTables<"attendance_events">["event_type"] | null;
  initialCallbacks: CallbackRow[];
  planInfo: PlanInfo;
  branding?: SidebarBranding;
  // Dial roles get the Zoom Phone Smart Embed dock (mounted lazily on /dial).
  enablePhone?: boolean;
  // The customer's chosen brand colour; re-themes the whole app.
  brandColor?: string | null;
  // Product tour + setup checklist state (see src/components/guide).
  guide: GuideInit;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const shell = (
      <div className="flex h-screen w-full overflow-clip" style={brandStyle(brandColor)}>
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
          )}
        </AnimatePresence>

        <div
          className={`fixed inset-y-0 left-0 z-50 md:static md:z-auto ${
            mobileNavOpen ? "flex" : "hidden md:flex"
          }`}
        >
          <Sidebar items={items} onNavigate={() => setMobileNavOpen(false)} branding={branding} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-clip">
          <PlanBar info={planInfo} />
          {planInfo.trial && planInfo.trial.daysLeft <= BANNER_DAYS && (
            <TrialBanner daysLeft={planInfo.trial.daysLeft} endsAt={planInfo.trial.endsAt} canManageBilling={planInfo.canManageBilling} />
          )}
          <Header
            profile={profile}
            initialEvent={initialEvent}
            initialCallbacks={initialCallbacks}
            onMenuClick={() => setMobileNavOpen(true)}
          />
          <PageTransition>{children}</PageTransition>
        </div>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <CommandPalette items={items} />
      </div>
  );

  const withPhone = enablePhone ? <ZoomPhoneProvider>{shell}</ZoomPhoneProvider> : shell;
  return <GuideProvider init={guide}>{withPhone}</GuideProvider>;
}

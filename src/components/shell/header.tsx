"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, User, CalendarPlus, Menu, Search, CircleHelp, ListChecks } from "lucide-react";
import { useGuide } from "@/components/guide/guide-provider";
import { signOut } from "@/lib/actions/auth";
import { BRAND } from "@/lib/brand";
import { RequestLeaveDialog } from "@/components/shell/request-leave-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AttendanceControl } from "@/components/shell/attendance-control";
import { FollowupTray } from "@/components/shell/followup-tray";
import type { Profile } from "@/lib/auth/current-profile";
import type { CallbackRow } from "@/lib/actions/callbacks";
import type { RealTables } from "@/lib/supabase/real-types";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  ops_manager: "Ops manager",
  team_lead: "Team lead",
  qa_analyst: "QA analyst",
  agent: "Sales agent",
  lead_gen: "Lead gen",
  client: "Client",
};

// profile.timezone is a free-text field (see admin/people/create-user-dialog)
// — an invalid IANA zone (e.g. "UK" instead of "Europe/London") makes
// toLocaleTimeString throw a RangeError. That throw happens inside the
// header, which every single page renders, so an unvalidated typo here
// took the entire app down for that one account on every page load. Falls
// back to the browser's local time rather than letting the header crash.
function safeTimeString(date: Date, timeZone: string) {
  try {
    return date.toLocaleTimeString("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const TITLES: Record<string, string> = {
  dial: "Dial workspace",
  live: "Live floor",
  portal: "Client reports",
  quality: "Quality",
  billing: "Agents & billing",
  branding: "Branding",
  email: "Email templates",
  performance: "Performance",
  people: "People",
  campaigns: "Campaigns",
  attendance: "Attendance",
  compliance: "Compliance",
  data: "Data",
  import: "Upload leads",
  security: "Security & audit",
  integrations: "Integrations",
  callsheet: "Call sheet",
  leadgen: "Lead gen",
  connectors: "Connectors",
  meetings: "Meetings",
  zoom: "Zoom",
};

function useTitle() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "live";
  if (segments[0] === "leadgen" && last === "leads") return "Lead inbox";
  return TITLES[last] ?? BRAND.productName;
}

export function Header({
  profile,
  initialEvent,
  initialCallbacks,
  onMenuClick,
}: {
  profile: Profile;
  initialEvent: RealTables<"attendance_events">["event_type"] | null;
  initialCallbacks: CallbackRow[];
  onMenuClick?: () => void;
}) {
  const title = useTitle();
  const guide = useGuide();
  const [now, setNow] = useState<Date | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // Clock-in, callbacks and leave are for people on a shift; clients and the
  // lead-gen seat have none.
  const isStaff = profile.role !== "client" && profile.role !== "lead_gen";

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface/80 px-2 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <h1 className="truncate font-display text-base font-semibold text-ink">{title}</h1>
        <button
          onClick={() => window.dispatchEvent(new Event("leadcallient:open-palette"))}
          data-tour="search"
          className="ml-2 hidden cursor-pointer items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand-blue-tint-2 hover:text-ink lg:flex"
        >
          <Search className="h-3.5 w-3.5" /> Jump to…
          <kbd className="rounded bg-surface px-1 text-[10px] ring-1 ring-line">Ctrl K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {guide?.steps && (
          <button
            type="button"
            onClick={guide.openChecklist}
            data-tour="setup-guide"
            data-testid="setup-guide-button"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-2 text-xs font-medium text-ink shadow-sm transition-colors hover:border-brand-blue-tint-2 hover:bg-canvas sm:px-2.5"
            aria-label={`Setup guide, ${guide.done} of ${guide.total} done`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Setup guide</span>
            <span className="tabular rounded-full bg-brand-blue px-1.5 py-px text-[10px] font-semibold text-white" data-testid="setup-guide-count">
              {guide.done}/{guide.total}
            </span>
          </button>
        )}
        {guide?.hasTour && (
          <button
            type="button"
            onClick={guide.startTour}
            data-tour="help"
            data-testid="take-tour-button"
            title="Take the tour"
            aria-label="Take the tour"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
          >
            <CircleHelp className="h-4.5 w-4.5" />
          </button>
        )}
        {isStaff && (
          <>
            <div data-tour="clock-in" className="flex items-center">
              <AttendanceControl initialEvent={initialEvent} />
            </div>
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <div data-tour="callbacks" className="flex items-center">
              <FollowupTray userId={profile.id} initial={initialCallbacks} />
            </div>
            <Separator orientation="vertical" className="hidden h-5 lg:block" />
          </>
        )}

        <div className="hidden items-center gap-1.5 text-xs lg:flex">
          <span className="tabular text-muted">{profile.timezone}</span>
          <span className="tabular font-medium text-ink">
            {now ? safeTimeString(now, profile.timezone) : "--:--:--"}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger data-tour="profile" className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-canvas cursor-pointer">
            <Avatar className="h-8 w-8 ring-2 ring-gold/60 ring-offset-1 ring-offset-surface">
              <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-white">
                {initials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-medium leading-tight text-ink">{profile.full_name}</div>
              <div className="text-[10px] leading-tight text-muted">
                {profile.agent_code ?? ROLE_LABEL[profile.role]}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="flex items-center gap-2 normal-case">
              <User className="h-3.5 w-3.5" />
              {profile.full_name}
              <Badge variant="blue">{ROLE_LABEL[profile.role]}</Badge>
            </DropdownMenuLabel>
            {isStaff && (
              <DropdownMenuItem onSelect={() => setLeaveOpen(true)}>
                <CalendarPlus className="mr-2 h-3.5 w-3.5" /> Request leave
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="danger"
              onSelect={() => {
                void signOut();
              }}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RequestLeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
    </header>
  );
}

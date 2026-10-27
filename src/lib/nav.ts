import type { RealEnums } from "@/lib/supabase/real-types";

export type AppRole = RealEnums<"app_role">;

// Icon names only (strings, not component references) — this array is
// built server-side in the (app) layout and passed as a prop into Client
// Components (Sidebar via AppChrome). React Server Components can't
// serialize a raw function/component reference across that boundary, only
// plain data — so the actual lucide-react component lookup happens
// client-side in Sidebar via ICON_MAP, keyed by this string.
export type NavIconName =
  | "Activity"
  | "BarChart3"
  | "Users"
  | "Megaphone"
  | "CalendarCheck"
  | "ShieldCheck"
  | "Database"
  | "Lock"
  | "Headset"
  | "Building2"
  | "PlugZap"
  | "CreditCard"
  | "Settings"
  | "Radar"
  | "Plug"
  | "Inbox"
  | "Video"
  | "Upload"
  | "ClipboardList";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  roles: AppRole[];
}

const MANAGERS: AppRole[] = ["super_admin", "ops_manager"];
const MANAGERS_AND_LEADS: AppRole[] = ["super_admin", "ops_manager", "team_lead"];

// Every route here is a real, Postgres-backed screen. team_lead sees a
// scoped subset (live floor, performance, people, attendance).
export const NAV: NavItem[] = [
  { href: "/dial", label: "Dial workspace", icon: "Headset", roles: ["agent", "team_lead", "qa_analyst", ...MANAGERS] },
  { href: "/callsheet", label: "Call sheet", icon: "ClipboardList", roles: ["agent", "team_lead", ...MANAGERS] },
  { href: "/portal", label: "Reports", icon: "Building2", roles: ["client"] },
  { href: "/leadgen", label: "Lead gen", icon: "Radar", roles: ["lead_gen"] },
  { href: "/leadgen/leads", label: "Lead inbox", icon: "Inbox", roles: ["lead_gen"] },
  { href: "/leadgen/connectors", label: "Connectors", icon: "Plug", roles: ["lead_gen"] },
  { href: "/quality", label: "QA queue", icon: "ShieldCheck", roles: ["qa_analyst"] },
  { href: "/meetings", label: "Meetings", icon: "Video", roles: ["super_admin", "ops_manager", "team_lead", "agent"] },
  { href: "/live", label: "Live floor", icon: "Activity", roles: MANAGERS_AND_LEADS },
  { href: "/performance", label: "Performance", icon: "BarChart3", roles: ["agent", ...MANAGERS_AND_LEADS] },
  { href: "/admin/people", label: "People", icon: "Users", roles: MANAGERS_AND_LEADS },
  { href: "/admin/campaigns", label: "Campaigns", icon: "Megaphone", roles: MANAGERS },
  { href: "/admin/leads", label: "Leads", icon: "Inbox", roles: MANAGERS },
  { href: "/admin/attendance", label: "Attendance", icon: "CalendarCheck", roles: MANAGERS_AND_LEADS },
  { href: "/admin/compliance", label: "Compliance", icon: "ShieldCheck", roles: MANAGERS },
  { href: "/admin/import", label: "Upload leads", icon: "Upload", roles: MANAGERS },
  { href: "/admin/data", label: "Data", icon: "Database", roles: MANAGERS },
  { href: "/quality", label: "Quality", icon: "ShieldCheck", roles: MANAGERS },
  { href: "/portal", label: "Client reports", icon: "Building2", roles: MANAGERS },
  { href: "/admin/integrations", label: "Integrations", icon: "PlugZap", roles: MANAGERS },
  { href: "/admin/settings/branding", label: "Settings", icon: "Settings", roles: MANAGERS },
  { href: "/admin/security", label: "Security & audit", icon: "Lock", roles: ["super_admin"] },
  { href: "/admin/billing", label: "Agents & billing", icon: "CreditCard", roles: ["super_admin"] },
];

export function navFor(role: AppRole): NavItem[] {
  return NAV.filter((item) => item.roles.includes(role));
}

export function homeFor(role: AppRole): string {
  switch (role) {
    case "agent":
      return "/dial";
    case "client":
      return "/portal";
    case "lead_gen":
      return "/leadgen";
    case "qa_analyst":
      return "/quality";
    default:
      return "/live";
  }
}

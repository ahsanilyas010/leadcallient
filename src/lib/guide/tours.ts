import type { AppRole } from "@/lib/nav";

// One step of a product tour. `target` is the value of a `data-tour`
// attribute: sidebar links use their route (data-tour="/admin/people"), header
// controls use a name (data-tour="clock-in"). A step with no target, or whose
// target is not on screen (for example the sidebar on a phone), is shown as a
// centred card instead.
export interface TourStep {
  id: string;
  target?: string;
  title: string;
  body: string;
  // Only show this step to these roles (default: every role that has the tour).
  roles?: AppRole[];
}

const MANAGER: AppRole[] = ["super_admin", "ops_manager"];

const MANAGER_STEPS: TourStep[] = [
  {
    id: "live",
    target: "/live",
    title: "Live floor",
    body: "See who is clocked in, who is on a call and how many calls and connects your team has made today. Start here every morning.",
  },
  {
    id: "performance",
    target: "/performance",
    title: "Performance",
    body: "Leaderboards and trends for calls, connects and results. Use it to spot who needs coaching and which campaigns are working.",
  },
  {
    id: "people",
    target: "/admin/people",
    title: "People",
    body: "Add agents, team leads, QA analysts and clients. You create the account and share a one-time password, then they sign in.",
  },
  {
    id: "campaigns",
    target: "/admin/campaigns",
    title: "Campaigns",
    body: "A campaign is one calling project: its leads, script, calling hours and the agents working it. Create one before you upload leads.",
  },
  {
    id: "attendance",
    target: "/admin/attendance",
    title: "Attendance",
    body: "Shifts, clock-ins, breaks and leave requests. Approve time off and see who was late.",
  },
  {
    id: "compliance",
    target: "/admin/compliance",
    title: "Compliance",
    body: "Screen leads against do-not-call lists and your own suppression list before anyone dials them, and keep a record that you did.",
  },
  {
    id: "import",
    target: "/admin/import",
    title: "Upload leads",
    body: "Bring in a CSV or Excel file, match its columns to name, phone, company and email, and check the result before it is saved. You can also call the leads yourself.",
  },
  {
    id: "dial",
    target: "/dial",
    title: "Dial workspace",
    body: "Managers can dial too: put yourself on a campaign's roster (or tick 'I will call these myself' when you upload) and your screened leads appear here.",
  },
  {
    id: "data",
    target: "/admin/data",
    title: "Data",
    body: "Upload lead lists from a CSV or Excel file and see where your leads come from. Leads land in a campaign, ready to be screened.",
  },
  {
    id: "quality",
    target: "/quality",
    title: "Quality",
    body: "Listen back to recorded calls, score them against a checklist and give agents feedback.",
  },
  {
    id: "reports",
    target: "/portal",
    title: "Client reports",
    body: "Share results with the companies you call for. Clients sign in to a read-only view of their own campaigns.",
  },
  {
    id: "integrations",
    target: "/admin/integrations",
    title: "Integrations",
    body: "Check which services are connected, such as email sending and the lead webhook, and what still needs setting up.",
  },
  {
    id: "settings",
    target: "/admin/settings/branding",
    title: "Settings",
    body: "Your logo and colour, Zoom connection, email templates and lead fields. Connect Zoom here so agents can call from the browser.",
  },
  {
    id: "security",
    target: "/admin/security",
    title: "Security and audit",
    body: "A record of who changed what and when, for your own peace of mind and for audits.",
    roles: ["super_admin"],
  },
  {
    id: "billing",
    target: "/admin/billing",
    title: "Plan and billing",
    body: "See your plan and agent seats, and add seats when your team grows.",
    roles: ["super_admin"],
  },
  {
    id: "clock",
    target: "clock-in",
    title: "Clock in",
    body: "Managers can clock in too. Agents use this to start their shift, take breaks and finish for the day.",
  },
  {
    id: "search",
    target: "search",
    title: "Jump to anything",
    body: "Press Ctrl K (or click here) and type a page name to go straight there.",
  },
  {
    id: "setup-guide",
    target: "setup-guide",
    title: "Your setup guide",
    body: "A short checklist: connect Zoom, add your agents, create a campaign, add leads and make your first call. Come back to it any time, and replay this tour from here.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Your account",
    body: "Request leave or sign out. Replay this tour any time from the help button next to it.",
  },
];

const TEAM_LEAD_STEPS: TourStep[] = [
  {
    id: "live",
    target: "/live",
    title: "Live floor",
    body: "See who on your floor is available, on a call or on a break, right now.",
  },
  {
    id: "performance",
    target: "/performance",
    title: "Performance",
    body: "How your team is doing: calls, connects and results by person. Use it for coaching conversations.",
  },
  {
    id: "people",
    target: "/admin/people",
    title: "People",
    body: "Your team members and their details.",
  },
  {
    id: "attendance",
    target: "/admin/attendance",
    title: "Attendance",
    body: "Who clocked in, who is on break and any leave requests from your team.",
  },
  {
    id: "clock",
    target: "clock-in",
    title: "Clock in",
    body: "Start your shift here, and take breaks or clock out when you finish.",
  },
  {
    id: "bell",
    target: "callbacks",
    title: "Callbacks",
    body: "People who asked to be called back at a set time show up here, so nobody is forgotten.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Your account",
    body: "Request leave or sign out. Replay this tour from the help button next to it.",
  },
];

const AGENT_STEPS: TourStep[] = [
  {
    id: "dial",
    target: "/dial",
    title: "Dial workspace",
    body: "This is where you make calls. The next lead appears, you call, then pick the outcome. Start every shift here.",
  },
  {
    id: "leads",
    target: "/callsheet",
    title: "Call sheet",
    body: "Every lead you can call, in one board with a column per campaign. Overdue and upcoming ones sit at the top; press a green bar to dial it.",
  },
  {
    id: "meetings",
    target: "/meetings",
    title: "Meetings",
    body: "Video meetings you have booked with prospects. Join or schedule them from here.",
  },
  {
    id: "clock",
    target: "clock-in",
    title: "Clock in",
    body: "Clock in before you start dialling. You can also take a break or clock out here.",
  },
  {
    id: "bell",
    target: "callbacks",
    title: "Callbacks",
    body: "When a lead asks you to call back later, it appears under this bell at the right time.",
  },
  {
    id: "phone",
    title: "Your phone",
    body: "On the Dial workspace a Zoom phone panel opens at the corner of the screen. Calls are placed and answered there, in your browser.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Your account",
    body: "Request leave or sign out. Replay this tour from the help button next to it.",
  },
];

const LEAD_GEN_STEPS: TourStep[] = [
  {
    id: "dashboard",
    target: "/leadgen",
    title: "Lead gen dashboard",
    body: "How many leads you have sent in and what happened to them.",
  },
  {
    id: "inbox",
    target: "/leadgen/leads",
    title: "Lead inbox",
    body: "Every lead you have supplied. Upload a file or add leads here and see which ones were accepted.",
  },
  {
    id: "connectors",
    target: "/leadgen/connectors",
    title: "Connectors",
    body: "Connect a form or ad platform so new leads arrive here automatically.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Your account",
    body: "Sign out here. Replay this tour from the help button next to it.",
  },
];

const QA_STEPS: TourStep[] = [
  {
    id: "queue",
    target: "/quality",
    title: "QA queue",
    body: "Calls waiting to be reviewed. Open one to listen, score it and leave feedback for the agent.",
  },
  {
    id: "clock",
    target: "clock-in",
    title: "Clock in",
    body: "Start and end your shift here.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Your account",
    body: "Request leave or sign out. Replay this tour from the help button next to it.",
  },
];

const CLIENT_STEPS: TourStep[] = [
  {
    id: "reports",
    target: "/portal",
    title: "Your reports",
    body: "Results for the campaigns we run for you: calls made, leads reached and outcomes. Open a report to see the detail.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Your account",
    body: "Sign out here. Replay this tour from the help button next to it.",
  },
];

// The Data-only seat: data screens only, never calling.
const DATA_STEPS: TourStep[] = [
  {
    id: "leads",
    target: "/admin/leads",
    title: "Leads",
    body: "Every lead and contact in one place. Filter, tag, put on lists, edit in bulk, hand to agents, export, or delete to the trash.",
  },
  {
    id: "upload",
    target: "/admin/import",
    title: "Upload leads",
    body: "Bring in a CSV or Excel file and match its columns. Save the mapping and the next file like it takes one click.",
  },
  {
    id: "migrate",
    target: "/admin/migrate",
    title: "Migrate from a CRM",
    body: "Move a whole CRM across: map stages and owners, run a small test, then the rest.",
  },
  {
    id: "data",
    target: "/admin/data",
    title: "Data",
    body: "Where each list came from, import history (undo an import for 7 days) and how each source performs.",
  },
  {
    id: "profile",
    target: "profile",
    title: "Your account",
    body: "Sign out here. Replay this tour from the help button next to it.",
  },
];

export function tourFor(role: AppRole): TourStep[] {
  switch (role) {
    case "super_admin":
    case "ops_manager":
      return MANAGER_STEPS.filter((s) => !s.roles || s.roles.includes(role));
    case "team_lead":
      return TEAM_LEAD_STEPS;
    case "agent":
      return AGENT_STEPS;
    case "lead_gen":
      return LEAD_GEN_STEPS;
    case "qa_analyst":
      return QA_STEPS;
    case "client":
      return CLIENT_STEPS;
    case "data_manager":
      return DATA_STEPS;
    default:
      return [];
  }
}

export function isManagerRole(role: AppRole): boolean {
  return MANAGER.includes(role);
}

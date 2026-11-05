import type { RealEnums } from "@/lib/supabase/real-types";

export type AppRole = RealEnums<"app_role">;

// Every seeded demo account signs in with this same password (spec: "the
// demo has no passwords" in spirit — one shared, publicly-documented one
// instead). Deliberately not a secret; shown on /login next to the account
// list, same as the pre-Supabase demo build did.
export const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "LeadCallient@123";

export interface DemoPersonaSeed {
  email: string;
  fullName: string;
  role: AppRole;
  title: string;
  blurb: string;
}

// One persona per role, mirroring the pre-Supabase demo's persona list
// (src/lib/demo/seed.ts, now deleted) with role values reconciled to the
// spec's exact names (qa -> qa_analyst, client_viewer -> client).
export const DEMO_PERSONAS: DemoPersonaSeed[] = [
  {
    email: "admin@leadcallient.demo",
    fullName: "Jordan Blake",
    role: "super_admin",
    title: "Super admin",
    blurb: "Full control: live floor, campaigns, people, compliance and billing.",
  },
  {
    email: "ops@leadcallient.demo",
    fullName: "Priya Shah",
    role: "ops_manager",
    title: "Operations manager",
    blurb: "Runs campaigns, assigns data and tracks performance.",
  },
  {
    email: "teamlead@leadcallient.demo",
    fullName: "Sam Carter",
    role: "team_lead",
    title: "Team lead",
    blurb: "Watches the live floor and coaches their team.",
  },
  {
    email: "agent@leadcallient.demo",
    fullName: "Alex Rivera",
    role: "agent",
    title: "Sales agent",
    blurb: "Dials leads, logs outcomes and manages callbacks.",
  },
  {
    email: "leadgen@leadcallient.demo",
    fullName: "Riley Chen",
    role: "lead_gen",
    title: "Lead generation",
    blurb: "Finds and loads leads, connects Zapier, and hands them to sales.",
  },
  {
    email: "qa@leadcallient.demo",
    fullName: "Morgan Lee",
    role: "qa_analyst",
    title: "Quality analyst",
    blurb: "Scores recorded calls against the QA scorecard.",
  },
  {
    email: "client@leadcallient.demo",
    fullName: "Taylor Brooks",
    role: "client",
    title: "Client viewer",
    blurb: "Read-only client portal: funnel, outcomes and reports.",
  },
];

export const DEMO_ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super admin",
  ops_manager: "Ops manager",
  team_lead: "Team lead",
  agent: "Sales agent",
  lead_gen: "Lead gen",
  qa_analyst: "QA",
  client: "Client",
  data_manager: "Data-only",
};

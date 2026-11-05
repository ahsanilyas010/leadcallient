// Accounts = real customer sign-ups (as opposed to the seeded demo
// personas). A sign-up creates a Workspace (the customer's company) and a
// Member (the person, as its super admin). Members the owner adds later
// get their own logins in the same workspace.
//
// Identity now lives in real Postgres (workspaces/profiles, see
// supabase/migrations/00000000000039_workspaces.sql and
// 00000000000040_identity_and_org.sql) via Supabase Auth, not Firebase.
// These types are kept stable on purpose — src/lib/accounts/adapters.ts
// maps real rows onto this exact shape, so the ~40 existing CRM action
// files and pages built against it never needed to change.

export type Role = "super_admin" | "ops_manager" | "team_lead" | "agent" | "lead_gen" | "qa_analyst" | "client" | "data_manager";

export type Plan = "free" | "paid";

export interface SignupSource {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  referrer?: string;
  landing_path?: string;
  team_size?: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerUid: string;
  plan: Plan;
  // How many active agents the workspace may have. 3 on the free plan; the
  // purchased quantity once they upgrade.
  agentSeats: number;
  billingStatus: "none" | "active" | "past_due" | "canceled";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  teamSize?: string | null;
  phone?: string | null;
  signup?: SignupSource;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandProductName?: string | null;
  isDemo?: boolean;
  createdAt: string;
}

export interface Member {
  uid: string;
  workspaceId: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

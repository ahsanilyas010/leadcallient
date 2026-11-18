// Who may use a workspace. The free plan is now a 30-day trial for 3 agents;
// when it runs out, access closes until the owner approves the company (after
// the customer has paid). Pure functions, no I/O: shared by the signed-in
// gate, the banner, the cron that sends the 2-day notice and the owner console.

import { isUnlimitedSeats } from "./plan";

const DAY = 86_400_000;

// How long a new workspace's trial runs. The database default
// (workspaces.trial_ends_at) must match.
export const TRIAL_DAYS = 30;

// Customers are told this many days before their access closes.
export const NOTICE_DAYS = 2;

export interface AccessInput {
  isDemo: boolean;
  seatLimit: number;
  // A live Stripe subscription (card payers). Setting a price in the owner
  // console flips workspaces.plan but does not grant access by itself.
  hasSubscription: boolean;
  trialEndsAt: string | null;
  // Set by the owner console when the company is approved to continue.
  accessApprovedAt: string | null;
}

export type FullReason = "demo" | "unlimited" | "approved" | "subscription" | "no_trial";

export type AccessState =
  | { kind: "full"; reason: FullReason }
  | { kind: "trial"; daysLeft: number; endsAt: string }
  | { kind: "locked"; endedAt: string };

export function accessState(w: AccessInput, now = Date.now()): AccessState {
  if (w.isDemo) return { kind: "full", reason: "demo" };
  if (isUnlimitedSeats(w.seatLimit)) return { kind: "full", reason: "unlimited" };
  if (w.accessApprovedAt) return { kind: "full", reason: "approved" };
  if (w.hasSubscription) return { kind: "full", reason: "subscription" };
  if (!w.trialEndsAt) return { kind: "full", reason: "no_trial" };
  const end = Date.parse(w.trialEndsAt);
  if (Number.isNaN(end)) return { kind: "full", reason: "no_trial" };
  if (end > now) return { kind: "trial", daysLeft: Math.ceil((end - now) / DAY), endsAt: w.trialEndsAt };
  return { kind: "locked", endedAt: w.trialEndsAt };
}

export function isLocked(state: AccessState): state is Extract<AccessState, { kind: "locked" }> {
  return state.kind === "locked";
}

// Show the "your trial is ending" strip from this many days out. The notice
// to existing customers (NOTICE_DAYS) is always inside it.
export const BANNER_DAYS = 7;

export function shouldWarn(state: AccessState): state is Extract<AccessState, { kind: "trial" }> {
  return state.kind === "trial" && state.daysLeft <= BANNER_DAYS;
}

// "Trial · 12 days left", for the plan bar.
export function trialPlanLabel(state: AccessState): string | null {
  if (state.kind !== "trial") return null;
  return `Trial · ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left`;
}

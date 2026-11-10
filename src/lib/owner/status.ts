// Pure rules the owner console uses to label companies. No I/O, so they are
// unit-tested (status.test.ts) and shared by pages, exports and the overview.

const DAY = 86_400_000;

export type TrialState =
  | { kind: "none" }
  | { kind: "paying" }
  | { kind: "trialing"; daysLeft: number }
  | { kind: "expired"; daysAgo: number };

// A company that has paid at least once counts as paying, whatever its trial
// date says. Without a trial date (demo, the vendor's own) there is no trial.
export function trialState(trialEndsAt: string | null, paidTotal: number, now = Date.now()): TrialState {
  if (paidTotal > 0) return { kind: "paying" };
  if (!trialEndsAt) return { kind: "none" };
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return { kind: "none" };
  if (end > now) return { kind: "trialing", daysLeft: Math.ceil((end - now) / DAY) };
  return { kind: "expired", daysAgo: Math.floor((now - end) / DAY) };
}

export function trialLabel(t: TrialState): string {
  switch (t.kind) {
    case "none":
      return "No trial";
    case "paying":
      return "Paying";
    case "trialing":
      return `Trial · ${t.daysLeft} day${t.daysLeft === 1 ? "" : "s"} left`;
    case "expired":
      return t.daysAgo === 0 ? "Trial ended today" : `Trial ended ${t.daysAgo} day${t.daysAgo === 1 ? "" : "s"} ago`;
  }
}

export type BillingState =
  | { kind: "not_set" }
  | { kind: "settled" }
  | { kind: "current"; dueInDays: number | null }
  | { kind: "due_soon"; dueInDays: number }
  | { kind: "overdue"; daysOverdue: number };

// balance > 0 means money is owed. A due date in the past with a balance
// owing is overdue; within 7 days is due soon.
export function billingState(
  balance: number,
  nextDueDate: string | null,
  billingAmount: number | null,
  now = Date.now(),
): BillingState {
  const today = startOfUtcDay(now);
  const due = nextDueDate ? Date.parse(`${nextDueDate}T00:00:00Z`) : NaN;
  const dueIn = Number.isNaN(due) ? null : Math.round((due - today) / DAY);
  if (balance > 0) {
    if (dueIn !== null && dueIn < 0) return { kind: "overdue", daysOverdue: -dueIn };
    if (dueIn !== null && dueIn <= 7) return { kind: "due_soon", dueInDays: dueIn };
    return { kind: "current", dueInDays: dueIn };
  }
  if (billingAmount === null || billingAmount === 0) return balance < 0 || billingAmount === 0 ? { kind: "settled" } : { kind: "not_set" };
  if (dueIn !== null && dueIn <= 7) return { kind: "due_soon", dueInDays: Math.max(dueIn, 0) };
  return { kind: "settled" };
}

export function billingLabel(b: BillingState): string {
  switch (b.kind) {
    case "not_set":
      return "No price set";
    case "settled":
      return "Paid up";
    case "current":
      return b.dueInDays === null ? "Balance owing" : `Due in ${b.dueInDays} days`;
    case "due_soon":
      return b.dueInDays === 0 ? "Due today" : `Due in ${b.dueInDays} day${b.dueInDays === 1 ? "" : "s"}`;
    case "overdue":
      return `Overdue ${b.daysOverdue} day${b.daysOverdue === 1 ? "" : "s"}`;
  }
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export type BillingCycle = "monthly" | "quarterly" | "yearly";

export function monthlyValue(amount: number | null, cycle: string): number {
  if (!amount) return 0;
  if (cycle === "yearly") return amount / 12;
  if (cycle === "quarterly") return amount / 3;
  return amount;
}

// Moves a due date forward by one billing cycle (used after recording a
// payment). Month arithmetic clamps to the last day of shorter months.
export function advanceDueDate(date: string, cycle: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const months = cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export type AttentionFlag =
  | "trial_ending"
  | "trial_expired"
  | "overdue"
  | "inactive"
  | "never_called"
  | "seats_full"
  | "suspended";

export const ATTENTION_LABEL: Record<AttentionFlag, string> = {
  trial_ending: "Trial ends within 7 days",
  trial_expired: "Trial expired, not paying",
  overdue: "Payment overdue",
  inactive: "No calls in 7 days",
  never_called: "Never made a call",
  seats_full: "All agent seats in use",
  suspended: "Suspended",
};

export interface AttentionInput {
  status: string;
  isDemo: boolean;
  trial: TrialState;
  billing: BillingState;
  callsTotal: number;
  calls7d: number;
  createdAt: string;
  agentsActive: number;
  seatLimit: number;
}

// Why a company might need the owner's attention, most urgent first.
export function attentionFlags(c: AttentionInput, now = Date.now()): AttentionFlag[] {
  if (c.isDemo) return [];
  const flags: AttentionFlag[] = [];
  if (c.status === "suspended") flags.push("suspended");
  if (c.billing.kind === "overdue") flags.push("overdue");
  if (c.trial.kind === "expired") flags.push("trial_expired");
  if (c.trial.kind === "trialing" && c.trial.daysLeft <= 7) flags.push("trial_ending");
  const ageDays = (now - new Date(c.createdAt).getTime()) / DAY;
  if (c.callsTotal === 0 && ageDays >= 3) flags.push("never_called");
  else if (c.callsTotal > 0 && c.calls7d === 0) flags.push("inactive");
  if (c.seatLimit < 2147483647 && c.agentsActive >= c.seatLimit && c.seatLimit > 0) flags.push("seats_full");
  return flags;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function fmtMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

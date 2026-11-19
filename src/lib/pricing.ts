// Published pricing: the single source for the website, the billing and
// trial-ended pages, the notice email and the owner console's suggested price.
// Pure, no I/O (unit-tested in pricing.test.ts).
//
// Graduated per-agent pricing with a 3-agent minimum: every workspace pays at
// least the Basic price after its free trial, and each extra agent costs less
// than the one before, so a bill never drops when an agent is added.

export const PRICING = {
  currency: "USD",
  // Basic: flat price that includes the first 3 agents (also the minimum).
  basePrice: 150,
  includedAgents: 3,
  // Agents 4 to 10.
  growthPerAgent: 40,
  growthMax: 10,
  // Agents 11 to 25.
  scalePerAgent: 35,
  scaleMax: 25,
  // Above scaleMax the price is agreed with sales.
  enterpriseFromPerAgent: 30,
  dataSeat: 15,
  // Annual prepay: pay for this many months, get 12.
  annualMonthsCharged: 10,
} as const;

export type PlanName = "Basic" | "Growth" | "Scale" | "Enterprise";

export interface Quote {
  plan: PlanName;
  agents: number;
  // null for Enterprise: priced with sales.
  monthly: number | null;
  annual: number | null;
}

export function planFor(agents: number): PlanName {
  if (agents <= PRICING.includedAgents) return "Basic";
  if (agents <= PRICING.growthMax) return "Growth";
  if (agents <= PRICING.scaleMax) return "Scale";
  return "Enterprise";
}

// What a workspace with this many agent seats pays per month.
export function quote(agents: number): Quote {
  const n = Math.max(0, Math.floor(agents));
  const plan = planFor(n);
  if (plan === "Enterprise") return { plan, agents: n, monthly: null, annual: null };
  const growth = Math.max(0, Math.min(n, PRICING.growthMax) - PRICING.includedAgents);
  const scale = Math.max(0, n - PRICING.growthMax);
  const monthly = PRICING.basePrice + growth * PRICING.growthPerAgent + scale * PRICING.scalePerAgent;
  return { plan, agents: n, monthly, annual: monthly * PRICING.annualMonthsCharged };
}

export function usd(amount: number): string {
  return "$" + amount.toLocaleString("en-US");
}

// "$150 per month for up to 3 agents"
export function basicPriceLine(): string {
  return usd(PRICING.basePrice) + " per month for up to " + PRICING.includedAgents + " agents";
}

// "$230 per month (Growth, 5 agents)" or "priced with our team (Enterprise, 40 agents)"
export function quoteLine(agents: number): string {
  const q = quote(agents);
  if (q.monthly === null) return "priced with our team (" + q.plan + ", " + q.agents + " agents)";
  if (q.plan === "Basic") return basicPriceLine();
  return usd(q.monthly) + " per month (" + q.plan + ", " + q.agents + " agents)";
}

// The cards on the pricing section and the billing page.
export const PLAN_CARDS: { name: PlanName; agents: string; price: string; detail: string }[] = [
  {
    name: "Basic",
    agents: "Up to " + PRICING.includedAgents + " agents",
    price: usd(PRICING.basePrice) + "/mo",
    detail: "Flat price. The minimum plan after the free trial.",
  },
  {
    name: "Growth",
    agents: PRICING.includedAgents + 1 + " to " + PRICING.growthMax + " agents",
    price: "+" + usd(PRICING.growthPerAgent) + "/agent",
    detail: "Basic plus " + usd(PRICING.growthPerAgent) + " a month for each agent above " + PRICING.includedAgents + ".",
  },
  {
    name: "Scale",
    agents: PRICING.growthMax + 1 + " to " + PRICING.scaleMax + " agents",
    price: "+" + usd(PRICING.scalePerAgent) + "/agent",
    detail: usd(PRICING.scalePerAgent) + " a month for each agent above " + PRICING.growthMax + ".",
  },
  {
    name: "Enterprise",
    agents: PRICING.scaleMax + 1 + "+ agents",
    price: "From " + usd(PRICING.enterpriseFromPerAgent) + "/agent",
    detail: "Volume pricing agreed with our team.",
  },
];

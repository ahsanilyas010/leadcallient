// Plan limits. Prices aren't published on the site; paid seats are priced
// in Stripe (see src/lib/billing/stripe.ts) and shown at checkout.

// Agents included free on every workspace. Admins, ops managers, team
// leads, QA analysts and client logins never use a seat.
export const FREE_AGENT_SEATS = 3;

// Above this many agents, upgrades go through sales instead of checkout.
export const SELF_SERVE_MAX_AGENTS = 200;

// Sentinel seat_limit meaning "no cap": Postgres int4 max, so every
// `used >= seat_limit` comparison stays false without special-casing the
// column. Set by migration 115 for the vendor's own (Assorted) workspace
// and by the seed; display code shows it as "Unlimited" via fmtSeats.
export const UNLIMITED_SEATS = 2147483647;

export function isUnlimitedSeats(seatLimit: number): boolean {
  return seatLimit >= UNLIMITED_SEATS;
}

// "12" or "Unlimited", for every place the seat limit is shown to a human.
export function fmtSeats(seatLimit: number): string {
  return isUnlimitedSeats(seatLimit) ? "Unlimited" : String(seatLimit);
}

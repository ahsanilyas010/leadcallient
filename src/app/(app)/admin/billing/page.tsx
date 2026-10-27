import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { activeAgentCount } from "@/lib/workspace/limits";
import { workspaceFromRow } from "@/lib/accounts/adapters";
import { createRealClient } from "@/lib/supabase/real";
import { stripeConfigured } from "@/lib/billing/stripe";
import { bankTransferDetails } from "@/lib/billing/bank-transfer";
import { FREE_AGENT_SEATS, SELF_SERVE_MAX_AGENTS } from "@/lib/plan";
import { ManageBillingButton, SeatPicker } from "./seat-picker";
import { ContactCard } from "./contact-card";

export const metadata: Metadata = { title: "Agents & billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") redirect("/start");
  const { status } = await searchParams;
  const workspace = workspaceFromRow(await getCurrentWorkspace());
  const used = await activeAgentCount(await createRealClient(), workspace.id);
  const pct = Math.min(100, Math.round((used / workspace.agentSeats) * 100));
  const paid = workspace.plan === "paid";
  // "simulate" (a Stripe-less preview upgrade) no longer applies — real
  // accounts always live in Supabase now, so an unconfigured deployment is
  // just "offline" rather than a special in-memory-only mode.
  const mode = stripeConfigured() ? "stripe" : "offline";
  const bank = bankTransferDetails();
  // No payment provider: there is no self-serve price list to show. The page
  // keeps the seat count and says how to reach us to add agents.
  const selfServe = mode === "stripe";

  return (
    <div className="space-y-4 p-4">
      {status === "success" && (
        <div className="flex items-center gap-2 rounded-2xl bg-brand-green-tint px-4 py-3 text-sm text-brand-green-text ring-1 ring-brand-green/30">
          <CheckCircle2 className="h-4 w-4" /> Payment received. Your new seats are active as soon as Stripe confirms (usually a few seconds).
        </div>
      )}
      {status === "cancelled" && (
        <div className="rounded-2xl bg-canvas px-4 py-3 text-sm text-muted ring-1 ring-line">Checkout cancelled. Nothing was charged.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">{selfServe ? "Current plan" : "Your workspace"}</div>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink">{selfServe ? (paid ? "Paid" : "Free") : workspace.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {selfServe
              ? paid
                ? `${workspace.agentSeats} agent seats, billed monthly`
                : `${FREE_AGENT_SEATS} agents included, free forever`
              : `${workspace.agentSeats} agent seat${workspace.agentSeats === 1 ? "" : "s"} on this workspace`}
          </p>
          {workspace.billingStatus === "past_due" && (
            <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-xs text-danger">Your last payment failed. Update your card to keep your seats.</p>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-ink">
                <Users className="h-4 w-4 text-brand-blue" /> Agent seats used
              </span>
              <span className="font-semibold tabular text-ink">
                {used} / {workspace.agentSeats}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-canvas ring-1 ring-line">
              <div className={`h-full rounded-full ${pct >= 100 ? "bg-gold-gradient" : "bg-brand-gradient"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {used >= workspace.agentSeats
                ? selfServe
                  ? "All seats are in use. Add seats to create more agents."
                  : "All seats are in use. Contact us to add more agents."
                : `${workspace.agentSeats - used} more agent${workspace.agentSeats - used === 1 ? "" : "s"} can be added.`}
            </p>
          </div>

          {paid && workspace.stripeCustomerId && (
            <div className="mt-6">
              <ManageBillingButton />
            </div>
          )}
        </div>

        {paid && workspace.stripeCustomerId ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-muted ring-1 ring-line sm:p-8">
            <h2 className="font-display text-xl font-semibold text-ink">Changing seats</h2>
            <p className="mt-2">
              Use <span className="font-medium text-ink">Manage card, seats &amp; invoices</span> to add or remove agent seats, update your card or
              download invoices. Changes are prorated on your next bill.
            </p>
          </div>
        ) : selfServe ? (
          <SeatPicker
            min={Math.max(FREE_AGENT_SEATS + 1, used, paid ? workspace.agentSeats : 0)}
            max={SELF_SERVE_MAX_AGENTS}
            initial={Math.max(10, used + 1)}
            mode={mode}
          />
        ) : (
          <ContactCard workspaceName={workspace.name} />
        )}
      </div>

      {bank && (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">Pay by bank transfer</h2>
          <p className="mt-1 text-sm text-muted">
            Prefer not to pay by card? Transfer to the account below, use <span className="font-medium text-ink">{workspace.name}</span> as the reference,
            and we&apos;ll activate your seats once the payment arrives.
          </p>
          <dl className="mt-4 grid max-w-xl grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
            {bank.rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-muted">{r.label}</dt>
                <dd className="font-medium tabular text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
          {bank.note && <p className="mt-4 text-xs text-muted">{bank.note}</p>}
        </div>
      )}
    </div>
  );
}

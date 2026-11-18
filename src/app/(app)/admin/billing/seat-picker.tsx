"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CreditCard, Loader2, Lock, Minus, Plus } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/access";
import { openBillingPortal, simulateUpgrade, startCheckout } from "@/lib/actions/billing";

// Choose agent seats, see the monthly price, continue to card payment.
export function SeatPicker({
  min,
  max,
  initial,
  mode,
}: {
  min: number;
  max: number;
  initial: number;
  mode: "stripe" | "simulate" | "offline";
}) {
  const [seats, setSeats] = useState(Math.min(Math.max(initial, min), max));
  const [pending, start] = useTransition();
  const router = useRouter();
  const clamp = (n: number) => Math.min(Math.max(n, min), max);

  const go = () =>
    start(async () => {
      if (mode === "simulate") {
        const r = await simulateUpgrade();
        if (r.error) toast.error(r.error);
        else {
          toast.success(`Upgraded to ${seats} agent seats (preview, no payment taken).`);
          router.refresh();
        }
        return;
      }
      const r = await startCheckout(seats);
      if (r.url) window.location.assign(r.url);
      else toast.error(r.error ?? "Something went wrong.");
    });

  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
      <h2 className="font-display text-xl font-semibold text-ink">Add agent seats</h2>
      <p className="mt-1 text-sm text-muted">
        Agent seats are billed once your {TRIAL_DAYS}-day free trial ends. Admins, managers, team leads, QA and client logins never cost anything.
      </p>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center rounded-2xl ring-1 ring-line">
          <button
            type="button"
            onClick={() => setSeats((s) => clamp(s - 1))}
            disabled={seats <= min}
            className="flex h-12 w-12 cursor-pointer items-center justify-center text-ink disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Fewer seats"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={seats}
            min={min}
            max={max}
            onChange={(e) => setSeats(clamp(Number(e.target.value) || min))}
            className="h-12 w-20 border-x border-line text-center font-display text-2xl font-semibold tabular text-ink outline-none"
            aria-label="Agent seats"
          />
          <button
            type="button"
            onClick={() => setSeats((s) => clamp(s + 1))}
            disabled={seats >= max}
            className="flex h-12 w-12 cursor-pointer items-center justify-center text-ink disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="More seats"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div>
          <div className="font-display text-3xl font-semibold tabular text-ink">
            {seats}
            <span className="text-sm font-normal text-muted"> agent seats</span>
          </div>
          <div className="text-xs text-muted">
            {seats} paid agent seats
          </div>
        </div>
      </div>

      {mode === "offline" ? (
        <p className="mt-6 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted ring-1 ring-line">
          Online card payments aren&apos;t switched on yet.{" "}
          <a href="/contact" className="font-semibold text-brand-blue hover:underline">
            Contact us
          </a>{" "}
          and we&apos;ll upgrade your workspace.
        </p>
      ) : (
        <button
          type="button"
          onClick={go}
          disabled={pending}
          className="mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gold-gradient text-base font-semibold text-ink shadow-lg shadow-gold/25 hover:brightness-105 disabled:cursor-wait disabled:opacity-80 sm:w-auto sm:px-8"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
          {mode === "simulate" ? "Upgrade (preview, no payment)" : "Continue to card payment"}
          {!pending && <ArrowRight className="h-5 w-5" />}
        </button>
      )}
      {mode === "stripe" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" /> Card details are entered on Stripe&apos;s secure checkout. Billed monthly, cancel any time.
        </p>
      )}
      {mode === "simulate" && (
        <p className="mt-3 text-xs text-muted">
          Preview build: the payment gateway isn&apos;t connected, so this upgrades instantly without a card.
        </p>
      )}
    </div>
  );
}

export function ManageBillingButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await openBillingPortal();
          if (r.url) window.location.assign(r.url);
          else toast.error(r.error ?? "Something went wrong.");
        })
      }
      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas disabled:opacity-70"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Manage card, seats &amp; invoices
    </button>
  );
}

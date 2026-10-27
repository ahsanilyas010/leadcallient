"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Building2, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { resetRealDemoWorkspace } from "@/lib/actions/real-demo";

export interface PlanInfo {
  workspaceName: string;
  plan: "free" | "paid";
  agentsUsed: number;
  agentSeats: number;
  canManageBilling: boolean;
  // True only for the real, Postgres-backed "demo" workspace signed into
  // via NEXT_PUBLIC_DEMO_MODE's role switcher (Phase 9) — never for a
  // real customer, and never the legacy sales-demo (which renders DemoBar
  // instead of this component entirely).
  isRealDemo?: boolean;
  // False when no payment provider is configured: there is no self-serve plan to
  // show, so the bar offers "Contact us" (phone / WhatsApp) instead of Upgrade.
  billingReady?: boolean;
}

// Strip above the header for customer workspaces (the sales demo shows
// DemoBar instead): workspace name, plan and agent seats, with an upgrade
// link — plus a reset button when this *is* the real demo workspace.
export function PlanBar({ info }: { info: PlanInfo }) {
  const full = info.agentsUsed >= info.agentSeats;
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 bg-midnight-gradient px-3 text-xs text-white">
      <div className="flex min-w-0 items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-soft" />
        <span className="truncate font-medium">{info.workspaceName}</span>
        {info.billingReady !== false && <span className="hidden text-white/60 sm:inline">· {info.plan === "free" ? "Free plan" : "Paid plan"}</span>}
        {info.isRealDemo && <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Demo mode</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={full ? "text-gold-soft" : "text-white/75"}>
          {info.agentsUsed} of {info.agentSeats} agents
        </span>
        {info.isRealDemo && (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await resetRealDemoWorkspace(); })}
            className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 ring-1 ring-white/25 hover:bg-white/25 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Reset data
          </button>
        )}
        {info.canManageBilling && (
          <Link
            href={info.billingReady === false && info.plan === "free" ? "/contact" : "/admin/billing"}
            className="inline-flex items-center gap-1 rounded-md bg-gold-gradient px-2 py-0.5 font-semibold text-ink hover:brightness-105"
          >
            <Sparkles className="h-3 w-3" />{" "}
            {info.plan !== "free" ? "Billing" : info.billingReady === false ? "Contact us" : "Upgrade"}
          </Link>
        )}
      </div>
    </div>
  );
}

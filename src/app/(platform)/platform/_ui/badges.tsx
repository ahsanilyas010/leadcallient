import { Badge } from "@/components/ui/badge";
import { ATTENTION_LABEL, billingLabel, trialLabel, type AttentionFlag, type BillingState, type TrialState } from "@/lib/owner/status";

export function TrialBadge({ trial }: { trial: TrialState }) {
  const variant =
    trial.kind === "paying" ? "confirm" : trial.kind === "expired" ? "danger" : trial.kind === "trialing" ? (trial.daysLeft <= 7 ? "warning" : "blue") : "neutral";
  return <Badge variant={variant}>{trialLabel(trial)}</Badge>;
}

export function BillingBadge({ billing }: { billing: BillingState }) {
  const variant =
    billing.kind === "overdue" ? "danger" : billing.kind === "due_soon" ? "warning" : billing.kind === "settled" ? "confirm" : billing.kind === "current" ? "blue" : "neutral";
  return <Badge variant={variant}>{billingLabel(billing)}</Badge>;
}

export function StatusBadge({ status, isDemo }: { status: string; isDemo?: boolean }) {
  const variant = status === "active" ? "confirm" : status === "suspended" ? "danger" : status === "canceled" ? "neutral" : "blue";
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={variant} className="capitalize">
        {status}
      </Badge>
      {isDemo && <Badge variant="gold">Demo</Badge>}
    </span>
  );
}

export function FlagBadges({ flags }: { flags: AttentionFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} variant={f === "overdue" || f === "trial_expired" || f === "suspended" ? "danger" : "warning"}>
          {ATTENTION_LABEL[f]}
        </Badge>
      ))}
    </span>
  );
}

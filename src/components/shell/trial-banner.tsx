import Link from "next/link";
import { Clock, Phone } from "lucide-react";
import { BILLING } from "@/lib/brand";
import { NOTICE_DAYS } from "@/lib/access";
import { fmtDate } from "@/lib/format";

// The notice that comes before access closes: shown under the plan bar to
// everyone in the workspace during the last week of the trial, and in the
// "urgent" colours for the final NOTICE_DAYS days.
export function TrialBanner({ daysLeft, endsAt, canManageBilling }: { daysLeft: number; endsAt: string; canManageBilling: boolean }) {
  const urgent = daysLeft <= NOTICE_DAYS;
  const when = daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs ring-1 ring-inset ${
        urgent ? "bg-danger-tint text-danger ring-danger/20" : "bg-gold/10 text-ink ring-gold/30"
      }`}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        Your free trial ends {when} ({fmtDate(endsAt)})
      </span>
      <span className="min-w-0 flex-1">
        After that, access is paused until we approve your company.{" "}
        {canManageBilling ? "Pay by bank transfer and send us the receipt to keep going." : "Ask your workspace admin to arrange payment."}
      </span>
      <span className="flex shrink-0 items-center gap-3 font-semibold">
        <a href={`tel:${BILLING.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 hover:underline">
          <Phone className="h-3.5 w-3.5" /> {BILLING.phone}
        </a>
        {canManageBilling && (
          <Link href="/admin/billing" className="underline underline-offset-2">
            How to pay
          </Link>
        )}
      </span>
    </div>
  );
}

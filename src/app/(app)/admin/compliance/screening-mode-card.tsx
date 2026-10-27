"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { setRequireScreening } from "@/lib/actions/compliance";
import { Switch } from "@/components/ui/switch";

// Screening is optional. This switch decides whether a lead has to pass
// screening before anyone can dial it. The suppression (do-not-call) list
// blocks a number either way.
export function ScreeningModeCard({ required, canManage }: { required: boolean; canManage: boolean }) {
  const [on, setOn] = useState(required);
  const [busy, startTransition] = useTransition();

  function change(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const r = await setRequireScreening(next);
      if (r.error) {
        setOn(!next);
        toast.error(r.error);
        return;
      }
      toast.success(next ? "Leads now have to pass screening before they can be dialled." : "Screening is optional: leads can be dialled as soon as they are uploaded.");
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm" data-testid="screening-mode">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? "bg-brand-blue-tint text-brand-blue" : "bg-canvas text-muted"}`}>
          {on ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">Require screening before dialing</div>
          <p className="mt-0.5 text-xs text-muted">
            {on
              ? "On: a lead can only be dialled after it has passed screening. Use this when your market needs a TPS, DNC or similar check before every call."
              : "Off: leads can be dialled as soon as they are uploaded and assigned. Screening stays available here for anyone who wants to run it, and the suppression list still blocks numbers."}
          </p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <span className="text-xs text-muted">{on ? "Required" : "Optional"}</span>}
        <Switch checked={on} onCheckedChange={change} disabled={!canManage || busy} aria-label="Require screening before dialing" />
      </label>
    </div>
  );
}

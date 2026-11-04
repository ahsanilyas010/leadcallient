"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { setRequireScreening } from "@/lib/actions/compliance";
import { SettingToggle } from "@/components/ui/setting-toggle";

// Screening is optional. This switch decides whether a lead has to pass
// screening before anyone can dial it (a campaign can override it on its own
// page). The suppression (do-not-call) list blocks a number either way.
// Turning it off is a big change, so it asks first.
export function ScreeningModeCard({ required, canManage }: { required: boolean; canManage: boolean }) {
  const router = useRouter();
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-line bg-white px-4 shadow-sm" data-testid="screening-mode">
      <span className={`mt-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${required ? "bg-brand-blue-tint text-brand-blue" : "bg-canvas text-muted"}`}>
        {required ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <SettingToggle
          label="Require screening before dialing"
          description={
            required
              ? "On: a lead can only be dialled after it has passed screening. Use this when your market needs a TPS, DNC or similar check before every call. Campaigns can set their own rule on their page."
              : "Off: leads can be dialled as soon as they are uploaded and assigned. Screening stays available here for anyone who wants to run it, and the suppression list still blocks numbers. Campaigns can set their own rule on their page."
          }
          checked={required}
          onLabel="Required"
          offLabel="Optional"
          disabled={!canManage}
          disabledReason={!canManage ? "Only an admin or ops manager can change this." : undefined}
          confirm={{
            when: "off",
            title: "Stop requiring screening?",
            body: "Leads that haven't been screened become dialable straight away, in every campaign that follows this setting. Numbers on your suppression list stay blocked. Only do this if your market doesn't need a TPS, DNC or similar check before each call.",
            confirmLabel: "Stop requiring it",
          }}
          onSave={async (on) => {
            const r = await setRequireScreening(on);
            if (!r.error) router.refresh();
            return r;
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { clockIn, clockOut, startBreak, endBreak } from "@/lib/actions/attendance-v2";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { RealTables } from "@/lib/supabase/real-types";

type EventType = RealTables<"attendance_events">["event_type"];

// The header's clock-in control. State is derived from the user's latest
// attendance_events row: no event or clock_out = offline, break_start = away
// (on a break), anything else = available. While clocked in, availability is
// an on/off switch that saves as soon as it is flipped.
export function AttendanceControl({ initialEvent }: { initialEvent: EventType | null }) {
  const [last, setLast] = useState<EventType | null>(initialEvent);
  const [pending, startTransition] = useTransition();

  const offline = last === null || last === "clock_out";
  const onBreak = last === "break_start";

  function run(action: () => Promise<{ error?: string }>, next: EventType, message: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      setLast(next);
    });
  }

  const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin" />;

  if (offline) {
    return (
      <Button size="sm" onClick={() => run(clockIn, "clock_in", "Clocked in")} disabled={pending}>
        {pending ? spinner : <LogIn className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Clock in</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1" data-testid="availability-toggle">
        <label htmlFor="availability" className={`text-xs font-medium ${onBreak ? "text-muted" : "text-brand-blue"}`}>
          {pending ? spinner : onBreak ? "Away" : "Available"}
        </label>
        <Switch
          id="availability"
          checked={!onBreak}
          disabled={pending}
          aria-label={onBreak ? "You are away. Switch on to show as available." : "You are available. Switch off to show as away (on a break)."}
          onCheckedChange={(available) =>
            available
              ? run(endBreak, "break_end", "Saved: you're available.")
              : run(startBreak, "break_start", "Saved: you're away (on a break).")
          }
        />
      </div>
      <Button size="sm" variant="secondary" onClick={() => run(clockOut, "clock_out", "Clocked out")} disabled={pending}>
        {pending ? spinner : <LogOut className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Clock out</span>
      </Button>
    </div>
  );
}

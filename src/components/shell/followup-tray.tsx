"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Clock, Check, AlarmClock, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMyCallbacks, snoozeCallback, completeCallback, cancelCallback, type CallbackRow } from "@/lib/actions/callbacks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtDateTime } from "@/lib/format";

// remind: show an in-app reminder when one of my callbacks falls due (the
// "Callback reminders" setting under My settings; on unless switched off).
export function FollowupTray({ userId, initial, remind = true }: { userId: string; initial: CallbackRow[]; remind?: boolean }) {
  const [followups, setFollowups] = useState(initial);
  const router = useRouter();
  // Callbacks already reminded about in this tab, so each is announced once.
  const reminded = useRef<Set<string>>(new Set());

  async function refresh() {
    setFollowups(await getMyCallbacks());
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`followups-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "callbacks", filter: `agent_id=eq.${userId}` },
        () => {
          refresh();
        },
      )
      .subscribe();

    const interval = setInterval(refresh, 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId]);

  // Check every 20 seconds for callbacks that have just come due.
  useEffect(() => {
    if (!remind) return;
    const check = () => {
      const now = Date.now();
      for (const f of followups) {
        const due = Date.parse(f.due_at);
        // Due now, or in the next minute; ones overdue by more than a day were
        // missed long ago and aren't announced again.
        if (reminded.current.has(f.id) || due > now + 60_000 || due < now - 24 * 60 * 60_000) continue;
        reminded.current.add(f.id);
        const who = f.leads?.full_name || f.leads?.phone_e164 || "a lead";
        toast(`Callback due: ${who}`, {
          description: `Due ${fmtDateTime(f.due_at)}. It is first in your dial queue.`,
          duration: 15_000,
          action: { label: "Open dial", onClick: () => router.push("/dial") },
        });
      }
    };
    check();
    const t = setInterval(check, 20_000);
    return () => clearInterval(t);
  }, [followups, remind, router]);

  const dueNow = followups.filter((f) => new Date(f.due_at) <= new Date());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {dueNow.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-semibold text-ink animate-pulse-dot">
              {dueNow.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
        <div className="border-b border-line px-3 py-2 text-xs font-medium text-muted">
          Callbacks due
        </div>
        <div className="max-h-80 overflow-y-auto">
          {followups.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted">Nothing due. Clear queue.</p>
          )}
          {followups.map((f) => {
            const due = new Date(f.due_at) <= new Date();
            return (
              <div key={f.id} className="flex flex-col gap-1.5 border-b border-line px-3 py-2 last:border-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">
                    {f.leads?.full_name || f.leads?.phone_e164 || "Lead"}
                  </span>
                  <Badge variant={due ? "accent" : "neutral"}>
                    <Clock className="h-2.5 w-2.5" />
                    {fmtDateTime(f.due_at)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const r = await completeCallback(f.id);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success("Done");
                        refresh();
                        router.refresh();
                      }
                    }}
                  >
                    <Check className="h-3 w-3" /> Done
                  </Button>
                  {f.snooze_count < 2 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const r = await snoozeCallback(f.id);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Snoozed 30 min");
                          refresh();
                        }
                      }}
                    >
                      <AlarmClock className="h-3 w-3" /> Snooze
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const r = await cancelCallback(f.id);
                      if (r.error) toast.error(r.error);
                      else {
                        refresh();
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

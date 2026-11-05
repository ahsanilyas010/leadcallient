"use client";

import { useRouter } from "next/navigation";
import { SettingToggle } from "@/components/ui/setting-toggle";
import { savePreference } from "@/lib/actions/preferences";

export function MySettings({ takesCalls, callbackReminders }: { takesCalls: boolean; callbackReminders: boolean }) {
  const router = useRouter();
  return (
    <section className="rounded-2xl border border-line bg-white px-4 shadow-sm" aria-labelledby="notif-heading">
      <h2 id="notif-heading" className="pt-4 text-sm font-semibold text-ink">
        Notifications
      </h2>
      <div className="divide-y divide-line">
        {takesCalls ? (
          <SettingToggle
            label="Callback reminders"
            description="A reminder pops up in LeadCallient when one of your callbacks is due, with a button to start dialling. The bell in the header always lists them either way."
            checked={callbackReminders}
            testId="toggle-callback-reminders"
            onSave={async (on) => {
              const r = await savePreference({ key: "callbackReminders", value: on });
              if (!r.error) router.refresh();
              return r;
            }}
          />
        ) : (
          <p className="py-3 text-sm text-muted">Your login doesn&apos;t make calls, so there are no callback reminders to set.</p>
        )}
        <p className="py-3 text-xs text-muted">
          Your availability (Available or Away) is the switch in the header while you are clocked in. Which columns a list shows is set
          with the Columns button on that list.
        </p>
      </div>
    </section>
  );
}

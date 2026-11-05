import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/current-profile";
import { readPreferences, callbackRemindersOn } from "@/lib/preferences";
import { worksShifts, ROLE_LABEL } from "@/lib/roles";
import { MySettings } from "./my-settings";

export const metadata: Metadata = { title: "My settings", robots: { index: false, follow: false } };

// Settings that belong to one person rather than the workspace.
export default async function AccountPage() {
  const profile = await requireProfile();
  const prefs = readPreferences((profile as { preferences?: unknown }).preferences);
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">My settings</h1>
        <p className="mt-1 text-sm text-muted">
          {profile.full_name} · {ROLE_LABEL[profile.role] ?? profile.role} · {profile.email}. These settings are yours only and follow you to
          any device.
        </p>
      </div>
      <MySettings takesCalls={worksShifts(profile.role)} callbackReminders={callbackRemindersOn(prefs)} />
    </div>
  );
}

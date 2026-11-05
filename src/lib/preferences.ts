// Per-person settings kept on profiles.preferences (migration 118). Shared by
// the server action that saves them and the components that read them.

export interface Preferences {
  // In-app reminders when one of my callbacks is due.
  callbackReminders?: boolean;
  // Columns hidden in list views, by list.
  hiddenColumns?: Partial<Record<"leads" | "contacts", string[]>>;
}

export function readPreferences(raw: unknown): Preferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Preferences = {};
  if (typeof r.callbackReminders === "boolean") out.callbackReminders = r.callbackReminders;
  if (r.hiddenColumns && typeof r.hiddenColumns === "object" && !Array.isArray(r.hiddenColumns)) {
    const h = r.hiddenColumns as Record<string, unknown>;
    out.hiddenColumns = {};
    for (const k of ["leads", "contacts"] as const) {
      if (Array.isArray(h[k])) out.hiddenColumns[k] = (h[k] as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 100);
    }
  }
  return out;
}

// Callback reminders are on unless the person turned them off.
export const callbackRemindersOn = (p: Preferences) => p.callbackReminders !== false;

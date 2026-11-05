"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { readPreferences, type Preferences } from "@/lib/preferences";

// Saves one of the signed-in person's own preferences. Anyone may change
// their own (guard_profile_self_update protects only role, team and similar).
const patchSchema = z.union([
  z.object({ key: z.literal("callbackReminders"), value: z.boolean() }),
  z.object({ key: z.literal("hiddenColumns"), list: z.enum(["leads", "contacts"]), value: z.array(z.string().max(80)).max(100) }),
]);

export async function savePreference(input: z.input<typeof patchSchema>): Promise<{ error?: string }> {
  const profile = await requireRealProfile();
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) return { error: "That setting wasn't understood." };
  const p = parsed.data;
  const current: Preferences = readPreferences((profile as { preferences?: unknown }).preferences);
  const next: Preferences =
    p.key === "callbackReminders"
      ? { ...current, callbackReminders: p.value }
      : { ...current, hiddenColumns: { ...(current.hiddenColumns ?? {}), [p.list]: [...new Set(p.value)] } };
  const supabase = await createRealClient();
  const { error } = await supabase.from("profiles").update({ preferences: next as never }).eq("id", profile.id);
  if (error) return { error: "Couldn't save that. Try again." };
  if (p.key === "callbackReminders") revalidatePath("/", "layout");
  return {};
}

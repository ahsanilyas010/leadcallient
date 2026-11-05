"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";
import type { RealEnums } from "@/lib/supabase/real-types";

export async function setWorkspaceStatus(workspaceId: string, status: RealEnums<"workspace_status">): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const supabase = await createRealClient();
  const { error } = await supabase.rpc("platform_set_workspace_status", { p_workspace_id: workspaceId, p_status: status });
  if (error) return { error: error.message };
  revalidatePath("/platform", "page");
  return {};
}

// Data-only seats are granted by Assorted's team until self-serve pricing is
// set. Platform admins only; the service role is what the workspace guard
// lets change seat fields.
export async function setDataSeats(workspaceId: string, seats: number): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return { error: "Unknown workspace." };
  if (!Number.isInteger(seats) || seats < 0 || seats > 100000) return { error: "Enter a whole number of seats." };
  const { error } = await createServiceClient().from("workspaces").update({ data_seat_limit: seats }).eq("id", workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/platform", "page");
  return {};
}

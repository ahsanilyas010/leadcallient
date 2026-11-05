import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureException } from "@/lib/error-tracking";

// Daily: deletes trashed leads and contacts that are past each workspace's
// retention period (Settings > Data & deleting). Vercel Cron calls it with
// "Authorization: Bearer <CRON_SECRET>"; without CRON_SECRET set it refuses to
// run, and expiry still happens whenever someone opens the trash.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET is not set", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const { data, error } = await createServiceClient().rpc("purge_all_expired_trash");
  if (error) {
    captureException(error, { action: "cron.purge-trash" });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: data ?? 0 });
}

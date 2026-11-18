import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { captureException } from "@/lib/error-tracking";
import { NOTICE_DAYS } from "@/lib/access";
import { UNLIMITED_SEATS } from "@/lib/plan";
import { trialNoticeEmail } from "@/lib/billing/trial-notice";

// Daily: emails each trial workspace's admins once, when its trial has
// NOTICE_DAYS or fewer days left (existing customers moved off the old free
// plan get the same notice). Vercel Cron calls it with
// "Authorization: Bearer <CRON_SECRET>". Without RESEND_API_KEY nothing is sent
// and nothing is marked as sent, so the in-app banner stays the notice and the
// emails go out as soon as email is configured.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET is not set", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true, sent: 0, skipped: "RESEND_API_KEY is not set" });

  const admin = createServiceClient();
  const now = Date.now();
  const { data: due, error } = await admin
    .from("workspaces")
    .select("id, name, trial_ends_at")
    .eq("is_demo", false)
    .is("access_approved_at", null)
    .is("stripe_subscription_id", null)
    .is("trial_notice_sent_at", null)
    .lt("seat_limit", UNLIMITED_SEATS)
    .gt("trial_ends_at", new Date(now).toISOString())
    .lte("trial_ends_at", new Date(now + NOTICE_DAYS * 86_400_000).toISOString());
  if (error) {
    captureException(error, { action: "cron.trial-notices" });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  let sent = 0;
  for (const ws of due ?? []) {
    const { data: admins } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("workspace_id", ws.id)
      .eq("role", "super_admin")
      .eq("is_active", true);
    let delivered = 0;
    for (const a of admins ?? []) {
      const { subject, text } = trialNoticeEmail({ workspaceName: ws.name, endsAt: ws.trial_ends_at!, adminName: a.full_name });
      try {
        const r = await resend.emails.send({ from, to: a.email, subject, text });
        if (!r.error) delivered++;
        else captureException(new Error(r.error.message), { action: "cron.trial-notices.send", workspaceId: ws.id });
      } catch (e) {
        captureException(e, { action: "cron.trial-notices.send", workspaceId: ws.id });
      }
    }
    if (delivered > 0) {
      await admin.from("workspaces").update({ trial_notice_sent_at: new Date().toISOString() }).eq("id", ws.id);
      sent++;
    }
  }
  return NextResponse.json({ ok: true, sent });
}

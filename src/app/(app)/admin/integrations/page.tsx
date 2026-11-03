import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleDashed, Phone, Mail, CreditCard, Video } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { createRealClient } from "@/lib/supabase/real";
import { stripeConfigured } from "@/lib/billing/stripe";
import { fmtSeats } from "@/lib/plan";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Integrations" };

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return ok ? (
    <Badge variant="confirm">
      <CheckCircle2 className="mr-1 h-3 w-3" /> {yes}
    </Badge>
  ) : (
    <Badge variant="warning">
      <CircleDashed className="mr-1 h-3 w-3" /> {no}
    </Badge>
  );
}

// Live status only: everything here is read from the database or the
// server environment. Nothing is simulated.
export default async function IntegrationsPage() {
  const profile = await requireProfile();
  if (profile.role !== "super_admin" && profile.role !== "ops_manager") redirect("/start");

  const workspace = await getCurrentWorkspace();
  const supabase = await createRealClient();
  const [{ data: zoom }, { count: templateCount }] = await Promise.all([
    supabase.from("zoom_credentials").select("status, verified_at, last_error").eq("workspace_id", workspace.id).maybeSingle(),
    supabase.from("email_templates").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);

  const zoomConnected = zoom?.status === "connected";
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const stripeOn = stripeConfigured();

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Integrations</h2>
        <p className="text-sm text-muted">What is connected to this workspace right now.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Video className="h-4 w-4" /> Zoom (Meetings API)
            </span>
            <Status ok={zoomConnected} yes="Connected" no={zoom ? zoom.status : "Not connected"} />
          </CardTitle>
          <CardDescription>Book and host Zoom meetings with leads from your own Zoom account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {zoomConnected && zoom?.verified_at && (
            <div className="text-xs text-muted">Last verified {new Date(zoom.verified_at).toLocaleString()}</div>
          )}
          {zoom?.last_error && !zoomConnected && <div className="text-xs text-danger">{zoom.last_error}</div>}
          <Link href="/admin/settings/zoom" className="text-xs font-medium text-brand-green-text underline">
            {zoomConnected ? "Manage Zoom settings" : "Connect Zoom"}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Zoom Phone (calling)
            </span>
            <Badge variant="neutral">Configured by your Zoom admin</Badge>
          </CardTitle>
          <CardDescription>
            Calls use Zoom Phone Smart Embed on the dial screen. Its setup lives in your Zoom account, so it cannot be verified from
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted">
          <Link href="/admin/settings/zoom" className="font-medium text-brand-green-text underline">
            Zoom Phone setup checklist
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email (Resend)
            </span>
            <Status ok={resendConfigured} yes="Configured" no="Not configured" />
          </CardTitle>
          <CardDescription>
            {resendConfigured
              ? `Sending from ${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev (Resend's test sender)"}.`
              : "Email sending is not set up yet, so invitations and reports cannot be emailed. Ask whoever runs your deployment to add an email provider."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted">
          <div>{templateCount ?? 0} email template{templateCount === 1 ? "" : "s"} saved.</div>
          <Link href="/admin/settings/email" className="font-medium text-brand-green-text underline">
            Email templates
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Billing (Stripe)
            </span>
            <Status ok={stripeOn} yes="Configured" no="Not configured" />
          </CardTitle>
          <CardDescription>
            {stripeOn
              ? "Checkout and the billing webhook are available."
              : "Online billing is not set up yet, so plan upgrades are unavailable. Ask whoever runs your deployment to add a payment provider."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted">
          <div>
            Plan: {workspace.plan} · billing status: {workspace.billing_status} · seat limit: {fmtSeats(workspace.seat_limit)}
          </div>
          <div>{workspace.stripe_subscription_id ? "Active Stripe subscription on file." : "No Stripe subscription on file."}</div>
          <Link href="/admin/billing" className="font-medium text-brand-green-text underline">
            Billing
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

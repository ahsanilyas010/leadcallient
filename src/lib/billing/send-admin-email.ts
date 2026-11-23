import "server-only";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { captureException } from "@/lib/error-tracking";
import { BILLING } from "@/lib/brand";
import type { AccessEmail } from "./access-emails";

export interface AdminEmailResult {
  sent: number;
  // Why nothing went out, in words the owner console can show.
  skipped?: string;
}

// Sends one email to each active super admin of a workspace (the people who
// manage its billing). Never throws: an email problem must not undo the
// payment or approval that triggered it, so the caller just reports the result.
export async function emailWorkspaceAdmins(
  workspaceId: string,
  build: (admin: { full_name: string | null }) => AccessEmail,
): Promise<AdminEmailResult> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: "email isn't set up (RESEND_API_KEY is missing)" };
  try {
    const { data: admins } = await createServiceClient()
      .from("profiles")
      .select("email, full_name")
      .eq("workspace_id", workspaceId)
      .eq("role", "super_admin")
      .eq("is_active", true);
    if (!admins?.length) return { sent: 0, skipped: "this company has no active admin to email" };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    let sent = 0;
    let lastError = "";
    for (const a of admins) {
      const { subject, text } = build(a);
      const r = await resend.emails.send({ from, to: a.email, replyTo: BILLING.replyTo, subject, text });
      if (r.error) {
        lastError = r.error.message;
        captureException(new Error(r.error.message), { action: "billing.admin-email", workspaceId });
      } else sent++;
    }
    return sent > 0 ? { sent } : { sent: 0, skipped: lastError || "the email provider refused it" };
  } catch (e) {
    captureException(e, { action: "billing.admin-email", workspaceId });
    return { sent: 0, skipped: e instanceof Error ? e.message : "unknown error" };
  }
}

// "Email sent to 2 admins." / "No email sent: …" for the owner console toast.
export function describeAdminEmail(r: AdminEmailResult): string {
  if (r.sent > 0) return "Email sent to " + r.sent + " admin" + (r.sent === 1 ? "" : "s") + ".";
  return "No email sent: " + (r.skipped ?? "unknown reason") + ".";
}

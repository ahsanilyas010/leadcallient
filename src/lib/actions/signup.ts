"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { createRealClient } from "@/lib/supabase/real";
import { checkRealRateLimit } from "@/lib/rate-limit";

export interface SignupState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"full_name" | "company" | "email" | "password" | "agree", string>>;
  values?: { full_name?: string; company?: string; email?: string; phone?: string; team_size?: string };
}

const TEAM_SIZES = ["1-3", "4-10", "11-50", "51-200", "200+"] as const;

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your name.").max(80),
  company: z.string().trim().min(2, "Enter your company name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  phone: z.string().trim().max(30).optional(),
  team_size: z.enum(TEAM_SIZES).optional(),
  agree: z.literal("on", { message: "Please accept the terms to continue." }),
});

const SOURCE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "referrer", "landing_path"] as const;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "workspace"}-${suffix}`;
}

// Creates the customer's workspace (30-day free trial, 3 agent seats), makes them
// its super admin and signs them in. The client then fires the ad pixel's
// CompleteRegistration event and sends them to their dashboard (/start), where
// the setup checklist and product tour guide them. The workspace is created
// active; there is no setup wizard.
// phone and team_size are no longer on the form but stay accepted so older
// clients (and any saved form posts) keep working.
export async function signUp(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const values = { full_name: raw.full_name, company: raw.company, email: raw.email, phone: raw.phone, team_size: raw.team_size };

  // Honeypot: people never see this field; form-filling bots do.
  if (raw.website) return { ok: false, error: "Something went wrong. Please try again.", values };

  const parsed = schema.safeParse({
    ...raw,
    phone: raw.phone || undefined,
    team_size: raw.team_size || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: SignupState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<SignupState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, values };
  }
  const input = parsed.data;

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRealRateLimit("signup", ip, 5, 60 * 60))) {
    return { error: "Too many sign-ups from this network. Try again in an hour.", values };
  }

  const signup: Record<string, string> = {};
  for (const k of SOURCE_KEYS) {
    const v = raw[k]?.trim();
    if (v) signup[k] = v.slice(0, 300);
  }

  const admin = createServiceClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return { fieldErrors: { email: "There's already an account with this email. Sign in instead." }, values };
    }
    console.error("signup: createUser failed", createError);
    return { error: "We couldn't create your account just now. Please try again.", values };
  }

  const { error: rpcError } = await admin.rpc("create_workspace_with_owner", {
    p_user_id: created.user.id,
    p_email: input.email,
    p_full_name: input.full_name,
    p_workspace_name: input.company,
    p_slug: slugify(input.company),
    p_phone: input.phone ?? undefined,
    p_team_size: input.team_size ?? undefined,
    p_signup: signup,
  });

  if (rpcError) {
    // Compensate: never leave an auth user with no workspace behind.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    console.error("signup: create_workspace_with_owner failed", rpcError);
    return { error: "We couldn't create your workspace just now. Please try again.", values };
  }

  const supabase = await createRealClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (signInError) {
    console.error("signup: sign-in after creation failed", signInError);
    return { error: "Your workspace was created — please sign in.", values };
  }

  return { ok: true };
}

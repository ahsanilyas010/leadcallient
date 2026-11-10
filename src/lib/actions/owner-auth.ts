"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRealRateLimit } from "@/lib/rate-limit";
import { isOwnerEmail, normalizeEmail, OWNER_EMAILS } from "@/lib/owner/allowlist";
import { captureException } from "@/lib/error-tracking";

// Owner console sign-in: a 6-digit PIN emailed by Supabase Auth (email OTP).
// Only the addresses in src/lib/owner/allowlist.ts are ever sent a PIN.

export interface OwnerPinState {
  step: "email" | "pin";
  email?: string;
  error?: string;
  notice?: string;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const SENT_NOTICE = "If that address is an owner, a 6-digit PIN is on its way. It expires in a few minutes.";

export async function requestOwnerPin(_prev: OwnerPinState, formData: FormData): Promise<OwnerPinState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { step: "email", error: "Enter a valid email address." };

  const ip = await clientIp();
  if (!(await checkRealRateLimit("owner_pin_request", `${ip}:${email}`, 5, 900))) {
    return { step: "email", email, error: "Too many PIN requests. Wait 15 minutes and try again." };
  }

  // Same answer whether or not the address is allowed, so the form can't be
  // used to discover who the owners are.
  if (!isOwnerEmail(email)) return { step: "pin", email, notice: SENT_NOTICE };

  try {
    const supabase = await createRealClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      captureException(error, { where: "requestOwnerPin" });
      return {
        step: "email",
        email,
        error: error.status === 429 ? "The email service is rate-limited. Try again in a few minutes." : "We couldn't send a PIN right now. Try again shortly.",
      };
    }
  } catch (e) {
    captureException(e, { where: "requestOwnerPin" });
    return { step: "email", email, error: "We couldn't send a PIN right now. Try again shortly." };
  }
  return { step: "pin", email, notice: SENT_NOTICE };
}

export async function verifyOwnerPin(_prev: OwnerPinState, formData: FormData): Promise<OwnerPinState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const pin = String(formData.get("pin") ?? "").replace(/\s+/g, "");
  if (!/^\d{6,10}$/.test(pin)) return { step: "pin", email, error: "Enter the PIN from the email." };

  const ip = await clientIp();
  if (!(await checkRealRateLimit("owner_pin_verify", `${ip}:${email}`, 8, 900))) {
    return { step: "pin", email, error: "Too many attempts. Request a new PIN in 15 minutes." };
  }
  if (!isOwnerEmail(email)) return { step: "pin", email, error: "That PIN is wrong or has expired." };

  try {
    const supabase = await createRealClient();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: pin, type: "email" });
    if (error || !data.user || !isOwnerEmail(data.user.email)) {
      if (data?.user) await supabase.auth.signOut();
      return { step: "pin", email, error: "That PIN is wrong or has expired." };
    }

    const admin = createServiceClient();
    await admin.from("platform_admins").upsert({ id: data.user.id, email }, { onConflict: "id" });
    await admin.from("platform_audit").insert({
      actor_id: data.user.id,
      actor_email: email,
      action: "owner.sign_in",
      details: { ip },
    });
  } catch (e) {
    captureException(e, { where: "verifyOwnerPin" });
    return { step: "pin", email, error: "We couldn't sign you in right now. Try again shortly." };
  }
  redirect("/platform");
}

export async function ownerSignOut() {
  const supabase = await createRealClient();
  await supabase.auth.signOut();
  redirect("/platform/login");
}

// Break-glass sign-in for when the email PIN can't be delivered (Supabase's
// mailer is rate-limited, or email isn't set up yet). Off unless the
// OWNER_ACCESS_TOKEN env var is set on the deployment (at least 32
// characters); delete the variable to turn it off again. It signs in the
// first owner on the allowlist without sending any email, so it grants
// exactly what the PIN would, and nothing else. Every use is audited.
export async function ownerAccessWithToken(_prev: OwnerPinState, formData: FormData): Promise<OwnerPinState> {
  const secret = process.env.OWNER_ACCESS_TOKEN;
  const given = String(formData.get("token") ?? "");
  const ip = await clientIp();
  if (!(await checkRealRateLimit("owner_access_token", ip, 5, 900))) {
    return { step: "email", error: "Too many attempts. Try again in 15 minutes." };
  }
  const digest = (v: string) => createHash("sha256").update(v).digest();
  const ok = !!secret && secret.length >= 32 && timingSafeEqual(digest(given), digest(secret));
  if (!ok) return { step: "email", error: "That access token isn't valid." };

  const email = OWNER_EMAILS[0];
  try {
    const admin = createServiceClient();
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) throw linkError ?? new Error("no token hash returned");

    const supabase = await createRealClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error || !data.user || !isOwnerEmail(data.user.email)) throw error ?? new Error("verification failed");

    await admin.from("platform_admins").upsert({ id: data.user.id, email }, { onConflict: "id" });
    await admin.from("platform_audit").insert({ actor_id: data.user.id, actor_email: email, action: "owner.sign_in", details: { ip, method: "access_token" } });
  } catch (e) {
    captureException(e, { where: "ownerAccessWithToken" });
    return { step: "email", error: "We couldn't sign you in right now." };
  }
  redirect("/platform");
}

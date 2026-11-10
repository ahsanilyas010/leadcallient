"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRealRateLimit } from "@/lib/rate-limit";
import { isOwnerEmail, normalizeEmail } from "@/lib/owner/allowlist";
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

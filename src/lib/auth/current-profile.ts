import { cache } from "react";
import { redirect } from "next/navigation";
import { createRealClient } from "@/lib/supabase/real";
import type { RealTables } from "@/lib/supabase/real-types";
import { isOwnerEmail, OWNER_SESSION_HOURS } from "@/lib/owner/allowlist";

export type Profile = RealTables<"profiles">;
export type RealProfile = Profile;

// The signed-in user's profile from the real, RLS-governed Postgres
// (Supabase Auth session cookie -> profiles row). Every signed-in page and
// action goes through this; there is no other identity source.
//
// Wrapped in React's cache(): the layout, the page and every helper each call
// this during one request, and each uncached call is two round trips to the
// auth server and the database. Cached, it runs once per request.
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = await createRealClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No valid user behind the cookie (expired, revoked, or never signed in):
  // signed_out clears it in the middleware.
  if (!user) redirect("/login?signed_out=1");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) redirect("/login?signed_out=1");
  if (!profile.is_active) redirect("/login?signed_out=1");
  if (profile.must_change_password) redirect("/change-password");

  return profile;
});

// Same as requireProfile() but without the forced-password-change redirect
// (the change-password page itself uses it).
export const requireRealProfile = cache(async (): Promise<Profile> => {
  const supabase = await createRealClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?signed_out=1");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) redirect("/login?signed_out=1");
  return profile;
});

// Role gate: redirects to the user's own home when the role isn't allowed.
export async function requireRole(roles: Profile["role"][]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/start");
  return profile;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  full_name: string | null;
}

// Gate for the owner console (/platform). A platform admin has no
// workspace/profiles row, so this is deliberately separate from
// requireProfile(). Four checks, all required:
//   1. a valid Supabase session (getUser() verifies it with the auth server);
//   2. the email is on the hard-coded owner allowlist (src/lib/owner/allowlist.ts);
//   3. a platform_admins row exists (what RLS and the platform_* RPCs check);
//   4. the session was started with an emailed PIN (OTP) within the last
//      OWNER_SESSION_HOURS, so a password sign-in never opens the console.
export const requireOwner = cache(async (): Promise<PlatformAdmin> => {
  const supabase = await createRealClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) redirect("/platform/login");

  const { data: claimsData } = await supabase.auth.getClaims();
  const amr = (claimsData?.claims?.amr ?? []) as Array<string | { method: string; timestamp: number }>;
  const otpAt = amr
    .map((e) => (typeof e === "string" ? null : e.method === "otp" || e.method === "magiclink" ? e.timestamp : null))
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => b - a)[0];
  if (!otpAt || Date.now() / 1000 - otpAt > OWNER_SESSION_HOURS * 3600) redirect("/platform/login?expired=1");

  const { data: admin } = await supabase.from("platform_admins").select("*").eq("id", user.id).single();
  if (!admin) redirect("/platform/login");
  return admin;
});

// Kept for existing callers; the owner console is the only platform surface.
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  return requireOwner();
}

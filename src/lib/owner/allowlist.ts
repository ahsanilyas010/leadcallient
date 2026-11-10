// The only people who can open the owner console (/platform). Sign-in is by
// a one-time PIN emailed to the address itself (Supabase Auth email OTP),
// so this list is the whole access policy: no env var, no password. To add
// or remove an owner, edit this list and redeploy.
export const OWNER_EMAILS: readonly string[] = ["ahsanilyas35@gmail.com", "nehalksyed3@gmail.com"];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(normalizeEmail(email));
}

// How long a PIN sign-in lasts before the console asks for a new PIN.
export const OWNER_SESSION_HOURS = 12;

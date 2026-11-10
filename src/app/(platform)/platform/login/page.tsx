import type { Metadata } from "next";
import { BrandMark } from "@/components/brand/mark";
import { OwnerLoginForm } from "./owner-login-form";

export const metadata: Metadata = { title: "Owner console", robots: { index: false, follow: false } };

export default async function OwnerLoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark size={40} />
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Owner console</h1>
            <p className="mt-1 text-sm text-muted">Sign in with a one-time PIN sent to your email.</p>
          </div>
        </div>
        {expired && (
          <p className="mb-3 rounded-md bg-warning-tint px-3 py-2 text-xs text-warning" role="status">
            Your session ended. Request a new PIN to continue.
          </p>
        )}
        <OwnerLoginForm />
      </div>
    </main>
  );
}

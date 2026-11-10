import type { Metadata } from "next";
import { BrandMark } from "@/components/brand/mark";
import { AccessForm } from "./access-form";

export const metadata: Metadata = { title: "Owner access", robots: { index: false, follow: false } };

// Not linked from anywhere. Works only while OWNER_ACCESS_TOKEN is set.
export default function OwnerAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark size={40} />
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Owner access</h1>
            <p className="mt-1 text-sm text-muted">Enter the access token set on the deployment.</p>
          </div>
        </div>
        <AccessForm />
      </div>
    </main>
  );
}

import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireOwner } from "@/lib/auth/current-profile";
import { ownerSignOut } from "@/lib/actions/owner-auth";
import { BrandMark } from "@/components/brand/mark";
import { OwnerNav } from "../_ui/nav";

export const dynamic = "force-dynamic";

export default async function OwnerConsoleLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-canvas px-4 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r md:py-6">
        <Link href="/platform" className="mb-4 hidden items-center gap-2 px-3 md:flex">
          <BrandMark size={28} />
          <span className="font-display text-sm font-semibold text-ink">Owner console</span>
        </Link>
        <OwnerNav />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-line bg-white/70 px-4 py-2.5 md:px-8">
          <span className="truncate text-xs text-muted">{owner.email}</span>
          <form action={ownerSignOut}>
            <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

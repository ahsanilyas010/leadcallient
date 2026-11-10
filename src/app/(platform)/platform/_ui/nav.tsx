"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, CreditCard, LayoutDashboard, PhoneCall, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard },
  { href: "/platform/companies", label: "Companies", icon: Building2 },
  { href: "/platform/users", label: "Users", icon: Users },
  { href: "/platform/dialer", label: "Dialer usage", icon: PhoneCall },
  { href: "/platform/billing", label: "Billing", icon: CreditCard },
  { href: "/platform/activity", label: "Activity", icon: Activity },
];

export function OwnerNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Owner console">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/platform" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-blue-tint text-brand-blue" : "text-muted hover:bg-white hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

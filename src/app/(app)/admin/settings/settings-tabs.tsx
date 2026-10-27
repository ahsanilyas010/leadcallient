"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings/branding", label: "Branding" },
  { href: "/admin/settings/clients", label: "Clients & logos" },
  { href: "/admin/settings/campaigns", label: "Campaigns" },
  { href: "/admin/settings/email", label: "Email templates" },
  { href: "/admin/settings/zoom", label: "Zoom" },
  { href: "/admin/compliance", label: "Screening & compliance" },
  { href: "/admin/integrations", label: "Plugins & integrations" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex flex-wrap gap-1 border-b border-line px-6 pt-4">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
              active ? "border-brand-blue text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

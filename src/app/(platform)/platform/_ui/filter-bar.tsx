import Link from "next/link";

// GET-form filters: server-rendered, shareable URLs, no client state.
export function FilterBar({
  action,
  children,
  resetHref,
}: {
  action: string;
  children: React.ReactNode;
  resetHref: string;
}) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3 shadow-sm">
      {children}
      <button type="submit" className="h-9 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white hover:brightness-110">
        Apply
      </button>
      <Link href={resetHref} className="h-9 px-2 text-sm leading-9 font-medium text-muted hover:text-ink">
        Reset
      </Link>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

export const fieldClass = "h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

export function ExportLink({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink shadow-sm hover:bg-canvas">
      Export CSV
    </a>
  );
}

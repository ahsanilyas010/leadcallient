import { cn } from "@/lib/utils";

// Plain, server-rendered table styling shared by every console list.
export function OTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line bg-white shadow-sm", className)}>
      <table className="w-full min-w-max text-sm">{children}</table>
    </div>
  );
}

export function OHead({ cols }: { cols: (string | { label: string; right?: boolean })[] }) {
  return (
    <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
      <tr>
        {cols.map((c, i) => {
          const col = typeof c === "string" ? { label: c } : c;
          return (
            <th key={i} className={cn("px-3 py-2.5 whitespace-nowrap", col.right && "text-right")}>
              {col.label}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export function OEmpty({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

export const td = "px-3 py-2.5 whitespace-nowrap";
export const tdNum = "px-3 py-2.5 whitespace-nowrap text-right tabular-nums";

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "danger" | "warning" | "good" }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-semibold tabular-nums text-ink",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
          tone === "good" && "text-brand-green-text",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

import type { Company, OwnerUser } from "@/lib/owner/data";

// Company list filters, shared by the Companies page and its CSV export.
export type CompanyFilters = { q?: string; status?: string; trial?: string; billing?: string; filter?: string; sort?: string; demo?: string };

export function filterCompanies(all: Company[], sp: CompanyFilters): Company[] {
  const q = (sp.q ?? "").trim().toLowerCase();
  let rows = all.filter((c) => (sp.demo === "1" ? true : !c.ws.is_demo));
  if (q) rows = rows.filter((c) => [c.ws.name, c.ws.slug, c.m.owner_email ?? "", c.m.owner_name ?? ""].some((s) => s.toLowerCase().includes(q)));
  if (sp.status) rows = rows.filter((c) => c.ws.status === sp.status);
  if (sp.trial) rows = rows.filter((c) => c.trial.kind === sp.trial || (sp.trial === "ending" && c.trial.kind === "trialing" && c.trial.daysLeft <= 7));
  if (sp.billing) rows = rows.filter((c) => c.billing.kind === sp.billing);
  if (sp.filter === "attention") rows = rows.filter((c) => c.flags.length > 0);
  const sorters: Record<string, (a: Company, b: Company) => number> = {
    newest: (a, b) => b.ws.created_at.localeCompare(a.ws.created_at),
    oldest: (a, b) => a.ws.created_at.localeCompare(b.ws.created_at),
    name: (a, b) => a.ws.name.localeCompare(b.ws.name),
    calls: (a, b) => Number(b.m.calls_30d) - Number(a.m.calls_30d),
    agents: (a, b) => Number(b.m.agents_active) - Number(a.m.agents_active),
    balance: (a, b) => b.m.balance - a.m.balance,
    trial: (a, b) => (a.ws.trial_ends_at ?? "9999").localeCompare(b.ws.trial_ends_at ?? "9999"),
    activity: (a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
  };
  return rows.sort(sorters[sp.sort ?? "newest"] ?? sorters.newest);
}


export type UserFilters = { q?: string; company?: string; role?: string; active?: string; demo?: string };

export function filterUsers(users: OwnerUser[], sp: UserFilters, names: Map<string, string>, demoIds: Set<string>, now = Date.now()): OwnerUser[] {
  const q = (sp.q ?? "").trim().toLowerCase();
  return users.filter((u) => {
    if (sp.demo !== "1" && demoIds.has(u.workspace_id)) return false;
    if (q && ![u.full_name, u.email, names.get(u.workspace_id) ?? ""].some((s) => s.toLowerCase().includes(q))) return false;
    if (sp.company && u.workspace_id !== sp.company) return false;
    if (sp.role && u.role !== sp.role) return false;
    if (sp.active === "yes" && !u.is_active) return false;
    if (sp.active === "no" && u.is_active) return false;
    if (sp.active === "never" && u.last_sign_in_at) return false;
    if (sp.active === "dormant" && (!u.is_active || (u.last_sign_in_at && now - Date.parse(u.last_sign_in_at) < 14 * 86_400_000))) return false;
    return true;
  });
}

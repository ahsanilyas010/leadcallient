import { requireOwner } from "@/lib/auth/current-profile";
import { loadAgentUsage, loadCompanies, loadUsers, rangeFromParam } from "@/lib/owner/data";
import { filterCompanies, filterUsers, type CompanyFilters, type UserFilters } from "@/lib/owner/filters";
import { billingLabel, trialLabel } from "@/lib/owner/status";

export const dynamic = "force-dynamic";

// CSV exports for the owner console. Same filters as the pages they come
// from; same counts-only data (no lead or call content).

function csv(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // Neutralise spreadsheet formulas.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

function file(name: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  await requireOwner();
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());

  if (sp.type === "companies") {
    const rows = filterCompanies(await loadCompanies(), sp as CompanyFilters);
    return file(
      "companies",
      csv([
        ["Company", "Slug", "Owner name", "Owner email", "Status", "Signed up", "Trial ends", "Trial", "Price", "Currency", "Cycle", "Next due", "Billing", "Balance", "Paid to date", "Agent seats used", "Agent seat limit", "Data seats used", "Data seat limit", "Users active", "Users total", "Campaigns", "Leads", "Calls today", "Calls 7d", "Calls 30d", "Calls total", "Talk minutes 30d", "Zoom connected", "Last call", "Last sign-in", "Flags"],
        ...rows.map((c) => [
          c.ws.name, c.ws.slug, c.m.owner_name, c.m.owner_email, c.ws.status, c.ws.created_at, c.ws.trial_ends_at, trialLabel(c.trial),
          c.ws.billing_amount, c.ws.billing_currency, c.ws.billing_cycle, c.ws.next_due_date, billingLabel(c.billing), c.m.balance, c.m.paid_total,
          c.m.agents_active, c.ws.seat_limit, c.m.data_seats_used, c.ws.data_seat_limit, c.m.users_active, c.m.users_total, c.m.campaigns, c.m.leads,
          c.m.calls_today, c.m.calls_7d, c.m.calls_30d, c.m.calls_total, Math.round(Number(c.m.talk_seconds_30d) / 60), c.m.zoom_connected,
          c.m.last_call_at, c.m.last_sign_in_at, c.flags.join(" "),
        ]),
      ]),
    );
  }

  if (sp.type === "users") {
    const [companies, users] = await Promise.all([loadCompanies(), loadUsers()]);
    const names = new Map(companies.map((c) => [c.ws.id, c.ws.name]));
    const demoIds = new Set(companies.filter((c) => c.ws.is_demo).map((c) => c.ws.id));
    const rows = filterUsers(users, sp as UserFilters, names, demoIds);
    return file(
      "users",
      csv([
        ["Name", "Email", "Company", "Role", "Active", "Joined", "Last sign-in", "Calls 30d", "Talk minutes 30d", "Last call"],
        ...rows.map((u) => [u.full_name, u.email, names.get(u.workspace_id), u.role, u.is_active, u.created_at, u.last_sign_in_at, u.calls_30d, Math.round(Number(u.talk_seconds_30d) / 60), u.last_call_at]),
      ]),
    );
  }

  if (sp.type === "dialer") {
    const range = rangeFromParam(sp.range, sp.from, sp.to);
    const companyId = sp.company && /^[0-9a-f-]{36}$/i.test(sp.company) ? sp.company : undefined;
    const [companies, usage] = await Promise.all([loadCompanies(), loadAgentUsage(range.from, range.to, companyId)]);
    const names = new Map(companies.map((c) => [c.ws.id, c.ws.name]));
    const demoIds = new Set(companies.filter((c) => c.ws.is_demo).map((c) => c.ws.id));
    const rows = usage.filter((r) => sp.demo === "1" || !demoIds.has(r.workspace_id));
    return file(
      "dialer-usage",
      csv([
        ["From", "To", "Name", "Email", "Company", "Role", "Active", "Calls", "Connects", "Sales", "Talk minutes", "Hours clocked", "Days active", "First call in range", "Last call in range", "Dialing since"],
        ...rows.map((r) => [
          range.from.toISOString(), range.to.toISOString(), r.full_name, r.email, names.get(r.workspace_id), r.role, r.is_active, r.calls, r.connects, r.conversions,
          Math.round(Number(r.talk_seconds) / 60), (Number(r.clocked_seconds) / 3600).toFixed(2), r.days_active, r.first_call_at, r.last_call_at, r.first_call_ever,
        ]),
      ]),
    );
  }

  return new Response("Unknown export type", { status: 400 });
}

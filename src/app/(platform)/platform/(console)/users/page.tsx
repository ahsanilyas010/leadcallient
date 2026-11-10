import type { Metadata } from "next";
import { loadCompanies, loadUsers } from "@/lib/owner/data";
import { filterUsers, type UserFilters } from "@/lib/owner/filters";
import { PageHeader } from "../../_ui/table";
import { UsersTable } from "../../_ui/lists";
import { ExportLink, FilterBar, FilterField, fieldClass } from "../../_ui/filter-bar";

export const metadata: Metadata = { title: "Users · Owner console" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<UserFilters> }) {
  const sp = await searchParams;
  const [companies, users] = await Promise.all([loadCompanies(), loadUsers()]);
  const names = new Map(companies.map((c) => [c.ws.id, c.ws.name]));
  const demoIds = new Set(companies.filter((c) => c.ws.is_demo).map((c) => c.ws.id));
  const rows = filterUsers(users, sp, names, demoIds);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  qs.set("type", "users");

  return (
    <>
      <PageHeader title="Users" description={`${rows.length} of ${users.length} users across every company`} actions={<ExportLink href={`/api/platform/export?${qs}`} />} />
      <FilterBar action="/platform/users" resetHref="/platform/users">
        <FilterField label="Search">
          <input name="q" defaultValue={sp.q} placeholder="Name or email" className={`${fieldClass} w-56`} />
        </FilterField>
        <FilterField label="Company">
          <select name="company" defaultValue={sp.company ?? ""} className={`${fieldClass} max-w-56`}>
            <option value="">All</option>
            {companies.map((c) => (
              <option key={c.ws.id} value={c.ws.id}>
                {c.ws.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Role">
          <select name="role" defaultValue={sp.role ?? ""} className={fieldClass}>
            <option value="">Any</option>
            <option value="super_admin">Super admin</option>
            <option value="ops_manager">Ops manager</option>
            <option value="team_lead">Team lead</option>
            <option value="agent">Agent</option>
            <option value="qa_analyst">QA analyst</option>
            <option value="lead_gen">Lead gen</option>
            <option value="data_manager">Data only</option>
            <option value="client">Client</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select name="active" defaultValue={sp.active ?? ""} className={fieldClass}>
            <option value="">Any</option>
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
            <option value="never">Never signed in</option>
            <option value="dormant">No sign-in for 14 days</option>
          </select>
        </FilterField>
        <label className="flex h-9 items-center gap-1.5 text-xs font-medium text-muted">
          <input type="checkbox" name="demo" value="1" defaultChecked={sp.demo === "1"} /> Include demo
        </label>
      </FilterBar>
      <UsersTable users={rows} companyNames={names} />
    </>
  );
}

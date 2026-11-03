import type { Metadata } from "next";
import { KeyRound, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/guide/empty-state";
import { OpenDialogButton } from "@/components/guide/open-dialog-button";
import { requireRole } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { activeAgentCount, seatsRemaining } from "@/lib/workspace/limits";
import { fmtSeats, isUnlimitedSeats } from "@/lib/plan";
import { CreateUserDialog } from "./create-user-dialog";
import { PeopleTable } from "./people-table";

export const metadata: Metadata = { title: "People" };

// Last sign-in lives in Supabase Auth, not in profiles. Only admins see it.
async function lastSignIns(canSee: boolean): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!canSee) return map;
  const { data } = await createServiceClient().auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) map.set(u.id, u.last_sign_in_at ?? null);
  return map;
}

export default async function PeoplePage() {
  const profile = await requireRole(["super_admin", "ops_manager", "team_lead"]);
  const canCreate = profile.role === "super_admin" || profile.role === "ops_manager";

  const supabase = await createRealClient();
  const [workspace, { data: people }, { data: teams }, { data: clients }, { data: campaigns }, signIns] = await Promise.all([
    getCurrentWorkspace(),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("campaigns").select("id, name").order("name"),
    lastSignIns(canCreate),
  ]);
  const agentsUsed = await activeAgentCount(supabase, workspace.id);
  const { data: zoomCred } = canCreate
    ? await supabase.from("zoom_credentials").select("status").eq("workspace_id", workspace.id).maybeSingle()
    : { data: null };
  const zoomConnected = zoomCred?.status === "connected";
  // Just the account that signed up: nudge them to add their first agent.
  const onlyOwner = (people ?? []).length <= 1;
  const seatsLeft = seatsRemaining(agentsUsed, workspace.seat_limit);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">One login per human, no exceptions.</p>
        {canCreate && <CreateUserDialog
            teams={teams ?? []}
            clients={clients ?? []}
            seatsLeft={seatsLeft}
            seatLimit={workspace.seat_limit}
            existingEmails={(people ?? []).map((p) => p.email.toLowerCase())}
            isSuperAdmin={profile.role === "super_admin"}
            hideTrigger={onlyOwner}
            openEvent="guide:new-user"
          />}
      </div>

      {canCreate && onlyOwner && (
        <div className="mb-4">
          <EmptyState
            testId="people-empty"
            icon={UserPlus}
            title="Add your first agent"
            action={
              <OpenDialogButton event="guide:new-user" icon={<UserPlus className="h-4 w-4" />}>
                Add your first agent
              </OpenDialogButton>
            }
          >
            Agents are the people who make the calls. Create a login for each one, share the one-time password, and they can sign in and start dialling.
          </EmptyState>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-muted">
        <KeyRound className="h-4 w-4 text-brand-blue" />
        {isUnlimitedSeats(workspace.seat_limit)
          ? `Unlimited agent seats on this workspace: ${agentsUsed} in use.`
          : `${workspace.plan === "free" ? "Free plan" : "Your plan"}: ${agentsUsed} of ${fmtSeats(workspace.seat_limit)} agent seats used.`}{" "}
        Admins, managers, team leads, lead gen, QA and client logins don&apos;t use a seat.
      </div>

      <PeopleTable
        rows={(people ?? []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          role: p.role,
          team_id: p.team_id,
          agent_code: p.agent_code,
          is_active: p.is_active,
          must_change_password: p.must_change_password,
          timezone: p.timezone,
          created_at: p.created_at,
          last_sign_in: canCreate ? (signIns.get(p.id) ?? null) : undefined,
          isSelf: p.id === profile.id,
          isOwner: p.id === workspace.created_by,
        }))}
        teams={teams ?? []}
        campaigns={campaigns ?? []}
        canManage={canCreate}
        seatsLeft={seatsLeft}
        seatLimit={workspace.seat_limit}
        isSuperAdmin={profile.role === "super_admin"}
        viewerTimezone={profile.timezone}
        zoomConnected={zoomConnected}
      />
    </div>
  );
}

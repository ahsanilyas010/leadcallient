-- Data tools: the Data-only seat, tags, saved import mappings, trash
-- (soft delete) with restore and permanent delete, undo import, and
-- data-subject erasure. Everything here is additive: no existing policy is
-- loosened for an existing role.
--
-- Sections
--   1. Workspace settings (data seats, who may permanently delete, trash
--      retention) and the guard that keeps them out of a customer's reach.
--   2. Role helpers and the Data-only role's access (no calling anywhere).
--   3. Tags on leads, and saved import mappings.
--   4. Trash: soft delete, restore, permanent delete, expiry.
--   5. Undo an import.
--   6. Import helpers: matching existing leads by phone and email, and the
--      bulk update used by "update existing" imports and CRM migration.
--   7. Data-subject requests: find and erase one person's data.

-- ===================================================================== 1
alter table workspaces
  add column if not exists data_seat_limit int not null default 0 check (data_seat_limit >= 0),
  add column if not exists ops_can_purge boolean not null default false,
  add column if not exists trash_retention_days int not null default 30 check (trash_retention_days between 1 and 365);

-- Same rule as migration 096 for plan/seat/billing fields, now also covering
-- data seats. Who may permanently delete (ops_can_purge) and how long trash
-- is kept are the super admin's call: an ops manager can't grant themselves
-- permanent delete.
create or replace function guard_workspace_self_update() returns trigger
language plpgsql as $$
begin
  if is_platform_admin() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.seat_limit is distinct from old.seat_limit
     or new.data_seat_limit is distinct from old.data_seat_limit
     or new.status is distinct from old.status
     or new.is_demo is distinct from old.is_demo
     or new.billing_status is distinct from old.billing_status
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  then
    raise exception 'plan, seats, status and billing fields can only be changed by the service role or a platform admin';
  end if;
  if (new.ops_can_purge is distinct from old.ops_can_purge
      or new.trash_retention_days is distinct from old.trash_retention_days)
     and auth_role() is distinct from 'super_admin'
  then
    raise exception 'only a super admin can change who may permanently delete, or how long trash is kept';
  end if;
  return new;
end;
$$;

-- Assorted's own workspaces (see migration 115) get unlimited data seats too.
alter table workspaces disable trigger workspaces_guard_self_update;
update workspaces set data_seat_limit = 2147483647 where slug in ('assorted', 'assorted-group-1wmccb');
alter table workspaces enable trigger workspaces_guard_self_update;

-- ===================================================================== 2
create or replace function is_data_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() = 'data_manager'
$$;

-- Managers and the Data-only role: everyone who may change lead data.
create or replace function is_data_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('super_admin', 'ops_manager', 'data_manager')
$$;

-- Permanent delete: always the super admin; ops managers only when the super
-- admin has allowed it. Never the Data-only role.
create or replace function can_purge() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() = 'super_admin'
    or (auth_role() = 'ops_manager'
        and coalesce((select ops_can_purge from workspaces where id = auth_workspace_id()), false))
$$;

revoke execute on function is_data_manager() from public, anon;
revoke execute on function is_data_admin() from public, anon;
revoke execute on function can_purge() from public, anon;
grant execute on function is_data_manager() to authenticated;
grant execute on function is_data_admin() to authenticated;
grant execute on function can_purge() to authenticated;

-- The lead-gen RPCs (campaign pick-list, duplicate check, lead inbox
-- assignment) are data tools; the Data-only role uses them too.
create or replace function is_lead_gen_or_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('lead_gen', 'super_admin', 'ops_manager', 'data_manager')
$$;

-- A lead can only be owned by someone who makes calls. A Data-only, lead
-- gen or client login never appears in a call queue.
create or replace function guard_lead_assignment() returns trigger
language plpgsql as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    if not exists (
      select 1 from profiles p
      where p.id = new.assigned_to and p.workspace_id = new.workspace_id
    ) then
      raise exception 'assigned_to must be a member of the lead''s workspace';
    end if;
    if exists (
      select 1 from profiles p
      where p.id = new.assigned_to and p.role in ('data_manager', 'lead_gen', 'client')
    ) then
      raise exception 'leads can only be assigned to people who make calls';
    end if;
    new.assigned_at := now();
    if new.status = 'new' then
      new.status := 'assigned';
    end if;
  elsif new.assigned_to is null then
    new.assigned_at := null;
    if new.status = 'assigned' then
      new.status := 'new';
    end if;
  end if;
  return new;
end;
$$;

-- Data-only access, additive to the existing policies. Read and change
-- leads, contacts, lists, sources and campaigns; read people, calls and
-- reports; never delete permanently, never dial (the roster guard in
-- guard_campaign_assignment already refuses this role on any campaign).
create policy leads_select_data_manager on leads for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy leads_insert_data_manager on leads for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy leads_update_data_manager on leads for update using (
  workspace_id = auth_workspace_id() and is_data_manager()
) with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy unphoned_contacts_select_data_manager on unphoned_contacts for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy unphoned_contacts_insert_data_manager on unphoned_contacts for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy unphoned_contacts_update_data_manager on unphoned_contacts for update using (
  workspace_id = auth_workspace_id() and is_data_manager()
) with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy lead_batches_select_data_manager on lead_batches for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy lead_batches_insert_data_manager on lead_batches for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy lead_batches_update_data_manager on lead_batches for update using (
  workspace_id = auth_workspace_id() and is_data_manager()
) with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy data_sources_select_data_manager on data_sources for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy data_sources_insert_data_manager on data_sources for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy data_sources_update_data_manager on data_sources for update using (
  workspace_id = auth_workspace_id() and is_data_manager()
) with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy source_fetch_runs_select_data_manager on source_fetch_runs for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy source_fetch_runs_insert_data_manager on source_fetch_runs for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy source_fetch_runs_update_data_manager on source_fetch_runs for update using (
  workspace_id = auth_workspace_id() and is_data_manager()
) with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy campaigns_select_data_manager on campaigns for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy campaigns_insert_data_manager on campaigns for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy campaigns_update_data_manager on campaigns for update using (
  workspace_id = auth_workspace_id() and is_data_manager()
) with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy clients_select_data_manager on clients for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy clients_insert_data_manager on clients for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

-- Rosters: a Data-only user hands leads to agents, which puts the agent on
-- the campaign's roster. guard_campaign_assignment refuses this role itself.
create policy campaign_assignments_data_manager on campaign_assignments for all using (
  workspace_id = auth_workspace_id() and is_data_manager()
) with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy profiles_select_data_manager on profiles for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);

-- Reports and dashboards read call outcomes; read only.
create policy calls_select_data_manager on calls for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy suppression_list_select_data_manager on suppression_list for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);
create policy suppression_list_insert_data_manager on suppression_list for insert with check (
  workspace_id = auth_workspace_id() and is_data_manager()
);

create policy lead_intake_events_select_data_manager on lead_intake_events for select using (
  workspace_id = auth_workspace_id() and is_data_manager()
);

-- Imports keep the original file in lead-uploads (same folder rule as 045).
create policy lead_uploads_data_manager_insert on storage.objects for insert with check (
  bucket_id = 'lead-uploads'
  and (storage.foldername(name))[1] = auth_workspace_id()::text
  and is_data_manager()
);
create policy lead_uploads_data_manager_select on storage.objects for select using (
  bucket_id = 'lead-uploads'
  and (storage.foldername(name))[1] = auth_workspace_id()::text
  and is_data_manager()
);

-- Screening and auto-assignment are data actions. Bodies unchanged from
-- production apart from the permission check.
create or replace function screen_leads(p_lead_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_passed int;
begin
  if not is_data_admin() then
    raise exception 'only a workspace manager can screen leads';
  end if;

  update leads l
  set screening_status = 'failed', screened_at = now()
  where l.id = any(p_lead_ids) and l.workspace_id = v_ws
    and l.screening_status <> 'passed'
    and exists (select 1 from suppression_list s where s.workspace_id = v_ws and s.phone_hash = l.phone_hash);

  update leads l
  set screening_status = 'passed', screened_at = now()
  where l.id = any(p_lead_ids) and l.workspace_id = v_ws
    and l.screening_status <> 'passed'
    and l.phone_e164 is not null
    and not exists (select 1 from suppression_list s where s.workspace_id = v_ws and s.phone_hash = l.phone_hash);
  get diagnostics v_passed = row_count;
  return v_passed;
end;
$$;

create or replace function screen_lead_batch(p_batch_id uuid, p_evidence_url text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_workspace_id uuid := auth_workspace_id();
  v_count int;
begin
  if not is_data_admin() then
    raise exception 'only a workspace manager can screen a batch';
  end if;

  update leads
  set screening_status = 'passed', screened_at = now()
  where batch_id = p_batch_id
    and workspace_id = v_workspace_id
    and screening_status = 'pending';
  get diagnostics v_count = row_count;

  update lead_batches
  set screened_at = now(), status = 'ready', evidence_url = coalesce(p_evidence_url, evidence_url)
  where id = p_batch_id and workspace_id = v_workspace_id;

  return v_count;
end;
$$;

create or replace function auto_assign_campaign_leads(p_campaign_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_count int;
begin
  if not is_data_admin() then
    raise exception 'only a workspace manager can assign leads';
  end if;
  if not exists (select 1 from campaigns where id = p_campaign_id and workspace_id = v_ws) then
    raise exception 'campaign not found';
  end if;

  with roster as (
    select
      ca.user_id,
      row_number() over (order by ca.created_at, ca.user_id) as ord,
      greatest(
        ca.daily_target - (
          select count(*) from leads l
          where l.campaign_id = p_campaign_id and l.assigned_to = ca.user_id
            and l.status in ('assigned', 'contacted')
        ),
        0
      )::int as need
    from campaign_assignments ca
    join profiles p on p.id = ca.user_id and p.is_active
    where ca.campaign_id = p_campaign_id and ca.workspace_id = v_ws
  ),
  slots as (
    select r.user_id, r.ord, k
    from roster r, lateral generate_series(1, r.need) as k
  ),
  ranked_slots as (
    select user_id, row_number() over (order by k, ord) as rn from slots
  ),
  pool as (
    select l.id, row_number() over (order by l.created_at, l.id) as rn
    from leads l
    where l.campaign_id = p_campaign_id
      and l.workspace_id = v_ws
      and l.assigned_to is null
      and l.screening_status = 'passed'
      and not exists (
        select 1 from suppression_list s where s.workspace_id = v_ws and s.phone_hash = l.phone_hash
      )
  ),
  picks as (
    select pool.id, ranked_slots.user_id
    from pool join ranked_slots using (rn)
  )
  update leads l
  set assigned_to = picks.user_id
  from picks
  where l.id = picks.id and l.assigned_to is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ===================================================================== 3
alter table leads add column if not exists tags text[] not null default '{}';
create index if not exists leads_tags_idx on leads using gin (tags);

-- Saved column mappings: a repeat import (the weekly list, a CRM export)
-- takes one click. kind 'migration' templates also carry the CRM source and
-- the stage and owner mappings.
create table if not exists import_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null default 'import' check (kind in ('import', 'migration')),
  source text,
  headers text[] not null default '{}',
  mapping jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists import_templates_name_idx on import_templates (workspace_id, kind, lower(btrim(name)));
create trigger import_templates_set_updated_at before update on import_templates
  for each row execute function set_updated_at();

alter table import_templates enable row level security;
create policy import_templates_select on import_templates for select using (
  workspace_id = auth_workspace_id() and is_lead_gen_or_manager()
);
create policy import_templates_insert on import_templates for insert with check (
  workspace_id = auth_workspace_id() and is_lead_gen_or_manager() and created_by = auth.uid()
);
create policy import_templates_update on import_templates for update using (
  workspace_id = auth_workspace_id() and (is_data_admin() or created_by = auth.uid())
) with check (
  workspace_id = auth_workspace_id() and (is_data_admin() or created_by = auth.uid())
);
create policy import_templates_delete on import_templates for delete using (
  workspace_id = auth_workspace_id() and (is_data_admin() or created_by = auth.uid())
);
grant select, insert, update, delete on import_templates to authenticated;

-- ===================================================================== 4
-- Trash. A trashed lead keeps its row (and its calls, which cascade only on a
-- permanent delete) but is detached from its campaign, owner and pending
-- callbacks, so no dial queue, call sheet or auto-assignment can reach it.
-- What it was attached to is kept in trash_meta so a restore puts it back.
-- A restrictive policy hides trashed rows from every ordinary read; the
-- trash itself is read through trashed_leads() / trashed_contacts().
alter table leads
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists trash_meta jsonb;
alter table unphoned_contacts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists trash_meta jsonb;
create index if not exists leads_trash_idx on leads (workspace_id, deleted_at) where deleted_at is not null;
create index if not exists unphoned_contacts_trash_idx on unphoned_contacts (workspace_id, deleted_at) where deleted_at is not null;

create policy leads_hide_trashed on leads as restrictive for select using (deleted_at is null);
create policy unphoned_contacts_hide_trashed on unphoned_contacts as restrictive for select using (deleted_at is null);

-- One summary audit row per delete-type action (the row triggers already log
-- each record's before/after state).
create or replace function log_data_action(p_action text, p_entity text, p_entity_id uuid, p_data jsonb) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, workspace_id, action, entity_type, entity_id, after_data)
  values (auth.uid(), auth_workspace_id(), p_action, p_entity, p_entity_id, p_data)
$$;
revoke execute on function log_data_action(text, text, uuid, jsonb) from public, anon, authenticated;

-- Internal workers (no permission check of their own; never granted to a
-- user). The public wrappers below check the caller first.
create or replace function _trash_lead_rows(p_ws uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  with targets as (
    select l.id from leads l
    where l.id = any(p_ids) and l.workspace_id = p_ws and l.deleted_at is null
    for update
  ),
  parked as (
    update callbacks c set status = 'cancelled'
    where c.workspace_id = p_ws and c.status = 'pending' and c.lead_id in (select id from targets)
    returning c.id, c.lead_id
  )
  update leads l set
    trash_meta = jsonb_build_object(
      'campaign_id', l.campaign_id,
      'assigned_to', l.assigned_to,
      'assigned_by', l.assigned_by,
      'status', l.status,
      'callbacks', coalesce((select jsonb_agg(p.id) from parked p where p.lead_id = l.id), '[]'::jsonb)
    ),
    deleted_at = now(),
    deleted_by = auth.uid(),
    campaign_id = null,
    assigned_to = null,
    assigned_by = null,
    claimed_by = null,
    claimed_at = null
  from targets t
  where l.id = t.id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function _trash_contact_rows(p_ws uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  update unphoned_contacts u set
    trash_meta = jsonb_build_object('campaign_id', u.campaign_id, 'assigned_to', u.assigned_to),
    deleted_at = now(),
    deleted_by = auth.uid(),
    campaign_id = null,
    assigned_to = null
  where u.id = any(p_ids) and u.workspace_id = p_ws and u.deleted_at is null and u.promoted_lead_id is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function _trash_lead_rows(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function _trash_contact_rows(uuid, uuid[]) from public, anon, authenticated;

create or replace function trash_leads(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can delete leads.';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 5000 then
    raise exception 'Delete at most 5,000 leads at a time.';
  end if;
  v_n := _trash_lead_rows(auth_workspace_id(), p_ids);
  if v_n > 0 then
    perform log_data_action('trash', 'lead', null, jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

create or replace function trash_contacts(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can delete contacts.';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 5000 then
    raise exception 'Delete at most 5,000 contacts at a time.';
  end if;
  v_n := _trash_contact_rows(auth_workspace_id(), p_ids);
  if v_n > 0 then
    perform log_data_action('trash', 'unphoned_contact', null, jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

-- Restore puts a record back where it was, as far as that still exists: a
-- campaign that has since been deleted, or an owner who has left, is not
-- restored (the lead comes back unassigned / without a campaign).
create or replace function restore_leads(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_n int;
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can restore leads.';
  end if;
  with targets as (
    select l.id, l.trash_meta from leads l
    where l.id = any(p_ids) and l.workspace_id = v_ws and l.deleted_at is not null
    for update
  ),
  unparked as (
    update callbacks c set status = 'pending'
    where c.workspace_id = v_ws and c.status = 'cancelled'
      and c.id in (
        select (jsonb_array_elements_text(coalesce(t.trash_meta -> 'callbacks', '[]'::jsonb)))::uuid from targets t
      )
    returning c.id
  )
  update leads l set
    campaign_id = (
      select c.id from campaigns c
      where c.id = nullif(t.trash_meta ->> 'campaign_id', '')::uuid and c.workspace_id = v_ws
    ),
    assigned_to = (
      select p.id from profiles p
      where p.id = nullif(t.trash_meta ->> 'assigned_to', '')::uuid and p.workspace_id = v_ws and p.is_active
        and p.role not in ('data_manager', 'lead_gen', 'client')
    ),
    assigned_by = (
      select p.id from profiles p
      where p.id = nullif(t.trash_meta ->> 'assigned_by', '')::uuid and p.workspace_id = v_ws
    ),
    status = coalesce(t.trash_meta ->> 'status', l.status),
    deleted_at = null,
    deleted_by = null,
    trash_meta = null
  from targets t
  where l.id = t.id;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform log_data_action('restore', 'lead', null, jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

create or replace function restore_contacts(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_n int;
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can restore contacts.';
  end if;
  update unphoned_contacts u set
    campaign_id = (
      select c.id from campaigns c
      where c.id = nullif(u.trash_meta ->> 'campaign_id', '')::uuid and c.workspace_id = v_ws
    ),
    assigned_to = (
      select p.id from profiles p
      where p.id = nullif(u.trash_meta ->> 'assigned_to', '')::uuid and p.workspace_id = v_ws and p.is_active
    ),
    deleted_at = null,
    deleted_by = null,
    trash_meta = null
  where u.id = any(p_ids) and u.workspace_id = v_ws and u.deleted_at is not null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform log_data_action('restore', 'unphoned_contact', null, jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

-- Permanent delete. A lead's calls and callbacks go with it (their foreign
-- keys cascade); the audit log keeps who deleted what and when.
create or replace function purge_leads(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not can_purge() then
    raise exception 'Only a super admin (or an ops manager they have allowed) can permanently delete.';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 5000 then
    raise exception 'Delete at most 5,000 leads at a time.';
  end if;
  delete from leads where id = any(p_ids) and workspace_id = auth_workspace_id();
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform log_data_action('purge', 'lead', null, jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

create or replace function purge_contacts(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not can_purge() then
    raise exception 'Only a super admin (or an ops manager they have allowed) can permanently delete.';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 5000 then
    raise exception 'Delete at most 5,000 contacts at a time.';
  end if;
  delete from unphoned_contacts where id = any(p_ids) and workspace_id = auth_workspace_id();
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform log_data_action('purge', 'unphoned_contact', null, jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

-- Everything past the workspace's retention period is deleted for good.
-- Expiry is policy, not a choice, so any data admin's visit to the trash
-- runs it; purge_all_expired_trash() does every workspace for a scheduled job.
create or replace function _purge_expired(p_ws uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_days int;
  v_leads int;
  v_contacts int;
begin
  select trash_retention_days into v_days from workspaces where id = p_ws;
  if v_days is null then
    return jsonb_build_object('leads', 0, 'contacts', 0);
  end if;
  delete from leads where workspace_id = p_ws and deleted_at < now() - make_interval(days => v_days);
  get diagnostics v_leads = row_count;
  delete from unphoned_contacts where workspace_id = p_ws and deleted_at < now() - make_interval(days => v_days);
  get diagnostics v_contacts = row_count;
  if v_leads + v_contacts > 0 then
    insert into audit_log (actor_id, workspace_id, action, entity_type, entity_id, after_data)
    values (auth.uid(), p_ws, 'trash_expired', 'workspace', p_ws,
            jsonb_build_object('leads', v_leads, 'contacts', v_contacts, 'retention_days', v_days));
  end if;
  return jsonb_build_object('leads', v_leads, 'contacts', v_contacts);
end;
$$;
revoke execute on function _purge_expired(uuid) from public, anon, authenticated;

create or replace function purge_expired_trash() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_data_admin() then
    raise exception 'not allowed';
  end if;
  return _purge_expired(auth_workspace_id());
end;
$$;

create or replace function purge_all_expired_trash() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_total int := 0;
  v_r jsonb;
begin
  for v_ws in select distinct workspace_id from leads where deleted_at is not null
              union select distinct workspace_id from unphoned_contacts where deleted_at is not null
  loop
    v_r := _purge_expired(v_ws);
    v_total := v_total + (v_r ->> 'leads')::int + (v_r ->> 'contacts')::int;
  end loop;
  return v_total;
end;
$$;
revoke execute on function purge_all_expired_trash() from public, anon, authenticated;
grant execute on function purge_all_expired_trash() to service_role;

-- The trash view. Only the columns the trash screen shows.
create or replace function trashed_leads(p_limit int default 500)
returns table (
  id uuid, full_name text, company_name text, phone_e164 text, email text, campaign_id uuid, campaign_name text,
  batch_id uuid, deleted_at timestamptz, deleted_by uuid, deleted_by_name text, expires_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_days int;
begin
  if not is_data_admin() then
    raise exception 'not allowed';
  end if;
  select w.trash_retention_days into v_days from workspaces w where w.id = v_ws;
  return query
    select l.id, l.full_name, l.company_name, l.phone_e164, l.email,
           nullif(l.trash_meta ->> 'campaign_id', '')::uuid,
           c.name, l.batch_id, l.deleted_at, l.deleted_by, p.full_name,
           l.deleted_at + make_interval(days => v_days)
    from leads l
    left join campaigns c on c.id = nullif(l.trash_meta ->> 'campaign_id', '')::uuid and c.workspace_id = v_ws
    left join profiles p on p.id = l.deleted_by
    where l.workspace_id = v_ws and l.deleted_at is not null
    order by l.deleted_at desc
    limit least(greatest(coalesce(p_limit, 500), 1), 2000);
end;
$$;

create or replace function trashed_contacts(p_limit int default 500)
returns table (
  id uuid, full_name text, company_name text, email text, campaign_id uuid, campaign_name text,
  deleted_at timestamptz, deleted_by uuid, deleted_by_name text, expires_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_days int;
begin
  if not is_data_admin() then
    raise exception 'not allowed';
  end if;
  select w.trash_retention_days into v_days from workspaces w where w.id = v_ws;
  return query
    select u.id, u.full_name, u.company_name, u.email,
           nullif(u.trash_meta ->> 'campaign_id', '')::uuid,
           c.name, u.deleted_at, u.deleted_by, p.full_name,
           u.deleted_at + make_interval(days => v_days)
    from unphoned_contacts u
    left join campaigns c on c.id = nullif(u.trash_meta ->> 'campaign_id', '')::uuid and c.workspace_id = v_ws
    left join profiles p on p.id = u.deleted_by
    where u.workspace_id = v_ws and u.deleted_at is not null
    order by u.deleted_at desc
    limit least(greatest(coalesce(p_limit, 500), 1), 2000);
end;
$$;

create or replace function trash_counts() returns table (leads bigint, contacts bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_data_admin() then
    raise exception 'not allowed';
  end if;
  return query select
    (select count(*) from leads l where l.workspace_id = auth_workspace_id() and l.deleted_at is not null),
    (select count(*) from unphoned_contacts u where u.workspace_id = auth_workspace_id() and u.deleted_at is not null);
end;
$$;

-- ===================================================================== 5
alter table lead_batches drop constraint if exists lead_batches_status_check;
alter table lead_batches add constraint lead_batches_status_check
  check (status in ('uploaded', 'processing', 'ready', 'undone'));
alter table source_fetch_runs drop constraint if exists source_fetch_runs_status_check;
alter table source_fetch_runs add constraint source_fetch_runs_status_check
  check (status in ('running', 'complete', 'failed', 'undone'));

-- Undo an import: every lead the import created and every contact it held
-- goes to the trash (so even an undo can itself be undone from the trash).
-- Leads an "update existing" import changed are not touched; only what the
-- import created. Allowed for 7 days after the import.
create or replace function undo_import(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_run source_fetch_runs;
  v_leads int := 0;
  v_contacts int := 0;
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can undo an import.';
  end if;
  select * into v_run from source_fetch_runs where id = p_run_id and workspace_id = v_ws for update;
  if v_run.id is null then
    raise exception 'Import not found.';
  end if;
  if v_run.status = 'undone' then
    raise exception 'This import has already been undone.';
  end if;
  if coalesce(v_run.finished_at, v_run.started_at) < now() - interval '7 days' then
    raise exception 'Imports can be undone for 7 days. Delete the leads from the Leads page instead.';
  end if;

  if v_run.batch_id is not null then
    v_leads := _trash_lead_rows(v_ws, array(
      select id from leads where batch_id = v_run.batch_id and workspace_id = v_ws and deleted_at is null
    ));
    update lead_batches set status = 'undone' where id = v_run.batch_id and workspace_id = v_ws;
  end if;
  v_contacts := _trash_contact_rows(v_ws, array(
    select id from unphoned_contacts where run_id = p_run_id and workspace_id = v_ws and deleted_at is null
  ));
  update source_fetch_runs set status = 'undone' where id = p_run_id;

  perform log_data_action('undo_import', 'source_fetch_run', p_run_id,
    jsonb_build_object('leads', v_leads, 'contacts', v_contacts));
  return jsonb_build_object('leads', v_leads, 'contacts', v_contacts);
end;
$$;

-- ===================================================================== 6
-- Existing leads matching a file's numbers or emails. Lead ids are only
-- returned to roles that may update leads; lead gen gets the match kinds
-- (enough to skip duplicates) and nothing else. Trashed leads are reported
-- as such, so an import never quietly duplicates something in the trash.
create or replace function import_find_existing(p_hashes text[], p_emails text[])
returns table (match_on text, match_value text, lead_id uuid, trashed boolean, suppressed boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_ids boolean := is_data_admin();
begin
  if not is_lead_gen_or_manager() then
    raise exception 'not allowed';
  end if;
  return query
    select 'phone'::text, l.phone_hash, case when v_ids then l.id end, l.deleted_at is not null, false
      from leads l
      where l.workspace_id = v_ws and l.phone_hash = any(coalesce(p_hashes, '{}'))
    union all
    select 'email'::text, lower(l.email), case when v_ids then l.id end, l.deleted_at is not null, false
      from leads l
      where l.workspace_id = v_ws and l.email is not null
        and lower(l.email) = any(coalesce(p_emails, '{}'))
    union all
    select 'phone'::text, s.phone_hash, null::uuid, false, true
      from suppression_list s
      where s.workspace_id = v_ws and s.phone_hash = any(coalesce(p_hashes, '{}'));
end;
$$;

-- "Update existing" imports and CRM migration: one statement per chunk.
-- Runs as the caller, so row-level security decides which leads it may
-- touch. Empty values never overwrite; tags and extra information merge.
create or replace function import_update_leads(p_rows jsonb) returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_n int;
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can update existing leads.';
  end if;
  update leads l set
    full_name = coalesce(r.full_name, l.full_name),
    company_name = coalesce(r.company_name, l.company_name),
    email = coalesce(r.email, l.email),
    contact_name = coalesce(r.contact_name, l.contact_name),
    website = coalesce(r.website, l.website),
    agent_notes = case
      when r.agent_notes is null then l.agent_notes
      when l.agent_notes is null or l.agent_notes = '' then r.agent_notes
      when position(r.agent_notes in l.agent_notes) > 0 then l.agent_notes
      else l.agent_notes || E'\n\n' || r.agent_notes
    end,
    next_step = coalesce(r.next_step, l.next_step),
    appointment_at = coalesce(r.appointment_at, l.appointment_at),
    last_contact_at = coalesce(r.last_contact_at, l.last_contact_at),
    status = coalesce(r.status, l.status),
    group_label = coalesce(r.group_label, l.group_label),
    tags = case when r.tags is null then l.tags
                else array(select distinct t from unnest(l.tags || r.tags) as t where t is not null and t <> '' order by t) end,
    custom = coalesce(l.custom, '{}'::jsonb) || coalesce(r.custom, '{}'::jsonb),
    campaign_id = coalesce(l.campaign_id, r.campaign_id),
    assigned_to = coalesce(r.assigned_to, l.assigned_to),
    assigned_by = case when r.assigned_to is not null then auth.uid() else l.assigned_by end
  from jsonb_to_recordset(p_rows) as r(
    id uuid, full_name text, company_name text, email text, contact_name text, website text,
    agent_notes text, next_step text, appointment_at timestamptz, last_contact_at timestamptz,
    status text, group_label text, tags text[], custom jsonb, campaign_id uuid, assigned_to uuid
  )
  where l.id = r.id and l.workspace_id = auth_workspace_id();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ===================================================================== 7
-- Data-subject requests. find_person_data() shows everything held about one
-- person (by email and/or phone hash), trashed records included;
-- erase_person() deletes it for good, scrubs the copies the row-level audit
-- triggers keep, and can add the number to the suppression list so the
-- person is never loaded again. The audit log records that an erasure
-- happened and how much was removed, never who it was about.
create or replace function find_person_data(p_email text, p_phone_hash text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_hash text := nullif(btrim(coalesce(p_phone_hash, '')), '');
  v_leads jsonb;
  v_contacts jsonb;
begin
  if not is_workspace_manager() then
    raise exception 'Only an admin or ops manager can search for a person''s data.';
  end if;
  if v_email is null and v_hash is null then
    raise exception 'Give an email address or a phone number.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'full_name', l.full_name, 'company_name', l.company_name, 'email', l.email,
      'phone_e164', l.phone_e164, 'status', l.status, 'created_at', l.created_at, 'deleted_at', l.deleted_at,
      'calls', (select count(*) from calls c where c.lead_id = l.id),
      'recordings', (select count(*) from calls c where c.lead_id = l.id and c.recording_path is not null),
      'callbacks', (select count(*) from callbacks cb where cb.lead_id = l.id)
    ) order by l.created_at), '[]'::jsonb)
  into v_leads
  from leads l
  where l.workspace_id = v_ws
    and ((v_hash is not null and l.phone_hash = v_hash) or (v_email is not null and lower(l.email) = v_email));

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id, 'full_name', u.full_name, 'company_name', u.company_name, 'email', u.email,
      'created_at', u.created_at, 'deleted_at', u.deleted_at
    ) order by u.created_at), '[]'::jsonb)
  into v_contacts
  from unphoned_contacts u
  where u.workspace_id = v_ws and v_email is not null and lower(u.email) = v_email;

  return jsonb_build_object(
    'leads', v_leads,
    'contacts', v_contacts,
    'emails_sent', (select count(*) from email_log e where e.workspace_id = v_ws and v_email is not null and lower(e.to_email) = v_email),
    'suppressed', v_hash is not null and exists (select 1 from suppression_list s where s.workspace_id = v_ws and s.phone_hash = v_hash)
  );
end;
$$;

-- Recording files live in Storage, which SQL can't delete: the app removes
-- them through the Storage API (paths from person_recording_paths()) before
-- calling erase_person().
create or replace function person_recording_paths(p_email text, p_phone_hash text)
returns setof text
language plpgsql stable security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_hash text := nullif(btrim(coalesce(p_phone_hash, '')), '');
begin
  if not can_purge() then
    raise exception 'not allowed';
  end if;
  return query
    select c.recording_path from calls c
    join leads l on l.id = c.lead_id
    where l.workspace_id = v_ws and c.recording_path is not null
      and ((v_hash is not null and l.phone_hash = v_hash) or (v_email is not null and lower(l.email) = v_email));
end;
$$;

create or replace function erase_person(p_email text, p_phone_hash text, p_suppress boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_hash text := nullif(btrim(coalesce(p_phone_hash, '')), '');
  v_lead_ids uuid[];
  v_call_ids uuid[];
  v_contact_ids uuid[];
  v_leads int := 0;
  v_contacts int := 0;
  v_emails int := 0;
  v_calls int := 0;
  v_suppressed boolean := false;
begin
  if not can_purge() then
    raise exception 'Only a super admin (or an ops manager they have allowed) can erase a person''s data.';
  end if;
  if v_email is null and v_hash is null then
    raise exception 'Give an email address or a phone number.';
  end if;

  select coalesce(array_agg(l.id), '{}') into v_lead_ids from leads l
  where l.workspace_id = v_ws
    and ((v_hash is not null and l.phone_hash = v_hash) or (v_email is not null and lower(l.email) = v_email));
  select coalesce(array_agg(c.id), '{}') into v_call_ids from calls c where c.lead_id = any(v_lead_ids);
  v_calls := coalesce(array_length(v_call_ids, 1), 0);
  select coalesce(array_agg(u.id), '{}') into v_contact_ids from unphoned_contacts u
  where u.workspace_id = v_ws and v_email is not null and lower(u.email) = v_email;

  delete from leads where id = any(v_lead_ids);
  get diagnostics v_leads = row_count;
  delete from unphoned_contacts where id = any(v_contact_ids);
  get diagnostics v_contacts = row_count;
  if v_email is not null then
    delete from email_log where workspace_id = v_ws and lower(to_email) = v_email;
    get diagnostics v_emails = row_count;
  end if;
  -- The row-level audit triggers kept copies of these records (including the
  -- ones the deletes above just logged); scrub every one of them.
  update audit_log set before_data = null, after_data = null
  where workspace_id = v_ws and (
    (entity_type = 'lead' and entity_id = any(v_lead_ids))
    or (entity_type = 'call' and entity_id = any(v_call_ids))
    or (entity_type = 'unphoned_contact' and entity_id = any(v_contact_ids))
  );

  if p_suppress and v_hash is not null
     and not exists (select 1 from suppression_list s where s.workspace_id = v_ws and s.phone_hash = v_hash) then
    insert into suppression_list (workspace_id, phone_hash, reason, note, added_by)
    values (v_ws, v_hash, 'erasure_request', 'Added when this person''s data was erased', auth.uid());
    v_suppressed := true;
  end if;

  perform log_data_action('erase_person', 'data_subject', null, jsonb_build_object(
    'leads', v_leads, 'calls', v_calls, 'contacts', v_contacts, 'emails', v_emails, 'suppressed', v_suppressed
  ));
  return jsonb_build_object('leads', v_leads, 'calls', v_calls, 'contacts', v_contacts, 'emails', v_emails, 'suppressed', v_suppressed);
end;
$$;

-- ------------------------------------------------------------- grants
do $$
declare
  f text;
begin
  foreach f in array array[
    'trash_leads(uuid[])', 'trash_contacts(uuid[])', 'restore_leads(uuid[])', 'restore_contacts(uuid[])',
    'purge_leads(uuid[])', 'purge_contacts(uuid[])', 'purge_expired_trash()', 'trashed_leads(int)',
    'trashed_contacts(int)', 'trash_counts()', 'undo_import(uuid)', 'import_find_existing(text[], text[])',
    'import_update_leads(jsonb)', 'find_person_data(text, text)', 'person_recording_paths(text, text)',
    'erase_person(text, text, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

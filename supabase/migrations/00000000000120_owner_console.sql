-- Owner console (/platform): trials, a manual billing ledger, an owner
-- audit trail and read-only aggregate RPCs for the vendor's own staff.
--
-- Everything the console reads is a count or metadata. Like the existing
-- platform_workspace_stats(), no function here returns lead phone numbers,
-- recordings, notes or call content.
--
-- Sections
--   1. Trial and billing columns on workspaces (+ guard), private notes.
--   2. platform_ledger: charges, payments, credits (gateway-ready).
--   3. platform_audit: every owner action.
--   4. Read RPCs for the console.

-- ===================================================================== 1
alter table workspaces
  add column if not exists trial_ends_at timestamptz default (now() + interval '30 days'),
  add column if not exists billing_amount numeric(12,2) check (billing_amount is null or billing_amount >= 0),
  add column if not exists billing_currency text not null default 'USD' check (billing_currency ~ '^[A-Z]{3}$'),
  add column if not exists billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'quarterly', 'yearly')),
  add column if not exists next_due_date date;

-- Existing customer workspaces get a 30-day trial from when they signed up.
-- The demo workspace and Assorted's own (unlimited-seat) workspaces have no
-- trial.
alter table workspaces disable trigger workspaces_guard_self_update;
update workspaces set trial_ends_at = null where is_demo or seat_limit >= 2147483647;
update workspaces set trial_ends_at = created_at + interval '30 days'
  where not is_demo and seat_limit < 2147483647;
alter table workspaces enable trigger workspaces_guard_self_update;

-- Same guard as migration 117, now also covering the owner-only columns.
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
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.billing_amount is distinct from old.billing_amount
     or new.billing_currency is distinct from old.billing_currency
     or new.billing_cycle is distinct from old.billing_cycle
     or new.next_due_date is distinct from old.next_due_date
  then
    raise exception 'plan, seats, status, trial and billing fields can only be changed by the service role or a platform admin';
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

-- The vendor's private notes about a customer live in their own table: a
-- workspace's members can read their own workspaces row, so notes can't be
-- a column there.
create table if not exists platform_workspace_notes (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table platform_workspace_notes enable row level security;
create policy platform_workspace_notes_select on platform_workspace_notes for select using (is_platform_admin());
grant select on platform_workspace_notes to authenticated;

-- ===================================================================== 2
create table if not exists platform_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('charge', 'payment', 'credit')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  occurred_on date not null default current_date,
  method text check (method in ('bank_transfer', 'cash', 'card', 'gateway', 'other')),
  reference text,
  note text,
  -- Reserved for a payment gateway's webhook (provider name + its own id),
  -- so a gateway payment lands in the same ledger and is never duplicated.
  provider text,
  provider_ref text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists platform_ledger_workspace_idx on platform_ledger (workspace_id, occurred_on desc);
create unique index if not exists platform_ledger_provider_ref_idx
  on platform_ledger (provider, provider_ref) where provider_ref is not null;

alter table platform_ledger enable row level security;
-- Platform admins read; writes go through the service role from owner
-- server actions. No tenant role has any policy here.
create policy platform_ledger_select on platform_ledger for select using (is_platform_admin());
grant select on platform_ledger to authenticated;

-- ===================================================================== 3
create table if not exists platform_audit (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  workspace_id uuid references workspaces(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_created_idx on platform_audit (created_at desc);
create index if not exists platform_audit_workspace_idx on platform_audit (workspace_id, created_at desc);

alter table platform_audit enable row level security;
create policy platform_audit_select on platform_audit for select using (is_platform_admin());
grant select on platform_audit to authenticated;

-- ===================================================================== 4
-- Balance per workspace: charges minus payments and credits.
create or replace function platform_balance(p_workspace_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when kind = 'charge' then amount else -amount end), 0)
  from platform_ledger where workspace_id = p_workspace_id
$$;
revoke execute on function platform_balance(uuid) from public, anon, authenticated;

-- One row per workspace with everything the companies table needs.
create or replace function platform_workspace_metrics() returns table (
  workspace_id uuid,
  owner_email text,
  owner_name text,
  users_total bigint,
  users_active bigint,
  agents_active bigint,
  data_seats_used bigint,
  campaigns bigint,
  leads bigint,
  clients bigint,
  calls_today bigint,
  calls_7d bigint,
  calls_30d bigint,
  calls_total bigint,
  talk_seconds_30d bigint,
  talk_seconds_total bigint,
  last_call_at timestamptz,
  last_sign_in_at timestamptz,
  agents_active_today bigint,
  zoom_connected boolean,
  emails_sent_30d bigint,
  balance numeric,
  paid_total numeric,
  last_payment_on date
)
language sql stable security definer set search_path = public, auth as $$
  select
    w.id,
    coalesce(op.email, ou.email::text),
    op.full_name,
    (select count(*) from profiles p where p.workspace_id = w.id),
    (select count(*) from profiles p where p.workspace_id = w.id and p.is_active),
    (select count(*) from profiles p where p.workspace_id = w.id and p.is_active and p.role = 'agent'),
    (select count(*) from profiles p where p.workspace_id = w.id and p.is_active and p.role = 'data_manager'),
    (select count(*) from campaigns c where c.workspace_id = w.id),
    (select count(*) from leads l where l.workspace_id = w.id and l.deleted_at is null),
    (select count(*) from clients cl where cl.workspace_id = w.id),
    (select count(*) from calls c where c.workspace_id = w.id and c.created_at >= date_trunc('day', now())),
    (select count(*) from calls c where c.workspace_id = w.id and c.created_at >= now() - interval '7 days'),
    (select count(*) from calls c where c.workspace_id = w.id and c.created_at >= now() - interval '30 days'),
    (select count(*) from calls c where c.workspace_id = w.id),
    (select coalesce(sum(c.duration_seconds), 0) from calls c where c.workspace_id = w.id and c.created_at >= now() - interval '30 days'),
    (select coalesce(sum(c.duration_seconds), 0) from calls c where c.workspace_id = w.id),
    (select max(c.created_at) from calls c where c.workspace_id = w.id),
    (select max(u.last_sign_in_at) from profiles p join auth.users u on u.id = p.id where p.workspace_id = w.id),
    (select count(distinct ae.user_id) from attendance_events ae
       where ae.workspace_id = w.id and ae.occurred_at >= date_trunc('day', now()) and ae.event_type = 'clock_in'),
    coalesce((select zc.status = 'connected' from zoom_credentials zc where zc.workspace_id = w.id), false),
    (select count(*) from email_log e where e.workspace_id = w.id and e.status = 'sent' and e.created_at >= now() - interval '30 days'),
    platform_balance(w.id),
    (select coalesce(sum(pl.amount), 0) from platform_ledger pl where pl.workspace_id = w.id and pl.kind = 'payment'),
    (select max(pl.occurred_on) from platform_ledger pl where pl.workspace_id = w.id and pl.kind = 'payment')
  from workspaces w
  left join profiles op on op.id = w.created_by
  left join auth.users ou on ou.id = w.created_by
  where is_platform_admin()
$$;
revoke execute on function platform_workspace_metrics() from public, anon, authenticated;
grant execute on function platform_workspace_metrics() to authenticated;

-- Every user across every workspace (or one workspace).
create or replace function platform_users(p_workspace_id uuid default null) returns table (
  user_id uuid,
  workspace_id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  must_change_password boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  calls_30d bigint,
  talk_seconds_30d bigint,
  last_call_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select
    p.id, p.workspace_id, p.email, p.full_name, p.role::text, p.is_active, p.must_change_password,
    p.created_at, u.last_sign_in_at,
    (select count(*) from calls c where c.agent_id = p.id and c.created_at >= now() - interval '30 days'),
    (select coalesce(sum(c.duration_seconds), 0) from calls c where c.agent_id = p.id and c.created_at >= now() - interval '30 days'),
    (select max(c.created_at) from calls c where c.agent_id = p.id)
  from profiles p
  left join auth.users u on u.id = p.id
  where is_platform_admin() and (p_workspace_id is null or p.workspace_id = p_workspace_id)
  order by p.created_at desc
$$;
revoke execute on function platform_users(uuid) from public, anon, authenticated;
grant execute on function platform_users(uuid) to authenticated;

-- Dialer usage per agent for a time window. Hours clocked pairs each
-- clock_in with the next clock_out (open shifts count up to now, capped at
-- 16 hours so a forgotten clock-out doesn't inflate the total).
create or replace function platform_agent_usage(p_from timestamptz, p_to timestamptz, p_workspace_id uuid default null)
returns table (
  user_id uuid,
  workspace_id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  calls bigint,
  connects bigint,
  conversions bigint,
  talk_seconds bigint,
  first_call_at timestamptz,
  last_call_at timestamptz,
  days_active bigint,
  clocked_seconds bigint,
  first_call_ever timestamptz
)
language sql stable security definer set search_path = public as $$
  with agents as (
    select p.* from profiles p
    where is_platform_admin()
      and (p_workspace_id is null or p.workspace_id = p_workspace_id)
      and (p.role in ('agent', 'super_admin', 'ops_manager', 'team_lead')
           or exists (select 1 from calls c where c.agent_id = p.id))
  ),
  win as (
    select c.agent_id, c.created_at, c.duration_seconds, d.outcome_group
    from calls c
    left join dispositions d on d.id = c.disposition_id
    where c.created_at >= p_from and c.created_at < p_to
      and c.agent_id in (select id from agents)
  ),
  ev as (
    select ae.user_id, ae.event_type, ae.occurred_at,
      lead(ae.event_type) over (partition by ae.user_id order by ae.occurred_at) as next_type,
      lead(ae.occurred_at) over (partition by ae.user_id order by ae.occurred_at) as next_at
    from attendance_events ae
    where ae.user_id in (select id from agents)
      and ae.event_type in ('clock_in', 'clock_out')
      and ae.occurred_at >= p_from - interval '1 day' and ae.occurred_at < p_to
  ),
  clocked as (
    select user_id, sum(
      least(
        extract(epoch from (
          least(case when next_type = 'clock_out' then next_at else now() end, p_to)
          - greatest(occurred_at, p_from)
        )),
        16 * 3600
      )
    )::bigint as secs
    from ev
    where event_type = 'clock_in'
      and least(case when next_type = 'clock_out' then next_at else now() end, p_to) > greatest(occurred_at, p_from)
    group by user_id
  )
  select
    a.id, a.workspace_id, a.email, a.full_name, a.role::text, a.is_active,
    (select count(*) from win where win.agent_id = a.id),
    (select count(*) from win where win.agent_id = a.id and win.outcome_group in ('connect', 'conversion', 'dnc')),
    (select count(*) from win where win.agent_id = a.id and win.outcome_group = 'conversion'),
    (select coalesce(sum(win.duration_seconds), 0) from win where win.agent_id = a.id),
    (select min(win.created_at) from win where win.agent_id = a.id),
    (select max(win.created_at) from win where win.agent_id = a.id),
    (select count(distinct date_trunc('day', win.created_at)) from win where win.agent_id = a.id),
    coalesce((select secs from clocked where clocked.user_id = a.id), 0),
    (select min(c.created_at) from calls c where c.agent_id = a.id)
  from agents a
$$;
revoke execute on function platform_agent_usage(timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function platform_agent_usage(timestamptz, timestamptz, uuid) to authenticated;

-- Daily series for charts: calls, talk minutes and signups.
create or replace function platform_daily_series(p_days int default 30, p_workspace_id uuid default null)
returns table (day date, calls bigint, talk_minutes numeric, signups bigint)
language sql stable security definer set search_path = public as $$
  with days as (
    select generate_series(current_date - (greatest(least(p_days, 366), 1) - 1), current_date, interval '1 day')::date as day
  )
  select
    d.day,
    (select count(*) from calls c
       where c.created_at >= d.day and c.created_at < d.day + 1
         and (p_workspace_id is null or c.workspace_id = p_workspace_id)),
    round((select coalesce(sum(c.duration_seconds), 0) from calls c
       where c.created_at >= d.day and c.created_at < d.day + 1
         and (p_workspace_id is null or c.workspace_id = p_workspace_id)) / 60.0, 1),
    (select count(*) from workspaces w
       where w.created_at >= d.day and w.created_at < d.day + 1 and not w.is_demo
         and (p_workspace_id is null or w.id = p_workspace_id))
  from days d
  where is_platform_admin()
  order by d.day
$$;
revoke execute on function platform_daily_series(int, uuid) from public, anon, authenticated;
grant execute on function platform_daily_series(int, uuid) to authenticated;

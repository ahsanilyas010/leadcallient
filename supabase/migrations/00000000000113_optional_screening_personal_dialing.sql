-- Screening is a choice, not a gate; personal lists are dialable.
--
-- 1. workspaces.require_screening (default off). When it is off, a lead no
--    longer has to pass screening before it can be dialled. The suppression
--    list (do-not-call) still blocks a number whatever this is set to, and
--    screening stays available under Compliance for workspaces that want the
--    TPS/DNC-style check before every call. Managers switch it under
--    Compliance; a workspace that needs the gate turns it on.
-- 2. A lead that belongs to no campaign ("I assigned this sheet to myself")
--    can be dialled by the agent it is assigned to, and is served by the dial
--    queue after campaign leads. Campaign-level rules do not exist for it, so
--    the campaign defaults apply: 6 attempts, 24 hours cooling-off, no calling
--    window, no roster.
--
-- Everything else in the gate is unchanged: suppression, demo allow-list,
-- claims, attempts, cooling-off, calling window, roster and assignment.

alter table workspaces add column if not exists require_screening boolean not null default false;

-- ----------------------------------------------------------------- queue
create or replace function next_lead_for_agent(p_agent_id uuid) returns leads
language plpgsql security definer set search_path = public as $$
declare
  v_workspace_id uuid;
  v_workspace workspaces;
  v_lead leads;
  v_claim_ttl constant interval := interval '10 minutes';
  v_default_max_attempts constant int := 6;
  v_default_cooling_off constant interval := interval '24 hours';
begin
  if p_agent_id is distinct from auth.uid() then
    raise exception 'agents can only pull their own next lead';
  end if;

  v_workspace_id := auth_workspace_id();
  select * into v_workspace from workspaces where id = v_workspace_id;

  -- Queue 1: a due-now callback assigned to this agent.
  select l.* into v_lead
  from callbacks cb
  join leads l on l.id = cb.lead_id
  left join campaigns c on c.id = l.campaign_id
  where cb.workspace_id = v_workspace_id
    and cb.agent_id = p_agent_id
    and cb.status = 'pending'
    and cb.due_at <= now()
    and l.phone_e164 is not null
    and (l.claimed_by is null or l.claimed_at < now() - v_claim_ttl)
    and l.attempts < coalesce(c.max_attempts, v_default_max_attempts)
    and not exists (
      select 1 from suppression_list s where s.workspace_id = v_workspace_id and s.phone_hash = l.phone_hash
    )
    and (not v_workspace.is_demo or l.phone_e164 = any(v_workspace.demo_allowed_numbers))
  order by cb.due_at asc
  limit 1
  for update of l skip locked;

  if v_lead.id is not null then
    update leads set claimed_by = p_agent_id, claimed_at = now() where id = v_lead.id returning * into v_lead;
    return v_lead;
  end if;

  -- Queue 2: a fresh, dialable lead in one of this agent's campaigns.
  select l.* into v_lead
  from leads l
  join campaigns c on c.id = l.campaign_id
  join campaign_assignments ca on ca.campaign_id = c.id and ca.user_id = p_agent_id
  where l.workspace_id = v_workspace_id
    and c.status = 'active'
    and (l.assigned_to is null or l.assigned_to = p_agent_id)
    and (not v_workspace.require_screening or (l.screening_status = 'passed' and l.screened_at is not null))
    and (l.claimed_by is null or l.claimed_at < now() - v_claim_ttl)
    and l.attempts < c.max_attempts
    and (l.last_attempt_at is null or l.last_attempt_at < now() - (c.cooling_off_hours || ' hours')::interval)
    and (
      c.calling_window_start is null or c.calling_window_end is null
      or (now() at time zone coalesce(c.timezone, 'UTC'))::time between c.calling_window_start and c.calling_window_end
    )
    and not exists (
      select 1 from suppression_list s where s.workspace_id = v_workspace_id and s.phone_hash = l.phone_hash
    )
    and (not v_workspace.is_demo or l.phone_e164 = any(v_workspace.demo_allowed_numbers))
  order by l.created_at asc
  limit 1
  for update of l skip locked;

  if v_lead.id is not null then
    update leads set claimed_by = p_agent_id, claimed_at = now() where id = v_lead.id returning * into v_lead;
    return v_lead;
  end if;

  -- Queue 3: the agent's own list: leads assigned to them that belong to no
  -- campaign. Campaign defaults apply (attempts, cooling-off); no window.
  select l.* into v_lead
  from leads l
  where l.workspace_id = v_workspace_id
    and l.campaign_id is null
    and l.assigned_to = p_agent_id
    and l.phone_e164 is not null and btrim(l.phone_e164) <> ''
    and l.status not in ('rejected', 'converted')
    and (not v_workspace.require_screening or (l.screening_status = 'passed' and l.screened_at is not null))
    and (l.claimed_by is null or l.claimed_at < now() - v_claim_ttl)
    and l.attempts < v_default_max_attempts
    and (l.last_attempt_at is null or l.last_attempt_at < now() - v_default_cooling_off)
    and not exists (
      select 1 from suppression_list s where s.workspace_id = v_workspace_id and s.phone_hash = l.phone_hash
    )
    and (not v_workspace.is_demo or l.phone_e164 = any(v_workspace.demo_allowed_numbers))
  order by l.created_at asc
  limit 1
  for update of l skip locked;

  if v_lead.id is null then
    return null;
  end if;

  update leads set claimed_by = p_agent_id, claimed_at = now() where id = v_lead.id returning * into v_lead;
  return v_lead;
end;
$$;

-- ------------------------------------------------------- call sheet gate
create or replace function lead_dial_block_reason(p_lead_id uuid, p_agent_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_claim_ttl constant interval := interval '10 minutes';
  v_default_max_attempts constant int := 6;
  v_default_cooling_off_hours constant int := 24;
  v_workspace_id uuid := auth_workspace_id();
  v_workspace workspaces;
  v_lead leads;
  v_c campaigns;
  v_max_attempts int;
  v_cooling_off_hours int;
  v_tz text;
  v_until timestamptz;
begin
  if p_agent_id is distinct from auth.uid() then
    raise exception 'You can only check your own dialability.';
  end if;

  select * into v_lead from leads where id = p_lead_id and workspace_id = v_workspace_id;
  if v_lead.id is null then
    return 'Lead not found';
  end if;

  select * into v_workspace from workspaces where id = v_workspace_id;
  if v_workspace.status = 'suspended' then
    return 'Workspace is suspended';
  end if;

  if v_lead.phone_e164 is null or btrim(v_lead.phone_e164) = '' then
    return 'No phone number yet';
  end if;

  if v_lead.campaign_id is null then
    -- A personal list: no roster or calling window, campaign defaults for the rest.
    if v_lead.assigned_to is not null and v_lead.assigned_to <> p_agent_id then
      return 'Assigned to another agent';
    end if;
    v_max_attempts := v_default_max_attempts;
    v_cooling_off_hours := v_default_cooling_off_hours;
  else
    select * into v_c from campaigns where id = v_lead.campaign_id and workspace_id = v_workspace_id;
    if v_c.id is null then
      return 'Not on a campaign';
    end if;
    if v_c.status <> 'active' then
      return case when v_c.status = 'paused' then 'Campaign is paused' else 'Campaign is ' || v_c.status end;
    end if;

    if not exists (select 1 from campaign_assignments ca where ca.campaign_id = v_c.id and ca.user_id = p_agent_id) then
      return 'You are not on this campaign''s roster';
    end if;

    if v_lead.assigned_to is not null and v_lead.assigned_to <> p_agent_id then
      return 'Assigned to another agent';
    end if;
    v_max_attempts := v_c.max_attempts;
    v_cooling_off_hours := v_c.cooling_off_hours;
  end if;

  if v_workspace.require_screening then
    if v_lead.screening_status = 'failed' then
      return 'Failed screening';
    elsif v_lead.screening_status = 'expired' then
      return 'Screening expired; needs re-screening';
    elsif v_lead.screening_status <> 'passed' or v_lead.screened_at is null then
      return 'Not screened yet';
    end if;
  end if;

  if exists (select 1 from suppression_list s where s.workspace_id = v_workspace_id and s.phone_hash = v_lead.phone_hash) then
    return 'Number is on the suppression list';
  end if;

  if v_workspace.is_demo and not (v_lead.phone_e164 = any(v_workspace.demo_allowed_numbers)) then
    return 'Demo workspace: number not on the allow-list';
  end if;

  if v_lead.claimed_by is not null and v_lead.claimed_by <> p_agent_id and v_lead.claimed_at >= now() - v_claim_ttl then
    return 'Another agent is on this lead right now';
  end if;

  if v_lead.attempts >= v_max_attempts then
    return 'Maximum attempts reached';
  end if;

  if v_lead.last_attempt_at is not null
     and v_lead.last_attempt_at >= now() - (v_cooling_off_hours || ' hours')::interval then
    v_until := v_lead.last_attempt_at + (v_cooling_off_hours || ' hours')::interval;
    select coalesce(nullif(timezone, ''), 'UTC') into v_tz from profiles where id = p_agent_id;
    return 'Cooling-off until ' || to_char(v_until at time zone coalesce(v_tz, 'UTC'), 'HH24:MI');
  end if;

  if v_c.id is not null
     and v_c.calling_window_start is not null and v_c.calling_window_end is not null
     and not ((now() at time zone coalesce(v_c.timezone, 'UTC'))::time between v_c.calling_window_start and v_c.calling_window_end) then
    return 'Outside calling hours (' || to_char(v_c.calling_window_start, 'HH24:MI') || '-' ||
           to_char(v_c.calling_window_end, 'HH24:MI') || ' ' || coalesce(v_c.timezone, 'UTC') || ')';
  end if;

  return null;
end;
$$;

-- --------------------------------------------------- "why is it empty?"
-- Same columns as migration 110 (the app reads them by name). Screening
-- states are only counted when the workspace requires screening, and the
-- agent's own campaign-less leads are counted alongside campaign leads.
create or replace function dial_queue_diagnosis() returns table (
  is_demo boolean,
  rostered_campaigns int,
  active_campaigns int,
  in_window_campaigns int,
  paused_campaign_name text,
  outside_campaign_name text,
  outside_window_start text,
  outside_window_end text,
  outside_timezone text,
  leads_in_rostered_campaigns int,
  leads_considered int,
  pending_screening int,
  failed_screening int,
  expired_screening int,
  assigned_elsewhere int,
  attempts_exhausted int,
  suppressed int,
  cooling_off int,
  claimed int,
  demo_blocked int,
  dialable int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid := auth_workspace_id();
  v_ttl constant interval := interval '10 minutes';
  v_default_max_attempts constant int := 6;
  v_default_cooling_off_hours constant int := 24;
  v_workspace workspaces;
begin
  if v_uid is null or v_ws is null then
    raise exception 'sign in to see why your queue is empty';
  end if;
  if auth_role() not in ('super_admin', 'ops_manager', 'team_lead', 'agent', 'qa_analyst') then
    raise exception 'only staff who can dial can use this';
  end if;
  select * into v_workspace from workspaces where id = v_ws;

  return query
  with camp as (
    select c.id, c.name, c.status, c.max_attempts, c.cooling_off_hours, c.timezone,
           c.calling_window_start, c.calling_window_end,
           (
             c.calling_window_start is null or c.calling_window_end is null
             or (now() at time zone coalesce(c.timezone, 'UTC'))::time between c.calling_window_start and c.calling_window_end
           ) as in_window
    from campaigns c
    join campaign_assignments ca on ca.campaign_id = c.id and ca.user_id = v_uid
    where c.workspace_id = v_ws
  ),
  servable as (
    select * from camp where status = 'active' and in_window
  ),
  considered as (
    select l.*, s.max_attempts as c_max_attempts, s.cooling_off_hours as c_cooling_off_hours
    from leads l
    join servable s on s.id = l.campaign_id
    where l.workspace_id = v_ws
    union all
    select l.*, v_default_max_attempts, v_default_cooling_off_hours
    from leads l
    where l.workspace_id = v_ws
      and l.campaign_id is null
      and l.assigned_to = v_uid
      and l.phone_e164 is not null and btrim(l.phone_e164) <> ''
      and l.status not in ('rejected', 'converted')
  ),
  state as (
    select case
      when v_workspace.require_screening and l.screening_status = 'failed' then 'failed'
      when v_workspace.require_screening and l.screening_status = 'expired' then 'expired'
      when v_workspace.require_screening and (l.screening_status <> 'passed' or l.screened_at is null) then 'pending'
      when l.assigned_to is not null and l.assigned_to <> v_uid then 'elsewhere'
      when l.attempts >= l.c_max_attempts then 'exhausted'
      when exists (select 1 from suppression_list sl where sl.workspace_id = v_ws and sl.phone_hash = l.phone_hash) then 'suppressed'
      when l.last_attempt_at is not null and l.last_attempt_at >= now() - (l.c_cooling_off_hours || ' hours')::interval then 'cooling'
      when l.claimed_by is not null and l.claimed_at >= now() - v_ttl then 'claimed'
      when v_workspace.is_demo and not (l.phone_e164 = any(v_workspace.demo_allowed_numbers)) then 'demo'
      else 'dialable'
    end as kind
    from considered l
  )
  select
    v_workspace.is_demo,
    (select count(*)::int from camp),
    (select count(*)::int from camp where status = 'active'),
    (select count(*)::int from servable),
    (select name from camp where status = 'paused' order by name limit 1),
    (select name from camp where status = 'active' and not in_window order by name limit 1),
    (select to_char(calling_window_start, 'HH24:MI') from camp where status = 'active' and not in_window order by name limit 1),
    (select to_char(calling_window_end, 'HH24:MI') from camp where status = 'active' and not in_window order by name limit 1),
    (select timezone from camp where status = 'active' and not in_window order by name limit 1),
    (select count(*)::int from leads l join camp c on c.id = l.campaign_id where l.workspace_id = v_ws)
      + (select count(*)::int from leads l where l.workspace_id = v_ws and l.campaign_id is null and l.assigned_to = v_uid
           and l.phone_e164 is not null and btrim(l.phone_e164) <> '' and l.status not in ('rejected', 'converted')),
    (select count(*)::int from state),
    (select count(*)::int from state where kind = 'pending'),
    (select count(*)::int from state where kind = 'failed'),
    (select count(*)::int from state where kind = 'expired'),
    (select count(*)::int from state where kind = 'elsewhere'),
    (select count(*)::int from state where kind = 'exhausted'),
    (select count(*)::int from state where kind = 'suppressed'),
    (select count(*)::int from state where kind = 'cooling'),
    (select count(*)::int from state where kind = 'claimed'),
    (select count(*)::int from state where kind = 'demo'),
    (select count(*)::int from state where kind = 'dialable');
end;
$$;

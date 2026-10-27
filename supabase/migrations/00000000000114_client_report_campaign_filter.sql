-- Client reports: choose the campaign. Every read model behind /portal takes
-- an optional p_campaign_id so the funnel, outcomes and agent activity can be
-- narrowed to one campaign. Scope is unchanged: a client login still only
-- sees campaigns of its own client, a manager only their workspace's.
-- The old zero/one-argument signatures are dropped so there is one
-- definition of each.

drop function if exists client_disposition_breakdown();
create function client_disposition_breakdown(p_campaign_id uuid default null) returns table (
  disposition_label text,
  outcome_group text,
  count bigint
)
language sql stable security definer set search_path = public as $$
  select d.label, d.outcome_group, count(*)
  from calls c
  join campaigns camp on camp.id = c.campaign_id
  join dispositions d on d.id = c.disposition_id
  where c.workspace_id = auth_workspace_id()
    and auth_role() = 'client'
    and camp.client_id = my_client_id()
    and (p_campaign_id is null or camp.id = p_campaign_id)
  group by d.label, d.outcome_group
  order by count(*) desc
$$;

drop function if exists client_agent_activity(boolean);
create function client_agent_activity(p_anonymize boolean default false, p_campaign_id uuid default null) returns table (
  agent_label text,
  calls bigint,
  connects bigint,
  conversions bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth_role() != 'client' then
    raise exception 'only a client-role user can call this';
  end if;

  return query
  with activity as (
    select
      c.agent_id,
      min(c.created_at) as first_seen,
      count(*) as calls,
      count(*) filter (where d.outcome_group in ('connect', 'conversion')) as connects,
      count(*) filter (where d.outcome_group = 'conversion') as conversions
    from calls c
    join campaigns camp on camp.id = c.campaign_id
    left join dispositions d on d.id = c.disposition_id
    where c.workspace_id = auth_workspace_id()
      and camp.client_id = my_client_id()
      and (p_campaign_id is null or camp.id = p_campaign_id)
    group by c.agent_id
  ),
  labeled as (
    select
      a.*,
      row_number() over (order by a.first_seen) as rn,
      p.full_name
    from activity a
    join profiles p on p.id = a.agent_id
  )
  select
    case when p_anonymize then 'Agent ' || chr(64 + rn::int) else full_name end,
    calls, connects, conversions
  from labeled
  order by rn;
end;
$$;

drop function if exists manager_client_report(uuid, boolean);
create function manager_client_report(p_client_id uuid, p_anonymize boolean default false, p_campaign_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_funnel jsonb;
  v_outcomes jsonb;
  v_activity jsonb;
begin
  if auth_role() not in ('super_admin', 'ops_manager') then
    raise exception 'only an admin or ops manager can view client reports';
  end if;
  if not exists (select 1 from clients where id = p_client_id and workspace_id = auth_workspace_id()) then
    raise exception 'unknown client';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.campaign_name), '[]'::jsonb) into v_funnel
  from (
    select f.campaign_id, f.campaign_name, f.loaded, f.screened, f.dialled, f.connected, f.converted
    from v_campaign_funnel f
    join campaigns c on c.id = f.campaign_id
    where c.workspace_id = auth_workspace_id() and c.client_id = p_client_id
      and (p_campaign_id is null or c.id = p_campaign_id)
  ) f;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.count desc), '[]'::jsonb) into v_outcomes
  from (
    select d.label as disposition_label, d.outcome_group, count(*) as count
    from calls c
    join campaigns camp on camp.id = c.campaign_id
    join dispositions d on d.id = c.disposition_id
    where c.workspace_id = auth_workspace_id() and camp.client_id = p_client_id
      and (p_campaign_id is null or camp.id = p_campaign_id)
    group by d.label, d.outcome_group
  ) o;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.rn), '[]'::jsonb) into v_activity
  from (
    select
      case when p_anonymize then 'Agent ' || chr(64 + (row_number() over (order by min(c.created_at)))::int) else p.full_name end as agent_label,
      count(*) as calls,
      count(*) filter (where d.outcome_group in ('connect', 'conversion')) as connects,
      count(*) filter (where d.outcome_group = 'conversion') as conversions,
      row_number() over (order by min(c.created_at)) as rn
    from calls c
    join campaigns camp on camp.id = c.campaign_id
    join profiles p on p.id = c.agent_id
    left join dispositions d on d.id = c.disposition_id
    where c.workspace_id = auth_workspace_id() and camp.client_id = p_client_id
      and (p_campaign_id is null or camp.id = p_campaign_id)
    group by p.id, p.full_name
  ) a;

  return jsonb_build_object('funnel', v_funnel, 'outcomes', v_outcomes, 'activity', v_activity);
end;
$$;

revoke execute on function client_disposition_breakdown(uuid) from public, anon;
revoke execute on function client_agent_activity(boolean, uuid) from public, anon;
revoke execute on function manager_client_report(uuid, boolean, uuid) from public, anon;
grant execute on function client_disposition_breakdown(uuid) to authenticated;
grant execute on function client_agent_activity(boolean, uuid) to authenticated;
grant execute on function manager_client_report(uuid, boolean, uuid) to authenticated;

-- Data cleanup: find duplicate leads (same phone number, or same email) and
-- merge them into one. For managers and the Data-only role.
--
-- A merge keeps one lead and:
--   * fills each of its empty fields from the others (oldest first),
--   * adds their tags and extra information (the kept lead's values win),
--   * appends their notes,
--   * keeps the latest contact and attempt times and the most attempts,
--   * moves their calls, callbacks, emails, meetings and intake history onto
--     it, so no history is lost,
--   * and moves the others to the trash, noting which lead they went into.

create or replace function duplicate_lead_groups(p_limit int default 200)
returns table (match_on text, match_value text, lead_ids uuid[], lead_count int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can look for duplicates.';
  end if;
  return query
    with phone_groups as (
      select 'phone'::text as match_on, l.phone_e164 as match_value,
             array_agg(l.id order by l.created_at, l.id) as lead_ids, count(*)::int as lead_count
      from leads l
      where l.workspace_id = v_ws and l.deleted_at is null and l.phone_hash is not null
      group by l.phone_hash, l.phone_e164
      having count(*) > 1
    ),
    email_groups as (
      select 'email'::text as match_on, lower(l.email) as match_value,
             array_agg(l.id order by l.created_at, l.id) as lead_ids, count(*)::int as lead_count
      from leads l
      where l.workspace_id = v_ws and l.deleted_at is null and l.email is not null and btrim(l.email) <> ''
      group by lower(l.email)
      having count(*) > 1
    )
    select * from phone_groups
    union all
    -- An email group that is exactly a phone group adds nothing.
    select e.* from email_groups e
    where not exists (select 1 from phone_groups p where p.lead_ids = e.lead_ids)
    order by 4 desc, 2
    limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

create or replace function merge_leads(p_keep uuid, p_merge uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid := auth_workspace_id();
  v_keep leads;
  v_ids uuid[];
  v_n int;
begin
  if not is_data_admin() then
    raise exception 'Only an admin, ops manager or Data-only user can merge leads.';
  end if;
  select * into v_keep from leads where id = p_keep and workspace_id = v_ws and deleted_at is null for update;
  if v_keep.id is null then
    raise exception 'The lead to keep was not found.';
  end if;
  select coalesce(array_agg(l.id order by l.created_at, l.id), '{}') into v_ids
  from leads l
  where l.id = any(p_merge) and l.id <> p_keep and l.workspace_id = v_ws and l.deleted_at is null;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then
    raise exception 'Choose at least one other lead to merge in.';
  end if;
  if v_n > 50 then
    raise exception 'Merge at most 50 leads into one at a time.';
  end if;

  -- Fill the kept lead's gaps (oldest duplicate first), and merge the rest.
  with src as (
    select * from leads where id = any(v_ids) order by created_at, id
  ),
  firsts as (
    select
      (array_remove(array_agg(full_name order by created_at, id), null))[1] as full_name,
      (array_remove(array_agg(first_name order by created_at, id), null))[1] as first_name,
      (array_remove(array_agg(last_name order by created_at, id), null))[1] as last_name,
      (array_remove(array_agg(company_name order by created_at, id), null))[1] as company_name,
      (array_remove(array_agg(email order by created_at, id), null))[1] as email,
      (array_remove(array_agg(phone_e164 order by created_at, id), null))[1] as phone_e164,
      (array_remove(array_agg(contact_name order by created_at, id), null))[1] as contact_name,
      (array_remove(array_agg(job_title order by created_at, id), null))[1] as job_title,
      (array_remove(array_agg(website order by created_at, id), null))[1] as website,
      (array_remove(array_agg(address_line1 order by created_at, id), null))[1] as address_line1,
      (array_remove(array_agg(city order by created_at, id), null))[1] as city,
      (array_remove(array_agg(postcode order by created_at, id), null))[1] as postcode,
      (array_remove(array_agg(region order by created_at, id), null))[1] as region,
      (array_remove(array_agg(country_code order by created_at, id), null))[1] as country_code,
      (array_remove(array_agg(next_step order by created_at, id), null))[1] as next_step,
      (array_remove(array_agg(group_label order by created_at, id), null))[1] as group_label,
      max(appointment_at) as appointment_at,
      max(last_contact_at) as last_contact_at,
      max(last_attempt_at) as last_attempt_at,
      max(attempts) as attempts,
      array(select distinct t from src s2, unnest(s2.tags) t where t <> '') as tags,
      string_agg(nullif(btrim(agent_notes), ''), E'\n\n' order by created_at) as notes,
      (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
         from (select distinct on (e.key) e.key as k, e.value as v
               from src s3, jsonb_each(coalesce(s3.custom, '{}'::jsonb)) e
               order by e.key, s3.created_at) x) as custom
    from src
  )
  update leads l set
    full_name = coalesce(nullif(l.full_name, ''), f.full_name),
    first_name = coalesce(nullif(l.first_name, ''), f.first_name),
    last_name = coalesce(nullif(l.last_name, ''), f.last_name),
    company_name = coalesce(nullif(l.company_name, ''), f.company_name),
    email = coalesce(nullif(l.email, ''), f.email),
    phone_e164 = coalesce(nullif(l.phone_e164, ''), f.phone_e164),
    contact_name = coalesce(nullif(l.contact_name, ''), f.contact_name),
    job_title = coalesce(nullif(l.job_title, ''), f.job_title),
    website = coalesce(nullif(l.website, ''), f.website),
    address_line1 = coalesce(nullif(l.address_line1, ''), f.address_line1),
    city = coalesce(nullif(l.city, ''), f.city),
    postcode = coalesce(nullif(l.postcode, ''), f.postcode),
    region = coalesce(nullif(l.region, ''), f.region),
    country_code = coalesce(nullif(l.country_code, ''), f.country_code),
    next_step = coalesce(nullif(l.next_step, ''), f.next_step),
    group_label = coalesce(nullif(l.group_label, ''), f.group_label),
    appointment_at = coalesce(l.appointment_at, f.appointment_at),
    last_contact_at = greatest(l.last_contact_at, f.last_contact_at),
    last_attempt_at = greatest(l.last_attempt_at, f.last_attempt_at),
    attempts = greatest(l.attempts, coalesce(f.attempts, 0)),
    tags = array(select distinct t from unnest(l.tags || f.tags) t where t <> '' order by t),
    agent_notes = case
      when f.notes is null then l.agent_notes
      when l.agent_notes is null or btrim(l.agent_notes) = '' then f.notes
      else l.agent_notes || E'\n\n' || f.notes
    end,
    custom = f.custom || coalesce(l.custom, '{}'::jsonb)
  from firsts f
  where l.id = p_keep;

  -- History moves onto the kept lead.
  update calls set lead_id = p_keep where lead_id = any(v_ids);
  update callbacks set lead_id = p_keep where lead_id = any(v_ids);
  update email_log set lead_id = p_keep where lead_id = any(v_ids);
  update zoom_meetings set lead_id = p_keep where lead_id = any(v_ids);
  update lead_intake_events set lead_id = p_keep where lead_id = any(v_ids);
  update unphoned_contacts set promoted_lead_id = p_keep where promoted_lead_id = any(v_ids);

  -- The others go to the trash, remembering where they went.
  perform _trash_lead_rows(v_ws, v_ids);
  update leads set trash_meta = coalesce(trash_meta, '{}'::jsonb) || jsonb_build_object('merged_into', p_keep)
  where id = any(v_ids);

  perform log_data_action('merge', 'lead', p_keep, jsonb_build_object('count', v_n));
  return v_n;
end;
$$;

revoke execute on function duplicate_lead_groups(int) from public, anon;
revoke execute on function merge_leads(uuid, uuid[]) from public, anon;
grant execute on function duplicate_lead_groups(int) to authenticated;
grant execute on function merge_leads(uuid, uuid[]) to authenticated;

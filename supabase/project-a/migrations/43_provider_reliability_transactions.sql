-- Make provider workspace mutations fail closed and commit as one unit.
-- Authentication/tenant authorization remains in the Next.js server action;
-- these Data API functions are executable only by the server-side service role.

create or replace function public.set_provider_lead_status(
  p_route_id uuid,
  p_facility_id uuid,
  p_status text
)
returns table(
  updated_route_id uuid,
  updated_match_id uuid,
  route_status text,
  match_status text,
  connected_seeker_count integer
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  route_row public.match_routes%rowtype;
  current_match_status text;
  seeker_count integer := 0;
begin
  if p_route_id is null or p_facility_id is null then
    raise exception 'route and facility are required' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('sent', 'viewed', 'accepted', 'declined') then
    raise exception 'invalid lead status' using errcode = '22023';
  end if;

  -- Lock and mutate the exact tenant-scoped route. A stale/forged route id must
  -- never be reported as success merely because an UPDATE affected zero rows.
  select route.* into route_row
  from public.match_routes as route
  where route.id = p_route_id
    and route.facility_id = p_facility_id
  for update;
  if not found then
    raise exception 'lead route not found for facility' using errcode = 'P0002';
  end if;

  update public.match_routes as route
  set status = p_status
  where route.id = route_row.id
    and route.facility_id = p_facility_id
  returning route.* into route_row;
  if not found then
    raise exception 'lead route was not updated' using errcode = 'P0002';
  end if;

  if p_status = 'accepted' then
    -- An acceptance advances open/routed matches, but closed/connected matches
    -- are terminal or already advanced and must never be downgraded.
    update public.matches as match
    set status = case
      when match.status in ('open', 'routed') then 'connected'
      else match.status
    end
    where match.id = route_row.match_id
    returning match.status into current_match_status;
    if not found then
      raise exception 'lead match not found' using errcode = 'P0002';
    end if;

    -- Only a still-active connector record with an explicit current permission
    -- advances. Revoked/unsubscribed records remain revoked; connected records
    -- remain connected. No contact identifier is returned to the caller.
    update public.vault_seekers as seeker
    set status = 'connected'
    where seeker.match_id = route_row.match_id
      and seeker.status = 'active'
      and seeker.consent_share;
    get diagnostics seeker_count = row_count;
  else
    select match.status into current_match_status
    from public.matches as match
    where match.id = route_row.match_id;
    if not found then
      raise exception 'lead match not found' using errcode = 'P0002';
    end if;
  end if;

  return query select
    route_row.id,
    route_row.match_id,
    route_row.status,
    current_match_status,
    seeker_count;
end;
$function$;

create or replace function public.replace_facility_insurance(
  p_facility_id uuid,
  p_payer_types text[],
  p_carriers_named text[]
)
returns table(
  updated_facility_id uuid,
  payer_count integer,
  carrier_count integer
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  locked_facility_id uuid;
  normalized_payers text[] := '{}'::text[];
  normalized_carriers text[] := '{}'::text[];
begin
  if p_facility_id is null then
    raise exception 'facility is required' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(coalesce(p_payer_types, '{}'::text[])) > 5 then
    raise exception 'too many payer categories' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(coalesce(p_carriers_named, '{}'::text[])) > 50 then
    raise exception 'too many named carriers' using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(coalesce(p_payer_types, '{}'::text[])) as listed(payer_type)
    where listed.payer_type is null
  ) or exists (
    select 1
    from pg_catalog.unnest(coalesce(p_carriers_named, '{}'::text[])) as listed(carrier)
    where listed.carrier is null
      or pg_catalog.length(pg_catalog.btrim(listed.carrier)) = 0
      or pg_catalog.length(pg_catalog.btrim(listed.carrier)) > 120
  ) then
    raise exception 'invalid insurance option' using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(normalized.payer_type order by normalized.payer_type),
    '{}'::text[]
  ) into normalized_payers
  from (
    select distinct pg_catalog.lower(pg_catalog.btrim(listed.payer_type)) as payer_type
    from pg_catalog.unnest(coalesce(p_payer_types, '{}'::text[])) as listed(payer_type)
  ) as normalized;

  if exists (
    select 1
    from pg_catalog.unnest(normalized_payers) as listed(payer_type)
    where listed.payer_type not in ('medicaid', 'medicare', 'commercial', 'tricare', 'self_pay')
  ) then
    raise exception 'invalid payer category' using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(normalized.carrier order by normalized.carrier),
    '{}'::text[]
  ) into normalized_carriers
  from (
    select distinct pg_catalog.btrim(listed.carrier) as carrier
    from pg_catalog.unnest(coalesce(p_carriers_named, '{}'::text[])) as listed(carrier)
  ) as normalized;

  -- Serialize both the child-row replacement and parent-array update on the
  -- facility. Any later statement error rolls the deletion back automatically.
  select facility.id into locked_facility_id
  from public.facilities as facility
  where facility.id = p_facility_id
  for update;
  if not found then
    raise exception 'facility not found' using errcode = 'P0002';
  end if;

  delete from public.facility_payers as payer
  where payer.facility_id = locked_facility_id;

  insert into public.facility_payers (
    facility_id,
    payer_type,
    in_network,
    verification_confidence,
    source_url
  )
  select
    locked_facility_id,
    listed.payer_type,
    false,
    'low',
    null
  from pg_catalog.unnest(normalized_payers) as listed(payer_type);

  update public.facilities as facility
  set carriers_named = normalized_carriers,
      updated_at = pg_catalog.clock_timestamp()
  where facility.id = locked_facility_id;
  if not found then
    raise exception 'facility insurance was not updated' using errcode = 'P0002';
  end if;

  return query select
    locked_facility_id,
    pg_catalog.cardinality(normalized_payers),
    pg_catalog.cardinality(normalized_carriers);
end;
$function$;

revoke all on function public.set_provider_lead_status(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.replace_facility_insurance(uuid, text[], text[])
  from public, anon, authenticated;
grant execute on function public.set_provider_lead_status(uuid, uuid, text)
  to service_role;
grant execute on function public.replace_facility_insurance(uuid, text[], text[])
  to service_role;

comment on function public.set_provider_lead_status(uuid, uuid, text) is
  'Service-only exact-route lead transition with atomic, monotonic match and consented connector advancement.';
comment on function public.replace_facility_insurance(uuid, text[], text[]) is
  'Service-only atomic replacement of program-reported payer categories and named carriers.';

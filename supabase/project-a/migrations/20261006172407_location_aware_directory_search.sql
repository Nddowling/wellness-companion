-- Server-only distance-ordered directory search. Caller resolves a city/ZIP to
-- coordinates without putting the seeker's location in a URL. Facility coordinates
-- currently represent ZIP centroids, so "miles" is approximate and not driving
-- distance to the facility's street address.
--
-- Keep filters identical to facilities_search/count/facet_counts. No radius is
-- applied: counts and facets from the existing RPCs therefore stay truthful,
-- including the 99 published listings without valid coordinates. Those listings
-- are returned after geolocated listings with miles = null.
create function public.facilities_search_nearby(
  p_olat   double precision,
  p_olng   double precision,
  p_region text default null,
  p_level  text default null,
  p_pay    text default null,
  p_spec   text default null,
  p_pop    text default null,
  p_q      text default null,
  p_open   boolean default false,
  p_limit  integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid, name text, city text, state text,
  levels_of_care text[], carriers_named text[],
  facility_payers jsonb, facility_capacity jsonb,
  miles double precision
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with eligible as (
    select
      f.id, f.name, f.city, f.state, f.levels_of_care, f.carriers_named,
      case
        when f.latitude between -90 and 90
         and f.longitude between -180 and 180
        then 3958.7613 * acos(greatest(-1, least(1,
          cos(radians(p_olat)) * cos(radians(f.latitude))
            * cos(radians(f.longitude) - radians(p_olng))
          + sin(radians(p_olat)) * sin(radians(f.latitude))
        )))
      end as miles
    from public.facilities f
    where p_olat between -90 and 90
      and p_olng between -180 and 180
      and f.is_published
      and (p_region is null or f.state = p_region)
      and (p_level is null or p_level = any(f.levels_of_care))
      and (p_spec is null or exists (
        select 1 from unnest(f.specialties) s
        where position(lower(p_spec) in lower(s)) > 0
      ))
      and (p_pop is null or exists (
        select 1 from unnest(f.populations_served) pp
        where position(lower(p_pop) in lower(pp)) > 0
      ))
      and (p_pay is null or exists (
        select 1 from public.facility_payers fp
        where fp.facility_id = f.id and fp.payer_type = p_pay
      ))
      and (p_q is null or public.facility_matches_q(f.id, p_q))
      and (p_open is not true or exists (
        select 1
        from public.facility_capacity c
        where c.facility_id = f.id
          and 'residential' = any(f.levels_of_care)
          and c.level_of_care = 'residential'
          and (p_level is null or c.level_of_care = p_level)
          and c.beds_available > 0
          and c.last_updated >= now() - interval '7 days'
          and c.last_updated <= now() + interval '5 minutes'
      ))
  ),
  ranked as materialized (
    select * from eligible e
    order by e.miles nulls last, lower(e.name), e.name, e.id
    limit greatest(coalesce(p_limit, 24), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    r.id, r.name, r.city, r.state, r.levels_of_care, r.carriers_named,
    coalesce((
      select jsonb_agg(jsonb_build_object('payer_type', fp.payer_type))
      from public.facility_payers fp where fp.facility_id = r.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'level_of_care', c.level_of_care,
        'beds_available', c.beds_available,
        'last_updated', c.last_updated,
        'provider_reported', c.updated_by is not null
      ))
      from public.facility_capacity c where c.facility_id = r.id
    ), '[]'::jsonb),
    r.miles
  from ranked r
  order by r.miles nulls last, lower(r.name), r.name, r.id;
$function$;

revoke execute on function public.facilities_search_nearby(
  double precision,double precision,text,text,text,text,text,text,boolean,integer,integer
) from public, anon, authenticated;
grant execute on function public.facilities_search_nearby(
  double precision,double precision,text,text,text,text,text,text,boolean,integer,integer
) to service_role;

comment on function public.facilities_search_nearby(
  double precision,double precision,text,text,text,text,text,text,boolean,integer,integer
) is 'Server-only directory search ordered by approximate facility ZIP-centroid miles; NULL miles last.';

-- Nearby POSTs use the same HMAC-only shared budget as other anonymous
-- workflows. Preserve every existing endpoint and limit while adding this scope.
alter table public.api_rate_limits
  drop constraint if exists api_rate_limits_scope_check;
alter table public.api_rate_limits
  add constraint api_rate_limits_scope_check
  check (scope in (
    'intake:ip', 'intake:session',
    'match:ip', 'match:session',
    'handoff:ip', 'handoff:session',
    'track:ip', 'track:session',
    'nearby:ip', 'nearby:session'
  ));

create or replace function public.consume_anonymous_budget(
  p_endpoint text,
  p_ip_key text,
  p_session_key text
)
returns table(
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  window_seconds integer;
  ip_limit integer;
  session_limit integer;
  bucket_start timestamptz;
  bucket_expiry timestamptz;
  ip_count integer;
  session_count integer;
begin
  if p_endpoint = 'intake' then
    window_seconds := 600;
    ip_limit := 40;
    session_limit := 20;
  elsif p_endpoint = 'match' then
    window_seconds := 3600;
    ip_limit := 20;
    session_limit := 4;
  elsif p_endpoint = 'handoff' then
    window_seconds := 3600;
    ip_limit := 60;
    session_limit := 12;
  elsif p_endpoint = 'track' then
    window_seconds := 600;
    ip_limit := 120;
    session_limit := 60;
  elsif p_endpoint = 'nearby' then
    window_seconds := 600;
    ip_limit := 120;
    session_limit := 60;
  else
    raise exception 'unsupported anonymous endpoint' using errcode = '22023';
  end if;

  if p_ip_key is null or p_ip_key !~ '^[a-f0-9]{64}$'
     or p_session_key is null or p_session_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid anonymous request key' using errcode = '22023';
  end if;

  bucket_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) / window_seconds)
      * window_seconds
  );
  bucket_expiry := bucket_start
    + pg_catalog.make_interval(secs => window_seconds)
    + interval '1 day';

  insert into public.api_rate_limits (
    scope, key_hash, window_started_at, request_count, expires_at
  ) values (
    p_endpoint || ':ip', p_ip_key, bucket_start, 1, bucket_expiry
  )
  on conflict (scope, key_hash, window_started_at)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    expires_at = excluded.expires_at
  returning request_count into ip_count;

  insert into public.api_rate_limits (
    scope, key_hash, window_started_at, request_count, expires_at
  ) values (
    p_endpoint || ':session', p_session_key, bucket_start, 1, bucket_expiry
  )
  on conflict (scope, key_hash, window_started_at)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    expires_at = excluded.expires_at
  returning request_count into session_count;

  if pg_catalog.random() < 0.01 then
    delete from public.api_rate_limits
    where expires_at < pg_catalog.clock_timestamp();
  end if;

  return query select
    ip_count <= ip_limit and session_count <= session_limit,
    greatest(0, least(ip_limit - ip_count, session_limit - session_count)),
    case
      when ip_count <= ip_limit and session_count <= session_limit then 0
      else greatest(
        1,
        pg_catalog.ceil(
          extract(epoch from (
            bucket_start + pg_catalog.make_interval(secs => window_seconds)
              - pg_catalog.clock_timestamp()
          ))
        )::integer
      )
    end;
end;
$function$;

revoke all on function public.consume_anonymous_budget(text,text,text)
  from public, anon, authenticated;
grant execute on function public.consume_anonymous_budget(text,text,text)
  to service_role;

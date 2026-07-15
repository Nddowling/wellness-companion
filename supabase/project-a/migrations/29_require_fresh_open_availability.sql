-- Make the public `open` facet mean exactly what the UI says: a positive
-- residential-bed report dated within seven days. The source data records detox
-- as a service but does not reliably distinguish outpatient, residential, and
-- hospital detox capacity, so detox is not treated as bed-based until that
-- setting is modeled explicitly. These definitions supersede the older
-- production RPC bodies while preserving migration 20's forgiving q matcher.

create or replace function public.facilities_search(
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
  facility_payers jsonb, facility_capacity jsonb
)
language sql stable as $function$
  select f.id, f.name, f.city, f.state, f.levels_of_care, f.carriers_named,
    coalesce((select jsonb_agg(jsonb_build_object('payer_type', fp.payer_type))
              from facility_payers fp where fp.facility_id = f.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                'level_of_care', c.level_of_care,
                'beds_available', c.beds_available,
                'last_updated', c.last_updated,
                'provider_reported', c.updated_by is not null))
              from facility_capacity c where c.facility_id = f.id), '[]'::jsonb)
  from facilities f
  where f.is_published
    and (p_region is null or f.state = p_region)
    and (p_level is null or p_level = any(f.levels_of_care))
    and (p_spec is null or exists (
      select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
    ))
    and (p_pop is null or exists (
      select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
    ))
    and (p_pay is null or exists (
      select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
    ))
    and (p_q is null or public.facility_matches_q(f.id, p_q))
    and (p_open is not true or exists (
      select 1
      from facility_capacity c
      where c.facility_id = f.id
        and 'residential' = any(f.levels_of_care)
        and c.level_of_care = 'residential'
        and (p_level is null or c.level_of_care = p_level)
        and c.beds_available > 0
        and c.last_updated >= now() - interval '7 days'
        and c.last_updated <= now() + interval '5 minutes'
    ))
  order by f.name
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$;

-- These directory RPCs are consumed only by controlled Server Components. Keep
-- raw capacity payloads and query cost away from browser database roles.
revoke execute on function public.facilities_search(text,text,text,text,text,text,boolean,integer,integer)
  from public, anon, authenticated;
revoke execute on function public.facilities_search_count(text,text,text,text,text,text,boolean)
  from public, anon, authenticated;
revoke execute on function public.facilities_facet_counts(text,text,text,text,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.facilities_search(text,text,text,text,text,text,boolean,integer,integer)
  to service_role;
grant execute on function public.facilities_search_count(text,text,text,text,text,text,boolean)
  to service_role;
grant execute on function public.facilities_facet_counts(text,text,text,text,text,text,boolean)
  to service_role;

create or replace function public.facilities_search_count(
  p_region text default null,
  p_level  text default null,
  p_pay    text default null,
  p_spec   text default null,
  p_pop    text default null,
  p_q      text default null,
  p_open   boolean default false
)
returns bigint
language sql stable as $function$
  select count(*)
  from facilities f
  where f.is_published
    and (p_region is null or f.state = p_region)
    and (p_level is null or p_level = any(f.levels_of_care))
    and (p_spec is null or exists (
      select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
    ))
    and (p_pop is null or exists (
      select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
    ))
    and (p_pay is null or exists (
      select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
    ))
    and (p_q is null or public.facility_matches_q(f.id, p_q))
    and (p_open is not true or exists (
      select 1
      from facility_capacity c
      where c.facility_id = f.id
        and 'residential' = any(f.levels_of_care)
        and c.level_of_care = 'residential'
        and (p_level is null or c.level_of_care = p_level)
        and c.beds_available > 0
        and c.last_updated >= now() - interval '7 days'
        and c.last_updated <= now() + interval '5 minutes'
    ));
$function$;

create or replace function public.facilities_facet_counts(
  p_region text default null,
  p_level  text default null,
  p_pay    text default null,
  p_spec   text default null,
  p_pop    text default null,
  p_q      text default null,
  p_open   boolean default false
)
returns jsonb
language sql stable as $function$
  with
  lvl as (
    select lv as value, count(*)::bigint as n
    from facilities f, unnest(f.levels_of_care) as lv
    where f.is_published
      and (p_region is null or f.state = p_region)
      and (p_spec is null or exists (
        select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
      ))
      and (p_pop is null or exists (
        select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
      ))
      and (p_pay is null or exists (
        select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
      ))
      and (p_q is null or public.facility_matches_q(f.id, p_q))
      and (p_open is not true or exists (
        select 1 from facility_capacity c
        where c.facility_id = f.id
          and 'residential' = any(f.levels_of_care)
          and c.level_of_care = 'residential'
          and c.level_of_care = lv
          and c.beds_available > 0
          and c.last_updated >= now() - interval '7 days'
          and c.last_updated <= now() + interval '5 minutes'
      ))
    group by lv
  ),
  pay as (
    select fp.payer_type as value, count(distinct f.id)::bigint as n
    from facilities f
    join facility_payers fp on fp.facility_id = f.id
    where f.is_published
      and (p_region is null or f.state = p_region)
      and (p_level is null or p_level = any(f.levels_of_care))
      and (p_spec is null or exists (
        select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
      ))
      and (p_pop is null or exists (
        select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
      ))
      and (p_q is null or public.facility_matches_q(f.id, p_q))
      and (p_open is not true or exists (
        select 1 from facility_capacity c
        where c.facility_id = f.id
          and 'residential' = any(f.levels_of_care)
          and c.level_of_care = 'residential'
          and (p_level is null or c.level_of_care = p_level)
          and c.beds_available > 0
          and c.last_updated >= now() - interval '7 days'
          and c.last_updated <= now() + interval '5 minutes'
      ))
    group by fp.payer_type
  ),
  reg as (
    select f.state as value, count(*)::bigint as n
    from facilities f
    where f.is_published and f.state is not null and f.state <> ''
      and (p_level is null or p_level = any(f.levels_of_care))
      and (p_spec is null or exists (
        select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
      ))
      and (p_pop is null or exists (
        select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
      ))
      and (p_pay is null or exists (
        select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
      ))
      and (p_q is null or public.facility_matches_q(f.id, p_q))
      and (p_open is not true or exists (
        select 1 from facility_capacity c
        where c.facility_id = f.id
          and 'residential' = any(f.levels_of_care)
          and c.level_of_care = 'residential'
          and (p_level is null or c.level_of_care = p_level)
          and c.beds_available > 0
          and c.last_updated >= now() - interval '7 days'
          and c.last_updated <= now() + interval '5 minutes'
      ))
    group by f.state
  )
  select jsonb_build_object(
    'levels', coalesce((select jsonb_object_agg(value, n) from lvl), '{}'::jsonb),
    'payers', coalesce((select jsonb_object_agg(value, n) from pay), '{}'::jsonb),
    'regions', coalesce((select jsonb_object_agg(value, n) from reg), '{}'::jsonb)
  );
$function$;

-- Server-side directory search so the public pages use the WHOLE table (13.5k rows),
-- not just PostgREST's default 1,000-row page. All filtering/counting/paging runs in
-- Postgres; the app fetches one page + true totals. Neutral ordering (name); no ranking.

-- True published-facility count per state (for the "Browse by state" page).
create or replace function public.facilities_state_counts()
returns table(state text, n bigint)
language sql stable as $function$
  select f.state, count(*)
  from facilities f
  where f.is_published and f.state is not null and f.state <> ''
  group by f.state
  order by f.state;
$function$;

-- A page of facilities matching the directory filters, with the bits the card needs
-- (payers + capacity) aggregated as JSON so the existing UI keeps working.
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
                'last_updated', c.last_updated))
              from facility_capacity c where c.facility_id = f.id), '[]'::jsonb)
  from facilities f
  where f.is_published
    and (p_region is null or f.state = p_region)
    and (p_level is null or p_level = any(f.levels_of_care))
    and (p_spec is null or exists (select 1 from unnest(f.specialties) s where s ~* ('(^|[^a-z])' || p_spec)))
    and (p_pop is null or exists (select 1 from unnest(f.populations_served) pp where pp ~* ('(^|[^a-z])' || p_pop)))
    and (p_pay is null or exists (select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay))
    and (p_q is null or (
      select bool_and(
        lower(f.name || ' ' || coalesce(f.city, '') || ' ' || coalesce(f.state, '') || ' ' ||
              array_to_string(f.levels_of_care, ' ') || ' ' ||
              array_to_string(f.specialties, ' ') || ' ' ||
              array_to_string(f.populations_served, ' ')) like '%' || tok || '%')
      from unnest(string_to_array(lower(trim(p_q)), ' ')) as tok
      where length(tok) > 0
    ))
    and (p_open is not true
         or exists (select 1 from facility_capacity c
                    where c.facility_id = f.id and c.level_of_care in ('detox','residential') and c.beds_available > 0)
         or not (f.levels_of_care && array['detox','residential']))
  order by f.name
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$;

-- True total of facilities matching the same filters (drives the count + pagination).
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
    and (p_spec is null or exists (select 1 from unnest(f.specialties) s where s ~* ('(^|[^a-z])' || p_spec)))
    and (p_pop is null or exists (select 1 from unnest(f.populations_served) pp where pp ~* ('(^|[^a-z])' || p_pop)))
    and (p_pay is null or exists (select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay))
    and (p_q is null or (
      select bool_and(
        lower(f.name || ' ' || coalesce(f.city, '') || ' ' || coalesce(f.state, '') || ' ' ||
              array_to_string(f.levels_of_care, ' ') || ' ' ||
              array_to_string(f.specialties, ' ') || ' ' ||
              array_to_string(f.populations_served, ' ')) like '%' || tok || '%')
      from unnest(string_to_array(lower(trim(p_q)), ' ')) as tok
      where length(tok) > 0
    ))
    and (p_open is not true
         or exists (select 1 from facility_capacity c
                    where c.facility_id = f.id and c.level_of_care in ('detox','residential') and c.beds_available > 0)
         or not (f.levels_of_care && array['detox','residential']));
$function$;

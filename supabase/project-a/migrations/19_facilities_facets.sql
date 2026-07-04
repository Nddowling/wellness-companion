-- Live facet counts for the browse filter bar. For each filter dimension we count
-- facilities matching all the OTHER active filters (a "faceted" count), so the
-- number next to an option tells you how many results you'd get if you picked it.
-- Mirrors the exact predicates in facilities_search (17) so counts and results agree.

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
  -- Level counts: every filter EXCEPT level.
  lvl as (
    select lv as value, count(*)::bigint as n
    from facilities f, unnest(f.levels_of_care) as lv
    where f.is_published
      and (p_region is null or f.state = p_region)
      and (p_spec is null or exists (select 1 from unnest(f.specialties) s where s ~* ('(^|[^a-z])' || p_spec)))
      and (p_pop is null or exists (select 1 from unnest(f.populations_served) pp where pp ~* ('(^|[^a-z])' || p_pop)))
      and (p_pay is null or exists (select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay))
      and (p_q is null or (
        select bool_and(
          lower(f.name || ' ' || coalesce(f.city,'') || ' ' || coalesce(f.state,'') || ' ' ||
                array_to_string(f.levels_of_care,' ') || ' ' || array_to_string(f.specialties,' ') || ' ' ||
                array_to_string(f.populations_served,' ')) like '%' || tok || '%')
        from unnest(string_to_array(lower(trim(p_q)),' ')) as tok where length(tok) > 0))
      and (p_open is not true
           or exists (select 1 from facility_capacity c where c.facility_id = f.id and c.level_of_care in ('detox','residential') and c.beds_available > 0)
           or not (f.levels_of_care && array['detox','residential']))
    group by lv
  ),
  -- Payer counts: every filter EXCEPT pay.
  pay as (
    select fp.payer_type as value, count(distinct f.id)::bigint as n
    from facilities f join facility_payers fp on fp.facility_id = f.id
    where f.is_published
      and (p_region is null or f.state = p_region)
      and (p_level is null or p_level = any(f.levels_of_care))
      and (p_spec is null or exists (select 1 from unnest(f.specialties) s where s ~* ('(^|[^a-z])' || p_spec)))
      and (p_pop is null or exists (select 1 from unnest(f.populations_served) pp where pp ~* ('(^|[^a-z])' || p_pop)))
      and (p_q is null or (
        select bool_and(
          lower(f.name || ' ' || coalesce(f.city,'') || ' ' || coalesce(f.state,'') || ' ' ||
                array_to_string(f.levels_of_care,' ') || ' ' || array_to_string(f.specialties,' ') || ' ' ||
                array_to_string(f.populations_served,' ')) like '%' || tok || '%')
        from unnest(string_to_array(lower(trim(p_q)),' ')) as tok where length(tok) > 0))
      and (p_open is not true
           or exists (select 1 from facility_capacity c where c.facility_id = f.id and c.level_of_care in ('detox','residential') and c.beds_available > 0)
           or not (f.levels_of_care && array['detox','residential']))
    group by fp.payer_type
  ),
  -- Region counts: every filter EXCEPT region.
  reg as (
    select f.state as value, count(*)::bigint as n
    from facilities f
    where f.is_published and f.state is not null and f.state <> ''
      and (p_level is null or p_level = any(f.levels_of_care))
      and (p_spec is null or exists (select 1 from unnest(f.specialties) s where s ~* ('(^|[^a-z])' || p_spec)))
      and (p_pop is null or exists (select 1 from unnest(f.populations_served) pp where pp ~* ('(^|[^a-z])' || p_pop)))
      and (p_pay is null or exists (select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay))
      and (p_q is null or (
        select bool_and(
          lower(f.name || ' ' || coalesce(f.city,'') || ' ' || coalesce(f.state,'') || ' ' ||
                array_to_string(f.levels_of_care,' ') || ' ' || array_to_string(f.specialties,' ') || ' ' ||
                array_to_string(f.populations_served,' ')) like '%' || tok || '%')
        from unnest(string_to_array(lower(trim(p_q)),' ')) as tok where length(tok) > 0))
      and (p_open is not true
           or exists (select 1 from facility_capacity c where c.facility_id = f.id and c.level_of_care in ('detox','residential') and c.beds_available > 0)
           or not (f.levels_of_care && array['detox','residential']))
    group by f.state
  )
  select jsonb_build_object(
    'levels',  coalesce((select jsonb_object_agg(value, n) from lvl), '{}'::jsonb),
    'payers',  coalesce((select jsonb_object_agg(value, n) from pay), '{}'::jsonb),
    'regions', coalesce((select jsonb_object_agg(value, n) from reg), '{}'::jsonb)
  );
$function$;

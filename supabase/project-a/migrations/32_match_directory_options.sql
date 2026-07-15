-- Rank match options inside Postgres so matching considers the full published
-- directory instead of the Data API's row-return ceiling. This RPC is deliberately
-- service-role-only: browser roles never call it and no identity enters its inputs.

create or replace function public.match_directory_options(
  p_region_zip3      text,
  p_care_level       text,
  p_payer_type       text,
  p_concern_category text,
  p_payer_carrier    text default null,
  p_limit            integer default 3
)
returns table(
  id                uuid,
  name              text,
  city              text,
  state             text,
  referral_contact  jsonb,
  level             text,
  bed_based         boolean,
  beds_available    integer,
  freshness         text,
  provider_reported boolean,
  region_match      boolean,
  score             integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $function$
  with eligible as (
    select
      f.id,
      f.name,
      f.city,
      f.state,
      f.referral_contact,
      (p_care_level = 'residential') as bed_based,
      (f.zip3 is not null and f.zip3 = p_region_zip3) as region_match,
      c.beds_available as reported_beds,
      c.last_updated as reported_at,
      c.updated_by as reported_by
    from public.facilities f
    left join public.facility_capacity c
      on c.facility_id = f.id
     and c.level_of_care = 'residential'
    where f.is_published
      -- Clear Bed's corpus is an addiction-treatment directory, not a standalone
      -- mental-health directory. Co-occurring requests need an explicit positive
      -- source/profile field, and an explicit negative always wins.
      and p_concern_category <> 'mental_health'
      and (
        p_concern_category <> 'co_occurring'
        or (
          lower(coalesce(f.co_occurring, ''))
            ~ '(^|[^a-z])(yes|co.?occurring|dual|integrated|both)([^a-z]|$)'
          and lower(coalesce(f.co_occurring, ''))
            !~ '(^|[^a-z])(no|none|not[[:space:]_-]+offered)([^a-z]|$)'
        )
      )
      -- A capacity row is not evidence that a facility lists a service. The
      -- directory's source-backed levels array is the hard level filter.
      and p_care_level = any(f.levels_of_care)
      and exists (
        select 1
        from public.facility_payers fp
        where fp.facility_id = f.id
          and fp.payer_type = p_payer_type
      )
      -- A generic commercial payer category never widens a volunteered carrier
      -- into unrelated commercial results.
      and (
        p_payer_carrier is null
        or exists (
          select 1
          from unnest(f.carriers_named) as listed_carrier(name)
          where lower(listed_carrier.name) = lower(p_payer_carrier)
        )
      )
  ),
  normalized as (
    select
      e.id,
      e.name,
      e.city,
      e.state,
      e.referral_contact,
      p_care_level as level,
      e.bed_based,
      case
        when e.bed_based
         and e.reported_beds > 0
         and e.reported_at >= now() - interval '7 days'
         and e.reported_at <= now() + interval '5 minutes'
          then e.reported_beds
        else 0
      end as beds_available,
      case
        when e.bed_based
         and e.reported_beds > 0
         and e.reported_at >= now() - interval '3 days'
         and e.reported_at <= now() + interval '5 minutes'
          then 'green'
        when e.bed_based
         and e.reported_beds > 0
         and e.reported_at >= now() - interval '7 days'
         and e.reported_at <= now() + interval '5 minutes'
          then 'amber'
        else 'red'
      end as freshness,
      (
        e.bed_based
        and e.reported_beds > 0
        and e.reported_at >= now() - interval '7 days'
        and e.reported_at <= now() + interval '5 minutes'
        and e.reported_by is not null
      ) as provider_reported,
      e.region_match
    from eligible e
  ),
  scored as (
    select
      n.*,
      (
        case when n.region_match then 12 else 0 end
        + case n.freshness when 'green' then 3 when 'amber' then 1 else 0 end
        + case when n.beds_available > 0 then 3 else 0 end
      )::integer as score
    from normalized n
  )
  select
    s.id,
    s.name,
    s.city,
    s.state,
    s.referral_contact,
    s.level,
    s.bed_based,
    s.beds_available,
    s.freshness,
    s.provider_reported,
    s.region_match,
    s.score
  from scored s
  -- Twelve proximity points exceed the maximum six availability points, so a
  -- same-ZIP3 option always precedes a different-region option. Bed count breaks
  -- only equally fresh residential ties; names and UUIDs make the order stable.
  order by
    s.score desc,
    s.beds_available desc,
    lower(s.name) asc,
    s.name asc,
    s.id asc
  limit least(greatest(coalesce(p_limit, 3), 1), 10);
$function$;

revoke all on function public.match_directory_options(text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.match_directory_options(text, text, text, text, text, integer)
  to service_role;

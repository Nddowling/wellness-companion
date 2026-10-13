-- Expand the guided directory browse window without expanding the separately
-- recorded and consent-limited contact shortlist (still at most three).
-- This replaces only the result cap of the previously deployed matcher.
create or replace function public.match_directory_options_nearby(
  p_olat             double precision,
  p_olng             double precision,
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
  miles             double precision
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with eligible as (
    select
      f.id,
      f.name,
      f.city,
      f.state,
      f.referral_contact,
      (p_care_level = 'residential') as bed_based,
      c.beds_available as reported_beds,
      c.last_updated as reported_at,
      c.updated_by as reported_by,
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
    left join public.facility_capacity c
      on c.facility_id = f.id
     and c.level_of_care = 'residential'
    where p_olat between -90 and 90
      and p_olng between -180 and 180
      and f.is_published
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
      and p_care_level = any(f.levels_of_care)
      and exists (
        select 1
        from public.facility_payers fp
        where fp.facility_id = f.id
          and fp.payer_type = p_payer_type
      )
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
      e.miles
    from eligible e
  )
  select
    n.id,
    n.name,
    n.city,
    n.state,
    n.referral_contact,
    n.level,
    n.bed_based,
    n.beds_available,
    n.freshness,
    n.provider_reported,
    n.miles
  from normalized n
  order by
    n.miles nulls last,
    case n.freshness when 'green' then 2 when 'amber' then 1 else 0 end desc,
    n.beds_available desc,
    lower(n.name) asc,
    n.name asc,
    n.id asc
  limit least(greatest(coalesce(p_limit, 3), 1), 24);
$function$;

-- CREATE OR REPLACE retains existing grants, but reiterate the server-only
-- boundary so this migration is safe if replayed on a fresh environment.
revoke all on function public.match_directory_options_nearby(
  double precision, double precision, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.match_directory_options_nearby(
  double precision, double precision, text, text, text, text, integer
) to service_role;

comment on function public.match_directory_options_nearby(
  double precision, double precision, text, text, text, text, integer
) is 'Server-only guided browse results: hard filters first, then approximate ZIP-centroid distance; up to 24 options; contact routing separately limited to three.';

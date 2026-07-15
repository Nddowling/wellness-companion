-- Viewport ("search this area") discovery for the nearby map: every published
-- facility whose coordinates fall inside the visible map frame, capped at p_limit and
-- ordered by distance to the seeker's origin (so the kept set is the closest-to-them in
-- view). Distance-only — no ranking or favoritism, same neutrality as facilities_near_point.

-- Historical clean-chain repair: these nullable/no-default columns existed in
-- the hosted schema before this RPC was checked in, but no repository migration
-- created them. Match that schema before the function's first reference.
alter table public.facilities
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create or replace function public.facilities_in_bounds(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_olat    double precision,
  p_olng    double precision,
  p_limit   integer default 20
)
returns table(
  id uuid, name text, city text, state text, zip text,
  levels_of_care text[], latitude double precision, longitude double precision, miles double precision
)
language sql stable as $function$
  select f.id, f.name, f.city, f.state, f.zip, f.levels_of_care, f.latitude, f.longitude,
    3959 * acos(greatest(-1, least(1,
      cos(radians(p_olat))*cos(radians(f.latitude))*cos(radians(f.longitude)-radians(p_olng))
      + sin(radians(p_olat))*sin(radians(f.latitude))))) as miles
  from facilities f
  where f.is_published
    and f.latitude is not null and f.longitude is not null
    and f.latitude between p_min_lat and p_max_lat
    and f.longitude between p_min_lng and p_max_lng
  order by miles
  limit p_limit;
$function$;

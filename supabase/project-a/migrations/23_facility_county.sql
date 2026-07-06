-- County for facilities, derived from ZIP via a public census crosswalk
-- (data/zip-county.csv). Powers the city -> county -> state differentiation tier so
-- single-facility-city profiles (the thinnest pages) still get a real "one of N in
-- {County}" positioning line instead of falling straight to weak state framing.
-- Backfilled by scripts/backfill-facility-counties.mjs.

alter table public.facilities add column if not exists county text;

comment on column public.facilities.county is
  'County name (no "County" suffix), derived from ZIP via the public census crosswalk.';

create index if not exists facilities_state_county_idx
  on public.facilities (state, county) where county is not null;

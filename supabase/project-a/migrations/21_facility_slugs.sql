-- SEO-friendly slugs for facility profile URLs (/programs/<slug> instead of the raw
-- UUID). Nullable to start: existing rows keep resolving by UUID while the backfill
-- (scripts/backfill-facility-slugs.mjs --write) fills slugs in. The unique index is
-- PARTIAL (where slug is not null) so the pre-backfill NULLs never collide and the
-- column can be populated incrementally / re-run safely.

alter table public.facilities
  add column if not exists slug text;

comment on column public.facilities.slug is
  'URL slug: slugify(name)-city-state, e.g. coastal-recovery-savannah-ga. '
  'Assigned once by scripts/backfill-facility-slugs.mjs and then stable (do not '
  'recompute on rename — that would break the canonical URL).';

-- Unique across all non-null slugs. Partial predicate keeps NULLs out of the index
-- (Postgres would treat them as distinct anyway) and documents the intent.
create unique index if not exists facilities_slug_key
  on public.facilities (slug)
  where slug is not null;

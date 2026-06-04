-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 06_profiles_and_reviews.sql                           ║
-- ║                                                                            ║
-- ║ Public facility profiles: website, photos, a longer description, and       ║
-- ║ visitor reviews/comments. Reviews are public content (NOT PHI). Approved   ║
-- ║ reviews are world-readable; submissions are inserted server-side.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table facilities
  add column if not exists website     text,
  add column if not exists images      text[] not null default '{}',
  add column if not exists description  text;

create table if not exists facility_reviews (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  author_name text,
  rating      integer check (rating between 1 and 5),
  body        text not null,
  status      text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_reviews_facility on facility_reviews (facility_id, status);

alter table facility_reviews enable row level security;
drop policy if exists reviews_public_read on facility_reviews;
create policy reviews_public_read on facility_reviews for select using (status = 'approved');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — Project A ("Core") — 01_core.sql                       ║
-- ║                                                                            ║
-- ║ Free-tier, NO PHI. Facilities, BD CRM, and DE-IDENTIFIED match records.    ║
-- ║ Run this first, then 02_rls.sql. Idempotent where practical.               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ── updated_at trigger helper ────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── facilities ───────────────────────────────────────────────────────────────
-- The directory. NONE of this is PHI — it describes places, not people.
create table if not exists facilities (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  street             text,
  city               text,
  state              text,
  zip                text,
  -- De-identified region used for matching analytics (ZIP-3, e.g. "load 902").
  zip3               text generated always as (left(zip, 3)) stored,
  npi                text,
  license_number     text,
  accreditations     text[] not null default '{}',          -- e.g. {jcaho, carf}
  levels_of_care     text[] not null default '{}',          -- detox/residential/php/iop/op
  specialties        text[] not null default '{}',          -- e.g. {dual_diagnosis, trauma}
  populations_served text[] not null default '{}',          -- e.g. {adolescent, lgbtq, veterans}
  is_gated           boolean not null default false,
  is_faith_based     boolean not null default false,
  cash_rate          numeric(10,2),
  referral_contact   jsonb not null default '{}'::jsonb,    -- {name, email, phone}
  is_published       boolean not null default false,
  verified_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_facilities_published    on facilities (is_published);
create index if not exists idx_facilities_zip3         on facilities (zip3);
create index if not exists idx_facilities_levels       on facilities using gin (levels_of_care);
create index if not exists idx_facilities_specialties  on facilities using gin (specialties);
create index if not exists idx_facilities_populations  on facilities using gin (populations_served);

drop trigger if exists trg_facilities_updated_at on facilities;
create trigger trg_facilities_updated_at before update on facilities
  for each row execute function set_updated_at();

-- ── facility_members ─────────────────────────────────────────────────────────
-- Links an auth user to a facility. THIS JOIN is what facility RLS keys off,
-- so a logged-in facility user can only touch their own facility's rows.
create table if not exists facility_members (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'staff' check (role in ('owner', 'staff')),
  created_at  timestamptz not null default now(),
  unique (facility_id, user_id)
);

create index if not exists idx_facility_members_user on facility_members (user_id);

-- ── facility_payers ──────────────────────────────────────────────────────────
-- Which payer *types* a facility accepts / is in-network with. Never member IDs.
create table if not exists facility_payers (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  payer_type  text not null check (payer_type in
                ('medicaid', 'medicare', 'commercial', 'tricare', 'self_pay')),
  in_network  boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (facility_id, payer_type)
);

create index if not exists idx_facility_payers_facility on facility_payers (facility_id);

-- ── facility_capacity ────────────────────────────────────────────────────────
-- Bed availability. `last_updated` is the FRESHNESS MOAT — keep it honest.
create table if not exists facility_capacity (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references facilities(id) on delete cascade,
  level_of_care   text not null check (level_of_care in
                    ('detox', 'residential', 'php', 'iop', 'op')),
  beds_available  integer not null default 0 check (beds_available >= 0),
  last_updated    timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  unique (facility_id, level_of_care)
);

create index if not exists idx_capacity_facility     on facility_capacity (facility_id);
create index if not exists idx_capacity_last_updated on facility_capacity (last_updated);

-- ── bd_users ─────────────────────────────────────────────────────────────────
-- Business-developer (referrer) profiles.
create table if not exists bd_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  employer   text,
  territory  text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_bd_users_updated_at on bd_users;
create trigger trg_bd_users_updated_at before update on bd_users
  for each row execute function set_updated_at();

-- ── bd_facility_notes ────────────────────────────────────────────────────────
-- CRM notes about PLACES, never about patients.
create table if not exists bd_facility_notes (
  id          uuid primary key default gen_random_uuid(),
  bd_user_id  uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_bd_notes_owner    on bd_facility_notes (bd_user_id);
create index if not exists idx_bd_notes_facility on bd_facility_notes (facility_id);

drop trigger if exists trg_bd_notes_updated_at on bd_facility_notes;
create trigger trg_bd_notes_updated_at before update on bd_facility_notes
  for each row execute function set_updated_at();

-- ── bd_saved_facilities ──────────────────────────────────────────────────────
create table if not exists bd_saved_facilities (
  bd_user_id  uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (bd_user_id, facility_id)
);

-- ── matches ──────────────────────────────────────────────────────────────────
-- DE-IDENTIFIED demand record. NO name / DOB / insurance ever lands here.
-- The only link to a real person lives in Project B and is resolved server-side.
create table if not exists matches (
  id               uuid primary key default gen_random_uuid(),
  region_zip3      text,
  care_level_needed text check (care_level_needed in
                     ('detox', 'residential', 'php', 'iop', 'op')),
  payer_type       text check (payer_type in
                     ('medicaid', 'medicare', 'commercial', 'tricare', 'self_pay')),
  concern_category text,
  source           text not null default 'seeker' check (source in ('seeker', 'bd')),
  bd_user_id       uuid references auth.users(id) on delete set null, -- set only for BD-originated referrals
  status           text not null default 'open' check (status in
                     ('open', 'routed', 'connected', 'closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_matches_bd     on matches (bd_user_id);
create index if not exists idx_matches_status on matches (status);

drop trigger if exists trg_matches_updated_at on matches;
create trigger trg_matches_updated_at before update on matches
  for each row execute function set_updated_at();

-- ── match_routes ─────────────────────────────────────────────────────────────
-- Which facilities a match was routed to. Drives "you have N leads" + facility
-- RLS (a facility sees only routes pointing at facilities it belongs to).
create table if not exists match_routes (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  status      text not null default 'sent' check (status in
                ('sent', 'viewed', 'accepted', 'declined')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (match_id, facility_id)
);

create index if not exists idx_match_routes_facility on match_routes (facility_id);
create index if not exists idx_match_routes_match    on match_routes (match_id);

drop trigger if exists trg_match_routes_updated_at on match_routes;
create trigger trg_match_routes_updated_at before update on match_routes
  for each row execute function set_updated_at();

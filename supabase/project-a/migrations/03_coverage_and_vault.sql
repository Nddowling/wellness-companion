-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 03_coverage_and_vault.sql                              ║
-- ║                                                                            ║
-- ║ 1. De-identified coverage status on matches.                               ║
-- ║ 2. PHI vault tables (seeker identity + consent + email log).               ║
-- ║                                                                            ║
-- ║ ⚠ The vault_* tables hold 42 CFR Part 2 records. RLS denies ALL client     ║
-- ║   roles — they are reachable ONLY via the server-side service-role client  ║
-- ║   (src/lib/supabase/vault.ts). In production, move them to an ISOLATED,    ║
-- ║   BAA-covered Supabase project and point VAULT_SUPABASE_URL at it. Only    ║
-- ║   write here with a signed BAA + HIPAA add-on + 42 CFR Part 2 / EKRA       ║
-- ║   review and explicit seeker consent.                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table matches
  add column if not exists coverage_status text
  check (coverage_status in ('active', 'inactive', 'unsure'));

create table if not exists vault_seekers (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid references matches(id) on delete set null,
  email            text,
  name             text,
  dob              text,
  insurance        text,
  coverage_status  text check (coverage_status in ('active', 'inactive', 'unsure')),
  phone            text,
  consent_email    boolean not null default false,
  consent_share    boolean not null default false,
  consent_at       timestamptz,
  status           text not null default 'active' check (status in ('active', 'connected', 'unsubscribed')),
  last_reminded_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists vault_seeker_interest (
  id           uuid primary key default gen_random_uuid(),
  seeker_id    uuid not null references vault_seekers(id) on delete cascade,
  facility_id  uuid not null references facilities(id) on delete cascade,
  match_id     uuid references matches(id) on delete set null,
  info_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (seeker_id, facility_id)
);

create table if not exists vault_email_log (
  id          uuid primary key default gen_random_uuid(),
  seeker_id   uuid references vault_seekers(id) on delete set null,
  facility_id uuid references facilities(id) on delete set null,
  kind        text not null check (kind in ('welcome', 'treatment_info', 'face_sheet', 'weekly_reminder')),
  to_email    text not null,
  provider_id text,
  sent_at     timestamptz not null default now(),
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists idx_vault_seekers_status on vault_seekers (status);
create index if not exists idx_vault_interest_seeker on vault_seeker_interest (seeker_id);

drop trigger if exists trg_vault_seekers_updated_at on vault_seekers;
create trigger trg_vault_seekers_updated_at before update on vault_seekers
  for each row execute function set_updated_at();

-- Deny-all: RLS on, no policies → only the service role (which bypasses RLS) can access.
alter table vault_seekers         enable row level security;
alter table vault_seeker_interest enable row level security;
alter table vault_email_log       enable row level security;

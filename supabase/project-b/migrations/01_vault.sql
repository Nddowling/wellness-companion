-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — Project B ("Vault") — 01_vault.sql                     ║
-- ║                                                                            ║
-- ║ 🔴 PHI. DO NOT APPLY AT BETA. Authored for review only.                     ║
-- ║                                                                            ║
-- ║ Apply ONLY after: Supabase Team plan + signed BAA + HIPAA add-on +          ║
-- ║ security risk assessment + healthcare-attorney sign-off. See README.md.     ║
-- ║                                                                            ║
-- ║ This runs in a SEPARATE Supabase project from Project A. The link to the    ║
-- ║ de-identified `matches` table lives in `seeker_match_link.match_id` and is   ║
-- ║ a logical (cross-project) reference — resolved server-side ONLY.            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgcrypto;

-- ── seekers — real identity ───────────────────────────────────────────────────
create table if not exists seekers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  dob         date,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── seeker_insurance — payer detail (highly sensitive) ────────────────────────
create table if not exists seeker_insurance (
  id            uuid primary key default gen_random_uuid(),
  seeker_id     uuid not null references seekers(id) on delete cascade,
  payer_name    text,
  member_id     text,
  group_number  text,
  subscriber    text,
  card_image_path text,                 -- stored in a HIPAA-scoped private bucket, never public
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── seeker_match_link — the ONE join person ↔ de-identified match ─────────────
-- match_id references Project A `matches.id` LOGICALLY (different project; no FK).
create table if not exists seeker_match_link (
  seeker_id  uuid not null references seekers(id) on delete cascade,
  match_id   uuid not null,             -- → Project A matches.id (cross-project)
  created_at timestamptz not null default now(),
  primary key (seeker_id, match_id)
);

-- RLS: deny-all by default. No client ever reads this project directly; only a
-- tightly-scoped server context (post-BAA) may touch it. Policies to be authored
-- alongside the attorney review — intentionally left with RLS on and NO policies,
-- which denies all access until explicitly granted.
alter table seekers           enable row level security;
alter table seeker_insurance  enable row level security;
alter table seeker_match_link enable row level security;

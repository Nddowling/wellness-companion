-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 12_facility_referrals.sql                             ║
-- ║                                                                            ║
-- ║ Facility-to-facility referral program. A paying facility refers another    ║
-- ║ program; when the referred facility starts a PAID membership the referrer  ║
-- ║ earns 50% off their next month — two paid referrals = a free month, capped ║
-- ║ at 3 free months (6 paid referrals). Not PHI.                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists facility_referrals (
  id                   uuid primary key default gen_random_uuid(),
  referrer_facility_id uuid not null references facilities(id) on delete cascade,
  referred_name        text not null,
  referred_email       text,
  referred_phone       text,
  referred_note        text,
  status               text not null default 'pending' check (status in ('pending', 'converted', 'declined')),
  converted_facility_id uuid references facilities(id) on delete set null,
  credit_applied       boolean not null default false, -- the 50% reward was granted
  created_at           timestamptz not null default now(),
  converted_at         timestamptz
);
create index if not exists idx_facility_referrals_referrer on facility_referrals (referrer_facility_id);
create index if not exists idx_facility_referrals_email on facility_referrals (lower(referred_email));
create index if not exists idx_facility_referrals_status on facility_referrals (status);

-- Running count of paid referrals that have been rewarded (hard cap 6 = 3 free months).
alter table facilities
  add column if not exists referral_credits_earned integer not null default 0;

-- Deny-all RLS: rows are written by server actions / the Stripe webhook via the
-- service-role client, and read in server components after a facility-membership check.
alter table facility_referrals enable row level security;

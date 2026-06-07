-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 10_consent_events.sql                                  ║
-- ║                                                                            ║
-- ║ Append-only consent ledger (PHI vault). vault_seekers already stores the    ║
-- ║ current consent_share / consent_email booleans + a single consent_at, but   ║
-- ║ that column is mutable — it can't prove "you answered yes on THIS date" if   ║
-- ║ consent ever changes. This table is the immutable receipt: one row per       ║
-- ║ consent decision (share / email), with its value and timestamp, never        ║
-- ║ updated. Required posture for HIPAA + 42 CFR Part 2 consent records.         ║
-- ║                                                                            ║
-- ║ Deny-all RLS like the rest of the vault — reachable only via the             ║
-- ║ service-role vault client.                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists vault_consent_events (
  id          uuid primary key default gen_random_uuid(),
  seeker_id   uuid references vault_seekers(id) on delete cascade,
  match_id    uuid,                                  -- de-identified link (no hard FK: vault stays portable)
  channel     text not null check (channel in ('share', 'email')),
  granted     boolean not null,                      -- the yes/no
  source      text not null default 'intake',        -- where the decision was captured
  occurred_at timestamptz not null default now(),    -- when they answered
  created_at  timestamptz not null default now()
);
create index if not exists idx_vault_consent_events_seeker on vault_consent_events (seeker_id, occurred_at desc);

alter table vault_consent_events enable row level security;
-- No policies → service-role only (deny-all), consistent with all vault_* tables.

-- Backfill the existing seekers from their current consent booleans + consent_at,
-- so the ledger is complete from day one. Idempotent: only runs while empty.
insert into vault_consent_events (seeker_id, match_id, channel, granted, source, occurred_at)
select s.id, s.match_id, c.channel,
       case c.channel when 'share' then s.consent_share else s.consent_email end,
       'backfill', coalesce(s.consent_at, s.created_at)
from vault_seekers s
cross join (values ('share'), ('email')) as c(channel)
where not exists (select 1 from vault_consent_events);

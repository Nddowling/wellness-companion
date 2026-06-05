-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 09_outbound_clicks.sql                                ║
-- ║                                                                            ║
-- ║ Outbound referral attribution. When a seeker clicks "Go to website" on a   ║
-- ║ program profile, they pass through /go/[id] which logs a row here and then  ║
-- ║ redirects on with UTM + cb_ref tags. This is the platform's own durable    ║
-- ║ record of "ClearBed handed this person off to you" — facility-level, not    ║
-- ║ a conversion. Not PHI: no seeker identity, just an optional de-identified   ║
-- ║ match_id. EKRA note: for showing value only — never wire to per-referral    ║
-- ║ billing.                                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists outbound_clicks (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  match_id    uuid references matches(id) on delete set null,  -- de-identified, optional
  referrer    text,                                            -- the page the click came from
  created_at  timestamptz not null default now()
);
create index if not exists idx_outbound_clicks_facility on outbound_clicks (facility_id, created_at desc);

alter table outbound_clicks enable row level security;

-- Inserts happen server-side via the service-role client (which bypasses RLS),
-- so there is deliberately no insert policy for authenticated/anon users.
-- A facility may read its own hand-off log; admins see everything.
drop policy if exists outbound_clicks_select on outbound_clicks;
create policy outbound_clicks_select on outbound_clicks for select using (
  is_admin() or is_facility_member(facility_id)
);

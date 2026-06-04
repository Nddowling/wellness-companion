-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 08_facility_claims.sql                                ║
-- ║                                                                            ║
-- ║ Self-service facility onboarding: a rep requests to claim a facility; a     ║
-- ║ Global Admin approves (which assigns them as a facility_member). Not PHI.   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists facility_claims (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  unique (user_id, facility_id)
);
create index if not exists idx_facility_claims_status on facility_claims (status);

alter table facility_claims enable row level security;

drop policy if exists claims_insert_own on facility_claims;
create policy claims_insert_own on facility_claims for insert with check (user_id = auth.uid());

drop policy if exists claims_select on facility_claims;
create policy claims_select on facility_claims for select using (user_id = auth.uid() or is_admin());

drop policy if exists claims_admin_update on facility_claims;
create policy claims_admin_update on facility_claims for update using (is_admin()) with check (is_admin());

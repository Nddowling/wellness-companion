-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — Project A ("Core") — 02_rls.sql                        ║
-- ║                                                                            ║
-- ║ Role-scoped Row-Level Security. Run AFTER 01_core.sql.                      ║
-- ║                                                                            ║
-- ║ Roles:                                                                     ║
-- ║   seeker  — anonymous, NO db account. Matching runs server-side with the   ║
-- ║             service-role key (which bypasses RLS), so seekers never get     ║
-- ║             direct table access.                                            ║
-- ║   facility — sees only its own facility (via facility_members) + matches    ║
-- ║              routed to it (via match_routes).                               ║
-- ║   bd       — reads the published directory; writes only its own notes/saves.║
-- ║   admin    — full access to Project A (membership in platform_admins).      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── admin registry ───────────────────────────────────────────────────────────
create table if not exists platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;

-- ── helper predicates (SECURITY DEFINER bypasses RLS inside → no recursion) ───
-- These are defined BEFORE the admins_select policy (moved below): a policy
-- expression is validated at CREATE time, so is_admin() must already exist. And
-- a SQL function's body is validated at creation too, so is_admin() must come
-- after platform_admins exists — hence platform_admins table first, then fns.
create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function is_bd()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from bd_users where user_id = auth.uid());
$$;

create or replace function is_facility_member(fid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from facility_members
    where facility_id = fid and user_id = auth.uid()
  );
$$;

create or replace function facility_is_published(fid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from facilities where id = fid and is_published);
$$;

create or replace function owns_match(mid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from matches where id = mid and bd_user_id = auth.uid());
$$;

create or replace function is_match_routed_to_me(mid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from match_routes mr
    join facility_members fm on fm.facility_id = mr.facility_id
    where mr.match_id = mid and fm.user_id = auth.uid()
  );
$$;

-- Only admins can read the admin list; no self-service writes (managed out-of-band).
drop policy if exists admins_select on platform_admins;
create policy admins_select on platform_admins
  for select using (is_admin());

-- ── enable RLS everywhere ─────────────────────────────────────────────────────
alter table facilities          enable row level security;
alter table facility_members    enable row level security;
alter table facility_payers     enable row level security;
alter table facility_capacity   enable row level security;
alter table bd_users            enable row level security;
alter table bd_facility_notes   enable row level security;
alter table bd_saved_facilities enable row level security;
alter table matches             enable row level security;
alter table match_routes        enable row level security;

-- ── facilities ────────────────────────────────────────────────────────────────
drop policy if exists facilities_select on facilities;
create policy facilities_select on facilities for select using (
  is_admin()
  or is_facility_member(id)                              -- own facility (even unpublished)
  or (is_published and auth.uid() is not null)           -- published directory → any authed user
);

drop policy if exists facilities_insert on facilities;
create policy facilities_insert on facilities for insert with check (is_admin());

drop policy if exists facilities_update on facilities;
create policy facilities_update on facilities for update
  using (is_admin() or is_facility_member(id))
  with check (is_admin() or is_facility_member(id));

drop policy if exists facilities_delete on facilities;
create policy facilities_delete on facilities for delete using (is_admin());

-- ── facility_members ──────────────────────────────────────────────────────────
drop policy if exists facility_members_select on facility_members;
create policy facility_members_select on facility_members for select using (
  is_admin() or user_id = auth.uid() or is_facility_member(facility_id)
);
-- Membership is assigned by admins (out of the self-service path) for now.
drop policy if exists facility_members_write on facility_members;
create policy facility_members_write on facility_members for all
  using (is_admin()) with check (is_admin());

-- ── facility_payers ───────────────────────────────────────────────────────────
drop policy if exists facility_payers_select on facility_payers;
create policy facility_payers_select on facility_payers for select using (
  is_admin() or is_facility_member(facility_id) or facility_is_published(facility_id)
);
drop policy if exists facility_payers_write on facility_payers;
create policy facility_payers_write on facility_payers for all
  using (is_admin() or is_facility_member(facility_id))
  with check (is_admin() or is_facility_member(facility_id));

-- ── facility_capacity ─────────────────────────────────────────────────────────
drop policy if exists facility_capacity_select on facility_capacity;
create policy facility_capacity_select on facility_capacity for select using (
  is_admin() or is_facility_member(facility_id) or facility_is_published(facility_id)
);
drop policy if exists facility_capacity_write on facility_capacity;
create policy facility_capacity_write on facility_capacity for all
  using (is_admin() or is_facility_member(facility_id))
  with check (is_admin() or is_facility_member(facility_id));

-- ── bd_users ──────────────────────────────────────────────────────────────────
drop policy if exists bd_users_select on bd_users;
create policy bd_users_select on bd_users for select using (
  is_admin() or user_id = auth.uid()
);
drop policy if exists bd_users_upsert on bd_users;
create policy bd_users_upsert on bd_users for insert with check (user_id = auth.uid());
drop policy if exists bd_users_update on bd_users;
create policy bd_users_update on bd_users for update
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ── bd_facility_notes (own rows only) ─────────────────────────────────────────
drop policy if exists bd_notes_all on bd_facility_notes;
create policy bd_notes_all on bd_facility_notes for all
  using (is_admin() or bd_user_id = auth.uid())
  with check (bd_user_id = auth.uid());

-- ── bd_saved_facilities (own rows only) ───────────────────────────────────────
drop policy if exists bd_saved_all on bd_saved_facilities;
create policy bd_saved_all on bd_saved_facilities for all
  using (is_admin() or bd_user_id = auth.uid())
  with check (bd_user_id = auth.uid());

-- ── matches (de-identified) ───────────────────────────────────────────────────
-- Read: admin; the BD who owns a referral; or a facility the match was routed to.
drop policy if exists matches_select on matches;
create policy matches_select on matches for select using (
  is_admin() or owns_match(id) or is_match_routed_to_me(id)
);
-- Insert: server (service role, bypasses RLS) for seeker matches; a BD may file
-- their own referral. Identity NEVER lives here regardless of source.
drop policy if exists matches_insert on matches;
create policy matches_insert on matches for insert with check (
  is_admin() or (source = 'bd' and bd_user_id = auth.uid())
);
drop policy if exists matches_update on matches;
create policy matches_update on matches for update
  using (is_admin()) with check (is_admin());

-- ── match_routes ──────────────────────────────────────────────────────────────
drop policy if exists match_routes_select on match_routes;
create policy match_routes_select on match_routes for select using (
  is_admin() or is_facility_member(facility_id) or owns_match(match_id)
);
-- Facilities update their own routes (viewed/accepted/declined). Creation is
-- server-side (service role) when a match is routed.
drop policy if exists match_routes_update on match_routes;
create policy match_routes_update on match_routes for update
  using (is_admin() or is_facility_member(facility_id))
  with check (is_admin() or is_facility_member(facility_id));
drop policy if exists match_routes_insert on match_routes;
create policy match_routes_insert on match_routes for insert with check (is_admin());

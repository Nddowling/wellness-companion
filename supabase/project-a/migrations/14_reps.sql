-- ═══════════════════════════════════════════════════════════════════════════
-- 14_reps.sql — the Reps lane (facility-side professional profiles)
-- ═══════════════════════════════════════════════════════════════════════════
-- "Reps" = facility-side professionals (business development, admissions,
-- marketing) who build a LinkedIn-style personal profile, attach it to their
-- facility's listing, invite colleagues, and seed the listing bottom-up. The
-- visible (half-built) team is the pull that brings the director in to file the
-- existing /claim — which verifies the team.
--
-- TRUST MODEL (decided): the personal profile is LIVE immediately (shareable at
-- /p/<slug>), but a rep only appears ON a facility's public listing once the
-- affiliation is VERIFIED (by the claimed facility's director, or an admin).
--
-- ACCESS ≠ AFFILIATION: an affiliation is display-only. It NEVER grants facility
-- management rights — that still requires a verified director claim
-- (facility_members). This blocks anyone from self-asserting control of a listing.
--
-- All rep data is NON-PHI app data → project-a (not the project-b vault).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── rep_profiles — one LinkedIn-style profile per person ──────────────────────
create table if not exists rep_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  slug         text unique not null,             -- public URL: /p/<slug>
  display_name text not null,
  headline     text,                             -- "Admissions Director · 8 yrs in recovery care"
  bio          text,
  photo_url    text,                             -- headshot URL (native upload is a fast-follow)
  linkedin_url text,
  location     text,
  specialties  text[] not null default '{}',
  is_public    boolean not null default true,    -- profile page live + listable
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_rep_profiles_updated_at on rep_profiles;
create trigger trg_rep_profiles_updated_at before update on rep_profiles
  for each row execute function set_updated_at();

-- ── facility_affiliations — "I represent this facility" (pending → verified) ──
create table if not exists facility_affiliations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  title       text,                              -- their role AT this facility
  status      text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, facility_id)
);

create index if not exists idx_affiliations_facility on facility_affiliations (facility_id, status);
create index if not exists idx_affiliations_user on facility_affiliations (user_id);

drop trigger if exists trg_affiliations_updated_at on facility_affiliations;
create trigger trg_affiliations_updated_at before update on facility_affiliations
  for each row execute function set_updated_at();

-- ── rep_invites — tokenized "invite a colleague" links (the viral loop) ──────
create table if not exists rep_invites (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,
  inviter_id  uuid not null references auth.users(id) on delete cascade,
  facility_id uuid references facilities(id) on delete set null,  -- pre-attach invitee to this facility
  email       text,                              -- optional targeted invite
  created_at  timestamptz not null default now()
);

create index if not exists idx_rep_invites_inviter on rep_invites (inviter_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table rep_profiles          enable row level security;
alter table facility_affiliations enable row level security;
alter table rep_invites           enable row level security;

-- rep_profiles: public profiles are world-readable; owner/admin manage.
drop policy if exists rep_profiles_select on rep_profiles;
create policy rep_profiles_select on rep_profiles for select
  using (is_public or user_id = auth.uid() or is_admin());
drop policy if exists rep_profiles_insert on rep_profiles;
create policy rep_profiles_insert on rep_profiles for insert with check (user_id = auth.uid());
drop policy if exists rep_profiles_update on rep_profiles;
create policy rep_profiles_update on rep_profiles for update
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- facility_affiliations: the rep owns their row; the claimed facility's director
-- (is_facility_member) or an admin can verify/reject. Public listing reads go
-- through the service client (bypasses RLS), so no anon policy is needed here.
drop policy if exists affiliations_select on facility_affiliations;
create policy affiliations_select on facility_affiliations for select
  using (is_admin() or user_id = auth.uid() or is_facility_member(facility_id));
drop policy if exists affiliations_insert on facility_affiliations;
create policy affiliations_insert on facility_affiliations for insert with check (user_id = auth.uid());
drop policy if exists affiliations_update on facility_affiliations;
create policy affiliations_update on facility_affiliations for update
  using (is_admin() or user_id = auth.uid() or is_facility_member(facility_id))
  with check (is_admin() or user_id = auth.uid() or is_facility_member(facility_id));
drop policy if exists affiliations_delete on facility_affiliations;
create policy affiliations_delete on facility_affiliations for delete
  using (is_admin() or user_id = auth.uid() or is_facility_member(facility_id));

-- rep_invites: created + read by the inviter (acceptance is read via the service
-- client by token, which bypasses RLS).
drop policy if exists rep_invites_select on rep_invites;
create policy rep_invites_select on rep_invites for select
  using (is_admin() or inviter_id = auth.uid());
drop policy if exists rep_invites_insert on rep_invites;
create policy rep_invites_insert on rep_invites for insert with check (inviter_id = auth.uid());
drop policy if exists rep_invites_delete on rep_invites;
create policy rep_invites_delete on rep_invites for delete
  using (is_admin() or inviter_id = auth.uid());

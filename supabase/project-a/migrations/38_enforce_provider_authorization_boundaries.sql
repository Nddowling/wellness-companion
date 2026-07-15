-- P0 authorization boundary: browser roles may read only the rows allowed by RLS,
-- but every sensitive facility mutation crosses a canonical server/RPC boundary.
-- This migration must run after 37_atomic_connector_handoff.sql.
--
-- Rollback (only during an application rollback window):
--   1. Move private.is_admin/is_bd/is_facility_member/facility_is_published/
--      owns_match/is_match_routed_to_me back to schema public.
--   2. Restore the former policies from 02_rls.sql / 08_facility_claims.sql /
--      14_reps.sql and their authenticated table grants; drop the partial
--      facility_claims_one_pending_user_request index only if the old upsert path
--      is also restored with a compatible full unique constraint.
--   3. Drop the four lane triggers, affiliation guard trigger, public status
--      wrapper, private status implementation, and claim-approval RPC.
--   4. Restore archived admin memberships with:
--        insert into public.facility_members (id, facility_id, user_id, role, created_at)
--        select original_member_id, facility_id, user_id, role, membership_created_at
--        from public.provider_lane_membership_archive
--        on conflict (facility_id, user_id) do nothing;
-- Do not restore an archived membership while the exclusivity trigger is installed.

-- Production had one historical admin + facility overlap. Admins already manage
-- facilities through /admin, so preserve the redundant membership for rollback
-- and remove it before installing the invariant.
create table if not exists public.provider_lane_membership_archive (
  original_member_id uuid primary key,
  facility_id uuid not null,
  user_id uuid not null,
  role text not null,
  membership_created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  reason text not null check (reason in ('admin_lane_precedence'))
);

alter table public.provider_lane_membership_archive enable row level security;
revoke all privileges on table public.provider_lane_membership_archive
  from public, anon, authenticated;
grant all privileges on table public.provider_lane_membership_archive to service_role;

-- RLS predicates are implementation details, not public RPCs. Move the existing
-- function OIDs (policy dependencies follow automatically) into a non-exposed
-- schema. Browser roles retain EXECUTE only so PostgreSQL can evaluate policies.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

do $block$
declare
  signature text;
  predicate regprocedure;
begin
  foreach signature in array array[
    'public.is_admin()',
    'public.is_bd()',
    'public.is_facility_member(uuid)',
    'public.facility_is_published(uuid)',
    'public.owns_match(uuid)',
    'public.is_match_routed_to_me(uuid)'
  ]
  loop
    predicate := to_regprocedure(signature);
    if predicate is not null then
      execute format('alter function %s set schema private', predicate);
    end if;
  end loop;
end;
$block$;

revoke execute on function private.is_admin() from public;
revoke execute on function private.is_bd() from public;
revoke execute on function private.is_facility_member(uuid) from public;
revoke execute on function private.facility_is_published(uuid) from public;
revoke execute on function private.owns_match(uuid) from public;
revoke execute on function private.is_match_routed_to_me(uuid) from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_bd() to anon, authenticated, service_role;
grant execute on function private.is_facility_member(uuid) to anon, authenticated, service_role;
grant execute on function private.facility_is_published(uuid) to anon, authenticated, service_role;
grant execute on function private.owns_match(uuid) to anon, authenticated, service_role;
grant execute on function private.is_match_routed_to_me(uuid) to anon, authenticated, service_role;

-- The ubiquitous timestamp trigger has no relation lookups; pinning pg_catalog
-- removes the final mutable-search-path warning without changing behavior.
alter function public.set_updated_at() set search_path = pg_catalog;

insert into public.provider_lane_membership_archive (
  original_member_id, facility_id, user_id, role, membership_created_at, reason
)
select member.id, member.facility_id, member.user_id, member.role,
       member.created_at, 'admin_lane_precedence'
from public.facility_members as member
join public.platform_admins as admin on admin.user_id = member.user_id
on conflict (original_member_id) do nothing;

delete from public.facility_members as member
using public.platform_admins as admin
where admin.user_id = member.user_id;

-- No other lane collision can be resolved automatically without changing the
-- user's product identity. Abort deployment if one appears after this audit.
do $block$
declare
  conflict_count integer;
begin
  with lanes as (
    select auth_user.id,
      exists (select 1 from public.platform_admins a where a.user_id = auth_user.id) as is_admin,
      exists (select 1 from public.facility_members f where f.user_id = auth_user.id) as is_facility,
      exists (select 1 from public.bd_users b where b.user_id = auth_user.id) as is_partner,
      exists (select 1 from public.rep_profiles r where r.user_id = auth_user.id) as is_rep
    from auth.users as auth_user
  )
  select count(*)::integer into conflict_count
  from lanes
  where is_admin::integer + is_facility::integer + is_partner::integer + is_rep::integer > 1;

  if conflict_count > 0 then
    raise exception 'provider lane conflicts require manual review: % user(s)', conflict_count
      using errcode = '23514';
  end if;
end;
$block$;

-- Serialize all lane establishment for one auth user and reject cross-lane
-- inserts even when two service requests race. A facility user may belong to
-- multiple facilities; those rows are one canonical lane.
create or replace function public.enforce_exclusive_provider_lane()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_user_id uuid := new.user_id;
begin
  if target_user_id is null then
    raise exception 'provider lane requires a user' using errcode = '23502';
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'provider lane identity is immutable' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_user_id::text, 38001)
  );

  if tg_table_name <> 'platform_admins'
     and exists (select 1 from public.platform_admins a where a.user_id = target_user_id) then
    raise exception 'user already belongs to the admin lane' using errcode = '23514';
  end if;
  if tg_table_name <> 'facility_members'
     and exists (select 1 from public.facility_members f where f.user_id = target_user_id) then
    raise exception 'user already belongs to the facility lane' using errcode = '23514';
  end if;
  if tg_table_name <> 'bd_users'
     and exists (select 1 from public.bd_users b where b.user_id = target_user_id) then
    raise exception 'user already belongs to the partner lane' using errcode = '23514';
  end if;
  if tg_table_name <> 'rep_profiles'
     and exists (select 1 from public.rep_profiles r where r.user_id = target_user_id) then
    raise exception 'user already belongs to the representative lane' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke execute on function public.enforce_exclusive_provider_lane()
  from public, anon, authenticated;

drop trigger if exists trg_platform_admin_exclusive_lane on public.platform_admins;
create trigger trg_platform_admin_exclusive_lane
  before insert or update on public.platform_admins
  for each row execute function public.enforce_exclusive_provider_lane();

drop trigger if exists trg_facility_member_exclusive_lane on public.facility_members;
create trigger trg_facility_member_exclusive_lane
  before insert or update on public.facility_members
  for each row execute function public.enforce_exclusive_provider_lane();

drop trigger if exists trg_partner_exclusive_lane on public.bd_users;
create trigger trg_partner_exclusive_lane
  before insert or update on public.bd_users
  for each row execute function public.enforce_exclusive_provider_lane();

drop trigger if exists trg_rep_exclusive_lane on public.rep_profiles;
create trigger trg_rep_exclusive_lane
  before insert or update on public.rep_profiles
  for each row execute function public.enforce_exclusive_provider_lane();

-- Affiliation identity is immutable and every new request begins pending. The
-- status-only RPC below is the sole browser-callable verification path.
create or replace function public.enforce_facility_affiliation_integrity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'new affiliations must be pending' using errcode = '23514';
    end if;
  elsif old.id is distinct from new.id
     or old.user_id is distinct from new.user_id
     or old.facility_id is distinct from new.facility_id
     or old.invited_by is distinct from new.invited_by
     or old.created_at is distinct from new.created_at then
    raise exception 'affiliation identity is immutable' using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_facility_affiliation_integrity()
  from public, anon, authenticated;

drop trigger if exists trg_affiliation_integrity on public.facility_affiliations;
create trigger trg_affiliation_integrity
  before insert or update on public.facility_affiliations
  for each row execute function public.enforce_facility_affiliation_integrity();

-- Remove every broad browser write policy on directory/control tables. Select
-- policies remain intact so each signed-in lane can render its own workspace.
drop policy if exists facilities_insert on public.facilities;
drop policy if exists facilities_update on public.facilities;
drop policy if exists facilities_delete on public.facilities;
drop policy if exists facility_members_write on public.facility_members;
drop policy if exists facility_payers_write on public.facility_payers;
drop policy if exists facility_capacity_write on public.facility_capacity;
drop policy if exists match_routes_update on public.match_routes;
drop policy if exists match_routes_insert on public.match_routes;
drop policy if exists matches_insert on public.matches;
drop policy if exists matches_update on public.matches;
drop policy if exists affiliations_insert on public.facility_affiliations;
drop policy if exists affiliations_update on public.facility_affiliations;
drop policy if exists affiliations_delete on public.facility_affiliations;
drop policy if exists bd_users_upsert on public.bd_users;
drop policy if exists rep_profiles_insert on public.rep_profiles;
drop policy if exists claims_admin_update on public.facility_claims;

-- A self-filed claim is only a pending review request. A browser can never
-- manufacture an approved claim and unlock a full public profile.
drop policy if exists claims_insert_own on public.facility_claims;
create policy claims_insert_own on public.facility_claims
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and facility_id is not null
    and status = 'pending'
  );

-- The public-claim migration intentionally removed the old nullable full-table
-- unique constraint. Restore idempotency only for signed-in pending requests;
-- rejected/approved history and account-less public claims remain append-only.
create unique index if not exists facility_claims_one_pending_user_request
  on public.facility_claims (user_id, facility_id)
  where status = 'pending' and user_id is not null and facility_id is not null;

-- Cache auth.uid() and no-argument role predicates once per statement instead
-- of once per candidate row. Restrict every workspace policy to authenticated
-- explicitly; anonymous public pages use controlled server-side directory DTOs.
drop policy if exists admins_select on public.platform_admins;
create policy admins_select on public.platform_admins
  for select to authenticated
  using ((select private.is_admin()));

drop policy if exists facilities_select on public.facilities;
create policy facilities_select on public.facilities
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(id)
    or (is_published and (select auth.uid()) is not null)
  );

drop policy if exists facility_members_select on public.facility_members;
create policy facility_members_select on public.facility_members
  for select to authenticated
  using (
    (select private.is_admin())
    or user_id = (select auth.uid())
    or private.is_facility_member(facility_id)
  );

drop policy if exists facility_payers_select on public.facility_payers;
create policy facility_payers_select on public.facility_payers
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(facility_id)
    or private.facility_is_published(facility_id)
  );

drop policy if exists facility_capacity_select on public.facility_capacity;
create policy facility_capacity_select on public.facility_capacity
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(facility_id)
    or private.facility_is_published(facility_id)
  );

drop policy if exists bd_users_select on public.bd_users;
create policy bd_users_select on public.bd_users
  for select to authenticated
  using ((select private.is_admin()) or user_id = (select auth.uid()));

drop policy if exists bd_users_update on public.bd_users;
create policy bd_users_update on public.bd_users
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists bd_notes_all on public.bd_facility_notes;
create policy bd_notes_all on public.bd_facility_notes
  for all to authenticated
  using ((select private.is_admin()) or bd_user_id = (select auth.uid()))
  with check (bd_user_id = (select auth.uid()));

drop policy if exists bd_saved_all on public.bd_saved_facilities;
create policy bd_saved_all on public.bd_saved_facilities
  for all to authenticated
  using ((select private.is_admin()) or bd_user_id = (select auth.uid()))
  with check (bd_user_id = (select auth.uid()));

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to authenticated
  using (
    (select private.is_admin())
    or private.owns_match(id)
    or private.is_match_routed_to_me(id)
  );

drop policy if exists match_routes_select on public.match_routes;
create policy match_routes_select on public.match_routes
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(facility_id)
    or private.owns_match(match_id)
  );

drop policy if exists claims_select on public.facility_claims;
create policy claims_select on public.facility_claims
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists partner_lists_all on public.partner_lists;
create policy partner_lists_all on public.partner_lists
  for all to authenticated
  using ((select private.is_admin()) or owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists partner_list_items_all on public.partner_list_items;
create policy partner_list_items_all on public.partner_list_items
  for all to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.partner_lists list
      where list.id = partner_list_items.list_id
        and list.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.partner_lists list
      where list.id = partner_list_items.list_id
        and list.owner_id = (select auth.uid())
    )
  );

drop policy if exists partner_history_all on public.partner_view_history;
create policy partner_history_all on public.partner_view_history
  for all to authenticated
  using ((select private.is_admin()) or user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists rep_profiles_select on public.rep_profiles;
create policy rep_profiles_select on public.rep_profiles
  for select to authenticated
  using (is_public or user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists rep_profiles_update on public.rep_profiles;
create policy rep_profiles_update on public.rep_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists affiliations_select on public.facility_affiliations;
create policy affiliations_select on public.facility_affiliations
  for select to authenticated
  using (
    (select private.is_admin())
    or user_id = (select auth.uid())
    or private.is_facility_member(facility_id)
  );

drop policy if exists rep_invites_select on public.rep_invites;
create policy rep_invites_select on public.rep_invites
  for select to authenticated
  using ((select private.is_admin()) or inviter_id = (select auth.uid()));

drop policy if exists rep_invites_insert on public.rep_invites;
create policy rep_invites_insert on public.rep_invites
  for insert to authenticated
  with check (inviter_id = (select auth.uid()));

drop policy if exists rep_invites_delete on public.rep_invites;
create policy rep_invites_delete on public.rep_invites
  for delete to authenticated
  using ((select private.is_admin()) or inviter_id = (select auth.uid()));

-- Grants are the first Data API boundary; RLS remains defense in depth for reads.
revoke all privileges on table
  public.facilities,
  public.facility_members,
  public.facility_payers,
  public.facility_capacity,
  public.matches,
  public.match_routes,
  public.facility_affiliations,
  public.platform_admins,
  public.bd_users,
  public.rep_profiles,
  public.facility_claims
from public, anon;

revoke insert, update, delete, truncate, references, trigger on table
  public.facilities,
  public.facility_members,
  public.facility_payers,
  public.facility_capacity,
  public.matches,
  public.match_routes,
  public.facility_affiliations,
  public.platform_admins
from authenticated;

revoke insert, delete, truncate, references, trigger on table
  public.bd_users,
  public.rep_profiles
from authenticated;

revoke update, delete, truncate, references, trigger on table public.facility_claims
from authenticated;

grant select on table
  public.facilities,
  public.facility_members,
  public.facility_payers,
  public.facility_capacity,
  public.matches,
  public.match_routes,
  public.facility_affiliations,
  public.platform_admins,
  public.bd_users,
  public.rep_profiles,
  public.facility_claims
to authenticated;
grant update on table public.bd_users, public.rep_profiles to authenticated;
grant insert on table public.facility_claims to authenticated;

-- A representative cannot verify themself. This RPC changes status only after
-- proving that the caller is either a platform admin or a canonical owner of the
-- exact facility. Core affiliation fields cannot be changed by this operation.
create or replace function private.set_facility_affiliation_status(
  p_affiliation_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_user_id uuid := auth.uid();
  target_facility_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'invalid affiliation status' using errcode = '22023';
  end if;

  select affiliation.facility_id into target_facility_id
  from public.facility_affiliations as affiliation
  where affiliation.id = p_affiliation_id
  for update;
  if not found then
    raise exception 'affiliation not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.platform_admins admin where admin.user_id = actor_user_id
  ) and not exists (
    select 1
    from public.facility_members member
    where member.user_id = actor_user_id
      and member.facility_id = target_facility_id
      and member.role = 'owner'
  ) then
    raise exception 'only a facility owner or administrator can change affiliation status'
      using errcode = '42501';
  end if;

  update public.facility_affiliations
  set status = p_status
  where id = p_affiliation_id;

  return target_facility_id;
end;
$function$;

revoke execute on function private.set_facility_affiliation_status(uuid, text)
  from public;
grant execute on function private.set_facility_affiliation_status(uuid, text)
  to authenticated, service_role;

-- PostgREST exposes this invoker wrapper, not the privileged implementation.
-- The private function still checks auth.uid() and exact owner/admin membership.
create or replace function public.set_facility_affiliation_status(
  p_affiliation_id uuid,
  p_status text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.set_facility_affiliation_status(p_affiliation_id, p_status);
$function$;

revoke execute on function public.set_facility_affiliation_status(uuid, text)
  from public, anon;
grant execute on function public.set_facility_affiliation_status(uuid, text)
  to authenticated, service_role;

-- Approve + link a claim in one transaction. The service action creates or finds
-- the Auth account first, then this RPC validates the exact identity, rejects a
-- cross-lane takeover, grants owner membership, and marks the claim approved.
create or replace function public.approve_facility_claim(
  p_claim_id uuid,
  p_user_id uuid
)
returns table(
  approved_claim_id uuid,
  approved_user_id uuid,
  approved_facility_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  claim_row public.facility_claims%rowtype;
  auth_email text;
begin
  if p_claim_id is null or p_user_id is null then
    raise exception 'claim and user are required' using errcode = '22023';
  end if;

  select claim.* into claim_row
  from public.facility_claims as claim
  where claim.id = p_claim_id
  for update;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if claim_row.facility_id is null then
    raise exception 'claim must be linked to a facility before approval'
      using errcode = '23502';
  end if;
  if claim_row.status = 'rejected' then
    raise exception 'a rejected claim cannot be approved' using errcode = '23514';
  end if;
  if claim_row.status = 'approved'
     and claim_row.user_id is distinct from p_user_id then
    raise exception 'approved claim identity is immutable' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 38001)
  );

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email)) into auth_email
  from auth.users as auth_user
  where auth_user.id = p_user_id;
  if not found or auth_email is null then
    raise exception 'provider auth account not found' using errcode = '23503';
  end if;

  if claim_row.user_id is not null and claim_row.user_id <> p_user_id then
    raise exception 'claim belongs to a different auth account' using errcode = '23514';
  end if;
  if claim_row.status <> 'approved'
     and claim_row.user_id is null
     and claim_row.claimant_email is null then
    raise exception 'claim has no verifiable identity' using errcode = '23514';
  end if;
  if claim_row.status <> 'approved'
     and claim_row.claimant_email is not null
     and pg_catalog.lower(pg_catalog.btrim(claim_row.claimant_email)) <> auth_email then
    raise exception 'claim email does not match the auth account' using errcode = '23514';
  end if;

  if exists (select 1 from public.platform_admins a where a.user_id = p_user_id)
     or exists (select 1 from public.bd_users b where b.user_id = p_user_id)
     or exists (select 1 from public.rep_profiles r where r.user_id = p_user_id) then
    raise exception 'claim approval would cross canonical provider lanes'
      using errcode = '23514';
  end if;

  insert into public.facility_members (facility_id, user_id, role)
  values (claim_row.facility_id, p_user_id, 'owner')
  on conflict (facility_id, user_id)
  do update set role = 'owner';

  update public.facility_claims
  set status = 'approved', user_id = p_user_id
  where id = p_claim_id;

  return query select p_claim_id, p_user_id, claim_row.facility_id;
end;
$function$;

revoke execute on function public.approve_facility_claim(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.approve_facility_claim(uuid, uuid) to service_role;

comment on function public.approve_facility_claim(uuid, uuid) is
  'Service-only atomic ownership claim approval; validates Auth identity and canonical provider lane.';

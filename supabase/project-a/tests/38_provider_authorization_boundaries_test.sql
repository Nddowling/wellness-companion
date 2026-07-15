-- Runtime regression test for migration 38. Run only on an isolated branch:
--   psql "$ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/project-a/tests/38_provider_authorization_boundaries_test.sql
-- Fixed synthetic UUIDs are scoped to this transaction; every fixture rolls back.

begin;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('38000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-38@example.test', now(), now()),
  ('38000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'staff-38@example.test', now(), now()),
  ('38000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rep-38@example.test', now(), now()),
  ('38000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'partner-38@example.test', now(), now()),
  ('38000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'admin-38@example.test', now(), now()),
  ('38000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'claimant-38@example.test', now(), now());

insert into public.facilities (id, name, levels_of_care, is_published, plan, plan_status) values
  ('38100000-0000-4000-8000-000000000001', 'Authorization fixture A', array['residential'], true, 'free', 'canceled'),
  ('38100000-0000-4000-8000-000000000002', 'Authorization fixture B', array['residential'], false, 'free', 'canceled');

insert into public.facility_members (id, facility_id, user_id, role) values
  ('38200000-0000-4000-8000-000000000001', '38100000-0000-4000-8000-000000000001', '38000000-0000-4000-8000-000000000001', 'owner');
insert into public.bd_users (user_id, employer)
values ('38000000-0000-4000-8000-000000000004', 'Authorization partner');
insert into public.rep_profiles (user_id, slug, display_name)
values ('38000000-0000-4000-8000-000000000003', 'authorization-rep-38', 'Authorization Rep');
insert into public.platform_admins (user_id)
values ('38000000-0000-4000-8000-000000000005');

insert into public.facility_capacity (facility_id, level_of_care, beds_available, updated_by)
values ('38100000-0000-4000-8000-000000000001', 'residential', 2, '38000000-0000-4000-8000-000000000001');
insert into public.facility_payers (facility_id, payer_type, in_network)
values ('38100000-0000-4000-8000-000000000001', 'self_pay', false);
insert into public.matches (id, source, status)
values ('38400000-0000-4000-8000-000000000001', 'seeker', 'routed');
insert into public.match_routes (id, match_id, facility_id, status)
values (
  '38500000-0000-4000-8000-000000000001',
  '38400000-0000-4000-8000-000000000001',
  '38100000-0000-4000-8000-000000000001',
  'sent'
);
insert into public.facility_affiliations (id, user_id, facility_id, title, status)
values (
  '38600000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000003',
  '38100000-0000-4000-8000-000000000001',
  'Admissions',
  'pending'
);

-- Even the trusted role cannot create an already-verified affiliation or mutate
-- its identity; the database invariant protects every write path.
do $block$
begin
  begin
    insert into public.facility_affiliations (user_id, facility_id, status)
    values (
      '38000000-0000-4000-8000-000000000003',
      '38100000-0000-4000-8000-000000000002',
      'verified'
    );
    raise exception 'verified affiliation insert was allowed';
  exception when check_violation then
    null;
  end;

  begin
    update public.facility_affiliations
    set facility_id = '38100000-0000-4000-8000-000000000002'
    where id = '38600000-0000-4000-8000-000000000001';
    raise exception 'affiliation identity mutation was allowed';
  exception when check_violation then
    null;
  end;
end;
$block$;

-- Facility owner: reads their workspace, but every sensitive mutation is denied
-- at the table-grant boundary. The one status RPC is allowed and scoped to owner.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"38000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
do $block$
declare
  changed integer;
begin
  if not exists (
    select 1 from public.facilities
    where id = '38100000-0000-4000-8000-000000000001'
  ) then
    raise exception 'facility owner positive read control failed';
  end if;

  begin
    update public.facilities
    set plan = 'anchor', plan_status = 'lifetime', is_published = true, verified_at = now()
    where id = '38100000-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'direct facility entitlement mutation was allowed'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.facility_capacity
    set beds_available = 999
    where facility_id = '38100000-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'direct capacity mutation was allowed'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.facility_payers (facility_id, payer_type, in_network)
    values ('38100000-0000-4000-8000-000000000001', 'commercial', true);
    raise exception 'direct payer mutation was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.match_routes set status = 'accepted'
    where id = '38500000-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'direct match route mutation was allowed'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.facility_members (facility_id, user_id, role)
    values (
      '38100000-0000-4000-8000-000000000001',
      '38000000-0000-4000-8000-000000000002',
      'owner'
    );
    raise exception 'direct owner creation was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.facility_claims (user_id, facility_id, status)
    values (
      '38000000-0000-4000-8000-000000000001',
      '38100000-0000-4000-8000-000000000002',
      'approved'
    );
    raise exception 'browser-created approved claim was allowed';
  exception when insufficient_privilege then null;
  end;

  perform public.set_facility_affiliation_status(
    '38600000-0000-4000-8000-000000000001',
    'verified'
  );
end;
$block$;
reset role;

do $block$
begin
  if not exists (
    select 1 from public.facility_affiliations
    where id = '38600000-0000-4000-8000-000000000001' and status = 'verified'
  ) then
    raise exception 'owner affiliation RPC did not persist';
  end if;
  if exists (
    select 1 from public.facilities
    where id = '38100000-0000-4000-8000-000000000001'
      and (plan <> 'free' or plan_status <> 'canceled')
  ) then
    raise exception 'denied billing mutation changed data';
  end if;
end;
$block$;

-- Representative: can update their existing profile, cannot establish another
-- lane, mutate affiliation rows directly, or call the owner-only status RPC.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"38000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
do $block$
declare
  changed integer;
begin
  update public.rep_profiles
  set headline = 'Updated through own-profile RLS'
  where user_id = '38000000-0000-4000-8000-000000000003';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'representative profile update positive control failed'; end if;

  begin
    update public.facility_affiliations set status = 'rejected'
    where id = '38600000-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'representative self-verification was allowed'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.set_facility_affiliation_status(
      '38600000-0000-4000-8000-000000000001',
      'rejected'
    );
    raise exception 'representative called owner-only status RPC';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.bd_users (user_id, employer)
    values ('38000000-0000-4000-8000-000000000003', 'Forged partner lane');
    raise exception 'representative self-created partner lane';
  exception when insufficient_privilege then null;
  end;
end;
$block$;
reset role;

-- Partner: can update the existing profile, but cannot self-create a Rep lane.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"38000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
do $block$
declare
  changed integer;
begin
  update public.bd_users
  set employer = 'Updated through own-profile RLS'
  where user_id = '38000000-0000-4000-8000-000000000004';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'partner profile update positive control failed'; end if;

  begin
    insert into public.rep_profiles (user_id, slug, display_name)
    values (
      '38000000-0000-4000-8000-000000000004',
      'forged-rep-38',
      'Forged Rep'
    );
    raise exception 'partner self-created representative lane';
  exception when insufficient_privilege then null;
  end;
end;
$block$;
reset role;

-- Admin browser sessions retain read/RPC access but cannot bypass the trusted
-- server boundary with raw table writes.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"38000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
do $block$
declare
  changed integer;
begin
  if not exists (
    select 1 from public.facilities
    where id = '38100000-0000-4000-8000-000000000002'
  ) then
    raise exception 'admin read positive control failed';
  end if;

  begin
    update public.facilities set plan = 'anchor'
    where id = '38100000-0000-4000-8000-000000000002';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'admin browser bypassed service boundary'; end if;
  exception when insufficient_privilege then null;
  end;

  perform public.set_facility_affiliation_status(
    '38600000-0000-4000-8000-000000000001',
    'verified'
  );
end;
$block$;
reset role;

-- An anonymous Data API role cannot read or write the controlled tables.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $block$
begin
  begin
    perform 1 from public.facilities limit 1;
    raise exception 'anonymous facility read was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.facilities (name) values ('Anonymous rogue facility');
    raise exception 'anonymous facility insert was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$block$;
reset role;

-- Service role: claim approval is atomic, validates identity, and rejects a
-- Partner-to-facility lane takeover without changing either table.
insert into public.facility_claims (
  id, facility_id, claimant_name, claimant_email, status
) values (
  '38700000-0000-4000-8000-000000000001',
  '38100000-0000-4000-8000-000000000002',
  'Valid Claimant',
  'claimant-38@example.test',
  'pending'
);
insert into public.facility_claims (
  id, user_id, facility_id, claimant_name, claimant_email, status
) values (
  '38700000-0000-4000-8000-000000000002',
  '38000000-0000-4000-8000-000000000004',
  '38100000-0000-4000-8000-000000000002',
  'Cross Lane Claimant',
  'partner-38@example.test',
  'pending'
);

set local role service_role;
select * from public.approve_facility_claim(
  '38700000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000006'
);
do $block$
begin
  begin
    perform public.approve_facility_claim(
      '38700000-0000-4000-8000-000000000002',
      '38000000-0000-4000-8000-000000000004'
    );
    raise exception 'cross-lane claim approval was allowed';
  exception when check_violation then null;
  end;

  begin
    insert into public.bd_users (user_id, employer)
    values ('38000000-0000-4000-8000-000000000001', 'Service cross lane');
    raise exception 'service role bypassed lane exclusivity';
  exception when check_violation then null;
  end;
end;
$block$;
reset role;

do $block$
begin
  if not exists (
    select 1 from public.facility_claims
    where id = '38700000-0000-4000-8000-000000000001'
      and status = 'approved'
      and user_id = '38000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'valid claim status was not committed';
  end if;
  if not exists (
    select 1 from public.facility_members
    where facility_id = '38100000-0000-4000-8000-000000000002'
      and user_id = '38000000-0000-4000-8000-000000000006'
      and role = 'owner'
  ) then
    raise exception 'valid claim owner membership was not committed';
  end if;
  if not exists (
    select 1 from public.facility_claims
    where id = '38700000-0000-4000-8000-000000000002'
      and status = 'pending'
  ) or exists (
    select 1 from public.facility_members
    where user_id = '38000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'cross-lane claim was not rolled back atomically';
  end if;
end;
$block$;

rollback;

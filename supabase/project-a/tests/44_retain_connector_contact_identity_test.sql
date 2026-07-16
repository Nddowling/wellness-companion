-- Runtime regression for the consented name + email + phone connector record.
-- Run only on an isolated branch after migration 20260715235708. Rolls back.

begin;

do $block$
begin
  if to_regprocedure(
    'public.complete_connector_handoff_v2(uuid,uuid[],text,text,text,boolean,boolean)'
  ) is null then
    raise exception 'v2 connector handoff is missing';
  end if;
  if has_function_privilege(
    'anon',
    'public.complete_connector_handoff_v2(uuid,uuid[],text,text,text,boolean,boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.complete_connector_handoff_v2(uuid,uuid[],text,text,text,boolean,boolean)',
    'EXECUTE'
  ) then
    raise exception 'browser role can execute the v2 connector handoff';
  end if;
end;
$block$;

insert into public.facilities (
  id, name, levels_of_care, is_published, plan, plan_status
) values (
  '44000000-0000-4000-8000-000000000001',
  'Contact retention recipient',
  array['residential'],
  true,
  'free',
  'inactive'
);

insert into public.matches (
  id, region_zip3, care_level_needed, payer_type, concern_category, source, status
) values
  (
    '44000000-0000-4000-8000-000000000101',
    '303', 'residential', 'self_pay', 'unsure', 'seeker', 'routed'
  ),
  (
    '44000000-0000-4000-8000-000000000102',
    '303', 'residential', 'self_pay', 'unsure', 'seeker', 'routed'
  );

insert into public.match_routes (match_id, facility_id, status, position) values
  (
    '44000000-0000-4000-8000-000000000101',
    '44000000-0000-4000-8000-000000000001',
    'sent', 1
  ),
  (
    '44000000-0000-4000-8000-000000000102',
    '44000000-0000-4000-8000-000000000001',
    'sent', 1
  );

do $block$
declare
  first_result record;
  retry_result record;
  stored public.vault_seekers%rowtype;
  interest_count integer;
  event_count integer;
begin
  select * into first_result
  from public.complete_connector_handoff_v2(
    '44000000-0000-4000-8000-000000000101',
    array['44000000-0000-4000-8000-000000000001'::uuid],
    '  Jordan   Smith  ',
    'Jordan.Smith@Example.Invalid',
    '+1 (555) 010-4401',
    false,
    true
  );

  select * into stored
  from public.vault_seekers s
  where s.id = first_result.seeker_id;
  select count(*)::integer into interest_count
  from public.vault_seeker_interest i
  where i.seeker_id = first_result.seeker_id;

  if stored.name <> 'Jordan Smith'
     or stored.email <> 'jordan.smith@example.invalid'
     or stored.phone <> '+1 (555) 010-4401'
     or stored.insurance is not null
     or not stored.consent_share
     or stored.consent_email
     or interest_count <> 1 then
    raise exception 'consented contact identity was not retained exactly';
  end if;

  select * into retry_result
  from public.complete_connector_handoff_v2(
    '44000000-0000-4000-8000-000000000101',
    array['44000000-0000-4000-8000-000000000001'::uuid],
    'Jordan Smith',
    'jordan.smith@example.invalid',
    '+1 (555) 010-4401',
    false,
    true
  );
  select count(*)::integer into event_count
  from public.vault_consent_events e
  where e.match_id = '44000000-0000-4000-8000-000000000101';
  if retry_result.seeker_id <> first_result.seeker_id
     or not retry_result.already_completed
     or event_count <> 2 then
    raise exception 'identical v2 retry was not idempotent';
  end if;

  begin
    perform public.complete_connector_handoff_v2(
      '44000000-0000-4000-8000-000000000101',
      array['44000000-0000-4000-8000-000000000001'::uuid],
      'Jordan Smith',
      'jordan.smith@example.invalid',
      null,
      false,
      true
    );
    raise exception 'program-sharing handoff accepted a missing phone';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.revoke_connector_contact(first_result.seeker_id, 'seeker_revocation');
  select * into stored
  from public.vault_seekers s
  where s.id = first_result.seeker_id;
  select count(*)::integer into interest_count
  from public.vault_seeker_interest i
  where i.seeker_id = first_result.seeker_id;
  if stored.name is not null
     or stored.email is not null
     or stored.phone is not null
     or stored.status <> 'unsubscribed'
     or stored.consent_share
     or stored.consent_email
     or interest_count <> 0 then
    raise exception 'revocation did not clear the complete contact identity';
  end if;
end;
$block$;

do $block$
declare
  email_result record;
  reservation record;
  stored public.vault_seekers%rowtype;
  remaining_logs integer;
begin
  select * into email_result
  from public.complete_connector_handoff_v2(
    '44000000-0000-4000-8000-000000000102',
    array['44000000-0000-4000-8000-000000000001'::uuid],
    'Taylor Lee',
    'taylor.lee@example.invalid',
    null,
    true,
    false
  );

  select * into stored
  from public.vault_seekers s
  where s.id = email_result.seeker_id;
  if stored.name <> 'Taylor Lee'
     or stored.email <> 'taylor.lee@example.invalid'
     or stored.phone is not null
     or not stored.consent_email
     or stored.consent_share then
    raise exception 'email-copy-only contact shape is incorrect';
  end if;

  select * into reservation
  from public.reserve_treatment_email(
    email_result.seeker_id,
    'taylor.lee@example.invalid'
  );
  if not reservation.should_send then
    raise exception 'email delivery reservation was not created';
  end if;

  delete from public.vault_seekers where id = email_result.seeker_id;
  select count(*)::integer into remaining_logs
  from public.vault_email_log l
  where l.id = reservation.email_log_id;
  if remaining_logs <> 0 then
    raise exception 'hard deletion orphaned a retained email address';
  end if;
end;
$block$;

rollback;

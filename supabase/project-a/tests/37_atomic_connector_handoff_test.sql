-- Runtime regression for capability-bound connector handoffs and email replay.
-- Run only on an isolated branch after the complete migration chain. Rolls back.

begin;

do $block$
begin
  if to_regprocedure(
    'public.complete_connector_handoff(uuid,text,text,boolean,boolean)'
  ) is not null then
    raise exception 'unsafe match-only handoff overload still exists';
  end if;
  if has_function_privilege(
    'anon',
    'public.complete_connector_handoff(uuid,uuid[],text,text,boolean,boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reserve_treatment_email(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'browser role can execute a connector handoff function';
  end if;
end;
$block$;

insert into public.facilities (
  id, name, levels_of_care, is_published, plan, plan_status
) values
  (
    '37100000-0000-4000-8000-000000000001',
    'Capability recipient A',
    array['residential'],
    true,
    'free',
    'inactive'
  ),
  (
    '37100000-0000-4000-8000-000000000002',
    'Capability recipient B',
    array['residential'],
    true,
    'free',
    'inactive'
  ),
  (
    '37100000-0000-4000-8000-000000000003',
    'Never displayed recipient',
    array['residential'],
    true,
    'free',
    'inactive'
  );

insert into public.matches (
  id, region_zip3, care_level_needed, payer_type, concern_category, source, status
) values
  (
    '37100000-0000-4000-8000-000000000101',
    '303', 'residential', 'self_pay', 'unsure', 'seeker', 'routed'
  ),
  (
    '37100000-0000-4000-8000-000000000102',
    '303', 'residential', 'self_pay', 'unsure', 'seeker', 'routed'
  ),
  (
    '37100000-0000-4000-8000-000000000103',
    '303', 'residential', 'self_pay', 'unsure', 'seeker', 'routed'
  );

insert into public.match_routes (match_id, facility_id, status, position) values
  (
    '37100000-0000-4000-8000-000000000101',
    '37100000-0000-4000-8000-000000000001',
    'sent', 1
  ),
  (
    '37100000-0000-4000-8000-000000000101',
    '37100000-0000-4000-8000-000000000002',
    'sent', 2
  ),
  (
    '37100000-0000-4000-8000-000000000102',
    '37100000-0000-4000-8000-000000000001',
    'sent', 1
  ),
  (
    '37100000-0000-4000-8000-000000000103',
    '37100000-0000-4000-8000-000000000002',
    'sent', 1
  );

do $block$
declare
  first_result record;
  retry_result record;
  changed_result record;
  stored_ids uuid[];
  event_count integer;
begin
  select * into first_result
  from public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000101',
    array['37100000-0000-4000-8000-000000000001'::uuid],
    null,
    '+1 555 010 3701',
    false,
    true
  );

  if first_result.seeker_id is null
     or first_result.shared_facility_count <> 1
     or first_result.already_completed then
    raise exception 'first capability-bound share returned the wrong state';
  end if;

  select array_agg(i.facility_id order by i.facility_id)
    into stored_ids
  from public.vault_seeker_interest i
  where i.seeker_id = first_result.seeker_id;
  if stored_ids <> array['37100000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'handoff shared outside the signed recipient subset';
  end if;

  select * into retry_result
  from public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000101',
    array['37100000-0000-4000-8000-000000000001'::uuid],
    null,
    '+1 555 010 3701',
    false,
    true
  );
  if retry_result.seeker_id <> first_result.seeker_id
     or not retry_result.already_completed then
    raise exception 'identical handoff replay was not idempotent';
  end if;

  select count(*)::integer into event_count
  from public.vault_consent_events e
  where e.match_id = '37100000-0000-4000-8000-000000000101';
  if event_count <> 2 then
    raise exception 'identical handoff replay duplicated consent receipts';
  end if;

  select * into changed_result
  from public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000101',
    array['37100000-0000-4000-8000-000000000002'::uuid],
    null,
    '+1 555 010 3701',
    false,
    true
  );
  if changed_result.already_completed then
    raise exception 'changed recipient manifest was reported as an identical replay';
  end if;

  select array_agg(i.facility_id order by i.facility_id)
    into stored_ids
  from public.vault_seeker_interest i
  where i.seeker_id = first_result.seeker_id;
  if stored_ids <> array['37100000-0000-4000-8000-000000000002'::uuid] then
    raise exception 'changed signed subset did not replace historical interests';
  end if;

  begin
    perform public.complete_connector_handoff(
      '37100000-0000-4000-8000-000000000101',
      array['37100000-0000-4000-8000-000000000003'::uuid],
      null,
      '+1 555 010 3701',
      false,
      true
    );
    raise exception 'non-routed recipient was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$block$;

-- A current unpublish must not prevent an explicit no-contact/no-share receipt.
update public.facilities
set is_published = false
where id = '37100000-0000-4000-8000-000000000001';

do $block$
declare
  first_result record;
  retry_result record;
  event_count integer;
begin
  select * into first_result
  from public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000102',
    array['37100000-0000-4000-8000-000000000001'::uuid],
    null,
    null,
    false,
    false
  );
  select * into retry_result
  from public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000102',
    array['37100000-0000-4000-8000-000000000001'::uuid],
    null,
    null,
    false,
    false
  );

  if first_result.seeker_id is not null
     or first_result.already_completed
     or retry_result.seeker_id is not null
     or not retry_result.already_completed then
    raise exception 'no-consent path did not remain storage-free and idempotent';
  end if;

  select count(*)::integer into event_count
  from public.vault_consent_events e
  where e.match_id = '37100000-0000-4000-8000-000000000102';
  if event_count <> 2 then
    raise exception 'no-consent replay duplicated denial receipts';
  end if;
end;
$block$;

do $block$
declare
  handoff_result record;
  normalized_retry record;
  first_reservation record;
  retry_reservation record;
  failed_reservation record;
  mismatched_reservation record;
  interest_count integer;
  event_count integer;
begin
  select * into handoff_result
  from public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000103',
    array['37100000-0000-4000-8000-000000000002'::uuid],
    'Handoff-Fixture@Example.Invalid',
    null,
    true,
    false
  );

  select count(*)::integer into interest_count
  from public.vault_seeker_interest i
  where i.seeker_id = handoff_result.seeker_id;
  if handoff_result.seeker_id is null
     or handoff_result.shared_facility_count <> 0
     or interest_count <> 0 then
    raise exception 'email-only consent created a facility share';
  end if;

  select * into normalized_retry
  from public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000103',
    array['37100000-0000-4000-8000-000000000002'::uuid],
    'handoff-fixture@example.invalid',
    null,
    true,
    false
  );
  select count(*)::integer into event_count
  from public.vault_consent_events e
  where e.match_id = '37100000-0000-4000-8000-000000000103';
  if not normalized_retry.already_completed or event_count <> 2 then
    raise exception 'case-only email retry duplicated the consent decision';
  end if;

  select * into first_reservation
  from public.reserve_treatment_email(
    handoff_result.seeker_id,
    'handoff-fixture@example.invalid'
  );
  select * into retry_reservation
  from public.reserve_treatment_email(
    handoff_result.seeker_id,
    'handoff-fixture@example.invalid'
  );
  if not first_reservation.should_send
     or first_reservation.delivery_status <> 'pending'
     or retry_reservation.should_send
     or retry_reservation.delivery_status <> 'pending'
     or retry_reservation.email_log_id <> first_reservation.email_log_id then
    raise exception 'pending treatment email replay was not latched at most once';
  end if;

  perform public.finish_treatment_email(
    first_reservation.email_log_id,
    'failed',
    null
  );
  select * into failed_reservation
  from public.reserve_treatment_email(
    handoff_result.seeker_id,
    'handoff-fixture@example.invalid'
  );
  if failed_reservation.should_send
     or failed_reservation.delivery_status <> 'failed' then
    raise exception 'failed treatment email was incorrectly opened for resend';
  end if;

  perform public.complete_connector_handoff(
    '37100000-0000-4000-8000-000000000103',
    array['37100000-0000-4000-8000-000000000002'::uuid],
    'changed-fixture@example.invalid',
    null,
    true,
    false
  );
  select * into mismatched_reservation
  from public.reserve_treatment_email(
    handoff_result.seeker_id,
    'changed-fixture@example.invalid'
  );
  if mismatched_reservation.should_send
     or mismatched_reservation.delivery_status <> 'recipient_mismatch' then
    raise exception 'email retry falsely described delivery to a changed recipient';
  end if;
end;
$block$;

rollback;

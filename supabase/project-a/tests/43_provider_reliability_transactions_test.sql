-- Runtime regression for provider reliability transactions. Run only against
-- an isolated branch after migration 43. Every synthetic fixture rolls back.

begin;

do $block$
begin
  if has_function_privilege(
    'anon',
    'public.set_provider_lead_status(uuid,uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.set_provider_lead_status(uuid,uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.replace_facility_insurance(uuid,text[],text[])',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.replace_facility_insurance(uuid,text[],text[])',
    'EXECUTE'
  ) then
    raise exception 'a browser role can execute a provider mutation function';
  end if;
end;
$block$;

insert into public.facilities (
  id, name, levels_of_care, carriers_named, is_published, plan, plan_status
) values
  (
    '43100000-0000-4000-8000-000000000001',
    'Provider reliability fixture A',
    array['residential'],
    array['Legacy Carrier'],
    true,
    'growth',
    'active'
  ),
  (
    '43100000-0000-4000-8000-000000000002',
    'Provider reliability fixture B',
    array['residential'],
    '{}'::text[],
    true,
    'growth',
    'active'
  );

insert into public.facility_payers (
  facility_id, payer_type, in_network, verification_confidence, source_url
) values (
  '43100000-0000-4000-8000-000000000001',
  'self_pay',
  false,
  'low',
  null
);

insert into public.matches (id, source, status) values
  ('43200000-0000-4000-8000-000000000001', 'seeker', 'routed'),
  ('43200000-0000-4000-8000-000000000002', 'seeker', 'closed'),
  ('43200000-0000-4000-8000-000000000003', 'seeker', 'routed');

insert into public.match_routes (id, match_id, facility_id, status) values
  (
    '43300000-0000-4000-8000-000000000001',
    '43200000-0000-4000-8000-000000000001',
    '43100000-0000-4000-8000-000000000001',
    'sent'
  ),
  (
    '43300000-0000-4000-8000-000000000002',
    '43200000-0000-4000-8000-000000000002',
    '43100000-0000-4000-8000-000000000001',
    'sent'
  ),
  (
    '43300000-0000-4000-8000-000000000003',
    '43200000-0000-4000-8000-000000000003',
    '43100000-0000-4000-8000-000000000001',
    'sent'
  );

insert into public.vault_seekers (
  id, match_id, phone, email, consent_share, consent_email, status
) values
  (
    '43400000-0000-4000-8000-000000000001',
    '43200000-0000-4000-8000-000000000001',
    '+1 555 010 4301',
    null,
    true,
    false,
    'active'
  ),
  (
    '43400000-0000-4000-8000-000000000002',
    '43200000-0000-4000-8000-000000000002',
    null,
    'provider-43@example.invalid',
    false,
    true,
    'active'
  ),
  (
    '43400000-0000-4000-8000-000000000003',
    '43200000-0000-4000-8000-000000000003',
    '+1 555 010 4303',
    null,
    true,
    false,
    'unsubscribed'
  );

set local role service_role;

select * from public.set_provider_lead_status(
  '43300000-0000-4000-8000-000000000001',
  '43100000-0000-4000-8000-000000000001',
  'accepted'
);
select * from public.set_provider_lead_status(
  '43300000-0000-4000-8000-000000000002',
  '43100000-0000-4000-8000-000000000001',
  'accepted'
);
select * from public.set_provider_lead_status(
  '43300000-0000-4000-8000-000000000003',
  '43100000-0000-4000-8000-000000000001',
  'accepted'
);

do $block$
begin
  begin
    perform public.set_provider_lead_status(
      '43300000-0000-4000-8000-000000000001',
      '43100000-0000-4000-8000-000000000002',
      'declined'
    );
    raise exception 'cross-facility route transition was accepted';
  exception when no_data_found then
    null;
  end;
end;
$block$;

do $block$
begin
  begin
    perform public.replace_facility_insurance(
      '43100000-0000-4000-8000-000000000001',
      array['commercial', 'forged_payer'],
      array['Aetna']
    );
    raise exception 'invalid payer replacement was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$block$;

select * from public.replace_facility_insurance(
  '43100000-0000-4000-8000-000000000001',
  array['commercial', 'medicaid', 'commercial'],
  array['Aetna', 'Cigna', 'Aetna']
);

reset role;

do $block$
declare
  actual_payers text[];
  actual_carriers text[];
begin
  if not exists (
    select 1 from public.match_routes
    where id = '43300000-0000-4000-8000-000000000001'
      and facility_id = '43100000-0000-4000-8000-000000000001'
      and status = 'accepted'
  ) then
    raise exception 'exact route was not updated or cross-facility failure changed it';
  end if;
  if not exists (
    select 1 from public.matches
    where id = '43200000-0000-4000-8000-000000000001'
      and status = 'connected'
  ) then
    raise exception 'accepted route did not advance its routed match';
  end if;
  if not exists (
    select 1 from public.matches
    where id = '43200000-0000-4000-8000-000000000002'
      and status = 'closed'
  ) then
    raise exception 'accepted route downgraded a closed match';
  end if;
  if not exists (
    select 1 from public.vault_seekers
    where id = '43400000-0000-4000-8000-000000000001'
      and status = 'connected'
  ) then
    raise exception 'share-consented active connector record was not advanced';
  end if;
  if not exists (
    select 1 from public.vault_seekers
    where id = '43400000-0000-4000-8000-000000000002'
      and status = 'active'
  ) then
    raise exception 'email-copy-only connector record was incorrectly marked connected';
  end if;
  if not exists (
    select 1 from public.vault_seekers
    where id = '43400000-0000-4000-8000-000000000003'
      and status = 'unsubscribed'
  ) then
    raise exception 'acceptance revived an unsubscribed connector record';
  end if;

  select pg_catalog.array_agg(payer.payer_type order by payer.payer_type)
    into actual_payers
  from public.facility_payers as payer
  where payer.facility_id = '43100000-0000-4000-8000-000000000001';
  if actual_payers <> array['commercial', 'medicaid'] then
    raise exception 'payer replacement is incomplete or duplicated';
  end if;
  if exists (
    select 1 from public.facility_payers as payer
    where payer.facility_id = '43100000-0000-4000-8000-000000000001'
      and (
        payer.in_network
        or payer.verification_confidence <> 'low'
        or payer.source_url is not null
      )
  ) then
    raise exception 'program-listed payer rows claimed stronger evidence';
  end if;

  select facility.carriers_named into actual_carriers
  from public.facilities as facility
  where facility.id = '43100000-0000-4000-8000-000000000001';
  if actual_carriers <> array['Aetna', 'Cigna'] then
    raise exception 'named carriers were not replaced in the same operation';
  end if;
end;
$block$;

rollback;

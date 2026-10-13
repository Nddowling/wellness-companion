-- Guided nearby matching regression. Run only on an isolated branch after the
-- 20261013181809 migration. Every fixture is rolled back at the end.
begin;

do $block$
begin
  if has_function_privilege(
    'anon',
    'public.match_directory_options_nearby(double precision,double precision,text,text,text,text,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.match_directory_options_nearby(double precision,double precision,text,text,text,text,integer)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.match_directory_options_nearby(double precision,double precision,text,text,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'guided nearby matcher has incorrect function privileges';
  end if;
end;
$block$;

-- Artificial coordinates and a fixture-only carrier isolate these rows from
-- real directory content while exercising all hard gates before the limit.
insert into public.facilities (
  id, name, zip, latitude, longitude, levels_of_care, co_occurring,
  carriers_named, is_published
) values
  ('91300000-0000-4000-8000-000000000001', 'A stale distance tie', '99901', 0, 0.1,
    array['residential'], 'yes', array['SQL_TEST_CARRIER_20261013'], true),
  ('91300000-0000-4000-8000-000000000002', 'Z fresh distance tie', '99902', 0, 0.1,
    array['residential'], 'yes', array['SQL_TEST_CARRIER_20261013'], true),
  ('91300000-0000-4000-8000-000000000003', 'Fresh but farther ZIP3', '30301', 0, 0.2,
    array['residential'], 'yes', array['SQL_TEST_CARRIER_20261013'], true),
  ('91300000-0000-4000-8000-000000000004', 'Eligible without coordinates', '99903', null, null,
    array['residential'], 'yes', array['SQL_TEST_CARRIER_20261013'], true),
  ('91300000-0000-4000-8000-000000000005', 'Nearby without payer', '99904', 0, 0.001,
    array['residential'], 'yes', array['SQL_TEST_CARRIER_20261013'], true),
  ('91300000-0000-4000-8000-000000000006', 'Nearby negative co-occurring', '99905', 0, 0.002,
    array['residential'], 'no', array['SQL_TEST_CARRIER_20261013'], true),
  ('91300000-0000-4000-8000-000000000007', 'Nearby wrong carrier', '99906', 0, 0.003,
    array['residential'], 'yes', array['Different Carrier'], true),
  ('91300000-0000-4000-8000-000000000008', 'Nearby unpublished', '99907', 0, 0,
    array['residential'], 'yes', array['SQL_TEST_CARRIER_20261013'], false);

insert into public.facility_payers (facility_id, payer_type)
select id, 'commercial'
from public.facilities
where id in (
  '91300000-0000-4000-8000-000000000001',
  '91300000-0000-4000-8000-000000000002',
  '91300000-0000-4000-8000-000000000003',
  '91300000-0000-4000-8000-000000000004',
  '91300000-0000-4000-8000-000000000006',
  '91300000-0000-4000-8000-000000000007',
  '91300000-0000-4000-8000-000000000008'
);

insert into public.facility_capacity (facility_id, level_of_care, beds_available, last_updated)
values
  ('91300000-0000-4000-8000-000000000002', 'residential', 1, now()),
  ('91300000-0000-4000-8000-000000000003', 'residential', 5, now());

do $block$
declare
  ranked_ids uuid[];
  ranked_miles double precision[];
  total integer;
begin
  select array_agg(r.id order by r.ordinality),
         array_agg(r.miles order by r.ordinality)
    into ranked_ids, ranked_miles
  from public.match_directory_options_nearby(
    0, 0, 'residential', 'commercial', 'co_occurring',
    'sql_test_carrier_20261013', 10
  ) with ordinality as r;

  if ranked_ids is distinct from array[
    '91300000-0000-4000-8000-000000000002'::uuid,
    '91300000-0000-4000-8000-000000000001'::uuid,
    '91300000-0000-4000-8000-000000000003'::uuid,
    '91300000-0000-4000-8000-000000000004'::uuid
  ] then
    raise exception 'hard filters, distance, freshness tie, or null-distance fallback failed: %', ranked_ids;
  end if;
  if ranked_miles[1] is null
     or ranked_miles[2] is null
     or ranked_miles[3] <= ranked_miles[2]
     or ranked_miles[4] is not null then
    raise exception 'unexpected approximate miles: %', ranked_miles;
  end if;

  select count(*) into total
  from public.match_directory_options_nearby(
    0, 0, 'residential', 'commercial', 'mental_health',
    'sql_test_carrier_20261013', 10
  );
  if total <> 0 then
    raise exception 'standalone mental-health request was routed as an addiction match';
  end if;

  select array_agg(r.id order by r.ordinality) into ranked_ids
  from public.match_directory_options_nearby(
    0, 0, 'residential', 'commercial', 'co_occurring',
    'sql_test_carrier_20261013', 2
  ) with ordinality as r;
  if ranked_ids is distinct from array[
    '91300000-0000-4000-8000-000000000002'::uuid,
    '91300000-0000-4000-8000-000000000001'::uuid
  ] then
    raise exception 'limit was applied before eligibility/distance order: %', ranked_ids;
  end if;

  select count(*) into total
  from public.match_directory_options_nearby(
    91, 0, 'residential', 'commercial', 'co_occurring',
    'sql_test_carrier_20261013', 10
  );
  if total <> 0 then
    raise exception 'out-of-range origin should not produce matches';
  end if;
end;
$block$;

rollback;

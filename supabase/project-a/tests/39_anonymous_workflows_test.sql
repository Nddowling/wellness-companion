-- Runtime regression for the anonymous request budget and atomic match recorder.
-- Run only on an isolated branch. Every fixture and counter is rolled back.

begin;

do $block$
begin
  if has_function_privilege(
    'anon',
    'public.consume_anonymous_budget(text,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.record_directory_match(text,text,text,text,text,text,uuid[])',
    'EXECUTE'
  ) then
    raise exception 'browser role can execute a server-only anonymous workflow function';
  end if;
end;
$block$;

insert into public.facilities (
  id, name, levels_of_care, is_published, plan, plan_status
) values
  (
    '39100000-0000-4000-8000-000000000001',
    'Anonymous workflow fixture A',
    array['residential'],
    true,
    'free',
    'inactive'
  ),
  (
    '39100000-0000-4000-8000-000000000002',
    'Anonymous workflow fixture B',
    array['residential'],
    true,
    'free',
    'inactive'
  ),
  (
    '39100000-0000-4000-8000-000000000003',
    'Anonymous workflow unpublished fixture',
    array['residential'],
    false,
    'free',
    'inactive'
  );

do $block$
declare
  budget record;
  iteration integer;
begin
  for iteration in 1..20 loop
    select * into budget
    from public.consume_anonymous_budget(
      'intake', repeat('a', 64), repeat('b', 64)
    );
    if not budget.allowed then
      raise exception 'intake session was denied before its documented limit at request %', iteration;
    end if;
  end loop;

  select * into budget
  from public.consume_anonymous_budget(
    'intake', repeat('a', 64), repeat('b', 64)
  );
  if budget.allowed or budget.remaining <> 0 or budget.retry_after_seconds <= 0 then
    raise exception 'intake session limit did not fail closed with retry metadata';
  end if;
end;
$block$;

do $block$
declare
  budget record;
  iteration integer;
begin
  for iteration in 1..12 loop
    select * into budget
    from public.consume_anonymous_budget(
      'handoff', repeat('6', 64), repeat('7', 64)
    );
    if not budget.allowed then
      raise exception 'handoff session was denied before its documented limit at request %', iteration;
    end if;
  end loop;

  select * into budget
  from public.consume_anonymous_budget(
    'handoff', repeat('6', 64), repeat('7', 64)
  );
  if budget.allowed or budget.remaining <> 0 or budget.retry_after_seconds <= 0 then
    raise exception 'handoff session limit did not fail closed with retry metadata';
  end if;
end;
$block$;

do $block$
declare
  budget record;
  iteration integer;
begin
  for iteration in 1..60 loop
    select * into budget
    from public.consume_anonymous_budget(
      'track', repeat('8', 64), repeat('9', 64)
    );
    if not budget.allowed then
      raise exception 'track session was denied before its documented limit at request %', iteration;
    end if;
  end loop;

  select * into budget
  from public.consume_anonymous_budget(
    'track', repeat('8', 64), repeat('9', 64)
  );
  if budget.allowed or budget.remaining <> 0 or budget.retry_after_seconds <= 0 then
    raise exception 'track session limit did not fail closed with retry metadata';
  end if;
end;
$block$;

do $block$
declare
  first_result record;
  retry_result record;
  match_count integer;
  route_count integer;
  ordered_ids uuid[];
begin
  select * into first_result
  from public.record_directory_match(
    repeat('c', 64),
    repeat('d', 64),
    '303',
    'residential',
    'self_pay',
    'unsure',
    array[
      '39100000-0000-4000-8000-000000000002'::uuid,
      '39100000-0000-4000-8000-000000000001'::uuid
    ]
  );

  if not first_result.created then
    raise exception 'first idempotent match call was not marked created';
  end if;

  select * into retry_result
  from public.record_directory_match(
    repeat('c', 64),
    repeat('d', 64),
    '303',
    'residential',
    'self_pay',
    'unsure',
    array[
      '39100000-0000-4000-8000-000000000001'::uuid
    ]
  );

  if retry_result.created
     or retry_result.recorded_match_id <> first_result.recorded_match_id then
    raise exception 'same idempotency key created a duplicate match';
  end if;

  select count(*)::integer into match_count
  from public.matches
  where id = first_result.recorded_match_id;
  select count(*)::integer,
         array_agg(facility_id order by position)
    into route_count, ordered_ids
  from public.match_routes
  where match_id = first_result.recorded_match_id;

  if match_count <> 1 or route_count <> 2 then
    raise exception 'atomic match recorder produced unexpected row counts';
  end if;
  if ordered_ids <> array[
    '39100000-0000-4000-8000-000000000002'::uuid,
    '39100000-0000-4000-8000-000000000001'::uuid
  ] then
    raise exception 'match route rank was not preserved';
  end if;

  begin
    perform public.record_directory_match(
      repeat('c', 64), repeat('e', 64), '303', 'residential',
      'self_pay', 'unsure', array[]::uuid[]
    );
    raise exception 'reused idempotency key accepted different input';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.record_directory_match(
      repeat('f', 64), repeat('1', 64), '303', 'residential',
      'self_pay', 'unsure',
      array['39100000-0000-4000-8000-000000000003'::uuid]
    );
    raise exception 'unpublished facility route was accepted';
  exception when foreign_key_violation then
    null;
  end;
end;
$block$;

rollback;

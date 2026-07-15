-- Runtime regression test for migration 36. Run only against an isolated branch:
--   psql "$ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/project-a/tests/36_secure_billing_events_test.sql
-- Every fixture is rolled back. Never point this script at production.

begin;

do $$
declare
  v_billing_columns integer;
  v_subscription_index integer;
begin
  select count(*)::integer into v_billing_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'facilities'
    and column_name in ('plan', 'plan_status', 'stripe_customer_id', 'stripe_subscription_id');
  if v_billing_columns <> 4 then
    raise exception 'migration did not establish all facility billing columns';
  end if;

  select count(*)::integer into v_subscription_index
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'facilities'
    and indexname = 'facilities_stripe_subscription_id_unique';
  if v_subscription_index <> 1 then
    raise exception 'migration did not establish subscription uniqueness';
  end if;
end;
$$;

insert into public.facilities (id, name, plan, plan_status, is_published)
values
  ('81000000-0000-4000-8000-000000000001', 'Billing SQL fixture A', 'free', 'canceled', false),
  ('81000000-0000-4000-8000-000000000002', 'Billing SQL fixture B', 'free', 'canceled', false);

insert into public.billing_checkout_attempts (
  id, facility_id, requested_by, plan, billing_cycle, status, expires_at
) values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  'growth', 'monthly', 'open', now() + interval '1 hour'
);

do $$
declare
  v_result text;
  v_changed_facility uuid;
  v_plan text;
  v_status text;
  v_subscription text;
begin
  -- An unknown/mismatched Stripe Price cannot inherit the persisted attempt plan.
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_price_mismatch', 'checkout.session.completed', 100, 'cs_sql_bad', 'sub_sql_bad',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', null, 'active', false, null
  ) as applied;
  if v_result <> 'price_mismatch' then raise exception 'expected price_mismatch, got %', v_result; end if;

  select plan, plan_status, stripe_subscription_id
    into v_plan, v_status, v_subscription
  from public.facilities where id = '81000000-0000-4000-8000-000000000001';
  if v_plan <> 'free' or v_subscription is not null then
    raise exception 'mismatched Price changed facility entitlement';
  end if;

  -- A deletion for a subscription that has never been bound cannot trust
  -- metadata alone to cancel an unrelated facility.
  update public.facilities
  set plan = 'growth', plan_status = 'active'
  where id = '81000000-0000-4000-8000-000000000002';
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_unbound_delete', 'customer.subscription.deleted', 105, 'sub_sql_unbound',
    'sub_sql_unbound', 'cus_sql', '81000000-0000-4000-8000-000000000002', null,
    'growth', 'canceled', false, null
  ) as applied;
  if v_result <> 'missing_checkout_attempt' then
    raise exception 'expected unbound deletion to require an attempt, got %', v_result;
  end if;
  select plan, plan_status into v_plan, v_status
  from public.facilities where id = '81000000-0000-4000-8000-000000000002';
  if v_plan <> 'growth' or v_status <> 'active' then
    raise exception 'unbound deletion changed unrelated facility billing';
  end if;

  -- Matching Price + attempt applies once.
  select applied.result, applied.changed_facility_id into v_result, v_changed_facility
  from public.apply_stripe_billing_event(
    'evt_sql_a_checkout', 'checkout.session.completed', 110, 'cs_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'growth', 'active', false, null
  ) as applied;
  if v_result <> 'applied' then raise exception 'expected applied checkout, got %', v_result; end if;

  select plan, plan_status, stripe_subscription_id
    into v_plan, v_status, v_subscription
  from public.facilities where id = '81000000-0000-4000-8000-000000000001';
  if v_plan <> 'growth' or v_status <> 'active' or v_subscription <> 'sub_sql_a' then
    raise exception 'matching Checkout was not applied';
  end if;

  -- Exact replay is durable no-op.
  v_changed_facility := null;
  select applied.result, applied.changed_facility_id into v_result, v_changed_facility
  from public.apply_stripe_billing_event(
    'evt_sql_a_checkout', 'checkout.session.completed', 110, 'cs_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'growth', 'active', false, null
  ) as applied;
  if v_result <> 'duplicate' then raise exception 'expected duplicate, got %', v_result; end if;
  if v_changed_facility <> '81000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'duplicate did not return durable facility identity';
  end if;

  -- A known subscription cannot complete an attempt belonging to another
  -- facility, even if the signed event omits facility metadata.
  insert into public.billing_checkout_attempts (
    id, facility_id, requested_by, plan, billing_cycle, status, expires_at
  ) values (
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000001',
    'growth', 'monthly', 'open', now() + interval '1 hour'
  );
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_attempt_wrong_facility', 'checkout.session.completed', 120, 'cs_sql_wrong',
    'sub_sql_a', 'cus_sql', null, '82000000-0000-4000-8000-000000000003',
    'growth', 'active', false, null
  ) as applied;
  if v_result <> 'attempt_facility_mismatch' then
    raise exception 'expected attempt facility mismatch, got %', v_result;
  end if;

  -- An allowlist miss on a later portal update fails closed and the expanded
  -- production-compatible status constraint accepts the safe sentinel.
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_a_unknown_price', 'customer.subscription.updated', 180, 'sub_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', null, 'active', false, null
  ) as applied;
  if v_result <> 'applied' then raise exception 'expected fail-closed update, got %', v_result; end if;
  select plan, plan_status into v_plan, v_status
  from public.facilities where id = '81000000-0000-4000-8000-000000000001';
  if v_plan <> 'free' or v_status <> 'unrecognized_price' then
    raise exception 'unknown current Price did not fail closed';
  end if;

  -- A newer portal update can change an already-bound subscription.
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_a_newer', 'customer.subscription.updated', 200, 'sub_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'anchor', 'active', false, null
  ) as applied;
  if v_result <> 'applied' then raise exception 'expected newer update, got %', v_result; end if;

  -- Stripe timestamps have one-second precision. Two distinct updates in the
  -- same second must not drop the later delivery; the route retrieves current
  -- subscription state before invoking this transaction.
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_a_same_second', 'customer.subscription.updated', 200, 'sub_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'starter', 'active', false, null
  ) as applied;
  if v_result <> 'applied' then raise exception 'same-second current update was dropped'; end if;

  -- An older delivery cannot roll the plan back.
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_a_older', 'customer.subscription.updated', 150, 'sub_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'growth', 'active', false, null
  ) as applied;
  if v_result <> 'older_event' then raise exception 'expected older_event, got %', v_result; end if;
  select plan into v_plan from public.facilities where id = '81000000-0000-4000-8000-000000000001';
  if v_plan <> 'starter' then raise exception 'older event rolled plan back'; end if;

  -- Cancel A, then establish B through a new persisted attempt.
  perform public.apply_stripe_billing_event(
    'evt_sql_a_deleted', 'customer.subscription.deleted', 300, 'sub_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'anchor', 'canceled', false, null
  );
end;
$$;

insert into public.billing_checkout_attempts (
  id, facility_id, requested_by, plan, billing_cycle, status, expires_at
) values (
  '82000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  'anchor', 'annual', 'open', now() + interval '1 hour'
);

do $$
declare
  v_result text;
  v_plan text;
  v_status text;
  v_subscription text;
begin
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_b_checkout', 'checkout.session.completed', 400, 'cs_sql_b', 'sub_sql_b',
    'cus_sql', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000002', 'anchor', 'active', false, null
  ) as applied;
  if v_result <> 'applied' then raise exception 'expected subscription B to apply, got %', v_result; end if;

  -- Late deletion from superseded subscription A cannot cancel current B.
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_a_late_delete', 'customer.subscription.deleted', 500, 'sub_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000001', null,
    'anchor', 'canceled', false, null
  ) as applied;
  if v_result <> 'superseded_subscription' then
    raise exception 'expected superseded_subscription, got %', v_result;
  end if;

  select plan, plan_status, stripe_subscription_id
    into v_plan, v_status, v_subscription
  from public.facilities where id = '81000000-0000-4000-8000-000000000001';
  if v_plan <> 'anchor' or v_status <> 'active' or v_subscription <> 'sub_sql_b' then
    raise exception 'superseded subscription changed current billing';
  end if;

  -- A subscription's first facility binding is immutable, even if later signed
  -- metadata points the same subscription ID at a different facility.
  select applied.result into v_result
  from public.apply_stripe_billing_event(
    'evt_sql_a_wrong_facility', 'customer.subscription.deleted', 600, 'sub_sql_a', 'sub_sql_a',
    'cus_sql', '81000000-0000-4000-8000-000000000002', null,
    'growth', 'canceled', false, null
  ) as applied;
  if v_result <> 'subscription_facility_mismatch' then
    raise exception 'expected immutable subscription facility binding, got %', v_result;
  end if;
end;
$$;

rollback;

-- Stripe billing safety: one in-flight Checkout per facility, durable webhook
-- idempotency, and chronological subscription updates. These tables are server-only;
-- they never contain card data or a raw Stripe payload.

-- Earlier repository migrations referred to these columns but never created
-- them. Establish the production schema here so a clean migration replay and an
-- existing hosted database converge before any billing function references them.
alter table public.facilities
  add column if not exists plan text default 'free',
  add column if not exists plan_status text default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

update public.facilities set plan = 'free' where plan is null;
update public.facilities set plan_status = 'inactive' where plan_status is null;

alter table public.facilities
  alter column plan set default 'free',
  alter column plan set not null,
  alter column plan_status set default 'inactive',
  alter column plan_status set not null;

alter table public.facilities
  drop constraint if exists facilities_plan_check,
  drop constraint if exists facilities_plan_status_check;
alter table public.facilities
  add constraint facilities_plan_check
    check (plan in ('free', 'starter', 'growth', 'anchor')),
  add constraint facilities_plan_status_check
    check (
      plan_status in (
        'inactive', 'active', 'past_due', 'canceled', 'incomplete', 'paused',
        'lifetime', 'unrecognized_status', 'unrecognized_price'
      )
    );

-- A Stripe subscription belongs to exactly one facility. Customer IDs are not
-- unique because one customer may legitimately manage multiple facilities.
create unique index if not exists facilities_stripe_subscription_id_unique
  on public.facilities (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists facilities_stripe_customer_id_idx
  on public.facilities (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  requested_by uuid not null,
  plan text not null check (plan in ('starter', 'growth', 'anchor')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  status text not null default 'pending'
    check (status in ('pending', 'open', 'completed', 'expired', 'failed')),
  stripe_session_id text unique,
  stripe_subscription_id text unique,
  checkout_url text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The partial uniqueness constraint is the final concurrency boundary. Two app
-- instances can race, but only one reusable pending/open attempt can survive.
create unique index if not exists billing_checkout_attempts_one_open_per_facility
  on public.billing_checkout_attempts (facility_id)
  where status in ('pending', 'open');
create index if not exists billing_checkout_attempts_expiry
  on public.billing_checkout_attempts (expires_at)
  where status in ('pending', 'open');

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  object_id text not null,
  subscription_id text,
  facility_id uuid references public.facilities(id) on delete set null,
  checkout_attempt_id uuid references public.billing_checkout_attempts(id) on delete set null,
  event_created bigint not null check (event_created > 0),
  livemode boolean not null,
  api_version text,
  status text not null check (status in ('processing', 'processed', 'ignored')),
  outcome text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists stripe_webhook_events_subscription_created
  on public.stripe_webhook_events (subscription_id, event_created desc);

create table if not exists public.stripe_subscription_event_state (
  subscription_id text primary key,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  last_event_created bigint not null,
  last_event_precedence smallint not null,
  last_event_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.billing_checkout_attempts enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_subscription_event_state enable row level security;

revoke all on table public.billing_checkout_attempts from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
revoke all on table public.stripe_subscription_event_state from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_checkout_attempts to service_role;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;
grant select, insert, update, delete on table public.stripe_subscription_event_state to service_role;

-- Signature verification happens in the app with Stripe's official SDK. This
-- service-role-only transaction receives only normalized, signed scalar fields.
-- It records the event, rejects replays/older events, updates the facility, and
-- advances chronology atomically so a retry cannot partially grant access.
create or replace function public.apply_stripe_billing_event(
  p_event_id text,
  p_event_type text,
  p_event_created bigint,
  p_object_id text,
  p_subscription_id text,
  p_customer_id text,
  p_facility_id uuid,
  p_checkout_attempt_id uuid,
  p_plan text,
  p_plan_status text,
  p_livemode boolean,
  p_api_version text
)
returns table(result text, changed_facility_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_precedence smallint;
  v_facility_id uuid;
  v_stored_facility_id uuid;
  v_attempt_facility_id uuid;
  v_attempt_plan text;
  v_attempt_status text;
  v_attempt_subscription_id text;
  v_plan text;
  v_plan_status text;
  v_current_plan_status text;
  v_current_subscription_id text;
  v_state_facility_id uuid;
  v_last_created bigint;
  v_last_precedence smallint;
begin
  if p_event_id is null or length(p_event_id) > 255
     or p_object_id is null or length(p_object_id) > 255
     or p_event_created <= 0 then
    raise exception 'invalid Stripe event envelope';
  end if;

  v_precedence := case p_event_type
    when 'checkout.session.completed' then 10
    when 'customer.subscription.updated' then 20
    when 'customer.subscription.deleted' then 30
    else null
  end;
  if v_precedence is null then
    raise exception 'unsupported Stripe event type';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, object_id, subscription_id, facility_id,
    checkout_attempt_id, event_created, livemode, api_version, status
  ) values (
    p_event_id, p_event_type, p_object_id, p_subscription_id, null,
    null, p_event_created, p_livemode, p_api_version, 'processing'
  )
  on conflict (event_id) do nothing;

  if not found then
    -- Return the durable facility identity so an application retry can repeat a
    -- cache purge if the first delivery committed here but cache invalidation
    -- failed afterward.
    select event.facility_id into v_facility_id
    from public.stripe_webhook_events as event
    where event.event_id = p_event_id;
    return query select 'duplicate'::text, v_facility_id;
    return;
  end if;

  if p_checkout_attempt_id is not null then
    select attempt.facility_id, attempt.plan, attempt.status, attempt.stripe_subscription_id
      into v_attempt_facility_id, v_attempt_plan, v_attempt_status, v_attempt_subscription_id
    from public.billing_checkout_attempts as attempt
    where attempt.id = p_checkout_attempt_id
    for update;

    if v_attempt_facility_id is null then
      update public.stripe_webhook_events
      set status = 'ignored', outcome = 'invalid_checkout_attempt', processed_at = now()
      where event_id = p_event_id;
      return query select 'invalid_checkout_attempt'::text, null::uuid;
      return;
    end if;
    if v_attempt_status not in ('pending', 'open', 'completed') then
      update public.stripe_webhook_events
      set status = 'ignored', outcome = 'inactive_checkout_attempt', processed_at = now()
      where event_id = p_event_id;
      return query select 'inactive_checkout_attempt'::text, null::uuid;
      return;
    end if;
    if v_attempt_subscription_id is not null and v_attempt_subscription_id <> p_subscription_id then
      update public.stripe_webhook_events
      set status = 'ignored', outcome = 'attempt_subscription_mismatch', processed_at = now()
      where event_id = p_event_id;
      return query select 'attempt_subscription_mismatch'::text, null::uuid;
      return;
    end if;
    if p_facility_id is not null and p_facility_id <> v_attempt_facility_id then
      update public.stripe_webhook_events
      set status = 'ignored', outcome = 'metadata_mismatch', processed_at = now()
      where event_id = p_event_id;
      return query select 'metadata_mismatch'::text, null::uuid;
      return;
    end if;
  end if;

  if p_subscription_id is not null then
    select facility.id into v_stored_facility_id
    from public.facilities as facility
    where facility.stripe_subscription_id = p_subscription_id
    limit 1;

    -- A superseded subscription is no longer the facility's current ID, but its
    -- first durable event-state binding remains authoritative for late events.
    if v_stored_facility_id is null then
      select state.facility_id into v_stored_facility_id
      from public.stripe_subscription_event_state as state
      where state.subscription_id = p_subscription_id;
    end if;
  end if;

  if v_stored_facility_id is not null
     and v_attempt_facility_id is not null
     and v_stored_facility_id <> v_attempt_facility_id then
    update public.stripe_webhook_events
    set facility_id = v_stored_facility_id,
        checkout_attempt_id = p_checkout_attempt_id,
        status = 'ignored', outcome = 'attempt_facility_mismatch', processed_at = now()
    where event_id = p_event_id;
    return query select 'attempt_facility_mismatch'::text, v_stored_facility_id;
    return;
  end if;

  v_facility_id := coalesce(v_stored_facility_id, v_attempt_facility_id, p_facility_id);
  if v_stored_facility_id is not null and p_facility_id is not null
     and v_stored_facility_id <> p_facility_id then
    update public.stripe_webhook_events
    set status = 'ignored', outcome = 'subscription_facility_mismatch', processed_at = now()
    where event_id = p_event_id;
    return query select 'subscription_facility_mismatch'::text, null::uuid;
    return;
  end if;

  if v_facility_id is null or p_subscription_id is null then
    update public.stripe_webhook_events
    set status = 'ignored', outcome = 'missing_billing_identity', processed_at = now()
    where event_id = p_event_id;
    return query select 'missing_billing_identity'::text, null::uuid;
    return;
  end if;

  select facility.plan_status, facility.stripe_subscription_id
    into v_current_plan_status, v_current_subscription_id
  from public.facilities as facility
  where facility.id = v_facility_id
  for update;

  if not found then
    update public.stripe_webhook_events
    set status = 'ignored', outcome = 'unknown_facility', processed_at = now()
    where event_id = p_event_id;
    return query select 'unknown_facility'::text, null::uuid;
    return;
  end if;

  -- Once a facility has moved to subscription B, a late event for superseded
  -- subscription A must never reclaim or cancel it. The only replacement path is
  -- a valid persisted Checkout attempt after the prior subscription was canceled.
  if v_current_subscription_id is not null
     and v_current_subscription_id <> p_subscription_id
     and not (
       lower(coalesce(v_current_plan_status, '')) = 'canceled'
       and v_attempt_facility_id = v_facility_id
       and p_event_type in ('checkout.session.completed', 'customer.subscription.updated')
     ) then
    update public.stripe_webhook_events
    set facility_id = v_facility_id,
        checkout_attempt_id = p_checkout_attempt_id,
        status = 'ignored', outcome = 'superseded_subscription', processed_at = now()
    where event_id = p_event_id;
    return query select 'superseded_subscription'::text, v_facility_id;
    return;
  end if;

  -- New subscriptions are bound to the exact allowlisted Price selected in the
  -- persisted attempt. Metadata or an unknown Price can never substitute for it,
  -- including when the first delivery happens to be a deletion event.
  if (
    p_event_type = 'checkout.session.completed'
    or v_stored_facility_id is null
  ) then
    if v_attempt_plan is null then
      update public.stripe_webhook_events
      set facility_id = v_facility_id,
          status = 'ignored', outcome = 'missing_checkout_attempt', processed_at = now()
      where event_id = p_event_id;
      return query select 'missing_checkout_attempt'::text, v_facility_id;
      return;
    end if;
    if p_plan is null or p_plan <> v_attempt_plan then
      update public.stripe_webhook_events
      set facility_id = v_facility_id,
          checkout_attempt_id = p_checkout_attempt_id,
          status = 'ignored', outcome = 'price_mismatch', processed_at = now()
      where event_id = p_event_id;
      return query select 'price_mismatch'::text, v_facility_id;
      return;
    end if;
  end if;

  -- Lock the chronology row for this subscription. The insert handles the first
  -- event atomically; SELECT FOR UPDATE serializes concurrent deliveries after it.
  insert into public.stripe_subscription_event_state (
    subscription_id, facility_id, last_event_created, last_event_precedence, last_event_id
  ) values (p_subscription_id, v_facility_id, 0, 0, '')
  on conflict (subscription_id) do nothing;

  select state.facility_id, state.last_event_created, state.last_event_precedence
    into v_state_facility_id, v_last_created, v_last_precedence
  from public.stripe_subscription_event_state as state
  where state.subscription_id = p_subscription_id
  for update;

  if v_state_facility_id <> v_facility_id then
    update public.stripe_webhook_events
    set facility_id = v_facility_id,
        checkout_attempt_id = p_checkout_attempt_id,
        status = 'ignored', outcome = 'subscription_binding_mismatch', processed_at = now()
    where event_id = p_event_id;
    return query select 'subscription_binding_mismatch'::text, v_facility_id;
    return;
  end if;

  if p_event_created < v_last_created
     or (p_event_created = v_last_created and v_precedence < v_last_precedence) then
    update public.stripe_webhook_events
    set facility_id = v_facility_id,
        checkout_attempt_id = p_checkout_attempt_id,
        status = 'ignored', outcome = 'older_event', processed_at = now()
    where event_id = p_event_id;
    return query select 'older_event'::text, v_facility_id;
    return;
  end if;

  if lower(coalesce(v_current_plan_status, '')) = 'lifetime' then
    v_plan_status := 'lifetime';
  else
    v_plan_status := case p_plan_status
      when 'active' then 'active'
      when 'past_due' then 'past_due'
      when 'incomplete' then 'incomplete'
      when 'paused' then 'paused'
      when 'canceled' then 'canceled'
      else 'unrecognized_status'
    end;

    if p_event_type = 'checkout.session.completed' then
      v_plan := p_plan;
    else
      -- Subscription updates reflect the current Stripe Price. Never fall back
      -- to the Checkout plan after a portal change: an unknown Price must fail
      -- closed instead of retaining paid access from an older tier.
      v_plan := p_plan;
    end if;

    if v_plan is null or v_plan not in ('starter', 'growth', 'anchor') then
      v_plan := 'free';
      if v_plan_status = 'active' then v_plan_status := 'unrecognized_price'; end if;
    end if;

    if p_event_type = 'customer.subscription.deleted' or v_plan_status = 'canceled' then
      update public.facilities
      set plan = 'free', plan_status = 'canceled'
      where id = v_facility_id;
    else
      update public.facilities
      set plan = v_plan,
          plan_status = v_plan_status,
          stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
          stripe_subscription_id = p_subscription_id
      where id = v_facility_id;
    end if;
  end if;

  update public.stripe_subscription_event_state
  set last_event_created = p_event_created,
      last_event_precedence = v_precedence,
      last_event_id = p_event_id,
      updated_at = now()
  where subscription_id = p_subscription_id;

  if p_checkout_attempt_id is not null then
    update public.billing_checkout_attempts
    set status = 'completed',
        stripe_subscription_id = coalesce(stripe_subscription_id, p_subscription_id),
        updated_at = now()
    where id = p_checkout_attempt_id;
  end if;

  update public.stripe_webhook_events
  set facility_id = v_facility_id,
      checkout_attempt_id = p_checkout_attempt_id,
      status = 'processed',
      outcome = case when v_plan_status = 'lifetime' then 'lifetime_protected' else 'applied' end,
      processed_at = now()
  where event_id = p_event_id;

  return query select
    case when v_plan_status = 'lifetime' then 'lifetime_protected'::text else 'applied'::text end,
    v_facility_id;
end;
$$;

revoke all on function public.apply_stripe_billing_event(
  text, text, bigint, text, text, text, uuid, uuid, text, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.apply_stripe_billing_event(
  text, text, bigint, text, text, text, uuid, uuid, text, text, boolean, text
) to service_role;

comment on table public.billing_checkout_attempts is
  'Server-only Stripe Checkout concurrency and idempotency records; no card data.';
comment on table public.stripe_webhook_events is
  'Server-only Stripe event IDs and processing outcomes; raw webhook payloads are not stored.';

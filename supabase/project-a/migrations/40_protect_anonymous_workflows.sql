-- Release sequence 40. Bound anonymous directory/handoff work across every Vercel instance and make match
-- creation atomic + idempotent. Only keyed HMAC digests are retained: never raw
-- IP addresses, browser tokens, contact data, narratives, or carrier names.
--
-- Rollback (during an application rollback window only):
--   drop function if exists public.record_directory_match(text, text, text, text, text, text, uuid[]);
--   drop function if exists public.consume_anonymous_budget(text, text, text);
--   drop table if exists public.match_request_keys;
--   drop table if exists public.api_rate_limits;
--   drop index if exists public.match_routes_match_position_unique;
--   alter table public.match_routes drop column if exists position;

create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, key_hash, window_started_at),
  constraint api_rate_limits_scope_check
    check (scope in (
      'intake:ip', 'intake:session',
      'match:ip', 'match:session',
      'handoff:ip', 'handoff:session',
      'track:ip', 'track:session'
    )),
  constraint api_rate_limits_key_hash_check
    check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint api_rate_limits_expiry_check
    check (expires_at > window_started_at)
);

-- Keep iterative branch execution idempotent when the endpoint allowlist grows
-- before release. PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
alter table public.api_rate_limits
  drop constraint if exists api_rate_limits_scope_check;
alter table public.api_rate_limits
  add constraint api_rate_limits_scope_check
  check (scope in (
    'intake:ip', 'intake:session',
    'match:ip', 'match:session',
    'handoff:ip', 'handoff:session',
    'track:ip', 'track:session'
  ));

create index if not exists api_rate_limits_expiry_idx
  on public.api_rate_limits (expires_at);

alter table public.api_rate_limits enable row level security;
revoke all privileges on table public.api_rate_limits
  from public, anon, authenticated;
grant all privileges on table public.api_rate_limits to service_role;

create or replace function public.consume_anonymous_budget(
  p_endpoint text,
  p_ip_key text,
  p_session_key text
)
returns table(
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  window_seconds integer;
  ip_limit integer;
  session_limit integer;
  bucket_start timestamptz;
  bucket_expiry timestamptz;
  ip_count integer;
  session_count integer;
begin
  if p_endpoint = 'intake' then
    window_seconds := 600;
    ip_limit := 40;
    session_limit := 20;
  elsif p_endpoint = 'match' then
    window_seconds := 3600;
    ip_limit := 20;
    session_limit := 4;
  elsif p_endpoint = 'handoff' then
    window_seconds := 3600;
    ip_limit := 60;
    session_limit := 12;
  elsif p_endpoint = 'track' then
    window_seconds := 600;
    ip_limit := 120;
    session_limit := 60;
  else
    raise exception 'unsupported anonymous endpoint' using errcode = '22023';
  end if;

  if p_ip_key is null or p_ip_key !~ '^[a-f0-9]{64}$'
     or p_session_key is null or p_session_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid anonymous request key' using errcode = '22023';
  end if;

  bucket_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) / window_seconds)
      * window_seconds
  );
  bucket_expiry := bucket_start
    + pg_catalog.make_interval(secs => window_seconds)
    + interval '1 day';

  insert into public.api_rate_limits (
    scope, key_hash, window_started_at, request_count, expires_at
  ) values (
    p_endpoint || ':ip', p_ip_key, bucket_start, 1, bucket_expiry
  )
  on conflict (scope, key_hash, window_started_at)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    expires_at = excluded.expires_at
  returning request_count into ip_count;

  insert into public.api_rate_limits (
    scope, key_hash, window_started_at, request_count, expires_at
  ) values (
    p_endpoint || ':session', p_session_key, bucket_start, 1, bucket_expiry
  )
  on conflict (scope, key_hash, window_started_at)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    expires_at = excluded.expires_at
  returning request_count into session_count;

  -- Indexed, probabilistic cleanup avoids turning every request into a table-wide
  -- maintenance pass while still bounding retention to roughly one day.
  if pg_catalog.random() < 0.01 then
    delete from public.api_rate_limits
    where expires_at < pg_catalog.clock_timestamp();
  end if;

  return query select
    ip_count <= ip_limit and session_count <= session_limit,
    greatest(
      0,
      least(ip_limit - ip_count, session_limit - session_count)
    ),
    case
      when ip_count <= ip_limit and session_count <= session_limit then 0
      else greatest(
        1,
        pg_catalog.ceil(
          extract(
            epoch from (
              bucket_start
              + pg_catalog.make_interval(secs => window_seconds)
              - pg_catalog.clock_timestamp()
            )
          )
        )::integer
      )
    end;
end;
$function$;

revoke all on function public.consume_anonymous_budget(text, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_anonymous_budget(text, text, text)
  to service_role;

-- Preserve the original directory rank for safe idempotent retries. Historical
-- routes remain nullable because their original ordering was not stored.
alter table public.match_routes
  add column if not exists position smallint;

do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'match_routes_position_check'
      and conrelid = 'public.match_routes'::regclass
  ) then
    alter table public.match_routes
      add constraint match_routes_position_check
      check (position between 1 and 10);
  end if;
end;
$block$;

create unique index if not exists match_routes_match_position_unique
  on public.match_routes (match_id, position)
  where position is not null;

create table if not exists public.match_request_keys (
  key_hash text primary key,
  payload_hash text not null,
  match_id uuid not null unique references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint match_request_keys_key_hash_check
    check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint match_request_keys_payload_hash_check
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint match_request_keys_expiry_check
    check (expires_at > created_at)
);

create index if not exists match_request_keys_expiry_idx
  on public.match_request_keys (expires_at);

alter table public.match_request_keys enable row level security;
revoke all privileges on table public.match_request_keys
  from public, anon, authenticated;
grant all privileges on table public.match_request_keys to service_role;

create or replace function public.record_directory_match(
  p_request_key_hash text,
  p_payload_hash text,
  p_region_zip3 text,
  p_care_level text,
  p_payer_type text,
  p_concern_category text,
  p_facility_ids uuid[]
)
returns table(
  recorded_match_id uuid,
  created boolean,
  recorded_facility_ids uuid[]
)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  existing_payload_hash text;
  existing_match_id uuid;
  existing_expiry timestamptz;
  selected_facility_ids uuid[] := coalesce(p_facility_ids, array[]::uuid[]);
  new_match_id uuid;
begin
  if p_request_key_hash is null or p_request_key_hash !~ '^[a-f0-9]{64}$'
     or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid match request key' using errcode = '22023';
  end if;
  if p_region_zip3 is null or p_region_zip3 !~ '^[0-9]{3}$'
     or p_care_level not in ('detox', 'residential', 'php', 'iop', 'op')
     or p_payer_type not in ('medicaid', 'medicare', 'commercial', 'tricare', 'self_pay')
     or p_concern_category not in ('substance_use', 'mental_health', 'co_occurring', 'unsure') then
    raise exception 'invalid de-identified match input' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(selected_facility_ids) > 3 then
    raise exception 'too many directory routes' using errcode = '22023';
  end if;
  if (
    select pg_catalog.count(*) <> pg_catalog.count(distinct candidate.facility_id)
    from pg_catalog.unnest(selected_facility_ids) as candidate(facility_id)
  ) then
    raise exception 'duplicate directory route' using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(selected_facility_ids) as candidate(facility_id)
    left join public.facilities as facility
      on facility.id = candidate.facility_id
     and facility.is_published
    where facility.id is null
  ) then
    raise exception 'directory route must reference a published facility'
      using errcode = '23503';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_key_hash, 39001)
  );

  select request_key.payload_hash, request_key.match_id, request_key.expires_at
    into existing_payload_hash, existing_match_id, existing_expiry
  from public.match_request_keys as request_key
  where request_key.key_hash = p_request_key_hash
  for update;

  if found and existing_expiry <= pg_catalog.clock_timestamp() then
    delete from public.match_request_keys where key_hash = p_request_key_hash;
    existing_match_id := null;
    existing_payload_hash := null;
  elsif found then
    if existing_payload_hash <> p_payload_hash then
      raise exception 'idempotency key was already used for different match input'
        using errcode = '22023';
    end if;

    return query
    select
      existing_match_id,
      false,
      coalesce(
        pg_catalog.array_agg(route.facility_id order by route.position, route.id),
        array[]::uuid[]
      )
    from public.match_routes as route
    where route.match_id = existing_match_id;
    return;
  end if;

  insert into public.matches (
    region_zip3,
    care_level_needed,
    payer_type,
    concern_category,
    source,
    status
  ) values (
    p_region_zip3,
    p_care_level,
    p_payer_type,
    p_concern_category,
    'seeker',
    case when pg_catalog.cardinality(selected_facility_ids) > 0 then 'routed' else 'open' end
  )
  returning id into new_match_id;

  insert into public.match_routes (match_id, facility_id, status, position)
  select new_match_id, candidate.facility_id, 'sent', candidate.position::smallint
  from pg_catalog.unnest(selected_facility_ids) with ordinality
    as candidate(facility_id, position);

  insert into public.match_request_keys (key_hash, payload_hash, match_id)
  values (p_request_key_hash, p_payload_hash, new_match_id);

  if pg_catalog.random() < 0.01 then
    delete from public.match_request_keys
    where expires_at < pg_catalog.clock_timestamp();
  end if;

  return query select new_match_id, true, selected_facility_ids;
end;
$function$;

revoke all on function public.record_directory_match(text, text, text, text, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.record_directory_match(text, text, text, text, text, text, uuid[])
  to service_role;

comment on table public.api_rate_limits is
  'Short-lived HMAC-only abuse counters; contains no raw IP, browser token, identity, contact, or intake content.';
comment on table public.match_request_keys is
  'Server-only 24-hour HMAC idempotency registry for de-identified directory matches.';
comment on function public.record_directory_match(text, text, text, text, text, text, uuid[]) is
  'Service-only atomic and idempotent creation of a de-identified match and its published facility routes.';

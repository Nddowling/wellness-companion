-- Release sequence 41. Reconcile a production table that predates the repository's migration history.
-- This exact shape was verified read-only against production on 2026-07-15.
-- The table is server-only: browser roles receive no table grant or RLS policy.

create table if not exists public.facility_events (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  event_type text not null,
  match_id uuid,
  referrer text,
  created_at timestamptz not null default now(),
  constraint facility_events_event_type_check
    check (event_type in ('call', 'directions', 'email', 'website')),
  constraint facility_events_match_id_redacted_check check (match_id is null),
  constraint facility_events_referrer_redacted_check check (referrer is null)
);

do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'facility_events_event_type_check'
      and conrelid = 'public.facility_events'::regclass
  ) then
    alter table public.facility_events
      add constraint facility_events_event_type_check
      check (event_type in ('call', 'directions', 'email', 'website'));
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'facility_events_facility_id_fkey'
      and conrelid = 'public.facility_events'::regclass
  ) then
    alter table public.facility_events
      add constraint facility_events_facility_id_fkey
      foreign key (facility_id) references public.facilities(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'facility_events_match_id_redacted_check'
      and conrelid = 'public.facility_events'::regclass
  ) then
    alter table public.facility_events
      add constraint facility_events_match_id_redacted_check
      check (match_id is null) not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'facility_events_referrer_redacted_check'
      and conrelid = 'public.facility_events'::regclass
  ) then
    alter table public.facility_events
      add constraint facility_events_referrer_redacted_check
      check (referrer is null) not valid;
  end if;
end;
$block$;

-- The retired fields tied facility-level engagement to a match record and leaked
-- full browser referrers. Preserve only the aggregate event itself.
update public.facility_events
set match_id = null,
    referrer = null
where match_id is not null or referrer is not null;

alter table public.facility_events
  validate constraint facility_events_match_id_redacted_check;
alter table public.facility_events
  validate constraint facility_events_referrer_redacted_check;

create index if not exists idx_facility_events_facility_created
  on public.facility_events (facility_id, created_at desc);

alter table public.facility_events enable row level security;
revoke all privileges on table public.facility_events
  from public, anon, authenticated;
grant select, insert on table public.facility_events to service_role;

comment on table public.facility_events is
  'Server-only, facility-level engagement counts; match and referrer fields are permanently redacted.';

-- Release sequence 42. Outbound analytics need a facility id and timestamp, not a visitor's match or the
-- page URL they came from. Remove historical links, prevent future retention at the
-- database boundary, and keep the event table service-only.

update public.outbound_clicks
set match_id = null,
    referrer = null
where match_id is not null or referrer is not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'outbound_clicks_referrer_must_be_null'
      and conrelid = 'public.outbound_clicks'::regclass
  ) then
    alter table public.outbound_clicks
      add constraint outbound_clicks_referrer_must_be_null
      check (referrer is null) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'outbound_clicks_match_id_must_be_null'
      and conrelid = 'public.outbound_clicks'::regclass
  ) then
    alter table public.outbound_clicks
      add constraint outbound_clicks_match_id_must_be_null
      check (match_id is null) not valid;
  end if;
end;
$migration$;
alter table public.outbound_clicks
  validate constraint outbound_clicks_referrer_must_be_null;
alter table public.outbound_clicks
  validate constraint outbound_clicks_match_id_must_be_null;

alter table public.outbound_clicks enable row level security;
drop policy if exists outbound_clicks_select on public.outbound_clicks;
revoke all privileges on table public.outbound_clicks
  from public, anon, authenticated, service_role;
grant select, insert on table public.outbound_clicks to service_role;

comment on column public.outbound_clicks.referrer is
  'Legacy compatibility column. Always NULL; raw Referer URLs are prohibited.';
comment on column public.outbound_clicks.match_id is
  'Legacy compatibility column. Always NULL; outbound analytics are facility-level only.';

-- Rollback note: dropping the two NULL constraints and restoring the former SELECT
-- policy/grants would restore the old access model, but scrubbed values are
-- intentionally unrecoverable and must not be restored from analytics.

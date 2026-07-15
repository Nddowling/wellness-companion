-- Clear Bed Recovery production enhancement release
-- Generated 2026-07-15 from migrations 28 through 43 in semantic order.
-- Apply as one Supabase managed migration. Do not edit after hashing.

-- BEGIN SOURCE: supabase/project-a/migrations/28_retire_conversation_history.sql

-- Compatibility phase for the privacy-first connector model.
--
-- This release stops collecting transcripts, names, and insurance-carrier text,
-- but deliberately RETAINS the old table/column shapes for one rollback window.
-- The prior production application can therefore still query and write without a
-- schema error, while these triggers discard prohibited payloads before storage.
-- A later contract migration may drop the retired objects after the new release
-- has soaked and rollback to the old application is no longer required.

create or replace function public.scrub_retired_conversation_payload()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.auth_user_id := null;
  new.title := null;
  new.messages := '[]'::jsonb;
  new.match_id := null;
  new.matched_facilities := '[]'::jsonb;
  return new;
end;
$function$;

drop trigger if exists trg_scrub_retired_conversation_payload on public.vault_conversations;
create trigger trg_scrub_retired_conversation_payload
before insert or update on public.vault_conversations
for each row execute function public.scrub_retired_conversation_payload();

-- Install the scrubber before cleanup so a concurrent legacy write cannot restore
-- a retired transcript between deletion and trigger creation.
delete from public.vault_conversations;

create or replace function public.scrub_retired_seeker_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.name := null;
  new.insurance := null;

  -- Compatibility with the prior early-contact endpoint: let its insert succeed,
  -- but discard contact until a consented handoff updates the record.
  if not coalesce(new.consent_share, false) and not coalesce(new.consent_email, false) then
    new.email := null;
  end if;
  if not coalesce(new.consent_share, false) then
    new.phone := null;
  end if;

  -- The connector needs one contact route, never a bundle of identifiers. Email
  -- wins when it is required to deliver the separately requested match copy.
  if new.email is not null and new.phone is not null then
    if coalesce(new.consent_email, false) then
      new.phone := null;
    else
      new.email := null;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_scrub_retired_seeker_fields on public.vault_seekers;
create trigger trg_scrub_retired_seeker_fields
before insert or update on public.vault_seekers
for each row execute function public.scrub_retired_seeker_fields();

-- Existing direct identifiers that the new flow does not need are cleared only
-- after the write scrubber is active. Running through the trigger also enforces the
-- one-contact-method rule on retained, consented connector records.
update public.vault_seekers
set name = null,
    insurance = null,
    email = case
      when coalesce(consent_share, false) or coalesce(consent_email, false) then email
      else null
    end,
    phone = case
      when coalesce(consent_share, false) then phone
      else null
    end;

revoke all on function public.scrub_retired_conversation_payload() from public, anon, authenticated;
revoke all on function public.scrub_retired_seeker_fields() from public, anon, authenticated;

-- Historical packet/reminder audit rows are no longer needed, but retain the
-- original kind constraint so the previous application remains rollback-compatible.
delete from public.vault_email_log
where kind in ('face_sheet', 'welcome', 'weekly_reminder');

-- Production accumulated owner/facility policies outside the repository's original
-- deny-all vault design. Remove every browser-facing policy on the retired vault
-- tables. Server-side service-role access remains available for consented connector
-- leads and compliance administration.
do $block$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'vault_conversations',
        'vault_seekers',
        'vault_seeker_interest',
        'vault_consent_events',
        'vault_email_log'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end;
$block$;

-- Supabase grants through the PUBLIC role as well as anon/authenticated. Revoking
-- only the named web roles would leave inherited PUBLIC privileges effective.
revoke all on table public.vault_conversations from public, anon, authenticated;
revoke all on table public.vault_seekers from public, anon, authenticated;
revoke all on table public.vault_seeker_interest from public, anon, authenticated;
revoke all on table public.vault_consent_events from public, anon, authenticated;
revoke all on table public.vault_email_log from public, anon, authenticated;

-- A service-role key still needs SQL privileges even though it bypasses RLS. Grant
-- the connector's exact DML surface explicitly so clean branches do not depend on
-- legacy Supabase default grants.
grant select, insert, update, delete on table public.vault_conversations to service_role;
grant select, insert, update, delete on table public.vault_seekers to service_role;
grant select, insert, update, delete on table public.vault_seeker_interest to service_role;
grant select, insert, update, delete on table public.vault_consent_events to service_role;
grant select, insert, update, delete on table public.vault_email_log to service_role;

-- Community comments are moderated but submitter identity/attendance is not
-- verified. Keep existing rows for admin review, but remove direct browser access;
-- the public profile may render approved comments only through its controlled
-- server-side loader. New public submissions are paused in application code.
do $block$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'facility_reviews'
  loop
    execute format('drop policy if exists %I on public.facility_reviews', policy_row.policyname);
  end loop;
end;
$block$;
revoke all on table public.facility_reviews from public, anon, authenticated;
grant select, insert, update, delete on table public.facility_reviews to service_role;

-- END SOURCE: supabase/project-a/migrations/28_retire_conversation_history.sql

-- BEGIN SOURCE: supabase/project-a/migrations/29_require_fresh_open_availability.sql

-- Make the public `open` facet mean exactly what the UI says: a positive
-- residential-bed report dated within seven days. The source data records detox
-- as a service but does not reliably distinguish outpatient, residential, and
-- hospital detox capacity, so detox is not treated as bed-based until that
-- setting is modeled explicitly. These definitions supersede the older
-- production RPC bodies while preserving migration 20's forgiving q matcher.

create or replace function public.facilities_search(
  p_region text default null,
  p_level  text default null,
  p_pay    text default null,
  p_spec   text default null,
  p_pop    text default null,
  p_q      text default null,
  p_open   boolean default false,
  p_limit  integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid, name text, city text, state text,
  levels_of_care text[], carriers_named text[],
  facility_payers jsonb, facility_capacity jsonb
)
language sql stable as $function$
  select f.id, f.name, f.city, f.state, f.levels_of_care, f.carriers_named,
    coalesce((select jsonb_agg(jsonb_build_object('payer_type', fp.payer_type))
              from facility_payers fp where fp.facility_id = f.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                'level_of_care', c.level_of_care,
                'beds_available', c.beds_available,
                'last_updated', c.last_updated,
                'provider_reported', c.updated_by is not null))
              from facility_capacity c where c.facility_id = f.id), '[]'::jsonb)
  from facilities f
  where f.is_published
    and (p_region is null or f.state = p_region)
    and (p_level is null or p_level = any(f.levels_of_care))
    and (p_spec is null or exists (
      select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
    ))
    and (p_pop is null or exists (
      select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
    ))
    and (p_pay is null or exists (
      select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
    ))
    and (p_q is null or public.facility_matches_q(f.id, p_q))
    and (p_open is not true or exists (
      select 1
      from facility_capacity c
      where c.facility_id = f.id
        and 'residential' = any(f.levels_of_care)
        and c.level_of_care = 'residential'
        and (p_level is null or c.level_of_care = p_level)
        and c.beds_available > 0
        and c.last_updated >= now() - interval '7 days'
        and c.last_updated <= now() + interval '5 minutes'
    ))
  order by f.name
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$;

-- These directory RPCs are consumed only by controlled Server Components. Keep
-- raw capacity payloads and query cost away from browser database roles.
revoke execute on function public.facilities_search(text,text,text,text,text,text,boolean,integer,integer)
  from public, anon, authenticated;
revoke execute on function public.facilities_search_count(text,text,text,text,text,text,boolean)
  from public, anon, authenticated;
revoke execute on function public.facilities_facet_counts(text,text,text,text,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.facilities_search(text,text,text,text,text,text,boolean,integer,integer)
  to service_role;
grant execute on function public.facilities_search_count(text,text,text,text,text,text,boolean)
  to service_role;
grant execute on function public.facilities_facet_counts(text,text,text,text,text,text,boolean)
  to service_role;

create or replace function public.facilities_search_count(
  p_region text default null,
  p_level  text default null,
  p_pay    text default null,
  p_spec   text default null,
  p_pop    text default null,
  p_q      text default null,
  p_open   boolean default false
)
returns bigint
language sql stable as $function$
  select count(*)
  from facilities f
  where f.is_published
    and (p_region is null or f.state = p_region)
    and (p_level is null or p_level = any(f.levels_of_care))
    and (p_spec is null or exists (
      select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
    ))
    and (p_pop is null or exists (
      select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
    ))
    and (p_pay is null or exists (
      select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
    ))
    and (p_q is null or public.facility_matches_q(f.id, p_q))
    and (p_open is not true or exists (
      select 1
      from facility_capacity c
      where c.facility_id = f.id
        and 'residential' = any(f.levels_of_care)
        and c.level_of_care = 'residential'
        and (p_level is null or c.level_of_care = p_level)
        and c.beds_available > 0
        and c.last_updated >= now() - interval '7 days'
        and c.last_updated <= now() + interval '5 minutes'
    ));
$function$;

create or replace function public.facilities_facet_counts(
  p_region text default null,
  p_level  text default null,
  p_pay    text default null,
  p_spec   text default null,
  p_pop    text default null,
  p_q      text default null,
  p_open   boolean default false
)
returns jsonb
language sql stable as $function$
  with
  lvl as (
    select lv as value, count(*)::bigint as n
    from facilities f, unnest(f.levels_of_care) as lv
    where f.is_published
      and (p_region is null or f.state = p_region)
      and (p_spec is null or exists (
        select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
      ))
      and (p_pop is null or exists (
        select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
      ))
      and (p_pay is null or exists (
        select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
      ))
      and (p_q is null or public.facility_matches_q(f.id, p_q))
      and (p_open is not true or exists (
        select 1 from facility_capacity c
        where c.facility_id = f.id
          and 'residential' = any(f.levels_of_care)
          and c.level_of_care = 'residential'
          and c.level_of_care = lv
          and c.beds_available > 0
          and c.last_updated >= now() - interval '7 days'
          and c.last_updated <= now() + interval '5 minutes'
      ))
    group by lv
  ),
  pay as (
    select fp.payer_type as value, count(distinct f.id)::bigint as n
    from facilities f
    join facility_payers fp on fp.facility_id = f.id
    where f.is_published
      and (p_region is null or f.state = p_region)
      and (p_level is null or p_level = any(f.levels_of_care))
      and (p_spec is null or exists (
        select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
      ))
      and (p_pop is null or exists (
        select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
      ))
      and (p_q is null or public.facility_matches_q(f.id, p_q))
      and (p_open is not true or exists (
        select 1 from facility_capacity c
        where c.facility_id = f.id
          and 'residential' = any(f.levels_of_care)
          and c.level_of_care = 'residential'
          and (p_level is null or c.level_of_care = p_level)
          and c.beds_available > 0
          and c.last_updated >= now() - interval '7 days'
          and c.last_updated <= now() + interval '5 minutes'
      ))
    group by fp.payer_type
  ),
  reg as (
    select f.state as value, count(*)::bigint as n
    from facilities f
    where f.is_published and f.state is not null and f.state <> ''
      and (p_level is null or p_level = any(f.levels_of_care))
      and (p_spec is null or exists (
        select 1 from unnest(f.specialties) s where position(lower(p_spec) in lower(s)) > 0
      ))
      and (p_pop is null or exists (
        select 1 from unnest(f.populations_served) pp where position(lower(p_pop) in lower(pp)) > 0
      ))
      and (p_pay is null or exists (
        select 1 from facility_payers fp where fp.facility_id = f.id and fp.payer_type = p_pay
      ))
      and (p_q is null or public.facility_matches_q(f.id, p_q))
      and (p_open is not true or exists (
        select 1 from facility_capacity c
        where c.facility_id = f.id
          and 'residential' = any(f.levels_of_care)
          and c.level_of_care = 'residential'
          and (p_level is null or c.level_of_care = p_level)
          and c.beds_available > 0
          and c.last_updated >= now() - interval '7 days'
          and c.last_updated <= now() + interval '5 minutes'
      ))
    group by f.state
  )
  select jsonb_build_object(
    'levels', coalesce((select jsonb_object_agg(value, n) from lvl), '{}'::jsonb),
    'payers', coalesce((select jsonb_object_agg(value, n) from pay), '{}'::jsonb),
    'regions', coalesce((select jsonb_object_agg(value, n) from reg), '{}'::jsonb)
  );
$function$;

-- END SOURCE: supabase/project-a/migrations/29_require_fresh_open_availability.sql

-- BEGIN SOURCE: supabase/project-a/migrations/30_close_public_function_grants.sql

-- Close production privilege drift discovered during the release audit.
--
-- PostgreSQL grants EXECUTE on new functions to the PUBLIC role by default. The
-- earlier migration revoked anon/authenticated explicitly, but those roles still
-- inherited EXECUTE through PUBLIC. These administrative and trigger functions
-- must be callable only by the database owner/service role (or by their triggers).

do $block$
declare
  signature text;
  target_function regprocedure;
begin
  -- Some data-pipeline functions were created directly in production before the
  -- repository migration set was complete. to_regprocedure keeps this migration
  -- valid in both production-derived branches and clean environments.
  foreach signature in array array[
    'public.clearbed_add_text_columns(regclass,text[])',
    'public.merge_ready_staging_facilities(integer)',
    'public.refresh_staging_quality_scores()',
    'public.mark_staging_duplicate_candidates()',
    'public.rls_auto_enable()',
    'public.bump_facility_updated_at()',
    'public.revalidate_facility()'
  ]
  loop
    target_function := to_regprocedure(signature);
    if target_function is not null then
      execute format(
        'revoke execute on function %s from public, anon, authenticated',
        target_function
      );
      execute format('grant execute on function %s to service_role', target_function);
    end if;
  end loop;
end;
$block$;

-- Prevent every web-role default EXECUTE grant observed in production from being
-- inherited by functions created in later migrations. Future public RPCs must
-- grant EXECUTE to their intended roles explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Supabase's newer projects no longer guarantee legacy API grants. The server-side
-- service role is the application's deliberate administrative boundary, so make its
-- access explicit for the existing schema and for objects created by later migrations.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select, update on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- Pin every audit-flagged mutable search path. Most are read-only directory helpers;
-- keeping their existing EXECUTE grants is intentional, but object resolution must
-- never depend on a caller-controlled schema.
do $block$
declare
  signature text;
  target_function regprocedure;
begin
  foreach signature in array array[
    'public.make_facility_slug(text,text,text,uuid)',
    'public.normalize_phone_digits(text)',
    'public.normalize_facility_name(text)',
    'public.calculate_facility_quality_score(uuid)',
    'public.calculate_staging_quality_score(uuid)',
    'public.bump_facility_updated_at()',
    'public.revalidate_facility()',
    'public.facilities_near_zip(text,double precision,integer)',
    'public.facilities_near_point(double precision,double precision,double precision,integer)',
    'public.facilities_state_counts()',
    'public.facilities_in_bounds(double precision,double precision,double precision,double precision,double precision,double precision,integer)',
    'public.facilities_search(text,text,text,text,text,text,boolean,integer,integer)',
    'public.facilities_search_count(text,text,text,text,text,text,boolean)',
    'public.contact_counts_by_state()',
    'public.facility_matches_q(uuid,text)',
    'public.facilities_facet_counts(text,text,text,text,text,text,boolean)'
  ]
  loop
    target_function := to_regprocedure(signature);
    if target_function is not null then
      execute format('alter function %s set search_path to public, pg_temp', target_function);
    end if;
  end loop;
end;
$block$;

-- This unused legacy lead form accepted arbitrary public inserts. The application has
-- no consumer, so close it instead of retaining a spam/data-collection surface.
do $block$
begin
  if to_regclass('public.facility_upgrade_leads') is not null then
    execute 'drop policy if exists facility_upgrade_leads_insert_public on public.facility_upgrade_leads';
    execute 'revoke all on table public.facility_upgrade_leads from public, anon, authenticated';
  end if;
end;
$block$;

-- END SOURCE: supabase/project-a/migrations/30_close_public_function_grants.sql

-- BEGIN SOURCE: supabase/project-a/migrations/31_normalize_payer_and_detox_evidence.sql

-- Normalize source-model fields that were stronger than their evidence.
--
-- 1. `facility_payers` means a program lists a payment category. It cannot establish
--    member-specific network status, so new and existing rows default to false.
-- 2. Detox remains a valid service category. Because existing capacity rows do not
--    encode outpatient/residential/hospital setting, migration 29 excludes detox
--    from the `open` bed facet instead of deleting or reclassifying source evidence.

alter table public.facility_payers
  alter column in_network set default false;

update public.facility_payers
set in_network = false
where in_network is true;

-- A match can create at most one consented connector lead. PostgreSQL permits
-- multiple NULLs, so pre-match compatibility contacts remain possible during rollback.
create unique index if not exists idx_vault_seekers_unique_match_id
  on public.vault_seekers (match_id);

-- END SOURCE: supabase/project-a/migrations/31_normalize_payer_and_detox_evidence.sql

-- BEGIN SOURCE: supabase/project-a/migrations/32_match_directory_options.sql

-- Rank match options inside Postgres so matching considers the full published
-- directory instead of the Data API's row-return ceiling. This RPC is deliberately
-- service-role-only: browser roles never call it and no identity enters its inputs.

create or replace function public.match_directory_options(
  p_region_zip3      text,
  p_care_level       text,
  p_payer_type       text,
  p_concern_category text,
  p_payer_carrier    text default null,
  p_limit            integer default 3
)
returns table(
  id                uuid,
  name              text,
  city              text,
  state             text,
  referral_contact  jsonb,
  level             text,
  bed_based         boolean,
  beds_available    integer,
  freshness         text,
  provider_reported boolean,
  region_match      boolean,
  score             integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $function$
  with eligible as (
    select
      f.id,
      f.name,
      f.city,
      f.state,
      f.referral_contact,
      (p_care_level = 'residential') as bed_based,
      (f.zip3 is not null and f.zip3 = p_region_zip3) as region_match,
      c.beds_available as reported_beds,
      c.last_updated as reported_at,
      c.updated_by as reported_by
    from public.facilities f
    left join public.facility_capacity c
      on c.facility_id = f.id
     and c.level_of_care = 'residential'
    where f.is_published
      -- Clear Bed's corpus is an addiction-treatment directory, not a standalone
      -- mental-health directory. Co-occurring requests need an explicit positive
      -- source/profile field, and an explicit negative always wins.
      and p_concern_category <> 'mental_health'
      and (
        p_concern_category <> 'co_occurring'
        or (
          lower(coalesce(f.co_occurring, ''))
            ~ '(^|[^a-z])(yes|co.?occurring|dual|integrated|both)([^a-z]|$)'
          and lower(coalesce(f.co_occurring, ''))
            !~ '(^|[^a-z])(no|none|not[[:space:]_-]+offered)([^a-z]|$)'
        )
      )
      -- A capacity row is not evidence that a facility lists a service. The
      -- directory's source-backed levels array is the hard level filter.
      and p_care_level = any(f.levels_of_care)
      and exists (
        select 1
        from public.facility_payers fp
        where fp.facility_id = f.id
          and fp.payer_type = p_payer_type
      )
      -- A generic commercial payer category never widens a volunteered carrier
      -- into unrelated commercial results.
      and (
        p_payer_carrier is null
        or exists (
          select 1
          from unnest(f.carriers_named) as listed_carrier(name)
          where lower(listed_carrier.name) = lower(p_payer_carrier)
        )
      )
  ),
  normalized as (
    select
      e.id,
      e.name,
      e.city,
      e.state,
      e.referral_contact,
      p_care_level as level,
      e.bed_based,
      case
        when e.bed_based
         and e.reported_beds > 0
         and e.reported_at >= now() - interval '7 days'
         and e.reported_at <= now() + interval '5 minutes'
          then e.reported_beds
        else 0
      end as beds_available,
      case
        when e.bed_based
         and e.reported_beds > 0
         and e.reported_at >= now() - interval '3 days'
         and e.reported_at <= now() + interval '5 minutes'
          then 'green'
        when e.bed_based
         and e.reported_beds > 0
         and e.reported_at >= now() - interval '7 days'
         and e.reported_at <= now() + interval '5 minutes'
          then 'amber'
        else 'red'
      end as freshness,
      (
        e.bed_based
        and e.reported_beds > 0
        and e.reported_at >= now() - interval '7 days'
        and e.reported_at <= now() + interval '5 minutes'
        and e.reported_by is not null
      ) as provider_reported,
      e.region_match
    from eligible e
  ),
  scored as (
    select
      n.*,
      (
        case when n.region_match then 12 else 0 end
        + case n.freshness when 'green' then 3 when 'amber' then 1 else 0 end
        + case when n.beds_available > 0 then 3 else 0 end
      )::integer as score
    from normalized n
  )
  select
    s.id,
    s.name,
    s.city,
    s.state,
    s.referral_contact,
    s.level,
    s.bed_based,
    s.beds_available,
    s.freshness,
    s.provider_reported,
    s.region_match,
    s.score
  from scored s
  -- Twelve proximity points exceed the maximum six availability points, so a
  -- same-ZIP3 option always precedes a different-region option. Bed count breaks
  -- only equally fresh residential ties; names and UUIDs make the order stable.
  order by
    s.score desc,
    s.beds_available desc,
    lower(s.name) asc,
    s.name asc,
    s.id asc
  limit least(greatest(coalesce(p_limit, 3), 1), 10);
$function$;

revoke all on function public.match_directory_options(text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.match_directory_options(text, text, text, text, text, integer)
  to service_role;

-- END SOURCE: supabase/project-a/migrations/32_match_directory_options.sql

-- BEGIN SOURCE: supabase/project-a/migrations/33_minimize_partner_shortlist_data.sql

-- Partner shortlists are collections of public program records, never client
-- records. Remove the free-text surfaces that could have captured a name or PHI,
-- invalidate every existing share URL, and enforce the minimized shape in the DB.

create or replace function public.enforce_partner_list_privacy()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  reference_number bigint;
begin
  if tg_op = 'INSERT' then
    -- Ignore caller-supplied identifiers/timestamps so the resulting label is
    -- entirely system-generated and cannot encode client information.
    new.id := gen_random_uuid();
    new.created_at := clock_timestamp();
  else
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;

  reference_number := (
    ('x' || substring(replace(new.id::text, '-', '') from 1 for 8))::bit(32)::bigint
    % 100000000
  );
  new.title := format(
    'Treatment program shortlist #%s - %s',
    lpad(reference_number::text, 8, '0'),
    to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD')
  );
  new.intro := null;

  if tg_op = 'INSERT' then
    if new.share_token is not null then
      new.share_token := encode(extensions.gen_random_bytes(32), 'hex');
    end if;
  elsif new.share_token is not null
    and (old.share_token is null or new.share_token is distinct from old.share_token)
  then
    -- Ignore a caller-provided token. Every activation/rotation receives 256
    -- bits from pgcrypto; setting the column to null still disables sharing.
    new.share_token := encode(extensions.gen_random_bytes(32), 'hex');
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_partner_list_item_privacy()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  new.note := null;
  return new;
end;
$function$;

-- Install enforcement before cleanup so concurrent legacy writes are minimized.
drop trigger if exists trg_partner_lists_privacy on public.partner_lists;
create trigger trg_partner_lists_privacy
before insert or update on public.partner_lists
for each row execute function public.enforce_partner_list_privacy();

drop trigger if exists trg_partner_list_items_privacy on public.partner_list_items;
create trigger trg_partner_list_items_privacy
before insert or update on public.partner_list_items
for each row execute function public.enforce_partner_list_item_privacy();

-- Recompute every title, null every introduction, and rotate every active token.
-- The trigger replaces the temporary random token with a second 256-bit value.
update public.partner_lists
set
  title = title,
  intro = null,
  share_token = case
    when share_token is null then null
    else encode(extensions.gen_random_bytes(32), 'hex')
  end;

update public.partner_list_items
set note = null
where note is not null;

alter table public.partner_lists
  drop constraint if exists partner_lists_system_title_check,
  drop constraint if exists partner_lists_intro_null_check,
  drop constraint if exists partner_lists_share_token_strength_check;

alter table public.partner_lists
  add constraint partner_lists_system_title_check
    check (title ~ '^Treatment program shortlist #[0-9]{8} - [0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  add constraint partner_lists_intro_null_check
    check (intro is null),
  add constraint partner_lists_share_token_strength_check
    check (
      share_token is null
      or (
        length(share_token) between 43 and 128
        and share_token ~ '^[A-Za-z0-9_-]+$'
      )
    );

alter table public.partner_list_items
  drop constraint if exists partner_list_items_note_null_check;
alter table public.partner_list_items
  add constraint partner_list_items_note_null_check check (note is null);

comment on column public.partner_lists.title is
  'System-generated dated/reference label; partner-supplied titles are discarded.';
comment on column public.partner_lists.intro is
  'Retired privacy surface; enforced null.';
comment on column public.partner_list_items.note is
  'Retired privacy surface; enforced null.';
comment on column public.partner_lists.share_token is
  'Null when private; otherwise a system-generated token with at least 256 bits of CSPRNG output.';

-- RLS ownership policies from migration 13 remain the access boundary.
alter table public.partner_lists enable row level security;
alter table public.partner_list_items enable row level security;

revoke all on function public.enforce_partner_list_privacy()
  from public, anon, authenticated;
revoke all on function public.enforce_partner_list_item_privacy()
  from public, anon, authenticated;
grant execute on function public.enforce_partner_list_privacy() to service_role;
grant execute on function public.enforce_partner_list_item_privacy() to service_role;

-- END SOURCE: supabase/project-a/migrations/33_minimize_partner_shortlist_data.sql

-- BEGIN SOURCE: supabase/project-a/migrations/34_promote_approved_claim_owners.sql

-- An approved ownership claim is the only self-service path that establishes an
-- owner. Historical approvals were mistakenly linked as staff, which meant any
-- staff member could later use the service-role invite action to elevate another
-- owner. Repair the historical role assignment before owner-only invites ship.

-- Public claim submissions did not always persist the auth user created during
-- approval. Link only an exact normalized claimant email on an approved, known
-- facility claim; auth.users.email is unique in the hosted Auth schema.
update public.facility_claims as claim
set user_id = auth_user.id
from auth.users as auth_user
where claim.status = 'approved'
  and claim.facility_id is not null
  and claim.user_id is null
  and claim.claimant_email is not null
  and lower(trim(auth_user.email)) = lower(trim(claim.claimant_email));

update public.facility_members as member
set role = 'owner'
from public.facility_claims as claim
where claim.status = 'approved'
  and claim.facility_id = member.facility_id
  and claim.user_id = member.user_id
  and member.role <> 'owner';

-- END SOURCE: supabase/project-a/migrations/34_promote_approved_claim_owners.sql

-- BEGIN SOURCE: supabase/project-a/migrations/35_remove_orphan_residential_capacity.sql

-- Residential capacity is meaningful only while a facility explicitly lists
-- residential care. Remove historical orphan rows and keep future level changes
-- from leaving a seven-day public bed signal behind.

delete from public.facility_capacity as capacity
using public.facilities as facility
where capacity.facility_id = facility.id
  and capacity.level_of_care = 'residential'
  and not ('residential' = any(coalesce(facility.levels_of_care, '{}'::text[])));

create or replace function public.remove_undeclared_residential_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if not ('residential' = any(coalesce(new.levels_of_care, '{}'::text[]))) then
    delete from public.facility_capacity
    where facility_id = new.id
      and level_of_care = 'residential';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_remove_undeclared_residential_capacity on public.facilities;
create trigger trg_remove_undeclared_residential_capacity
after insert or update of levels_of_care on public.facilities
for each row execute function public.remove_undeclared_residential_capacity();

revoke all on function public.remove_undeclared_residential_capacity() from public, anon, authenticated;
grant execute on function public.remove_undeclared_residential_capacity() to service_role;

-- END SOURCE: supabase/project-a/migrations/35_remove_orphan_residential_capacity.sql

-- BEGIN SOURCE: supabase/project-a/migrations/36_secure_billing_events.sql

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

-- END SOURCE: supabase/project-a/migrations/36_secure_billing_events.sql

-- BEGIN SOURCE: supabase/project-a/migrations/37_atomic_connector_handoff.sql

-- Complete or revoke the optional connector handoff in one database transaction.
-- The service route validates the browser capability; this function is the final
-- data-integrity boundary. The recipient array comes only from the signed server
-- capability issued with /api/match and is revalidated as a published route here.

-- Iterative release branches may already have the earlier match-only overload.
-- Remove it explicitly so it cannot remain callable as an unsafe side door.
drop function if exists public.complete_connector_handoff(uuid, text, text, boolean, boolean);

create or replace function public.complete_connector_handoff(
  p_match_id uuid,
  p_recipient_facility_ids uuid[],
  p_email text,
  p_phone text,
  p_consent_email boolean,
  p_consent_share boolean
)
returns table(
  seeker_id uuid,
  consent_email boolean,
  consent_share boolean,
  shared_facility_count integer,
  already_completed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  existing public.vault_seekers%rowtype;
  v_seeker_id uuid;
  v_changed boolean := true;
  v_shared integer := 0;
  v_latest_email boolean;
  v_latest_share boolean;
  v_recipient_ids uuid[] := coalesce(p_recipient_facility_ids, array[]::uuid[]);
begin
  if p_match_id is null
    or not exists (
      select 1 from public.matches m
      where m.id = p_match_id and m.source = 'seeker'
    )
  then
    raise exception 'Invalid connector match' using errcode = '22023';
  end if;

  if p_consent_email is null or p_consent_share is null then
    raise exception 'Both permission choices are required' using errcode = '22023';
  end if;
  if p_email is not null and p_phone is not null then
    raise exception 'Only one contact method is permitted' using errcode = '22023';
  end if;
  if (p_consent_email or p_consent_share) and p_email is null and p_phone is null then
    raise exception 'A permitted contact method is required' using errcode = '22023';
  end if;
  if p_consent_email and p_email is null then
    raise exception 'Email permission requires an email address' using errcode = '22023';
  end if;
  if p_email is not null and (length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;
  if p_phone is not null and length(regexp_replace(p_phone, '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Invalid phone number' using errcode = '22023';
  end if;
  if cardinality(v_recipient_ids) > 3 then
    raise exception 'Too many handoff recipients' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(v_recipient_ids) as recipient(facility_id)
    where recipient.facility_id is null
  ) or (
    select count(*) <> count(distinct recipient.facility_id)
    from unnest(v_recipient_ids) as recipient(facility_id)
  ) then
    raise exception 'Invalid handoff recipient set' using errcode = '22023';
  end if;

  -- Serialize every decision for one match, including concurrent browser retries.
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  -- Every recipient must be one of this match's routes. Current publication is
  -- required only when contact/email permission is granted; a later unpublish
  -- must never stop a person from recording an explicit denial.
  if exists (
    select 1
    from unnest(v_recipient_ids) as recipient(facility_id)
    left join public.match_routes mr
      on mr.match_id = p_match_id
     and mr.facility_id = recipient.facility_id
    where mr.id is null
  ) then
    raise exception 'Recipient is not routed for this match' using errcode = '22023';
  end if;

  if p_consent_email or p_consent_share then
    if cardinality(v_recipient_ids) = 0 or exists (
      select 1
      from unnest(v_recipient_ids) as recipient(facility_id)
      left join public.facilities f
        on f.id = recipient.facility_id
       and f.is_published
      where f.id is null
    ) then
      raise exception 'No published capability-bound recipients remain' using errcode = '22023';
    end if;
  end if;

  select s.*
  into existing
  from public.vault_seekers s
  where s.match_id = p_match_id
  for update;

  if found then
    v_seeker_id := existing.id;
    v_changed :=
      existing.email is distinct from case
        when p_consent_email or p_consent_share then lower(p_email)
        else null
      end
      or existing.phone is distinct from case when p_consent_email or p_consent_share then p_phone else null end
      or existing.consent_email is distinct from p_consent_email
      or existing.consent_share is distinct from p_consent_share
      or ((p_consent_email or p_consent_share) and existing.status = 'unsubscribed')
      or (not p_consent_email and not p_consent_share and existing.status <> 'unsubscribed')
      or exists (
        select 1
        from public.vault_seeker_interest i
        where i.seeker_id = existing.id
          and (
            not p_consent_share
            or i.match_id is distinct from p_match_id
            or not (i.facility_id = any(v_recipient_ids))
          )
      )
      or (
        p_consent_share and exists (
          select 1
          from unnest(v_recipient_ids) as recipient(facility_id)
          where not exists (
            select 1
            from public.vault_seeker_interest i
            where i.seeker_id = existing.id
              and i.match_id = p_match_id
              and i.facility_id = recipient.facility_id
          )
        )
      );

    if v_changed then
      update public.vault_seekers s
      set
        email = case when p_consent_email or p_consent_share then lower(p_email) else null end,
        phone = case when p_consent_email or p_consent_share then p_phone else null end,
        consent_email = p_consent_email,
        consent_share = p_consent_share,
        consent_at = clock_timestamp(),
        status = case
          when not p_consent_email and not p_consent_share then 'unsubscribed'
          when s.status = 'unsubscribed' then 'active'
          else s.status
        end
      where s.id = v_seeker_id;
    end if;
  elsif p_consent_email or p_consent_share then
    insert into public.vault_seekers (
      match_id, email, phone, coverage_status,
      consent_email, consent_share, consent_at, status
    ) values (
      p_match_id, lower(p_email), p_phone, null,
      p_consent_email, p_consent_share, clock_timestamp(), 'active'
    )
    returning id into v_seeker_id;
  else
    -- A repeated "neither" response with no lead row is already complete when
    -- the latest immutable receipts record the same two denials.
    select e.granted into v_latest_email
    from public.vault_consent_events e
    where e.match_id = p_match_id and e.channel = 'email' and e.source = 'intake_handoff'
    order by e.occurred_at desc, e.created_at desc, e.id desc
    limit 1;

    select e.granted into v_latest_share
    from public.vault_consent_events e
    where e.match_id = p_match_id and e.channel = 'share' and e.source = 'intake_handoff'
    order by e.occurred_at desc, e.created_at desc, e.id desc
    limit 1;

    v_changed := v_latest_email is distinct from false or v_latest_share is distinct from false;
  end if;

  if v_seeker_id is not null then
    delete from public.vault_seeker_interest i
    where i.seeker_id = v_seeker_id
      and (
        not p_consent_share
        or i.match_id is distinct from p_match_id
        or not (i.facility_id = any(v_recipient_ids))
      );
    if p_consent_share then
      insert into public.vault_seeker_interest (seeker_id, facility_id, match_id)
      select v_seeker_id, recipient.facility_id, p_match_id
      from unnest(v_recipient_ids) as recipient(facility_id)
      on conflict (seeker_id, facility_id) do nothing;
      select count(*)::integer into v_shared
      from public.vault_seeker_interest i
      where i.seeker_id = v_seeker_id
        and i.match_id = p_match_id
        and i.facility_id = any(v_recipient_ids);
    end if;
  end if;

  if v_changed then
    insert into public.vault_consent_events (
      seeker_id, match_id, channel, granted, source, occurred_at
    ) values
      (v_seeker_id, p_match_id, 'share', p_consent_share, 'intake_handoff', clock_timestamp()),
      (v_seeker_id, p_match_id, 'email', p_consent_email, 'intake_handoff', clock_timestamp());
  end if;

  return query select
    v_seeker_id,
    p_consent_email,
    p_consent_share,
    v_shared,
    not v_changed;
end;
$function$;

revoke all on function public.complete_connector_handoff(uuid, uuid[], text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_connector_handoff(uuid, uuid[], text, text, boolean, boolean)
  to service_role;

-- Administrative privacy requests revoke current access, clear the retained
-- contact, remove every facility interest, and append denial receipts atomically.
create or replace function public.revoke_connector_contact(
  p_seeker_id uuid,
  p_source text default 'admin_revocation'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  current public.vault_seekers%rowtype;
begin
  if p_source not in ('admin_revocation', 'seeker_revocation') then
    raise exception 'Invalid revocation source' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_seeker_id::text, 0));
  select s.* into current
  from public.vault_seekers s
  where s.id = p_seeker_id
  for update;
  if not found then
    raise exception 'Connector contact not found' using errcode = 'P0002';
  end if;

  update public.vault_seekers
  set email = null,
      phone = null,
      consent_email = false,
      consent_share = false,
      consent_at = clock_timestamp(),
      status = 'unsubscribed'
  where id = p_seeker_id;

  delete from public.vault_seeker_interest where seeker_id = p_seeker_id;

  if current.consent_share or current.consent_email or current.email is not null or current.phone is not null then
    insert into public.vault_consent_events (
      seeker_id, match_id, channel, granted, source, occurred_at
    ) values
      (p_seeker_id, current.match_id, 'share', false, p_source, clock_timestamp()),
      (p_seeker_id, current.match_id, 'email', false, p_source, clock_timestamp());
  end if;
end;
$function$;

revoke all on function public.revoke_connector_contact(uuid, text)
  from public, anon, authenticated;
grant execute on function public.revoke_connector_contact(uuid, text) to service_role;

-- Reserve the one requested treatment-information email before calling the
-- external mail provider. The unique row makes retries at-most-once even if a
-- function stops after the provider accepted a message but before status update.
alter table public.vault_email_log
  add column if not exists delivery_status text;

-- A legacy log proves only that an application attempted to record a send; it
-- does not prove provider acceptance. Keep that truth explicit and retain every
-- duplicate audit row without allowing any of them to open a second-send race.
alter table public.vault_email_log
  drop constraint if exists vault_email_log_delivery_status_check;

update public.vault_email_log
set delivery_status = 'legacy_unknown'
where delivery_status is null;

with ranked_legacy as (
  select
    l.id,
    row_number() over (
      partition by l.seeker_id, l.kind
      order by l.sent_at asc nulls last, l.id asc
    ) as occurrence
  from public.vault_email_log l
  where l.seeker_id is not null
    and l.kind = 'treatment_info'
    and l.delivery_status = 'legacy_unknown'
)
update public.vault_email_log l
set delivery_status = 'legacy_duplicate'
from ranked_legacy r
where r.id = l.id and r.occurrence > 1;

alter table public.vault_email_log
  alter column delivery_status set default 'pending',
  alter column delivery_status set not null,
  alter column sent_at drop not null,
  alter column sent_at drop default;

alter table public.vault_email_log
  add constraint vault_email_log_delivery_status_check
    check (delivery_status in (
      'pending', 'sent', 'failed', 'legacy_unknown', 'legacy_duplicate'
    ));

drop index if exists public.idx_vault_email_one_treatment_copy;
create unique index idx_vault_email_one_treatment_copy
  on public.vault_email_log (seeker_id, kind)
  where seeker_id is not null
    and kind = 'treatment_info'
    and delivery_status <> 'legacy_duplicate';

create or replace function public.reserve_treatment_email(
  p_seeker_id uuid,
  p_to_email text
)
returns table(
  email_log_id uuid,
  delivery_status text,
  should_send boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  existing public.vault_email_log%rowtype;
  created_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_seeker_id::text, 1));

  if p_to_email is null
     or length(p_to_email) > 254
     or p_to_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email recipient' using errcode = '22023';
  end if;

  select l.* into existing
  from public.vault_email_log l
  where l.seeker_id = p_seeker_id
    and l.kind = 'treatment_info'
    and l.delivery_status <> 'legacy_duplicate'
  for update;
  if found then
    return query select
      existing.id,
      case
        when lower(existing.to_email) = lower(p_to_email) then existing.delivery_status
        else 'recipient_mismatch'::text
      end,
      false;
    return;
  end if;

  if not exists (
    select 1 from public.vault_seekers s
    where s.id = p_seeker_id
      and s.consent_email
      and s.status in ('active', 'connected')
      and lower(s.email) = lower(p_to_email)
  ) then
    raise exception 'Email delivery is not permitted' using errcode = '42501';
  end if;

  insert into public.vault_email_log (
    seeker_id, kind, to_email, delivery_status, sent_at
  ) values (
    p_seeker_id, 'treatment_info', lower(p_to_email), 'pending', null
  )
  returning id into created_id;

  return query select created_id, 'pending'::text, true;
end;
$function$;

create or replace function public.finish_treatment_email(
  p_email_log_id uuid,
  p_delivery_status text,
  p_provider_id text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_delivery_status not in ('sent', 'failed') then
    raise exception 'Invalid delivery status' using errcode = '22023';
  end if;

  update public.vault_email_log
  set delivery_status = p_delivery_status,
      provider_id = case when p_delivery_status = 'sent' then left(p_provider_id, 500) else null end,
      sent_at = case when p_delivery_status = 'sent' then clock_timestamp() else null end
  where id = p_email_log_id and kind = 'treatment_info' and delivery_status = 'pending';
end;
$function$;

revoke all on function public.reserve_treatment_email(uuid, text)
  from public, anon, authenticated;
revoke all on function public.finish_treatment_email(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_treatment_email(uuid, text) to service_role;
grant execute on function public.finish_treatment_email(uuid, text, text) to service_role;

-- END SOURCE: supabase/project-a/migrations/37_atomic_connector_handoff.sql

-- BEGIN SOURCE: supabase/project-a/migrations/38_enforce_provider_authorization_boundaries.sql

-- P0 authorization boundary: browser roles may read only the rows allowed by RLS,
-- but every sensitive facility mutation crosses a canonical server/RPC boundary.
-- This migration must run after 37_atomic_connector_handoff.sql.
--
-- Rollback (only during an application rollback window):
--   1. Move private.is_admin/is_bd/is_facility_member/facility_is_published/
--      owns_match/is_match_routed_to_me back to schema public.
--   2. Restore the former policies from 02_rls.sql / 08_facility_claims.sql /
--      14_reps.sql and their authenticated table grants; drop the partial
--      facility_claims_one_pending_user_request index only if the old upsert path
--      is also restored with a compatible full unique constraint.
--   3. Drop the four lane triggers, affiliation guard trigger, public status
--      wrapper, private status implementation, and claim-approval RPC.
--   4. Restore archived admin memberships with:
--        insert into public.facility_members (id, facility_id, user_id, role, created_at)
--        select original_member_id, facility_id, user_id, role, membership_created_at
--        from public.provider_lane_membership_archive
--        on conflict (facility_id, user_id) do nothing;
-- Do not restore an archived membership while the exclusivity trigger is installed.

-- Production had one historical admin + facility overlap. Admins already manage
-- facilities through /admin, so preserve the redundant membership for rollback
-- and remove it before installing the invariant.
create table if not exists public.provider_lane_membership_archive (
  original_member_id uuid primary key,
  facility_id uuid not null,
  user_id uuid not null,
  role text not null,
  membership_created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  reason text not null check (reason in ('admin_lane_precedence'))
);

alter table public.provider_lane_membership_archive enable row level security;
revoke all privileges on table public.provider_lane_membership_archive
  from public, anon, authenticated;
grant all privileges on table public.provider_lane_membership_archive to service_role;

-- RLS predicates are implementation details, not public RPCs. Move the existing
-- function OIDs (policy dependencies follow automatically) into a non-exposed
-- schema. Browser roles retain EXECUTE only so PostgreSQL can evaluate policies.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

do $block$
declare
  signature text;
  predicate regprocedure;
begin
  foreach signature in array array[
    'public.is_admin()',
    'public.is_bd()',
    'public.is_facility_member(uuid)',
    'public.facility_is_published(uuid)',
    'public.owns_match(uuid)',
    'public.is_match_routed_to_me(uuid)'
  ]
  loop
    predicate := to_regprocedure(signature);
    if predicate is not null then
      execute format('alter function %s set schema private', predicate);
    end if;
  end loop;
end;
$block$;

revoke execute on function private.is_admin() from public;
revoke execute on function private.is_bd() from public;
revoke execute on function private.is_facility_member(uuid) from public;
revoke execute on function private.facility_is_published(uuid) from public;
revoke execute on function private.owns_match(uuid) from public;
revoke execute on function private.is_match_routed_to_me(uuid) from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_bd() to anon, authenticated, service_role;
grant execute on function private.is_facility_member(uuid) to anon, authenticated, service_role;
grant execute on function private.facility_is_published(uuid) to anon, authenticated, service_role;
grant execute on function private.owns_match(uuid) to anon, authenticated, service_role;
grant execute on function private.is_match_routed_to_me(uuid) to anon, authenticated, service_role;

-- The ubiquitous timestamp trigger has no relation lookups; pinning pg_catalog
-- removes the final mutable-search-path warning without changing behavior.
alter function public.set_updated_at() set search_path = pg_catalog;

insert into public.provider_lane_membership_archive (
  original_member_id, facility_id, user_id, role, membership_created_at, reason
)
select member.id, member.facility_id, member.user_id, member.role,
       member.created_at, 'admin_lane_precedence'
from public.facility_members as member
join public.platform_admins as admin on admin.user_id = member.user_id
on conflict (original_member_id) do nothing;

delete from public.facility_members as member
using public.platform_admins as admin
where admin.user_id = member.user_id;

-- No other lane collision can be resolved automatically without changing the
-- user's product identity. Abort deployment if one appears after this audit.
do $block$
declare
  conflict_count integer;
begin
  with lanes as (
    select auth_user.id,
      exists (select 1 from public.platform_admins a where a.user_id = auth_user.id) as is_admin,
      exists (select 1 from public.facility_members f where f.user_id = auth_user.id) as is_facility,
      exists (select 1 from public.bd_users b where b.user_id = auth_user.id) as is_partner,
      exists (select 1 from public.rep_profiles r where r.user_id = auth_user.id) as is_rep
    from auth.users as auth_user
  )
  select count(*)::integer into conflict_count
  from lanes
  where is_admin::integer + is_facility::integer + is_partner::integer + is_rep::integer > 1;

  if conflict_count > 0 then
    raise exception 'provider lane conflicts require manual review: % user(s)', conflict_count
      using errcode = '23514';
  end if;
end;
$block$;

-- Serialize all lane establishment for one auth user and reject cross-lane
-- inserts even when two service requests race. A facility user may belong to
-- multiple facilities; those rows are one canonical lane.
create or replace function public.enforce_exclusive_provider_lane()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_user_id uuid := new.user_id;
begin
  if target_user_id is null then
    raise exception 'provider lane requires a user' using errcode = '23502';
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'provider lane identity is immutable' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_user_id::text, 38001)
  );

  if tg_table_name <> 'platform_admins'
     and exists (select 1 from public.platform_admins a where a.user_id = target_user_id) then
    raise exception 'user already belongs to the admin lane' using errcode = '23514';
  end if;
  if tg_table_name <> 'facility_members'
     and exists (select 1 from public.facility_members f where f.user_id = target_user_id) then
    raise exception 'user already belongs to the facility lane' using errcode = '23514';
  end if;
  if tg_table_name <> 'bd_users'
     and exists (select 1 from public.bd_users b where b.user_id = target_user_id) then
    raise exception 'user already belongs to the partner lane' using errcode = '23514';
  end if;
  if tg_table_name <> 'rep_profiles'
     and exists (select 1 from public.rep_profiles r where r.user_id = target_user_id) then
    raise exception 'user already belongs to the representative lane' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke execute on function public.enforce_exclusive_provider_lane()
  from public, anon, authenticated;

drop trigger if exists trg_platform_admin_exclusive_lane on public.platform_admins;
create trigger trg_platform_admin_exclusive_lane
  before insert or update on public.platform_admins
  for each row execute function public.enforce_exclusive_provider_lane();

drop trigger if exists trg_facility_member_exclusive_lane on public.facility_members;
create trigger trg_facility_member_exclusive_lane
  before insert or update on public.facility_members
  for each row execute function public.enforce_exclusive_provider_lane();

drop trigger if exists trg_partner_exclusive_lane on public.bd_users;
create trigger trg_partner_exclusive_lane
  before insert or update on public.bd_users
  for each row execute function public.enforce_exclusive_provider_lane();

drop trigger if exists trg_rep_exclusive_lane on public.rep_profiles;
create trigger trg_rep_exclusive_lane
  before insert or update on public.rep_profiles
  for each row execute function public.enforce_exclusive_provider_lane();

-- Affiliation identity is immutable and every new request begins pending. The
-- status-only RPC below is the sole browser-callable verification path.
create or replace function public.enforce_facility_affiliation_integrity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'new affiliations must be pending' using errcode = '23514';
    end if;
  elsif old.id is distinct from new.id
     or old.user_id is distinct from new.user_id
     or old.facility_id is distinct from new.facility_id
     or old.invited_by is distinct from new.invited_by
     or old.created_at is distinct from new.created_at then
    raise exception 'affiliation identity is immutable' using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_facility_affiliation_integrity()
  from public, anon, authenticated;

drop trigger if exists trg_affiliation_integrity on public.facility_affiliations;
create trigger trg_affiliation_integrity
  before insert or update on public.facility_affiliations
  for each row execute function public.enforce_facility_affiliation_integrity();

-- Remove every broad browser write policy on directory/control tables. Select
-- policies remain intact so each signed-in lane can render its own workspace.
drop policy if exists facilities_insert on public.facilities;
drop policy if exists facilities_update on public.facilities;
drop policy if exists facilities_delete on public.facilities;
drop policy if exists facility_members_write on public.facility_members;
drop policy if exists facility_payers_write on public.facility_payers;
drop policy if exists facility_capacity_write on public.facility_capacity;
drop policy if exists match_routes_update on public.match_routes;
drop policy if exists match_routes_insert on public.match_routes;
drop policy if exists matches_insert on public.matches;
drop policy if exists matches_update on public.matches;
drop policy if exists affiliations_insert on public.facility_affiliations;
drop policy if exists affiliations_update on public.facility_affiliations;
drop policy if exists affiliations_delete on public.facility_affiliations;
drop policy if exists bd_users_upsert on public.bd_users;
drop policy if exists rep_profiles_insert on public.rep_profiles;
drop policy if exists claims_admin_update on public.facility_claims;

-- A self-filed claim is only a pending review request. A browser can never
-- manufacture an approved claim and unlock a full public profile.
drop policy if exists claims_insert_own on public.facility_claims;
create policy claims_insert_own on public.facility_claims
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and facility_id is not null
    and status = 'pending'
  );

-- The public-claim migration intentionally removed the old nullable full-table
-- unique constraint. Restore idempotency only for signed-in pending requests;
-- rejected/approved history and account-less public claims remain append-only.
create unique index if not exists facility_claims_one_pending_user_request
  on public.facility_claims (user_id, facility_id)
  where status = 'pending' and user_id is not null and facility_id is not null;

-- Cache auth.uid() and no-argument role predicates once per statement instead
-- of once per candidate row. Restrict every workspace policy to authenticated
-- explicitly; anonymous public pages use controlled server-side directory DTOs.
drop policy if exists admins_select on public.platform_admins;
create policy admins_select on public.platform_admins
  for select to authenticated
  using ((select private.is_admin()));

drop policy if exists facilities_select on public.facilities;
create policy facilities_select on public.facilities
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(id)
    or (is_published and (select auth.uid()) is not null)
  );

drop policy if exists facility_members_select on public.facility_members;
create policy facility_members_select on public.facility_members
  for select to authenticated
  using (
    (select private.is_admin())
    or user_id = (select auth.uid())
    or private.is_facility_member(facility_id)
  );

drop policy if exists facility_payers_select on public.facility_payers;
create policy facility_payers_select on public.facility_payers
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(facility_id)
    or private.facility_is_published(facility_id)
  );

drop policy if exists facility_capacity_select on public.facility_capacity;
create policy facility_capacity_select on public.facility_capacity
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(facility_id)
    or private.facility_is_published(facility_id)
  );

drop policy if exists bd_users_select on public.bd_users;
create policy bd_users_select on public.bd_users
  for select to authenticated
  using ((select private.is_admin()) or user_id = (select auth.uid()));

drop policy if exists bd_users_update on public.bd_users;
create policy bd_users_update on public.bd_users
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists bd_notes_all on public.bd_facility_notes;
create policy bd_notes_all on public.bd_facility_notes
  for all to authenticated
  using ((select private.is_admin()) or bd_user_id = (select auth.uid()))
  with check (bd_user_id = (select auth.uid()));

drop policy if exists bd_saved_all on public.bd_saved_facilities;
create policy bd_saved_all on public.bd_saved_facilities
  for all to authenticated
  using ((select private.is_admin()) or bd_user_id = (select auth.uid()))
  with check (bd_user_id = (select auth.uid()));

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to authenticated
  using (
    (select private.is_admin())
    or private.owns_match(id)
    or private.is_match_routed_to_me(id)
  );

drop policy if exists match_routes_select on public.match_routes;
create policy match_routes_select on public.match_routes
  for select to authenticated
  using (
    (select private.is_admin())
    or private.is_facility_member(facility_id)
    or private.owns_match(match_id)
  );

drop policy if exists claims_select on public.facility_claims;
create policy claims_select on public.facility_claims
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists partner_lists_all on public.partner_lists;
create policy partner_lists_all on public.partner_lists
  for all to authenticated
  using ((select private.is_admin()) or owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists partner_list_items_all on public.partner_list_items;
create policy partner_list_items_all on public.partner_list_items
  for all to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.partner_lists list
      where list.id = partner_list_items.list_id
        and list.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.partner_lists list
      where list.id = partner_list_items.list_id
        and list.owner_id = (select auth.uid())
    )
  );

drop policy if exists partner_history_all on public.partner_view_history;
create policy partner_history_all on public.partner_view_history
  for all to authenticated
  using ((select private.is_admin()) or user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists rep_profiles_select on public.rep_profiles;
create policy rep_profiles_select on public.rep_profiles
  for select to authenticated
  using (is_public or user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists rep_profiles_update on public.rep_profiles;
create policy rep_profiles_update on public.rep_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists affiliations_select on public.facility_affiliations;
create policy affiliations_select on public.facility_affiliations
  for select to authenticated
  using (
    (select private.is_admin())
    or user_id = (select auth.uid())
    or private.is_facility_member(facility_id)
  );

drop policy if exists rep_invites_select on public.rep_invites;
create policy rep_invites_select on public.rep_invites
  for select to authenticated
  using ((select private.is_admin()) or inviter_id = (select auth.uid()));

drop policy if exists rep_invites_insert on public.rep_invites;
create policy rep_invites_insert on public.rep_invites
  for insert to authenticated
  with check (inviter_id = (select auth.uid()));

drop policy if exists rep_invites_delete on public.rep_invites;
create policy rep_invites_delete on public.rep_invites
  for delete to authenticated
  using ((select private.is_admin()) or inviter_id = (select auth.uid()));

-- Grants are the first Data API boundary; RLS remains defense in depth for reads.
revoke all privileges on table
  public.facilities,
  public.facility_members,
  public.facility_payers,
  public.facility_capacity,
  public.matches,
  public.match_routes,
  public.facility_affiliations,
  public.platform_admins,
  public.bd_users,
  public.rep_profiles,
  public.facility_claims
from public, anon;

revoke insert, update, delete, truncate, references, trigger on table
  public.facilities,
  public.facility_members,
  public.facility_payers,
  public.facility_capacity,
  public.matches,
  public.match_routes,
  public.facility_affiliations,
  public.platform_admins
from authenticated;

revoke insert, delete, truncate, references, trigger on table
  public.bd_users,
  public.rep_profiles
from authenticated;

revoke update, delete, truncate, references, trigger on table public.facility_claims
from authenticated;

grant select on table
  public.facilities,
  public.facility_members,
  public.facility_payers,
  public.facility_capacity,
  public.matches,
  public.match_routes,
  public.facility_affiliations,
  public.platform_admins,
  public.bd_users,
  public.rep_profiles,
  public.facility_claims
to authenticated;
grant update on table public.bd_users, public.rep_profiles to authenticated;
grant insert on table public.facility_claims to authenticated;

-- A representative cannot verify themself. This RPC changes status only after
-- proving that the caller is either a platform admin or a canonical owner of the
-- exact facility. Core affiliation fields cannot be changed by this operation.
create or replace function private.set_facility_affiliation_status(
  p_affiliation_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_user_id uuid := auth.uid();
  target_facility_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'invalid affiliation status' using errcode = '22023';
  end if;

  select affiliation.facility_id into target_facility_id
  from public.facility_affiliations as affiliation
  where affiliation.id = p_affiliation_id
  for update;
  if not found then
    raise exception 'affiliation not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.platform_admins admin where admin.user_id = actor_user_id
  ) and not exists (
    select 1
    from public.facility_members member
    where member.user_id = actor_user_id
      and member.facility_id = target_facility_id
      and member.role = 'owner'
  ) then
    raise exception 'only a facility owner or administrator can change affiliation status'
      using errcode = '42501';
  end if;

  update public.facility_affiliations
  set status = p_status
  where id = p_affiliation_id;

  return target_facility_id;
end;
$function$;

revoke execute on function private.set_facility_affiliation_status(uuid, text)
  from public;
grant execute on function private.set_facility_affiliation_status(uuid, text)
  to authenticated, service_role;

-- PostgREST exposes this invoker wrapper, not the privileged implementation.
-- The private function still checks auth.uid() and exact owner/admin membership.
create or replace function public.set_facility_affiliation_status(
  p_affiliation_id uuid,
  p_status text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.set_facility_affiliation_status(p_affiliation_id, p_status);
$function$;

revoke execute on function public.set_facility_affiliation_status(uuid, text)
  from public, anon;
grant execute on function public.set_facility_affiliation_status(uuid, text)
  to authenticated, service_role;

-- Approve + link a claim in one transaction. The service action creates or finds
-- the Auth account first, then this RPC validates the exact identity, rejects a
-- cross-lane takeover, grants owner membership, and marks the claim approved.
create or replace function public.approve_facility_claim(
  p_claim_id uuid,
  p_user_id uuid
)
returns table(
  approved_claim_id uuid,
  approved_user_id uuid,
  approved_facility_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  claim_row public.facility_claims%rowtype;
  auth_email text;
begin
  if p_claim_id is null or p_user_id is null then
    raise exception 'claim and user are required' using errcode = '22023';
  end if;

  select claim.* into claim_row
  from public.facility_claims as claim
  where claim.id = p_claim_id
  for update;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if claim_row.facility_id is null then
    raise exception 'claim must be linked to a facility before approval'
      using errcode = '23502';
  end if;
  if claim_row.status = 'rejected' then
    raise exception 'a rejected claim cannot be approved' using errcode = '23514';
  end if;
  if claim_row.status = 'approved'
     and claim_row.user_id is distinct from p_user_id then
    raise exception 'approved claim identity is immutable' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 38001)
  );

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email)) into auth_email
  from auth.users as auth_user
  where auth_user.id = p_user_id;
  if not found or auth_email is null then
    raise exception 'provider auth account not found' using errcode = '23503';
  end if;

  if claim_row.user_id is not null and claim_row.user_id <> p_user_id then
    raise exception 'claim belongs to a different auth account' using errcode = '23514';
  end if;
  if claim_row.status <> 'approved'
     and claim_row.user_id is null
     and claim_row.claimant_email is null then
    raise exception 'claim has no verifiable identity' using errcode = '23514';
  end if;
  if claim_row.status <> 'approved'
     and claim_row.claimant_email is not null
     and pg_catalog.lower(pg_catalog.btrim(claim_row.claimant_email)) <> auth_email then
    raise exception 'claim email does not match the auth account' using errcode = '23514';
  end if;

  if exists (select 1 from public.platform_admins a where a.user_id = p_user_id)
     or exists (select 1 from public.bd_users b where b.user_id = p_user_id)
     or exists (select 1 from public.rep_profiles r where r.user_id = p_user_id) then
    raise exception 'claim approval would cross canonical provider lanes'
      using errcode = '23514';
  end if;

  insert into public.facility_members (facility_id, user_id, role)
  values (claim_row.facility_id, p_user_id, 'owner')
  on conflict (facility_id, user_id)
  do update set role = 'owner';

  update public.facility_claims
  set status = 'approved', user_id = p_user_id
  where id = p_claim_id;

  return query select p_claim_id, p_user_id, claim_row.facility_id;
end;
$function$;

revoke execute on function public.approve_facility_claim(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.approve_facility_claim(uuid, uuid) to service_role;

comment on function public.approve_facility_claim(uuid, uuid) is
  'Service-only atomic ownership claim approval; validates Auth identity and canonical provider lane.';

-- END SOURCE: supabase/project-a/migrations/38_enforce_provider_authorization_boundaries.sql

-- BEGIN SOURCE: supabase/project-a/migrations/39_harden_media_storage.sql

-- Keep public facility/representative media consistent across Postgres and
-- Storage. Application uploads use the service role, but gallery mutations are
-- serialized here so concurrent requests cannot lose an append or exceed a cap.

-- Production already has this column; the repository's historical migration
-- chain did not. Reconcile clean environments before creating the RPCs.
alter table public.facilities
  add column if not exists videos text[] not null default '{}'::text[];

alter table public.facilities
  drop constraint if exists facilities_images_limit,
  add constraint facilities_images_limit check (cardinality(images) <= 10),
  drop constraint if exists facilities_videos_limit,
  add constraint facilities_videos_limit check (cardinality(videos) <= 5);

create or replace function public.append_facility_media_url(
  p_facility_id uuid,
  p_kind text,
  p_url text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_images text[];
  current_videos text[];
  next_count integer;
begin
  if p_kind not in ('photo', 'video') then
    raise exception 'unsupported facility media kind' using errcode = '22023';
  end if;
  if p_url is null or length(p_url) = 0 or length(p_url) > 2048 then
    raise exception 'invalid facility media URL' using errcode = '22023';
  end if;

  select coalesce(facility.images, '{}'::text[]),
         coalesce(facility.videos, '{}'::text[])
    into current_images, current_videos
  from public.facilities as facility
  where facility.id = p_facility_id
  for update;

  if not found then
    raise exception 'facility not found' using errcode = 'P0002';
  end if;

  if p_kind = 'photo' then
    if p_url = any(current_images) then
      return cardinality(current_images);
    end if;
    if cardinality(current_images) >= 10 then
      raise exception 'facility photo limit reached' using errcode = '23514';
    end if;
    update public.facilities
      set images = array_append(current_images, p_url)
      where id = p_facility_id;
    next_count := cardinality(current_images) + 1;
  else
    if p_url = any(current_videos) then
      return cardinality(current_videos);
    end if;
    if cardinality(current_videos) >= 5 then
      raise exception 'facility video limit reached' using errcode = '23514';
    end if;
    update public.facilities
      set videos = array_append(current_videos, p_url)
      where id = p_facility_id;
    next_count := cardinality(current_videos) + 1;
  end if;

  return next_count;
end;
$function$;

create or replace function public.remove_facility_media_url(
  p_facility_id uuid,
  p_kind text,
  p_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_images text[];
  current_videos text[];
begin
  if p_kind not in ('photo', 'video') or p_url is null or length(p_url) = 0 then
    raise exception 'invalid facility media removal' using errcode = '22023';
  end if;

  select coalesce(facility.images, '{}'::text[]),
         coalesce(facility.videos, '{}'::text[])
    into current_images, current_videos
  from public.facilities as facility
  where facility.id = p_facility_id
  for update;

  if not found then
    raise exception 'facility not found' using errcode = 'P0002';
  end if;

  if p_kind = 'photo' then
    if not (p_url = any(current_images)) then return false; end if;
    update public.facilities
      set images = array_remove(current_images, p_url)
      where id = p_facility_id;
  else
    if not (p_url = any(current_videos)) then return false; end if;
    update public.facilities
      set videos = array_remove(current_videos, p_url)
      where id = p_facility_id;
  end if;

  return true;
end;
$function$;

-- Compare-and-swap prevents two simultaneous representative saves from both
-- replacing the same headshot and orphaning the earlier upload.
create or replace function public.swap_rep_profile_photo(
  p_user_id uuid,
  p_expected_url text,
  p_new_url text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  previous_url text;
begin
  if p_new_url is not null and (length(p_new_url) = 0 or length(p_new_url) > 2048) then
    raise exception 'invalid representative photo URL' using errcode = '22023';
  end if;

  select profile.photo_url into previous_url
  from public.rep_profiles as profile
  where profile.user_id = p_user_id
  for update;

  if not found then
    raise exception 'representative profile not found' using errcode = 'P0002';
  end if;
  if previous_url is distinct from p_expected_url then
    raise exception 'representative photo changed concurrently' using errcode = '40001';
  end if;

  update public.rep_profiles
    set photo_url = p_new_url
    where user_id = p_user_id;

  return previous_url;
end;
$function$;

revoke execute on function public.append_facility_media_url(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.remove_facility_media_url(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.swap_rep_profile_photo(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.append_facility_media_url(uuid, text, text) to service_role;
grant execute on function public.remove_facility_media_url(uuid, text, text) to service_role;
grant execute on function public.swap_rep_profile_photo(uuid, text, text) to service_role;

comment on function public.append_facility_media_url(uuid, text, text) is
  'Service-only, row-locked facility gallery append with hard item caps.';
comment on function public.remove_facility_media_url(uuid, text, text) is
  'Service-only, row-locked facility gallery removal.';
comment on function public.swap_rep_profile_photo(uuid, text, text) is
  'Service-only compare-and-swap for a representative headshot URL.';

-- Bucket restrictions are defense in depth behind byte-signature validation in
-- the application. Dynamic SQL keeps clean Postgres-only test environments valid
-- when the hosted Storage schema is unavailable.
do $block$
begin
  if to_regclass('storage.buckets') is not null then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values
        ('facility-photos', 'facility-photos', true, 8000000,
          array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]),
        ('facility-videos', 'facility-videos', true, 25000000,
          array['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']::text[]),
        ('rep-photos', 'rep-photos', true, 4000000,
          array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[])
      on conflict (id) do update
        set name = excluded.name,
            public = excluded.public,
            file_size_limit = excluded.file_size_limit,
            allowed_mime_types = excluded.allowed_mime_types
    $sql$;
  end if;
end;
$block$;

-- END SOURCE: supabase/project-a/migrations/39_harden_media_storage.sql

-- BEGIN SOURCE: supabase/project-a/migrations/40_protect_anonymous_workflows.sql

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

-- END SOURCE: supabase/project-a/migrations/40_protect_anonymous_workflows.sql

-- BEGIN SOURCE: supabase/project-a/migrations/41_restore_facility_events_history.sql

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

-- END SOURCE: supabase/project-a/migrations/41_restore_facility_events_history.sql

-- BEGIN SOURCE: supabase/project-a/migrations/42_redact_outbound_referrer_urls.sql

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

-- END SOURCE: supabase/project-a/migrations/42_redact_outbound_referrer_urls.sql

-- BEGIN SOURCE: supabase/project-a/migrations/43_provider_reliability_transactions.sql

-- Make provider workspace mutations fail closed and commit as one unit.
-- Authentication/tenant authorization remains in the Next.js server action;
-- these Data API functions are executable only by the server-side service role.

create or replace function public.set_provider_lead_status(
  p_route_id uuid,
  p_facility_id uuid,
  p_status text
)
returns table(
  updated_route_id uuid,
  updated_match_id uuid,
  route_status text,
  match_status text,
  connected_seeker_count integer
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  route_row public.match_routes%rowtype;
  current_match_status text;
  seeker_count integer := 0;
begin
  if p_route_id is null or p_facility_id is null then
    raise exception 'route and facility are required' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('sent', 'viewed', 'accepted', 'declined') then
    raise exception 'invalid lead status' using errcode = '22023';
  end if;

  -- Lock and mutate the exact tenant-scoped route. A stale/forged route id must
  -- never be reported as success merely because an UPDATE affected zero rows.
  select route.* into route_row
  from public.match_routes as route
  where route.id = p_route_id
    and route.facility_id = p_facility_id
  for update;
  if not found then
    raise exception 'lead route not found for facility' using errcode = 'P0002';
  end if;

  update public.match_routes as route
  set status = p_status
  where route.id = route_row.id
    and route.facility_id = p_facility_id
  returning route.* into route_row;
  if not found then
    raise exception 'lead route was not updated' using errcode = 'P0002';
  end if;

  if p_status = 'accepted' then
    -- An acceptance advances open/routed matches, but closed/connected matches
    -- are terminal or already advanced and must never be downgraded.
    update public.matches as match
    set status = case
      when match.status in ('open', 'routed') then 'connected'
      else match.status
    end
    where match.id = route_row.match_id
    returning match.status into current_match_status;
    if not found then
      raise exception 'lead match not found' using errcode = 'P0002';
    end if;

    -- Only a still-active connector record with an explicit current permission
    -- advances. Revoked/unsubscribed records remain revoked; connected records
    -- remain connected. No contact identifier is returned to the caller.
    update public.vault_seekers as seeker
    set status = 'connected'
    where seeker.match_id = route_row.match_id
      and seeker.status = 'active'
      and seeker.consent_share;
    get diagnostics seeker_count = row_count;
  else
    select match.status into current_match_status
    from public.matches as match
    where match.id = route_row.match_id;
    if not found then
      raise exception 'lead match not found' using errcode = 'P0002';
    end if;
  end if;

  return query select
    route_row.id,
    route_row.match_id,
    route_row.status,
    current_match_status,
    seeker_count;
end;
$function$;

create or replace function public.replace_facility_insurance(
  p_facility_id uuid,
  p_payer_types text[],
  p_carriers_named text[]
)
returns table(
  updated_facility_id uuid,
  payer_count integer,
  carrier_count integer
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  locked_facility_id uuid;
  normalized_payers text[] := '{}'::text[];
  normalized_carriers text[] := '{}'::text[];
begin
  if p_facility_id is null then
    raise exception 'facility is required' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(coalesce(p_payer_types, '{}'::text[])) > 5 then
    raise exception 'too many payer categories' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(coalesce(p_carriers_named, '{}'::text[])) > 50 then
    raise exception 'too many named carriers' using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(coalesce(p_payer_types, '{}'::text[])) as listed(payer_type)
    where listed.payer_type is null
  ) or exists (
    select 1
    from pg_catalog.unnest(coalesce(p_carriers_named, '{}'::text[])) as listed(carrier)
    where listed.carrier is null
      or pg_catalog.length(pg_catalog.btrim(listed.carrier)) = 0
      or pg_catalog.length(pg_catalog.btrim(listed.carrier)) > 120
  ) then
    raise exception 'invalid insurance option' using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(normalized.payer_type order by normalized.payer_type),
    '{}'::text[]
  ) into normalized_payers
  from (
    select distinct pg_catalog.lower(pg_catalog.btrim(listed.payer_type)) as payer_type
    from pg_catalog.unnest(coalesce(p_payer_types, '{}'::text[])) as listed(payer_type)
  ) as normalized;

  if exists (
    select 1
    from pg_catalog.unnest(normalized_payers) as listed(payer_type)
    where listed.payer_type not in ('medicaid', 'medicare', 'commercial', 'tricare', 'self_pay')
  ) then
    raise exception 'invalid payer category' using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(normalized.carrier order by normalized.carrier),
    '{}'::text[]
  ) into normalized_carriers
  from (
    select distinct pg_catalog.btrim(listed.carrier) as carrier
    from pg_catalog.unnest(coalesce(p_carriers_named, '{}'::text[])) as listed(carrier)
  ) as normalized;

  -- Serialize both the child-row replacement and parent-array update on the
  -- facility. Any later statement error rolls the deletion back automatically.
  select facility.id into locked_facility_id
  from public.facilities as facility
  where facility.id = p_facility_id
  for update;
  if not found then
    raise exception 'facility not found' using errcode = 'P0002';
  end if;

  delete from public.facility_payers as payer
  where payer.facility_id = locked_facility_id;

  insert into public.facility_payers (
    facility_id,
    payer_type,
    in_network,
    verification_confidence,
    source_url
  )
  select
    locked_facility_id,
    listed.payer_type,
    false,
    'low',
    null
  from pg_catalog.unnest(normalized_payers) as listed(payer_type);

  update public.facilities as facility
  set carriers_named = normalized_carriers,
      updated_at = pg_catalog.clock_timestamp()
  where facility.id = locked_facility_id;
  if not found then
    raise exception 'facility insurance was not updated' using errcode = 'P0002';
  end if;

  return query select
    locked_facility_id,
    pg_catalog.cardinality(normalized_payers),
    pg_catalog.cardinality(normalized_carriers);
end;
$function$;

revoke all on function public.set_provider_lead_status(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.replace_facility_insurance(uuid, text[], text[])
  from public, anon, authenticated;
grant execute on function public.set_provider_lead_status(uuid, uuid, text)
  to service_role;
grant execute on function public.replace_facility_insurance(uuid, text[], text[])
  to service_role;

comment on function public.set_provider_lead_status(uuid, uuid, text) is
  'Service-only exact-route lead transition with atomic, monotonic match and consented connector advancement.';
comment on function public.replace_facility_insurance(uuid, text[], text[]) is
  'Service-only atomic replacement of program-reported payer categories and named carriers.';

-- END SOURCE: supabase/project-a/migrations/43_provider_reliability_transactions.sql


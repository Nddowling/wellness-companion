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

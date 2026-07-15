-- Lint 0028/0029: SECURITY DEFINER functions were callable by anon/authenticated via
-- /rest/v1/rpc — including clearbed_add_text_columns (ALTERs tables) and the staging
-- pipeline runners. Revoke EXECUTE from the public web roles. These are only invoked by
-- the service_role (app, lead engine) and by triggers (which run as the table owner and
-- are unaffected by EXECUTE grants).
--
-- Deliberately NOT revoked: is_admin(), is_bd(), is_facility_member(), owns_match(),
-- is_match_routed_to_me(), facility_is_published() — these are referenced inside RLS
-- policies and must remain executable by anon/authenticated or the policies break.

-- Historical clean-chain repair: several administrative functions were created
-- directly in the hosted database. Revoke every function that exists without
-- making a fresh schema depend on an untracked object.
do $$
begin
  if to_regprocedure('public.clearbed_add_text_columns(regclass,text[])') is not null then
    revoke execute on function public.clearbed_add_text_columns(regclass, text[]) from anon, authenticated;
  end if;
  if to_regprocedure('public.merge_ready_staging_facilities(integer)') is not null then
    revoke execute on function public.merge_ready_staging_facilities(integer) from anon, authenticated;
  end if;
  if to_regprocedure('public.refresh_staging_quality_scores()') is not null then
    revoke execute on function public.refresh_staging_quality_scores() from anon, authenticated;
  end if;
  if to_regprocedure('public.mark_staging_duplicate_candidates()') is not null then
    revoke execute on function public.mark_staging_duplicate_candidates() from anon, authenticated;
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
  if to_regprocedure('public.bump_facility_updated_at()') is not null then
    revoke execute on function public.bump_facility_updated_at() from anon, authenticated;
  end if;
  if to_regprocedure('public.revalidate_facility()') is not null then
    revoke execute on function public.revalidate_facility() from anon, authenticated;
  end if;
end;
$$;

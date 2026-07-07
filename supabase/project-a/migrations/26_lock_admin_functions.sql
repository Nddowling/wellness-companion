-- Lint 0028/0029: SECURITY DEFINER functions were callable by anon/authenticated via
-- /rest/v1/rpc — including clearbed_add_text_columns (ALTERs tables) and the staging
-- pipeline runners. Revoke EXECUTE from the public web roles. These are only invoked by
-- the service_role (app, lead engine) and by triggers (which run as the table owner and
-- are unaffected by EXECUTE grants).
--
-- Deliberately NOT revoked: is_admin(), is_bd(), is_facility_member(), owns_match(),
-- is_match_routed_to_me(), facility_is_published() — these are referenced inside RLS
-- policies and must remain executable by anon/authenticated or the policies break.

revoke execute on function public.clearbed_add_text_columns(regclass, text[]) from anon, authenticated;
revoke execute on function public.merge_ready_staging_facilities(integer)      from anon, authenticated;
revoke execute on function public.refresh_staging_quality_scores()             from anon, authenticated;
revoke execute on function public.mark_staging_duplicate_candidates()          from anon, authenticated;
revoke execute on function public.rls_auto_enable()                            from anon, authenticated;
revoke execute on function public.bump_facility_updated_at()                   from anon, authenticated;
revoke execute on function public.revalidate_facility()                        from anon, authenticated;

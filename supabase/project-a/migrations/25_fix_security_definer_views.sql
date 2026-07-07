-- Fix Supabase lint 0010_security_definer_view (3 CRITICAL findings).
--
-- public_basic_directory, public_paid_profile_directory, and v_outreach_ready were all
-- SECURITY DEFINER views: queries ran with the view creator's privileges, bypassing RLS
-- on the base tables and reachable through the anon Data API. None are used by the app
-- (the site reads `facilities` directly via the service role; the lead engine reads
-- v_outreach_ready via the service role too).
--
-- Fix: make all three respect the caller's RLS (security_invoker), and fully close the
-- outreach view — it exposes decision-maker PII (best_contact_name/email/phone) plus the
-- lead score/stage pipeline and must never be reachable by anon/authenticated.

alter view public.public_basic_directory        set (security_invoker = true);
alter view public.public_paid_profile_directory set (security_invoker = true);
alter view public.v_outreach_ready              set (security_invoker = true);

-- Sensitive lead/outreach view — remove all Data-API access (service_role still reads it).
revoke all on public.v_outreach_ready from anon, authenticated;

-- Public directory views hold only published marketing data; drop the default over-broad
-- write grants but keep SELECT (RLS on the base tables now governs which rows are visible).
revoke insert, update, delete, truncate, references, trigger
  on public.public_basic_directory, public.public_paid_profile_directory
  from anon, authenticated;

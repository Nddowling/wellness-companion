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

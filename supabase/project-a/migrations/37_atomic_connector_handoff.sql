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

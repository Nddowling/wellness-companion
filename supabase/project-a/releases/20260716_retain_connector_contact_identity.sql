-- Retain the minimal contact identity needed for a consented connector lead:
-- name, email, and phone. Continue scrubbing address/clinical/insurance fields.
--
-- The v2 RPC intentionally uses a new name so the database can be migrated before
-- the application without breaking the currently deployed v1 handoff during rollout.

create or replace function public.scrub_retired_seeker_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  -- Carrier/member information is not part of a connector contact record.
  new.insurance := null;

  -- Contact details are retained only with an affirmative connection or email-copy
  -- choice. Email-only permission does not justify retaining a phone number.
  if not coalesce(new.consent_share, false) and not coalesce(new.consent_email, false) then
    new.name := null;
    new.email := null;
    new.phone := null;
  elsif not coalesce(new.consent_share, false) then
    new.phone := null;
  end if;
  return new;
end;
$function$;

revoke all on function public.scrub_retired_seeker_fields()
  from public, anon, authenticated;

create or replace function public.complete_connector_handoff_v2(
  p_match_id uuid,
  p_recipient_facility_ids uuid[],
  p_name text,
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
  v_name text := nullif(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'), '');
  v_email text := nullif(lower(btrim(p_email)), '');
  v_phone text := nullif(btrim(p_phone), '');
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
  if not p_consent_email and not p_consent_share
     and (v_name is not null or v_email is not null or v_phone is not null) then
    raise exception 'Contact details require an affirmative permission' using errcode = '22023';
  end if;
  if (p_consent_email or p_consent_share)
     and (v_name is null or length(v_name) > 120 or p_name ~ '[[:cntrl:]]') then
    raise exception 'Invalid contact name' using errcode = '22023';
  end if;
  if (p_consent_email or p_consent_share)
     and (v_email is null or length(v_email) > 254
       or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;
  if p_consent_share
     and (v_phone is null or length(v_phone) > 50
       or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15) then
    raise exception 'Invalid phone number' using errcode = '22023';
  end if;
  if not p_consent_share and v_phone is not null then
    raise exception 'Phone retention requires program-sharing permission' using errcode = '22023';
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

  -- Serialize all contact and consent decisions for one match, including retries.
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

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
      existing.name is distinct from case
        when p_consent_email or p_consent_share then v_name
        else null
      end
      or existing.email is distinct from case
        when p_consent_email or p_consent_share then v_email
        else null
      end
      or existing.phone is distinct from case when p_consent_share then v_phone else null end
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
        name = case when p_consent_email or p_consent_share then v_name else null end,
        email = case when p_consent_email or p_consent_share then v_email else null end,
        phone = case when p_consent_share then v_phone else null end,
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
      match_id, name, email, phone, coverage_status,
      consent_email, consent_share, consent_at, status
    ) values (
      p_match_id, v_name, v_email, case when p_consent_share then v_phone else null end, null,
      p_consent_email, p_consent_share, clock_timestamp(), 'active'
    )
    returning id into v_seeker_id;
  else
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
      on conflict on constraint vault_seeker_interest_seeker_id_facility_id_key do nothing;
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

revoke all on function public.complete_connector_handoff_v2(uuid, uuid[], text, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_connector_handoff_v2(uuid, uuid[], text, text, text, boolean, boolean)
  to service_role;

-- Privacy revocation must clear the newly retained name as well as both channels.
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
  set name = null,
      email = null,
      phone = null,
      consent_email = false,
      consent_share = false,
      consent_at = clock_timestamp(),
      status = 'unsubscribed'
  where id = p_seeker_id;

  delete from public.vault_seeker_interest where seeker_id = p_seeker_id;

  if current.name is not null
     or current.email is not null
     or current.phone is not null
     or current.consent_share
     or current.consent_email then
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

-- A hard-delete privacy request must not orphan the email address in the delivery
-- log. The current table contains only connector delivery audit rows.
alter table public.vault_email_log
  drop constraint if exists vault_email_log_seeker_id_fkey;
alter table public.vault_email_log
  add constraint vault_email_log_seeker_id_fkey
  foreign key (seeker_id) references public.vault_seekers(id) on delete cascade;

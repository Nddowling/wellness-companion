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

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

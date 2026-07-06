-- On-demand ISR revalidation for facility profiles. Applied directly (not via this
-- file) so the shared secret stays out of the repo — the live trigger carries the real
-- REVALIDATE_SECRET in its net.http_post headers; here it's a placeholder.
--
--   facility_capacity change ─▶ bump parent facilities.updated_at ─▶
--   facilities UPDATE ─▶ net.http_post → https://clearbedrecovery.com/api/revalidate
--   ─▶ revalidatePath(profile + city hub)   (sub-60s; also covers bed changes)

create or replace function public.bump_facility_updated_at()
returns trigger language plpgsql security definer as $fn$
declare fid uuid;
begin
  fid := coalesce(NEW.facility_id, OLD.facility_id);
  if fid is not null then
    update public.facilities set updated_at = now() where id = fid;
  end if;
  return coalesce(NEW, OLD);
end;
$fn$;

drop trigger if exists trg_capacity_bump_parent on public.facility_capacity;
create trigger trg_capacity_bump_parent
after insert or update or delete on public.facility_capacity
for each row execute function public.bump_facility_updated_at();

create or replace function public.revalidate_facility()
returns trigger language plpgsql security definer as $fn$
begin
  if NEW.is_published and NEW.slug is not null then
    perform net.http_post(
      url := 'https://clearbedrecovery.com/api/revalidate',
      body := jsonb_build_object('record', jsonb_build_object('id', NEW.id, 'slug', NEW.slug, 'city', NEW.city, 'state', NEW.state)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-revalidate-secret', 'REVALIDATE_SECRET_PLACEHOLDER')
    );
  end if;
  return NEW;
end;
$fn$;

drop trigger if exists trg_facilities_revalidate on public.facilities;
create trigger trg_facilities_revalidate
after update on public.facilities
for each row execute function public.revalidate_facility();

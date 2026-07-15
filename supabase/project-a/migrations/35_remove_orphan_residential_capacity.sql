-- Residential capacity is meaningful only while a facility explicitly lists
-- residential care. Remove historical orphan rows and keep future level changes
-- from leaving a seven-day public bed signal behind.

delete from public.facility_capacity as capacity
using public.facilities as facility
where capacity.facility_id = facility.id
  and capacity.level_of_care = 'residential'
  and not ('residential' = any(coalesce(facility.levels_of_care, '{}'::text[])));

create or replace function public.remove_undeclared_residential_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if not ('residential' = any(coalesce(new.levels_of_care, '{}'::text[]))) then
    delete from public.facility_capacity
    where facility_id = new.id
      and level_of_care = 'residential';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_remove_undeclared_residential_capacity on public.facilities;
create trigger trg_remove_undeclared_residential_capacity
after insert or update of levels_of_care on public.facilities
for each row execute function public.remove_undeclared_residential_capacity();

revoke all on function public.remove_undeclared_residential_capacity() from public, anon, authenticated;
grant execute on function public.remove_undeclared_residential_capacity() to service_role;

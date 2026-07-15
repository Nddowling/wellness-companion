-- Normalize source-model fields that were stronger than their evidence.
--
-- 1. `facility_payers` means a program lists a payment category. It cannot establish
--    member-specific network status, so new and existing rows default to false.
-- 2. Detox remains a valid service category. Because existing capacity rows do not
--    encode outpatient/residential/hospital setting, migration 29 excludes detox
--    from the `open` bed facet instead of deleting or reclassifying source evidence.

alter table public.facility_payers
  alter column in_network set default false;

update public.facility_payers
set in_network = false
where in_network is true;

-- A match can create at most one consented connector lead. PostgreSQL permits
-- multiple NULLs, so pre-match compatibility contacts remain possible during rollback.
create unique index if not exists idx_vault_seekers_unique_match_id
  on public.vault_seekers (match_id);

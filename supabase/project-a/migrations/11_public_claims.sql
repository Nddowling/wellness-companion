-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 11_public_claims.sql                                  ║
-- ║                                                                            ║
-- ║ Public (pre-account) facility claims. A provider submits a claim WITHOUT   ║
-- ║ an account; a Global Admin verifies them and, on approval, an account is   ║
-- ║ created and credentials are emailed. So user_id + facility_id become       ║
-- ║ nullable (set/known at approval time) and we capture claimant contact +    ║
-- ║ a free-text facility name for "not listed yet" cases. Not PHI.             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table facility_claims alter column user_id drop not null;
alter table facility_claims alter column facility_id drop not null;

alter table facility_claims
  add column if not exists claimant_name         text,
  add column if not exists claimant_email        text,
  add column if not exists claimant_phone        text,
  add column if not exists claimant_title        text,
  add column if not exists facility_name_freetext text;

-- The old one-claim-per-user-per-facility uniqueness can't hold for public claims
-- (user_id is null until approval); admins de-dupe on review instead.
alter table facility_claims drop constraint if exists facility_claims_user_id_facility_id_key;
create index if not exists idx_facility_claims_email on facility_claims (claimant_email);

-- Public claims are inserted by the server-side admin (service-role) client, so the
-- existing deny-by-default RLS + admin policies are unchanged. The self-serve
-- (logged-in) insert policy still applies to claims that carry a user_id.

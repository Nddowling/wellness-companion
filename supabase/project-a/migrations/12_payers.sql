-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 12_payers.sql                                         ║
-- ║                                                                            ║
-- ║ Canonical payer/insurance reference. Drives the /match coverage options    ║
-- ║ and the /insurance/* landing pages. `payer_type` maps named carriers onto  ║
-- ║ the 5 matchable types used in facility_payers. Public-read reference data. ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists payers (
  slug        text primary key,
  name        text not null,
  payer_type  text not null check (payer_type in ('medicaid','medicare','commercial','tricare','self_pay')),
  kind        text not null check (kind in ('public','commercial','military','self')),
  common      boolean not null default false,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

insert into payers (slug, name, payer_type, kind, common, sort) values
  ('medicaid','Medicaid','medicaid','public',true,1),
  ('medicare','Medicare','medicare','public',true,2),
  ('tricare','TRICARE','tricare','military',true,3),
  ('aetna','Aetna','commercial','commercial',true,4),
  ('blue-cross-blue-shield','Blue Cross Blue Shield','commercial','commercial',true,5),
  ('cigna','Cigna','commercial','commercial',true,6),
  ('unitedhealthcare','UnitedHealthcare','commercial','commercial',true,7),
  ('humana','Humana','commercial','commercial',true,8),
  ('kaiser-permanente','Kaiser Permanente','commercial','commercial',true,9),
  ('anthem','Anthem (Elevance Health)','commercial','commercial',false,10),
  ('optum','Optum','commercial','commercial',false,11),
  ('magellan','Magellan Health','commercial','commercial',false,12),
  ('carelon','Carelon Behavioral Health','commercial','commercial',false,13),
  ('ambetter','Ambetter','commercial','commercial',false,14),
  ('molina','Molina Healthcare','commercial','commercial',false,15),
  ('self-pay','Self-pay','self_pay','self',true,16)
on conflict (slug) do update set
  name = excluded.name, payer_type = excluded.payer_type, kind = excluded.kind,
  common = excluded.common, sort = excluded.sort;

alter table payers enable row level security;
drop policy if exists payers_public_read on payers;
create policy payers_public_read on payers for select using (true);

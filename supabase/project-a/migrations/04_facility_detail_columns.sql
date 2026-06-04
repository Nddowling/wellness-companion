-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 04_facility_detail_columns.sql                         ║
-- ║                                                                            ║
-- ║ Richer facility fields captured from real-world directory data (operator   ║
-- ║ type, bed detail, named carriers, intake line, on-site flags, BD notes,    ║
-- ║ priority tier). All additive + nullable — existing queries are unaffected. ║
-- ║ The flag-style columns are free text (yes/no/partial/verify) on purpose:   ║
-- ║ source data carries nuance ("Ambulatory only", "Yes (court/forensic)").    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table facilities
  add column if not exists operator_type        text,
  add column if not exists levels_detail         text,   -- raw levels-of-care text
  add column if not exists has_beds              text,   -- YES / NO / PARTIAL / (OTP)
  add column if not exists bed_detail            text,
  add column if not exists specialty_programs    text,
  add column if not exists payers_detail         text,   -- raw payer text
  add column if not exists carriers_named        text[] not null default '{}',
  add column if not exists payer_confidence      text,
  add column if not exists main_phone            text,
  add column if not exists intake_line           text,
  add column if not exists intake_hours          text,
  add column if not exists accepts_court_ordered text,
  add column if not exists detox_on_site         text,
  add column if not exists mat_on_site           text,
  add column if not exists co_occurring          text,
  add column if not exists priority_tier         text,   -- A-Anchor / B / C tiers
  add column if not exists bd_notes              text;

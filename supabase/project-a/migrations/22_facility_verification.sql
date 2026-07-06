-- Enrichment / verification provenance (P0). Every enriched fact carries where it
-- came from, when it was last checked, and how confident we are — the backbone of the
-- §6 enrichment protocol, YMYL trust signals, and freshness weighting. AI may never
-- ORIGINATE facts for payer/clinical/licensing/availability/phone; those are
-- source-or-nothing, and this schema is how we enforce + display that.

alter table public.facilities
  add column if not exists last_verified timestamptz,
  add column if not exists verification_confidence text not null default 'low'
    check (verification_confidence in ('high', 'medium', 'low')),
  add column if not exists source_url text,
  add column if not exists verified_by text;

comment on column public.facilities.verification_confidence is
  'high = claimed/registry-confirmed · medium = site-crawl match · low = SAMHSA-only (default)';

-- Backfill the SAMHSA-seeded corpus: low confidence, SAMHSA locator as source,
-- import timestamp as the last-verified date.
update public.facilities
set source_url  = coalesce(source_url, 'https://findtreatment.gov'),
    last_verified = coalesce(last_verified, created_at),
    verified_by = coalesce(verified_by, 'samhsa_import')
where source_url is null or last_verified is null or verified_by is null;

-- Payer-level provenance (§6 insurance-accuracy protocol): a payer boolean must be
-- source- or claim-backed and dated, never AI-guessed. Confidence + source per row.
alter table public.facility_payers
  add column if not exists verification_confidence text not null default 'low'
    check (verification_confidence in ('high', 'medium', 'low')),
  add column if not exists source_url text;

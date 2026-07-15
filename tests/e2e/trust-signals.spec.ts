import { expect, test } from '@playwright/test';

import { AVAILABILITY_MAX_AGE_DAYS, bedSummary, freshnessTone, isBedBased } from '../../src/lib/constants';
import { rankFacilities, scoreFacility, type FacilityForMatch } from '../../src/lib/matching/rank';
import { STEP_TOOLS, type IntakeExtraction } from '../../src/lib/intake/prompt';
import { normalizeCommercialCarrierNames, programListedPayerRecord } from '../../src/lib/payers';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

test('TRUST-PRIVACY-1 · guided payment step cannot collect coverage status', () => {
  const schema = STEP_TOOLS.coverage.input_schema as {
    properties: Record<string, unknown>;
    required?: string[];
  };
  expect(Object.keys(schema.properties).sort()).toEqual(['payer_carrier', 'payer_type']);
  expect(schema.required).toEqual(['payer_type']);
});

test('TRUST-AVAIL-1 · exact bed counts disappear after the seven-day freshness window', () => {
  expect(AVAILABILITY_MAX_AGE_DAYS).toBe(7);
  expect(
    bedSummary(
      [{ level_of_care: 'residential', beds_available: 3, last_updated: daysAgo(2) }],
      ['residential'],
    ).label,
  ).toBe('3 beds recently reported');
  expect(
    bedSummary(
      [{ level_of_care: 'residential', beds_available: 3, last_updated: daysAgo(8) }],
      ['residential'],
    ).label,
  ).toBe('Call to confirm beds');
});

test('TRUST-TAXONOMY-1 · setting-unknown detox is never presented as bed capacity', () => {
  expect(isBedBased('residential')).toBe(true);
  expect(isBedBased('detox')).toBe(false);
  expect(
    bedSummary(
      [{ level_of_care: 'detox', beds_available: 3, last_updated: daysAgo(1) }],
      ['detox', 'op'],
    ).label,
  ).toBe('Call for scheduling');
});

test('TRUST-AVAIL-5 · an orphan capacity row cannot create beds for a non-residential program', () => {
  expect(
    bedSummary(
      [{ level_of_care: 'residential', beds_available: 8, last_updated: daysAgo(1) }],
      ['iop'],
    ).label,
  ).toBe('Call for scheduling');
});

const intake: IntakeExtraction = {
  region_zip3: '787',
  care_level_needed: 'residential',
  payer_type: 'commercial',
  payer_carrier: 'Aetna',
  concern_category: 'substance_use',
};

const facility: FacilityForMatch = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Example program',
  city: 'Austin',
  state: 'TX',
  zip3: '787',
  is_gated: false,
  is_faith_based: false,
  levels_of_care: ['residential'],
  co_occurring: 'YES',
  referral_contact: null,
  carriers_named: ['Aetna'],
  capacity: [
    {
      level_of_care: 'residential',
      beds_available: 2,
      last_updated: daysAgo(1),
      updated_by: '00000000-0000-4000-8000-000000000002',
    },
  ],
  payers: [{ payer_type: 'commercial' }],
};

test('TRUST-PAYER-1 · a named carrier requires an exact facility listing', () => {
  expect(scoreFacility(intake, facility)).not.toBeNull();
  expect(scoreFacility(intake, { ...facility, carriers_named: ['Cigna'] })).toBeNull();
});

test('TRUST-TAXONOMY-2 · gated is a physical-setting attribute, not an open-match exclusion', () => {
  expect(scoreFacility(intake, { ...facility, is_gated: true })).not.toBeNull();
});

test('TRUST-PAYER-2 · a provider checkbox is not stored as verified network participation', () => {
  expect(normalizeCommercialCarrierNames([' Aetna ', 'Aetna', 'Invented Health'])).toEqual(['Aetna']);
  expect(programListedPayerRecord(facility.id, 'commercial')).toEqual({
    facility_id: facility.id,
    payer_type: 'commercial',
    in_network: false,
    verification_confidence: 'low',
    source_url: null,
  });
});

test('TRUST-SCOPE-1 · standalone mental-health requests are not routed through the addiction directory', () => {
  expect(scoreFacility({ ...intake, concern_category: 'mental_health' }, facility)).toBeNull();
});

test('TRUST-SCOPE-2 · co-occurring requests require a documented co-occurring field', () => {
  expect(scoreFacility({ ...intake, concern_category: 'co_occurring' }, facility)).not.toBeNull();
  expect(scoreFacility({ ...intake, concern_category: 'co_occurring' }, { ...facility, co_occurring: 'NO' })).toBeNull();
});

test('TRUST-AVAIL-3 · outpatient listings receive no unsupported availability boost', () => {
  const outpatient = scoreFacility(
    { ...intake, care_level_needed: 'iop' },
    {
      ...facility,
      levels_of_care: ['iop'],
      capacity: [],
    },
  );
  expect(outpatient?.score).toBe(12);
  expect(outpatient?.bed_based).toBe(false);
});

test('TRUST-AVAIL-4 · stale bed counts do not boost or break ties in matching', () => {
  const staleLarge = {
    ...facility,
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Zulu stale program',
    capacity: [{ level_of_care: 'residential', beds_available: 99, last_updated: daysAgo(8), updated_by: null }],
  };
  const noReportedOpening = {
    ...facility,
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Alpha call-to-confirm program',
    capacity: [{ level_of_care: 'residential', beds_available: 0, last_updated: daysAgo(1), updated_by: null }],
  };

  expect(scoreFacility(intake, staleLarge)?.score).toBe(12);
  expect(rankFacilities(intake, [staleLarge, noReportedOpening]).map((result) => result.name)).toEqual([
    'Alpha call-to-confirm program',
    'Zulu stale program',
  ]);
});

test('TRUST-AVAIL-2 · availability freshness uses recent / this week / stale bands', () => {
  expect(freshnessTone(daysAgo(2))).toBe('green');
  expect(freshnessTone(daysAgo(5))).toBe('amber');
  expect(freshnessTone(daysAgo(8))).toBe('red');
  expect(freshnessTone(daysAhead(30))).toBe('red');
  expect(
    bedSummary(
      [{ level_of_care: 'residential', beds_available: 3, last_updated: daysAhead(30) }],
      ['residential'],
    ).label,
  ).toBe('Call to confirm beds');
});

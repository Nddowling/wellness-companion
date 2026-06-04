import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  LEVELS_OF_CARE,
  PAYER_TYPES,
  COVERAGE_STATUSES,
  type LevelOfCare,
  type PayerType,
  type CoverageStatus,
} from '@/lib/constants';
import { CONCERN_CATEGORIES, type IntakeExtraction, type ConcernCategory } from '@/lib/intake/prompt';
import { rankFacilities, type FacilityForMatch } from '@/lib/matching/rank';

// Takes the de-identified intake, ranks published facilities, and records a
// de-identified `matches` row + `match_routes` for the top facilities. The seeker
// never gets a DB account; this runs server-side with the service-role client.
// NO identity is ever written — only the four coarse fields.

const TOP_N = 3;

// Map the model's wording to a valid enum. Exact match wins; otherwise match on
// keywords; otherwise fall back. Keeps a completed conversation from ever failing
// on a casing/synonym mismatch (e.g. "Medicaid", "cocaine", "inpatient").
function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  synonyms: Record<string, string[]>,
  fallback: T
): T {
  const v = String(value ?? '').toLowerCase().trim();
  if ((allowed as readonly string[]).includes(v)) return v as T;
  for (const key of Object.keys(synonyms)) {
    if (synonyms[key].some((p) => v.includes(p))) return key as T;
  }
  return fallback;
}

function normalizeIntake(body: unknown): IntakeExtraction {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const zipDigits = String(b.region_zip3 ?? b.zip ?? '').replace(/\D/g, '');
  const region_zip3 = zipDigits.slice(0, 3);

  const care_level_needed = pick<LevelOfCare>(b.care_level_needed, LEVELS_OF_CARE, {
    detox: ['detox', 'withdraw'],
    php: ['php', 'partial'],
    iop: ['iop', 'intensive'],
    residential: ['residential', 'inpatient', 'overnight', 'rtc', 'stay'],
    op: ['op', 'outpatient'],
  }, 'residential');

  const payer_type = pick<PayerType>(b.payer_type, PAYER_TYPES, {
    medicaid: ['medicaid', 'medi-cal'],
    medicare: ['medicare'],
    tricare: ['tricare', 'military', 'va '],
    self_pay: ['self', 'cash', 'out of pocket', 'uninsured', 'no insurance', 'none'],
    commercial: ['commercial', 'private', 'employer', 'blue', 'bcbs', 'aetna', 'cigna', 'united', 'humana', 'anthem', 'optum', 'marketplace', 'ppo', 'hmo'],
  }, 'self_pay');

  const coverage_status = pick<CoverageStatus>(b.coverage_status, COVERAGE_STATUSES, {
    active: ['active', 'current', 'yes', 'have it', 'valid'],
    inactive: ['inactive', 'lapsed', 'expired', 'cancel', 'terminat', 'not active', 'no longer'],
    unsure: ['unsure', 'unknown', 'not sure', 'maybe', 'idk', "don't know"],
  }, 'unsure');

  const concern_category = pick<ConcernCategory>(b.concern_category, CONCERN_CATEGORIES, {
    alcohol: ['alcohol', 'drink', 'booze', 'beer', 'liquor', 'wine'],
    opioids: ['opioid', 'opiate', 'heroin', 'fentanyl', 'oxy', 'percocet', 'vicodin', 'suboxone', 'methadone', 'morphine', 'pill'],
    stimulants: ['stimulant', 'cocaine', 'coke', 'crack', 'meth', 'amphetamine', 'adderall', 'speed'],
    co_occurring: ['co-occurring', 'co_occurring', 'co occurring', 'dual', 'both'],
    mental_health: ['mental', 'depress', 'anxiety', 'bipolar', 'ptsd', 'trauma', 'suicid'],
    other_substance: ['marijuana', 'cannabis', 'weed', 'benzo', 'xanax', 'klonopin', 'kratom', 'other'],
    unsure: ['unsure', 'unknown', 'not sure'],
  }, 'unsure');

  return { region_zip3, care_level_needed, payer_type, coverage_status, concern_category };
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const intake = normalizeIntake(raw);

  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from('facilities')
    .select(
      'id, name, city, state, zip3, is_gated, is_faith_based, referral_contact, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type, in_network)'
    )
    .eq('is_published', true);

  if (error) {
    return Response.json({ error: 'Could not load facilities' }, { status: 500 });
  }

  const facilities: FacilityForMatch[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    state: r.state,
    zip3: r.zip3,
    is_gated: r.is_gated,
    is_faith_based: r.is_faith_based,
    referral_contact: (r.referral_contact ?? null) as FacilityForMatch['referral_contact'],
    capacity: r.facility_capacity ?? [],
    payers: r.facility_payers ?? [],
  }));

  const ranked = rankFacilities(intake, facilities, TOP_N);

  // Record the de-identified demand + routing. Identity NEVER lands here.
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .insert({
      region_zip3: intake.region_zip3,
      care_level_needed: intake.care_level_needed,
      payer_type: intake.payer_type,
      coverage_status: intake.coverage_status,
      concern_category: intake.concern_category,
      source: 'seeker',
      status: ranked.length > 0 ? 'routed' : 'open',
    })
    .select('id')
    .single();

  if (matchErr || !match) {
    return Response.json({ error: 'Could not record match' }, { status: 500 });
  }

  if (ranked.length > 0) {
    await supabase
      .from('match_routes')
      .insert(ranked.map((r) => ({ match_id: match.id, facility_id: r.id, status: 'sent' })));
  }

  return Response.json({
    match_id: match.id,
    facilities: ranked.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      state: r.state,
      level: r.level,
      bed_based: r.bed_based,
      beds_available: r.beds_available,
      freshness: r.freshness,
      in_network: r.in_network,
      referral_contact: r.referral_contact,
    })),
  });
}

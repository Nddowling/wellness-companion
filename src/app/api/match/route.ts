import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  LEVELS_OF_CARE,
  PAYER_TYPES,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { CONCERN_CATEGORIES, type IntakeExtraction, type ConcernCategory } from '@/lib/intake/prompt';
import { COMMERCIAL_CARRIER_NAMES } from '@/lib/payers';
import { handoffCookie, issueHandoffToken } from '@/lib/matching/handoff-token';
import { readBoundedJson, RequestBodyError } from '@/lib/request-body';
import {
  anonymousBudgetHeaders,
  consumeAnonymousBudget,
  keyedSecurityDigest,
} from '@/lib/security/anonymous-guard';

// Takes the de-identified intake, ranks published facilities, and records a
// de-identified `matches` row + `match_routes` for the top facilities. The seeker
// never gets a DB account; this runs server-side with the service-role client.
// NO identity is ever written — only ZIP3, listed care level, payer category, and
// coarse concern scope. A volunteered carrier is used transiently and not persisted.

const TOP_N = 3;
const CANDIDATE_LIMIT = 10;
const MAX_BODY_BYTES = 16 * 1024;
const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ReferralContact = { name?: string; email?: string; phone?: string };
type MatchDirectoryOption = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  referral_contact: ReferralContact | null;
  level: string;
  bed_based: boolean;
  beds_available: number;
  freshness: 'green' | 'amber' | 'red';
  provider_reported: boolean;
  region_match: boolean;
};
type MatchDirectoryClient = {
  rpc: (
    functionName: 'match_directory_options',
    args: {
      p_region_zip3: string;
      p_care_level: string;
      p_payer_type: string;
      p_concern_category: string;
      p_payer_carrier: string | null;
      p_limit: number;
    },
  ) => Promise<{ data: MatchDirectoryOption[] | null; error: unknown }>;
};

type RecordMatchRow = {
  recorded_match_id: string;
  created: boolean;
  recorded_facility_ids: string[];
};

type RecordMatchClient = {
  rpc: (
    functionName: 'record_directory_match',
    args: {
      p_request_key_hash: string;
      p_payload_hash: string;
      p_region_zip3: string;
      p_care_level: string;
      p_payer_type: string;
      p_concern_category: string;
      p_facility_ids: string[];
    },
  ) => Promise<{
    data: RecordMatchRow[] | null;
    error: { code?: string } | null;
  }>;
};

const INTAKE_FIELDS = new Set([
  'region_zip3',
  'care_level_needed',
  'payer_type',
  'payer_carrier',
  'concern_category',
]);

function intakeError(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Expected a JSON object';
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => !INTAKE_FIELDS.has(key))) return 'Unexpected intake field';
  if (!/^\d{3}$/.test(String(body.region_zip3 ?? ''))) return 'A three-digit region is required';
  if (!LEVELS_OF_CARE.includes(body.care_level_needed as LevelOfCare)) return 'A valid level of care is required';
  if (!PAYER_TYPES.includes(body.payer_type as PayerType)) return 'A valid payer type is required';
  if (
    body.payer_carrier !== undefined &&
    (body.payer_type !== 'commercial' || !COMMERCIAL_CARRIER_NAMES.includes(body.payer_carrier as never))
  ) {
    return 'A valid commercial carrier is required';
  }
  if (!CONCERN_CATEGORIES.includes(body.concern_category as ConcernCategory)) return 'A valid concern category is required';
  return null;
}

// Normalize incoming wording to a valid enum. Exact match wins; otherwise match on
// keywords or fall back. This keeps older clients from failing on casing/synonym
// differences (for example, "Medicaid", "cocaine", or "inpatient").
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

  const payer_carrier =
    payer_type === 'commercial' && COMMERCIAL_CARRIER_NAMES.includes(b.payer_carrier as never)
      ? (b.payer_carrier as (typeof COMMERCIAL_CARRIER_NAMES)[number])
      : undefined;

  const concern_category = pick<ConcernCategory>(b.concern_category, CONCERN_CATEGORIES, {
    substance_use: ['substance', 'alcohol', 'drink', 'opioid', 'opiate', 'heroin', 'fentanyl', 'stimulant', 'cocaine', 'meth', 'benzo', 'cannabis', 'addiction'],
    co_occurring: ['co-occurring', 'co_occurring', 'co occurring', 'dual', 'both'],
    mental_health: ['mental', 'depress', 'anxiety', 'bipolar', 'ptsd', 'trauma', 'suicid'],
    unsure: ['unsure', 'unknown', 'not sure'],
  }, 'unsure');

  return { region_zip3, care_level_needed, payer_type, payer_carrier, concern_category };
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return Response.json(
      { error: status === 413 ? 'Request body is too large' : 'Invalid JSON' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const validationError = intakeError(raw);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return Response.json(
      { error: 'A valid Idempotency-Key is required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const intake = normalizeIntake(raw);

  const budget = await consumeAnonymousBudget(request, 'match');
  if (!budget.ok) {
    return Response.json(
      {
        error:
          budget.status === 429
            ? 'Please wait before starting another directory match.'
            : 'Directory matching is temporarily unavailable.',
      },
      { status: budget.status, headers: anonymousBudgetHeaders(budget) },
    );
  }

  const supabase = createAdminClient();

  // Rank inside Postgres so the full published directory is considered before the
  // top-N limit. Fetching rows through PostgREST and ranking in Node silently capped
  // the candidate pool at the Data API row ceiling.
  const { data: rows, error } = await (supabase as unknown as MatchDirectoryClient).rpc(
    'match_directory_options',
    {
      p_region_zip3: intake.region_zip3,
      p_care_level: intake.care_level_needed,
      p_payer_type: intake.payer_type,
      p_concern_category: intake.concern_category,
      p_payer_carrier: intake.payer_carrier ?? null,
      p_limit: CANDIDATE_LIMIT,
    },
  );

  if (error) {
    return Response.json(
      { error: 'Could not load facilities' },
      { status: 500, headers: anonymousBudgetHeaders(budget) },
    );
  }

  const candidates = (rows ?? []).slice(0, CANDIDATE_LIMIT);
  const selected = candidates.slice(0, TOP_N);
  const canonicalPayload = JSON.stringify({
    region_zip3: intake.region_zip3,
    care_level_needed: intake.care_level_needed,
    payer_type: intake.payer_type,
    payer_carrier: intake.payer_carrier ?? null,
    concern_category: intake.concern_category,
  });
  const { data: recordedRows, error: recordError } = await (
    supabase as unknown as RecordMatchClient
  ).rpc('record_directory_match', {
    p_request_key_hash: keyedSecurityDigest(
      'match-idempotency',
      `${budget.sessionToken}:${idempotencyKey.toLowerCase()}`,
    ),
    p_payload_hash: keyedSecurityDigest('match-payload', canonicalPayload),
    p_region_zip3: intake.region_zip3,
    p_care_level: intake.care_level_needed,
    p_payer_type: intake.payer_type,
    p_concern_category: intake.concern_category,
    p_facility_ids: selected.map((facility) => facility.id),
  });

  const recorded = recordedRows?.[0];
  if (recordError || !recorded) {
    return Response.json(
      {
        error:
          recordError?.code === '22023'
            ? 'That match request key was already used for different filters.'
            : 'Could not record match',
      },
      {
        status: recordError?.code === '22023' ? 409 : 500,
        headers: anonymousBudgetHeaders(budget),
      },
    );
  }

  // On an idempotent retry, return only the facilities originally routed. The
  // larger candidate window makes a recent option resilient to small rank shifts;
  // an option that is no longer eligible/published is deliberately omitted.
  const candidateById = new Map(candidates.map((facility) => [facility.id, facility]));
  const ranked = recorded.recorded_facility_ids
    .map((facilityId) => candidateById.get(facilityId))
    .filter((facility): facility is MatchDirectoryOption => Boolean(facility));

  let token: string;
  try {
    token = issueHandoffToken(
      recorded.recorded_match_id,
      ranked.map((facility) => facility.id),
    );
  } catch {
    if (recorded.created) {
      const { error: cleanupError } = await supabase
        .from('matches')
        .delete()
        .eq('id', recorded.recorded_match_id);
      if (cleanupError) {
        console.error('[match] failed to clean up an unusable match', {
          code: cleanupError.code ?? 'unknown',
        });
      }
    }
    return Response.json(
      { error: 'Match handoff is not configured' },
      { status: 503, headers: anonymousBudgetHeaders(budget) },
    );
  }

  const responseHeaders = new Headers(anonymousBudgetHeaders(budget));
  responseHeaders.append('Set-Cookie', handoffCookie(token));
  return Response.json(
    {
      match_id: recorded.recorded_match_id,
      facilities: ranked.map((r) => ({
        id: r.id,
        name: r.name,
        city: r.city,
        state: r.state,
        level: r.level,
        bed_based: r.bed_based,
        beds_available: r.beds_available,
        freshness: r.freshness,
        provider_reported: r.provider_reported,
        region_match: r.region_match,
        referral_contact: r.referral_contact,
      })),
    },
    { headers: responseHeaders },
  );
}

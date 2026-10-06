import 'server-only';

import { bedSummary, LEVELS_OF_CARE, PAYER_LABELS, PAYER_TYPES } from '@/lib/constants';
import { readBoundedJson, RequestBodyError } from '@/lib/request-body';
import { resolveSearchLocation } from '@/lib/search/location-resolver';
import type { SearchLocation } from '@/lib/search/directory-language';
import { anonymousBudgetHeaders, consumeAnonymousBudget } from '@/lib/security/anonymous-guard';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;
const MAX_PAGE = 1_000;
const MAX_BODY_BYTES = 2 * 1024;
const SPECIALTIES = new Set(['occurring', 'trauma', 'mat', 'substance']);
const POPULATIONS = new Set(['men', 'women', 'adolescent', 'young adult', 'veteran', 'senior', 'pregnant']);

type Filters = {
  level: string | null;
  pay: string | null;
  spec: string | null;
  pop: string | null;
  open: boolean;
};

type NearbyRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[] | null;
  carriers_named: string[] | null;
  facility_payers: { payer_type: string }[] | null;
  facility_capacity: { level_of_care: string; beds_available: number; last_updated: string; updated_by?: string | null }[] | null;
  miles: number | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseLocation(value: unknown): SearchLocation | null {
  const location = record(value);
  if (!location) return null;
  if (location.kind === 'zip' && typeof location.zip === 'string') {
    return { kind: 'zip', zip: location.zip };
  }
  if (location.kind === 'city' && typeof location.city === 'string') {
    if (location.state !== undefined && typeof location.state !== 'string') return null;
    return { kind: 'city', city: location.city, state: location.state as string | undefined };
  }
  return null;
}

function allowed(value: unknown, choices: readonly string[] | Set<string>): string | null {
  return typeof value === 'string' && (choices instanceof Set ? choices.has(value) : choices.includes(value))
    ? value
    : null;
}

function parseFilters(value: unknown): Filters {
  const input = record(value) ?? {};
  const level = allowed(input.level, LEVELS_OF_CARE);
  return {
    level,
    pay: allowed(input.pay, PAYER_TYPES),
    spec: allowed(input.spec, SPECIALTIES),
    pop: allowed(input.pop, POPULATIONS),
    open: input.open === true && (!level || level === 'residential'),
  };
}

function paymentSummary(row: NearbyRow): string {
  const publicTypes = (row.facility_payers ?? [])
    .filter((payer) => payer.payer_type !== 'commercial')
    .map((payer) => PAYER_LABELS[payer.payer_type as keyof typeof PAYER_LABELS] ?? payer.payer_type);
  const labels = [...new Set([...publicTypes, ...(row.carriers_named ?? [])])];
  return labels.length ? labels.slice(0, 4).join(' · ') + (labels.length > 4 ? ` +${labels.length - 4} more` : '') : 'Call to verify payment options';
}

/** The response contains only public card fields, never raw capacity or seeker coordinates. */
export async function POST(request: Request) {
  const noStore = { 'Cache-Control': 'no-store' };
  let body: Record<string, unknown> | null;
  try {
    body = record(await readBoundedJson(request, MAX_BODY_BYTES));
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return Response.json({ status: 'error', message: 'Invalid search request.' }, { status, headers: noStore });
  }
  const location = parseLocation(body?.location);
  const page = body?.page === undefined ? 1 : Number(body.page);
  if (!location || !Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) {
    return Response.json({ status: 'error', message: 'Enter a city or ZIP and try again.' }, { status: 400, headers: noStore });
  }
  const filters = parseFilters(body?.filters);

  const budget = await consumeAnonymousBudget(request, 'nearby');
  const headers = anonymousBudgetHeaders(budget);
  if (!budget.ok) {
    return Response.json(
      { status: 'error', message: budget.status === 429 ? 'Too many searches. Please try again shortly.' : 'Search is temporarily unavailable.' },
      { status: budget.status, headers },
    );
  }

  try {
    const resolved = await resolveSearchLocation(location);
    if (resolved.status === 'ambiguous') {
      return Response.json(resolved, { headers });
    }
    if (resolved.status === 'error') {
      return Response.json(resolved, { status: 422, headers });
    }

    const args = {
      p_olat: resolved.origin.latitude,
      p_olng: resolved.origin.longitude,
      p_region: null,
      p_level: filters.level,
      p_pay: filters.pay,
      p_spec: filters.spec,
      p_pop: filters.pop,
      p_q: null,
      p_open: filters.open,
    };
    const admin = createAdminClient();
    // Generated database types predate this production migration.
    const client = admin as unknown as {
      rpc: (name: string, params: Record<string, unknown>) => Promise<{
        data: unknown;
        error: { code?: string } | null;
      }>;
    };
    const [rowsResult, countResult] = await Promise.all([
      client.rpc('facilities_search_nearby', { ...args, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
      client.rpc('facilities_search_count', {
        p_region: null,
        p_level: filters.level,
        p_pay: filters.pay,
        p_spec: filters.spec,
        p_pop: filters.pop,
        p_q: null,
        p_open: filters.open,
      }),
    ]);
    if (rowsResult.error || countResult.error) {
      console.error('[nearby-search] database RPC failed', {
        rows: rowsResult.error?.code ?? null,
        count: countResult.error?.code ?? null,
      });
      return Response.json({ status: 'error', message: 'Search is temporarily unavailable.' }, { status: 503, headers });
    }

    const rows = ((rowsResult.data ?? []) as NearbyRow[]).map((row) => {
      const beds = bedSummary(row.facility_capacity, row.levels_of_care);
      const miles = row.miles === null ? null : Number(row.miles);
      return {
        id: row.id,
        name: row.name,
        city: row.city,
        state: row.state,
        levels: row.levels_of_care ?? [],
        miles: miles !== null && Number.isFinite(miles) && miles >= 0 ? Math.round(miles * 10) / 10 : null,
        bedLabel: beds.label,
        bedTone: beds.tone,
        paymentSummary: paymentSummary(row),
      };
    });
    return Response.json({
      status: 'ok',
      origin: { label: resolved.origin.label, kind: resolved.origin.kind },
      rows,
      total: Number(countResult.data ?? 0),
      page,
      pageSize: PAGE_SIZE,
      distanceBasis: 'Approximate straight-line miles between ZIP-area centers, not driving distance or verified street-address distance.',
    }, { headers });
  } catch (error) {
    console.error('[nearby-search] unexpected failure', { kind: error instanceof Error ? error.name : 'unknown' });
    return Response.json({ status: 'error', message: 'Search is temporarily unavailable.' }, { status: 503, headers });
  }
}

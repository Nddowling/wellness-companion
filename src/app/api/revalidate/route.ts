import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

import { facilityPath } from '@/lib/facility/href';
import { stateSlug, slugify } from '@/lib/geo';

// On-demand revalidation for facility profiles. Called by a Supabase Database Webhook
// on facilities UPDATE (and, via a facility_capacity → parent updated_at trigger, on
// bed-availability changes) so edits and bed changes hit the live ISR-cached page in
// seconds instead of waiting out the hourly revalidate window. Shared-secret gated.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret');
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty/invalid body — nothing to revalidate */
  }

  // Supabase webhook shape is { type, table, record, old_record }; also accept a
  // direct { id, slug, city, state } for manual/testing calls.
  const b = body as { record?: Record<string, unknown> } & Record<string, unknown>;
  const rec = (b.record ?? b) as { id?: string; slug?: string | null; city?: string | null; state?: string | null };

  const revalidated: string[] = [];
  if (rec.slug && rec.city && rec.state && rec.id) {
    const profile = facilityPath({ id: rec.id, slug: rec.slug, city: rec.city, state: rec.state });
    revalidatePath(profile);
    revalidated.push(profile);
    // The facility's city hub aggregates change too (counts, availability).
    const cityHub = `/treatment/${stateSlug(String(rec.state).toUpperCase())}/${slugify(String(rec.city))}`;
    revalidatePath(cityHub);
    revalidated.push(cityHub);
  }

  return NextResponse.json({ ok: true, revalidated });
}

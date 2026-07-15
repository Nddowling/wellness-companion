import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// Lightweight facility search for claim pickers and the public program-name
// autocomplete (scales to 13k+ facilities; no full list is shipped to clients).
async function searchFacilities(rawQuery: unknown, rawState: unknown, publishedOnly = false) {
  // Sanitize so user input can't break the PostgREST `or` filter string.
  const q = String(rawQuery ?? '').replace(/[^a-zA-Z0-9 .'&/-]/g, '').trim().slice(0, 100);
  const state = String(rawState ?? '').replace(/[^a-zA-Z]/g, '').trim().slice(0, 2);
  if (!q && !state) return { facilities: [] };

  // Match word-by-word: every typed word must appear in the name or city. This finds
  // "Coastal Harbor Treatment Center" from "coastal harbor" or "harbor treatment",
  // instead of needing the exact full-name substring.
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);
  if (!tokens.length && !state) return { facilities: [] };

  const supabase = createAdminClient();
  let query = supabase.from('facilities').select('id, name, city, state').order('name').limit(25);
  if (publishedOnly) query = query.eq('is_published', true);
  if (state) query = query.ilike('state', state);
  for (const tok of tokens) query = query.or(`name.ilike.%${tok}%,city.ilike.%${tok}%`);

  const { data, error } = await query;
  if (error) throw new Error('Facility search failed');
  return { facilities: data ?? [] };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    return Response.json(await searchFacilities(searchParams.get('q'), searchParams.get('state')));
  } catch {
    return Response.json({ facilities: [], error: 'search failed' }, { status: 500 });
  }
}

// Public autocomplete uses a JSON body so a person cannot place an accidental
// treatment narrative in browser history, referrers, or request URLs.
export async function POST(request: Request) {
  let body: { q?: unknown; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ facilities: [] }, { status: 400 });
  }
  try {
    return Response.json(await searchFacilities(body.q, body.state, true));
  } catch {
    return Response.json({ facilities: [], error: 'search failed' }, { status: 500 });
  }
}

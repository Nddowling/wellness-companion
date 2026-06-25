import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// Lightweight facility search for the claim picker (scales to 13k+ facilities —
// no full list ever shipped to the client). Returns at most 25 matches.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Sanitize so user input can't break the PostgREST `or` filter string.
  const q = (searchParams.get('q') ?? '').replace(/[^a-zA-Z0-9 .'&/-]/g, '').trim();
  const state = (searchParams.get('state') ?? '').replace(/[^a-zA-Z]/g, '').trim();
  if (!q && !state) return Response.json({ facilities: [] });

  // Match word-by-word: every typed word must appear in the name or city. This finds
  // "Coastal Harbor Treatment Center" from "coastal harbor" or "harbor treatment",
  // instead of needing the exact full-name substring.
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);
  if (!tokens.length && !state) return Response.json({ facilities: [] });

  const supabase = createAdminClient();
  let query = supabase.from('facilities').select('id, name, city, state').order('name').limit(25);
  if (state) query = query.ilike('state', state);
  for (const tok of tokens) query = query.or(`name.ilike.%${tok}%,city.ilike.%${tok}%`);

  const { data, error } = await query;
  if (error) return Response.json({ facilities: [], error: 'search failed' }, { status: 500 });
  return Response.json({ facilities: data ?? [] });
}

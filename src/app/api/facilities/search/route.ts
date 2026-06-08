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

  const supabase = createAdminClient();
  let query = supabase.from('facilities').select('id, name, city, state').order('name').limit(25);
  if (state) query = query.ilike('state', state);
  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return Response.json({ facilities: [], error: 'search failed' }, { status: 500 });
  return Response.json({ facilities: data ?? [] });
}

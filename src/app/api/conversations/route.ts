import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  upsertConversation,
  type ChatMessage,
  type MatchedFacilitySnapshot,
} from '@/lib/vault/conversations';

// Autosave endpoint for the seeker Companion (/match). The client owns the live
// transcript; it POSTs here on mount, after each completed turn, and after a
// match/handoff. Auth-required — a conversation is always scoped to the session
// user, who can only ever write their own row. Returns the conversation id so the
// client can keep updating the same row.

type Body = {
  id?: string;
  title?: string;
  messages?: ChatMessage[];
  match_id?: string;
  matched_facilities?: MatchedFacilitySnapshot[];
  face_sheet?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter(
        (m): m is ChatMessage =>
          !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      )
    : [];

  const id = await upsertConversation({
    id: typeof body.id === 'string' ? body.id : null,
    authUserId: user.id,
    title: typeof body.title === 'string' ? body.title.slice(0, 120) : null,
    messages,
    matchId: typeof body.match_id === 'string' ? body.match_id : null,
    matchedFacilities: Array.isArray(body.matched_facilities) ? body.matched_facilities : [],
  });

  return Response.json({ id });
}

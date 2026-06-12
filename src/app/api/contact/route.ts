import 'server-only';

import { createContact } from '@/lib/vault/seekers';

// Captures the seeker's name + email at the very start of the conversation, before
// matching, so the lead is saved even if they drop off. Returns a contact_id the
// client threads into the eventual hand-off so it updates this same row (no dupes).
// Best-effort: if the vault is disabled or the write fails, we return contact_id:null
// and the conversation continues uninterrupted.
export async function POST(request: Request) {
  let body: { full_name?: unknown; name?: unknown; email?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawName = typeof body.full_name === 'string' ? body.full_name : typeof body.name === 'string' ? body.name : '';
  const name = rawName.trim().slice(0, 120);
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

  let contactId: string | null = null;
  try {
    contactId = await createContact({ name: name || undefined, email });
  } catch {
    // vault disabled (no BAA) or transient error — lead capture is best-effort
  }
  return Response.json({ contact_id: contactId });
}

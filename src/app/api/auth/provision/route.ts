import { NextResponse, type NextRequest } from 'next/server';

import { provisionCanonicalLane } from '@/lib/auth/provision-canonical';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_AUTHORIZATION_LENGTH = 4_096;

/** Complete canonical profile setup when Supabase signup returns a live session. */
export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization') ?? '';
  if (authorization.length > MAX_AUTHORIZATION_LENGTH || !authorization.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const accessToken = authorization.slice('Bearer '.length).trim();
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(accessToken);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await provisionCanonicalLane(user))) {
    return NextResponse.json({ error: 'Profile setup failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

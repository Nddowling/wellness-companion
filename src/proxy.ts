import { type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

// Next 16 renamed the `middleware` file convention to `proxy`. This runs the
// Supabase session refresh before routes render. See:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

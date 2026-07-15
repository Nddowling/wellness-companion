import 'server-only';

import { redirect } from 'next/navigation';

import {
  outboundFallbackPath,
  outboundRedirectDestination,
} from '@/lib/outbound-redirect';
import { createAdminClient } from '@/lib/supabase/admin';

// Outbound referral redirect. A visitor clicks "Go to website" on a program
// profile and lands here first: we log a facility-level hand-off row, then redirect
// them to the facility's real site with UTM + cb_ref tags appended so
// the facility's own analytics also credit ClearBed.
//
//   /go/<facilityId>   →   logs click   →   facility.com/?utm_source=clearbed&cb_ref=<clickId>
//
// We only ever redirect to the website stored on the facility row (never to a
// user-supplied URL), so this is not an open redirect.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let destination = outboundFallbackPath(id);
  try {
    destination = await outboundRedirectDestination(createAdminClient(), id);
  } catch {
    // Covers configuration/client initialization failures before a query exists.
    // Keep the diagnostic fixed and context-free; the visitor still gets a safe path.
    console.error('[outbound-click] client initialization failed');
  }
  redirect(destination);
}

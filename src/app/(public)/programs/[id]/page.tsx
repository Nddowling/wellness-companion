import { notFound, permanentRedirect } from 'next/navigation';

import { loadFacilityById, facilityCanonicalPath } from '@/lib/facility/load';

// Legacy UUID profile URL. The canonical home is now
// /treatment/[state]/[city]/[slug]. Nearly all hits are 301'd by proxy.ts before
// this renders; this page-level permanent redirect is the belt-and-suspenders for
// any request that reaches the route directly (e.g. internal <Link>s that still
// point at /programs/[id], or if the proxy matcher is ever narrowed).
export default async function LegacyProgramRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await loadFacilityById(id);
  if (!f) notFound();
  permanentRedirect(facilityCanonicalPath(f));
}

// Retired with the precise-location map flow. Do not restore coordinate query
// parameters: treatment-seeking location must not enter URLs or request logs.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ error: 'Precise-location map search has been retired.' }, { status: 410 });
}

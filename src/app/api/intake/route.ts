// The AI-guided intake was retired. The public matching page now uses explicit,
// deterministic controls and sends only the selected directory filters to
// /api/match. Keep this endpoint as a hard tombstone so stale clients cannot send
// treatment narratives or contact/consent data to a model.

const RETIRED_RESPONSE = {
  error: 'AI-guided intake is retired. Use the directory filter form.',
} as const;

export async function POST() {
  return Response.json(RETIRED_RESPONSE, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}

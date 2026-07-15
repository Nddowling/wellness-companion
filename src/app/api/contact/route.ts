import 'server-only';

// Early lead capture was retired. Contact details are accepted only in the
// optional, consented handoff after a person has seen their matches.
export async function POST() {
  return Response.json({ error: 'Early contact capture is retired.' }, { status: 410 });
}

import 'server-only';

// Raw guided-intake transcripts are deliberately not persisted under the Path A
// connector model. Keep the former endpoint closed so old clients cannot resume
// writing narrative into a durable transcript store.
export async function POST() {
  return Response.json({ error: 'Conversation history is not stored.' }, { status: 410 });
}

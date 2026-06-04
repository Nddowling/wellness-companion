import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import { INTAKE_MODEL, INTAKE_SYSTEM, INTAKE_TOOL } from '@/lib/intake/prompt';

// Streams a warm, Claude-guided intake conversation. No PHI is stored anywhere —
// the only output beyond the chat text is the de-identified `record_intake`
// extraction, which the client forwards to /api/match.

type ClientMessage = { role: 'user' | 'assistant'; content: string };

// Strip invalid Unicode (broken surrogate halves) and control chars before sending.
function sanitize(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 4000);
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  // Lazy init so a missing key doesn't break the build.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return client;
}

export async function POST(request: Request) {
  let body: { messages?: ClientMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: sanitize(m.content) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'Expected a non-empty history ending in a user message' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const stream = anthropic().messages.stream({
          model: INTAKE_MODEL,
          max_tokens: 2048,
          // Warmth + low latency matter more than deep reasoning here.
          thinking: { type: 'disabled' },
          system: [
            { type: 'text', text: INTAKE_SYSTEM, cache_control: { type: 'ephemeral' } },
          ],
          tools: [INTAKE_TOOL],
          messages,
        });

        // Stream the assistant's reply token-by-token.
        stream.on('text', (delta) => send({ type: 'text', text: delta }));

        const final = await stream.finalMessage();

        // If Claude recorded the intake, hand the de-identified fields to the client.
        const tool = final.content.find((b) => b.type === 'tool_use');
        if (tool && tool.type === 'tool_use') {
          send({ type: 'intake', data: tool.input });
        }
        send({ type: 'done' });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Intake failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body$, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

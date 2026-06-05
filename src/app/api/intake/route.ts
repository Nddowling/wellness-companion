import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import { INTAKE_MODEL, STEP_SYSTEM, STEP_TOOLS, STEP_ORDER, type StepKey } from '@/lib/intake/prompt';

// Streams one warm, Claude-guided intake STEP. The /match page walks through four
// steps (need → location → coverage → identity); each call focuses on one. Claude
// either streams a gentle follow-up or calls that step's tool to emit the gathered
// fields. No PHI is stored here — the client assembles the face sheet and forwards
// the de-identified subset to /api/match.

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
  // Lazy init so a missing key doesn't break the build. maxRetries covers
  // transient 429/529s on the request setup; mid-stream overloads are retried below.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 3 });
  return client;
}

// Warm, user-safe error copy — never leak raw API JSON to the seeker.
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const status = (err as { status?: number } | null)?.status;
  if (status === 529 || status === 429 || /overloaded|rate.?limit/i.test(msg)) {
    return "Our guide is catching its breath for a second — please tap your answer again in a moment.";
  }
  return 'Something interrupted us just now. Please try that again.';
}

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const status = (err as { status?: number } | null)?.status;
  return status === 529 || status === 429 || /overloaded|rate.?limit/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  let body: { messages?: ClientMessage[]; step?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const step = body.step as StepKey | undefined;
  if (!step || !STEP_ORDER.includes(step)) {
    return Response.json({ error: 'Expected a valid step' }, { status: 400 });
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

      // Retry the whole turn on transient overloads — but only while NOTHING has
      // streamed yet, so a retry can't duplicate half a reply.
      let sentText = false;
      let lastErr: unknown = null;
      try {
        for (let attempt = 0; attempt <= 3; attempt++) {
          try {
            const stream = anthropic().messages.stream({
              model: INTAKE_MODEL,
              max_tokens: 2048,
              // Warmth + low latency matter more than deep reasoning here.
              thinking: { type: 'disabled' },
              system: [
                { type: 'text', text: STEP_SYSTEM[step], cache_control: { type: 'ephemeral' } },
              ],
              tools: [STEP_TOOLS[step]],
              messages,
            });

            // Stream the assistant's reply token-by-token.
            stream.on('text', (delta) => {
              sentText = true;
              send({ type: 'text', text: delta });
            });

            const final = await stream.finalMessage();

            // If Claude recorded this step, hand the gathered fields to the client
            // and signal the step is complete so the UI can advance.
            const tool = final.content.find((b) => b.type === 'tool_use');
            if (tool && tool.type === 'tool_use') {
              send({ type: 'step', step, data: tool.input });
            }
            send({ type: 'done' });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (!sentText && isRetryable(err) && attempt < 3) {
              await sleep(500 * (attempt + 1));
              continue;
            }
            throw err;
          }
        }
      } catch (err) {
        send({ type: 'error', message: friendlyError(lastErr ?? err) });
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

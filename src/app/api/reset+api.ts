import { validateThought } from '../../lib/reset-contract.ts';

// Allows even 2,000 JSON-escaped UTF-16 code units, while bounding body parsing.
const MAX_BODY_BYTES = 16 * 1024;
const MOCK_REFLECTION = {
  mock: true,
  label: 'Mock reflection — not AI-generated',
  reflection: 'Take a slow breath. You do not need to untangle everything at once. Choose one small next step and give yourself permission to pause.',
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return json({ error: 'Send an application/json body.' }, 415);
    }

    // Enforce the byte limit while reading; do not trust Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Send a JSON object with one thought field.' }, 400);
    let text = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          await reader.cancel();
          return json({ error: 'Request body is too large.' }, 413);
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Send valid JSON.' }, 400);
    }
    if (
      body === null || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'thought')
    ) {
      return json({ error: 'Send a JSON object with one thought field.' }, 400);
    }
    const error = validateThought((body as { thought: unknown }).thought);
    if (error) return json({ error }, 400);

    return json(MOCK_REFLECTION);
  } catch {
    // Never expose or log request contents, exception messages, or stack traces.
    return json({ error: 'Unable to reset thoughts. Please try again.' }, 500);
  }
}

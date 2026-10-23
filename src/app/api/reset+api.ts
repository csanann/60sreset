import { validateThought } from '../../lib/reset-contract.ts';
import { ResetServiceError, resetThought } from '../../lib/reset-service.ts';
import { BodyReadError, BodyTooLargeError, readLimitedText, REQUEST_BODY_TIMEOUT_MS } from '../../lib/server-http.ts';

// Allows even 2,000 JSON-escaped UTF-16 code units, while bounding body parsing.
const MAX_BODY_BYTES = 16 * 1024;

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

    if (!request.body) return json({ error: 'Send a JSON object with one thought field.' }, 400);
    const text = await readLimitedText(request.body, MAX_BODY_BYTES, {
      signal: request.signal, timeoutMs: REQUEST_BODY_TIMEOUT_MS,
    });

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
    const thought = (body as { thought: unknown }).thought;
    const error = validateThought(thought);
    if (error || typeof thought !== 'string') return json({ error }, 400);

    return json(await resetThought(thought, request.signal));
  } catch (error) {
    if (error instanceof BodyReadError) {
      return json({ error: error.code === 'TIMEOUT' ? 'Request body took too long. Please try again.' : 'Request was cancelled.' }, 408);
    }
    if (error instanceof BodyTooLargeError) return json({ error: 'Request body is too large.' }, 413);
    if (error instanceof TypeError) return json({ error: 'Send valid UTF-8 JSON.' }, 400);
    if (error instanceof ResetServiceError) return json({ error: error.message, code: error.code }, error.status);
    // Never expose or log request contents, exception messages, or stack traces.
    return json({ error: 'Unable to reset thoughts. Please try again.' }, 500);
  }
}

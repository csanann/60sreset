import { type MockReflection, validateThought } from './reset-contract.ts';

const REQUEST_ERROR = 'Could not get a mock reflection. Check your connection and try again.';

export async function requestReset(
  thought: string,
  controller = new AbortController(),
  fetcher: typeof fetch = fetch,
): Promise<MockReflection> {
  const validationError = validateThought(thought);
  if (validationError) throw new Error(validationError);

  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ thought }),
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(REQUEST_ERROR);
    const body: unknown = await response.json();
    if (
      body === null || typeof body !== 'object' ||
      !('mock' in body) || body.mock !== true ||
      !('label' in body) || typeof body.label !== 'string' || !body.label.trim() ||
      !('reflection' in body) || typeof body.reflection !== 'string' || !body.reflection.trim()
    ) {
      throw new Error(REQUEST_ERROR);
    }
    return { mock: true, label: body.label, reflection: body.reflection };
  } catch {
    // Untrusted server/network errors can contain input; show only fixed copy.
    throw new Error(REQUEST_ERROR);
  } finally {
    clearTimeout(timeout);
  }
}

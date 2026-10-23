import {
  isRecord, parseResetResponse, RESET_FAILURE_MESSAGES, type ResetFailureCode,
  type ResetResponse, validateThought,
} from './reset-contract.ts';

export class ResetRequestError extends Error {
  constructor(code: ResetFailureCode = 'REQUEST_FAILED') {
    super(RESET_FAILURE_MESSAGES[code]);
  }
}

export async function requestReset(
  thought: string,
  controller = new AbortController(),
  fetcher: typeof fetch = fetch,
): Promise<ResetResponse> {
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
    if (!response.ok) {
      const errorBody: unknown = await response.json();
      const code = isRecord(errorBody) ? errorBody.code : null;
      // Ignore server message text; only recognized codes select local fixed copy.
      throw new ResetRequestError(typeof code === 'string' && Object.hasOwn(RESET_FAILURE_MESSAGES, code)
        ? code as ResetFailureCode : 'REQUEST_FAILED');
    }
    const result = parseResetResponse(await response.json());
    if (!result) throw new ResetRequestError();
    return result;
  } catch (error) {
    // Untrusted server/network errors can contain input; show only fixed copy.
    if (error instanceof ResetRequestError) throw error;
    throw new ResetRequestError();
  } finally {
    clearTimeout(timeout);
  }
}

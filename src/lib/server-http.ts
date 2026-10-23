// Server-only bounded reads shared by incoming requests and provider responses.
export class BodyTooLargeError extends Error {}
export const REQUEST_BODY_TIMEOUT_MS = 5_000;

export class BodyReadError extends Error {
  readonly code: 'TIMEOUT' | 'ABORTED';
  constructor(code: BodyReadError['code']) {
    super(code);
    this.code = code;
  }
}

export async function readLimitedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let interrupt: (error: BodyReadError) => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => { interrupt = reject; });
  const onAbort = () => interrupt(new BodyReadError('ABORTED'));
  async function read() {
    let text = '';
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new BodyTooLargeError();
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  }
  try {
    if (options.signal?.aborted) throw new BodyReadError('ABORTED');
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.timeoutMs !== undefined) {
      // One deadline for the whole read, not an idle timeout refreshed by chunks.
      timer = setTimeout(() => interrupt(new BodyReadError('TIMEOUT')), options.timeoutMs);
    }
    return await Promise.race([read(), interrupted]);
  } catch (error) {
    // Never wait for a broken source's cancel promise or pass sensitive abort reasons.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

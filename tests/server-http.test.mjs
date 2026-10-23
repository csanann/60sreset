import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { test } from 'node:test';

import { readLimitedText, REQUEST_BODY_TIMEOUT_MS } from '../src/lib/server-http.ts';

test('bounded read clears its timer, listener and reader lock on success', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const controller = new AbortController();
  let cancelled = 0;
  const body = new ReadableStream({
    start(stream) { stream.enqueue(new TextEncoder().encode('ไทย')); stream.close(); },
    cancel() { cancelled++; },
  });
  assert.equal(await readLimitedText(body, 100, { signal: controller.signal, timeoutMs: REQUEST_BODY_TIMEOUT_MS }), 'ไทย');
  assert.equal(body.locked, false);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(clear.mock.callCount(), 1);
  controller.abort();
  t.mock.timers.tick(REQUEST_BODY_TIMEOUT_MS);
  assert.equal(cancelled, 0);
});

test('one total deadline stops trickled/stalled reads without waiting for cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const controller = new AbortController();
  let source, cancelled = 0;
  const body = new ReadableStream({
    start(stream) { source = stream; },
    cancel(reason) { assert.equal(reason, undefined); cancelled++; return new Promise(() => {}); },
  });
  const pending = readLimitedText(body, 100, { signal: controller.signal, timeoutMs: REQUEST_BODY_TIMEOUT_MS });
  const rejected = assert.rejects(pending, { code: 'TIMEOUT', message: 'TIMEOUT' });
  t.mock.timers.tick(REQUEST_BODY_TIMEOUT_MS - 1);
  source.enqueue(new TextEncoder().encode('partial'));
  await Promise.resolve();
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(clear.mock.callCount(), 1);
});

for (const alreadyAborted of [true, false]) {
  test(`abort ${alreadyAborted ? 'before' : 'during'} read cancels once, sanitizes reason and cleans up`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let cancelled = 0;
    const controller = new AbortController();
    const body = new ReadableStream({ cancel(reason) {
      cancelled++;
      assert.equal(reason, undefined);
      return Promise.reject(new Error('private-cancel-detail'));
    } });
    if (alreadyAborted) controller.abort(new Error('private-abort-detail'));
    const pending = readLimitedText(body, 100, { signal: controller.signal, timeoutMs: REQUEST_BODY_TIMEOUT_MS });
    const rejected = assert.rejects(pending, { code: 'ABORTED', message: 'ABORTED' });
    if (!alreadyAborted) controller.abort(new Error('private-abort-detail'));
    await rejected;
    assert.equal(cancelled, 1);
    assert.equal(body.locked, false);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    t.mock.timers.tick(REQUEST_BODY_TIMEOUT_MS);
    assert.equal(cancelled, 1);
  });
}

for (const bytes of [Uint8Array.of(0xff), new Uint8Array(101)]) {
  test('invalid UTF-8 and oversized reads cancel and remove their resources', async (t) => {
    const controller = new AbortController();
    const clear = t.mock.method(globalThis, 'clearTimeout');
    let cancelled = 0;
    const body = new ReadableStream({
      start(stream) { stream.enqueue(bytes); },
      cancel() { cancelled++; },
    });
    await assert.rejects(readLimitedText(body, 100, { signal: controller.signal, timeoutMs: REQUEST_BODY_TIMEOUT_MS }));
    assert.equal(cancelled, 1);
    assert.equal(body.locked, false);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    assert.equal(clear.mock.callCount(), 1);
  });
}

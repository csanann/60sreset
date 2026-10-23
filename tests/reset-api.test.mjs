import assert from 'node:assert/strict';
import { test } from 'node:test';

import { POST } from '../src/app/api/reset+api.ts';
import { REQUEST_BODY_TIMEOUT_MS } from '../src/lib/server-http.ts';
import { THOUGHT_CONTENT_MESSAGE } from '../src/lib/reset-contract.ts';
import { acceptedThoughts, rejectedThoughts } from './fixtures/thoughts.mjs';

// Keep the original mock acceptance suite independent of owner configuration.
process.env.RESET_PROVIDER = 'mock';

function request(body, headers = { 'Content-Type': 'application/json' }) {
  return new Request('http://localhost/api/reset', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

for (const [name, body] of [
  ['missing field', {}], ['null body', null], ['array body', []],
  ['string body', 'thought'], ['extra fields', { thought: 'hello', extra: 'no' }],
  ['number', { thought: 12 }], ['boolean', { thought: true }],
  ['null thought', { thought: null }], ['object thought', { thought: {} }],
  ['array thought', { thought: ['hello'] }], ['empty', { thought: '' }],
  ['whitespace', { thought: ' \n\t\u00a0' }],
  ['over limit', { thought: 'x'.repeat(2001) }],
  ['raw length before trimming', { thought: ` ${'x'.repeat(2000)}` }],
]) {
  test(`POST rejects ${name}`, async () => {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(typeof (await response.json()).error, 'string');
  });
}

test('POST returns the same labelled mock for different valid thoughts without echoing input', async () => {
  let expected;
  for (const thought of ['private-sentinel-123', ' หลายเรื่อง\n at once 😅 ', 'ab'.repeat(1000)]) {
    const response = await POST(request({ thought }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.mock, true);
    assert.match(body.label, /mock.*not AI-generated/i);
    assert.equal(typeof body.reflection, 'string');
    assert.ok(body.reflection.length > 0);
    if (expected) assert.deepEqual(body, expected);
    expected = body;
    assert.ok(!JSON.stringify(body).includes(thought));
  }
});

test('direct POST preserves acceptance of short, emotional, ambiguous and multilingual thoughts', async () => {
  const expected = await (await POST(request({ thought: 'Fictional deadline.' }))).json();
  for (const thought of acceptedThoughts) {
    const response = await POST(request({ thought }));
    assert.equal(response.status, 200, thought);
    assert.deepEqual(await response.json(), expected);
  }
});

test('direct POST enforces non-meaningful input validation independently of the UI', async () => {
  for (const thought of rejectedThoughts) {
    const response = await POST(request({ thought }));
    assert.equal(response.status, 400, JSON.stringify(thought));
    assert.deepEqual(await response.json(), { error: THOUGHT_CONTENT_MESSAGE });
  }
});

test('POST stops a stalled upload at the total read deadline with fixed 408 copy', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = 0;
  const stream = new ReadableStream({ cancel() { cancelled++; return new Promise(() => {}); } });
  const pending = POST(new Request('http://localhost/api/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
  }));
  t.mock.timers.tick(REQUEST_BODY_TIMEOUT_MS);
  const response = await pending;
  assert.equal(response.status, 408);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Request body took too long. Please try again.' });
  assert.equal(cancelled, 1);
  assert.equal(stream.locked, false);
});

test('POST cancels an aborted upload without exposing its abort reason', async () => {
  const controller = new AbortController();
  let cancelled = 0;
  const stream = new ReadableStream({ cancel() { cancelled++; } });
  const pending = POST(new Request('http://localhost/api/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half', signal: controller.signal,
  }));
  controller.abort('private-sentinel');
  const response = await pending;
  assert.equal(response.status, 408);
  assert.deepEqual(await response.json(), { error: 'Request was cancelled.' });
  assert.equal(cancelled, 1);
  assert.equal(stream.locked, false);
});

test('POST accepts application/json with charset', async () => {
  const response = await POST(request({ thought: 'hello' }, { 'Content-Type': 'application/json; charset=utf-8' }));
  assert.equal(response.status, 200);
});

test('POST rejects missing or unsupported content type', async () => {
  for (const headers of [{}, { 'Content-Type': 'text/plain' }]) {
    const response = await POST(request({ thought: 'hello' }, headers));
    assert.equal(response.status, 415);
  }
});

test('POST handles empty and malformed JSON without echoing submitted text', async () => {
  for (const body of ['', '{"thought":"private-sentinel']) {
    const response = await POST(new Request('http://localhost/api/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Send valid JSON.' });
  }
});

test('POST rejects a missing body', async () => {
  const response = await POST(new Request('http://localhost/api/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  }));
  assert.equal(response.status, 400);
});

test('POST bounds streamed bytes even with a false Content-Length and cancels excess input', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(8193)); },
    cancel() { cancelled = true; },
  });
  const response = await POST(new Request('http://localhost/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': '1' },
    body: stream, duplex: 'half',
  }));
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('POST handles UTF-8 characters split across stream chunks', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ thought: 'ไทย 😅' }));
  const response = await POST(new Request('http://localhost/api/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, duplex: 'half',
    body: new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }),
  }));
  assert.equal(response.status, 200);
});

test('POST sanitizes unexpected read failures and does not log thoughts', async (t) => {
  const logs = ['log', 'info', 'warn', 'error', 'debug'].map((method) => t.mock.method(console, method, () => {}));
  const response = await POST(new Request('http://localhost/api/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, duplex: 'half',
    body: new ReadableStream({ start(controller) { controller.error(new Error('private-sentinel')); } }),
  }));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Unable to reset thoughts. Please try again.' });
  await POST(request({ thought: 'private-sentinel' }));
  for (const log of logs) assert.equal(log.mock.callCount(), 0);
});

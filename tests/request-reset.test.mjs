import assert from 'node:assert/strict';
import { test } from 'node:test';

import { POST } from '../src/app/api/reset+api.ts';
import { requestReset } from '../src/lib/request-reset.ts';

const failure = /^Error: Could not get a mock reflection\. Check your connection and try again\.$/;

test('client posts verbatim thoughts to the endpoint and reads its mock response', async () => {
  const thought = '  private-sentinel\n ไทย 😅  ';
  const controller = new AbortController();
  const result = await requestReset(thought, controller, async (url, options) => {
    assert.equal(url, '/api/reset');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.signal, controller.signal);
    assert.deepEqual(JSON.parse(options.body), { thought });
    return POST(new Request(`http://localhost${url}`, options));
  });
  assert.equal(result.mock, true);
  assert.match(result.label, /mock.*not AI-generated/i);
});

test('client rejects invalid input before making a request', async () => {
  for (const [thought, message] of [
    ['', 'Write a thought before resetting.'],
    [' \n\t', 'Write a thought before resetting.'],
    ['x'.repeat(2001), 'Keep your thoughts to 2,000 characters or fewer.'],
  ]) {
    let networkCalls = 0;
    await assert.rejects(requestReset(thought, undefined, async () => {
      networkCalls++;
      throw new Error('Unexpected network request');
    }), { message });
    assert.equal(networkCalls, 0, 'invalid input must not reach the network');
  }
});

for (const status of [400, 413, 415, 500, 503]) {
  test(`client sanitizes HTTP ${status} errors`, async () => {
    await assert.rejects(requestReset('hello', undefined, async () =>
      Response.json({ error: 'private-sentinel' }, { status })), failure);
  });
}

for (const [name, response] of [
  ['invalid JSON', () => new Response('private-sentinel')],
  ['null JSON', () => Response.json(null)],
  ['missing reflection', () => Response.json({ mock: true, label: 'Mock' })],
  ['unlabelled result', () => Response.json({ mock: true, reflection: 'Pause' })],
  ['non-mock result', () => Response.json({ mock: false, label: 'AI', reflection: 'Pause' })],
  ['wrong reflection type', () => Response.json({ mock: true, label: 'Mock', reflection: 123 })],
  ['blank reflection', () => Response.json({ mock: true, label: 'Mock', reflection: ' ' })],
]) {
  test(`client rejects ${name}`, async () => {
    await assert.rejects(requestReset('hello', undefined, async () => response()), failure);
  });
}

test('client sanitizes network errors', async () => {
  await assert.rejects(requestReset('hello', undefined, async () => {
    throw new Error('private-sentinel');
  }), failure);
});

test('client times out after 10 seconds and clears its timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  const pending = requestReset('hello', controller, async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('private-sentinel')), { once: true });
    }));
  const rejection = assert.rejects(pending, failure);
  t.mock.timers.tick(9999);
  assert.equal(controller.signal.aborted, false);
  t.mock.timers.tick(1);
  await rejection;
  assert.equal(controller.signal.aborted, true);
});

test('client supports cancellation when the screen unmounts', async () => {
  const controller = new AbortController();
  const pending = requestReset('hello', controller, async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('private-sentinel')), { once: true });
    }));
  const rejection = assert.rejects(pending, failure);
  controller.abort();
  await rejection;
});

test('successful request clears its timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  await requestReset('hello', controller, async () => Response.json({
    mock: true, label: 'Mock reflection — not AI-generated', reflection: 'Pause.',
  }));
  t.mock.timers.tick(10_000);
  assert.equal(controller.signal.aborted, false);
});

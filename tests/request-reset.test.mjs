import assert from 'node:assert/strict';
import { test } from 'node:test';

import { POST } from '../src/app/api/reset+api.ts';
import { requestReset } from '../src/lib/request-reset.ts';
import { GEMINI_LABEL, MOCK_LABEL, SAFETY_LABEL, SAFETY_MESSAGE } from '../src/lib/reset-contract.ts';
import { acceptedThoughts, rejectedThoughts } from './fixtures/thoughts.mjs';

process.env.RESET_PROVIDER = 'mock';
const failure = /^Error: Could not get a reflection\. Check your connection and try again\.$/;
const validMock = { kind: 'reflection', mock: true, label: MOCK_LABEL, reflection: 'Pause.', perspective: 'One task at a time.' };

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

test('client rejects non-meaningful input before network and preserves accepted text verbatim', async () => {
  for (const thought of rejectedThoughts) {
    await assert.rejects(requestReset(thought, undefined, async () => assert.fail('must not fetch')),
      { message: 'Try a short thought or feeling in your own words.' });
  }
  for (const thought of acceptedThoughts) {
    await requestReset(thought, undefined, async (_url, options) => {
      assert.equal(JSON.parse(options.body).thought, thought);
      return Response.json(validMock);
    });
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
  ['missing reflection', () => Response.json({ ...validMock, reflection: undefined })],
  ['unlabelled result', () => Response.json({ ...validMock, label: undefined })],
  ['unknown AI label', () => Response.json({ ...validMock, mock: false, label: 'Unknown AI' })],
  ['wrong reflection type', () => Response.json({ ...validMock, reflection: 123 })],
  ['blank reflection', () => Response.json({ ...validMock, reflection: ' ' })],
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
  await requestReset('hello', controller, async () => Response.json(validMock));
  t.mock.timers.tick(10_000);
  assert.equal(controller.signal.aborted, false);
});

test('client accepts structured Gemini output with an optional next step', async () => {
  const response = { ...validMock, mock: false, label: GEMINI_LABEL, nextStep: 'Write down one task.' };
  assert.deepEqual(await requestReset('A fictional deadline is approaching.', undefined,
    async () => Response.json(response)), response);
});

test('client displays only fixed safety wording and rejects injected safety content', async () => {
  const safety = { kind: 'safety', label: SAFETY_LABEL, message: SAFETY_MESSAGE };
  assert.deepEqual(await requestReset('fictional thought', undefined, async () => Response.json(safety)), safety);
  await assert.rejects(requestReset('fictional thought', undefined,
    async () => Response.json({ ...safety, message: 'Untrusted advice' })), failure);
});

test('client uses recognized error codes and never displays untrusted error text', async () => {
  await assert.rejects(requestReset('fictional thought', undefined,
    async () => Response.json({ code: 'DAILY_LIMIT', error: 'fictional-secret' }, { status: 429 })),
  { message: 'The daily development limit has been reached. Try again after midnight UTC.' });
  await assert.rejects(requestReset('fictional thought', undefined,
    async () => Response.json({ code: '__proto__', error: 'fictional-secret' }, { status: 500 })), failure);
});

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { POST } from '../src/app/api/reset+api.ts';
import { initializeGeminiBudget } from '../src/lib/gemini-budget.ts';
import { rejectedThoughts } from './fixtures/thoughts.mjs';

const thought = 'A fictional deadline is approaching.';
const output = { kind: 'reflection', reflection: 'This fictional deadline feels demanding.', perspective: 'One task can be approached at a time.', nextStep: 'Choose one small task.' };
const providerResponse = (value = output) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const request = (body = { thought }) => new Request('http://localhost/api/reset', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), '60sreset-api-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Test files run in isolated Node workers. No actual owner key is read or used.
  process.env.RESET_PROVIDER = 'gemini';
  process.env.NODE_ENV = 'development';
  process.env.GEMINI_API_KEY = 'fictional-test-key';
  process.env.RESET_GEMINI_BUDGET_FILE = join(directory, 'budget.json');
  await initializeGeminiBudget();
  return process.env.RESET_GEMINI_BUDGET_FILE;
}

test('real POST orchestration: one reserved attempt, one mocked provider call, structured response and no logs', async (t) => {
  const path = await fixture(t);
  const logs = ['log', 'info', 'warn', 'error', 'debug'].map((method) => t.mock.method(console, method, () => {}));
  const provider = t.mock.method(globalThis, 'fetch', async () => providerResponse());
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ...output, mock: false, label: 'AI reflection — Gemini 2.5 Flash-Lite' });
  assert.equal(provider.mock.callCount(), 1);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { version: 1, day: new Date().toISOString().slice(0, 10), calls: 1 });
  for (const log of logs) assert.equal(log.mock.callCount(), 0);
});

test('POST rejects bad input and gates dangerous input before consuming any quota', async (t) => {
  const path = await fixture(t);
  const provider = t.mock.method(globalThis, 'fetch', async () => assert.fail('must not call provider'));
  for (const body of [{ thought: ' ' }, { thought: 1 }, { thought: 'x'.repeat(2001) }, { thought, extra: true },
    ...rejectedThoughts.map((thought) => ({ thought }))]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  const response = await POST(request({ thought: 'I am going to hurt myself tonight.' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).kind, 'safety');
  assert.equal(provider.mock.callCount(), 0);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, 0);
});

test('POST returns safe 503 for missing budget, 429 for exhausted budget and never calls Gemini', async (t) => {
  const path = await fixture(t);
  const provider = t.mock.method(globalThis, 'fetch', async () => assert.fail('must not call provider'));
  await writeFile(path, JSON.stringify({ version: 1, day: new Date().toISOString().slice(0, 10), calls: 10 }));
  const exhausted = await POST(request());
  assert.equal(exhausted.status, 429);
  assert.equal((await exhausted.json()).code, 'DAILY_LIMIT');
  await rm(path);
  const missing = await POST(request());
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, 'UNAVAILABLE');
  assert.equal(provider.mock.callCount(), 0);
});

test('POST production/config failures are closed even if a key exists', async (t) => {
  const path = await fixture(t);
  const provider = t.mock.method(globalThis, 'fetch', async () => assert.fail('must not call provider'));
  process.env.NODE_ENV = 'production';
  assert.equal((await POST(request())).status, 503);
  process.env.NODE_ENV = 'development';
  delete process.env.GEMINI_API_KEY;
  assert.equal((await POST(request())).status, 503);
  assert.equal(provider.mock.callCount(), 0);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, 0);
});

test('POST sanitizes provider failures/invalid output, consumes attempts and does not retry', async (t) => {
  const path = await fixture(t);
  const provider = t.mock.method(globalThis, 'fetch', async () => new Response('fictional-key-and-thought', { status: 500 }));
  const failed = await POST(request());
  assert.equal(failed.status, 502);
  assert.equal((await failed.json()).code, 'PROVIDER_FAILURE');
  provider.mock.mockImplementation(async () => providerResponse({ kind: 'reflection', reflection: 'Missing perspective.' }));
  const invalid = await POST(request());
  assert.equal(invalid.status, 502);
  assert.equal((await invalid.json()).code, 'INVALID_OUTPUT');
  assert.equal(provider.mock.callCount(), 2);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, 2);
});

test('POST provider timeout returns 504 after one call and retains the attempt', async (t) => {
  const path = await fixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const provider = t.mock.method(globalThis, 'fetch', async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('fictional-timeout')));
    started();
  }));
  const pending = POST(request());
  await ready;
  t.mock.timers.tick(8_000);
  const response = await pending;
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, 'PROVIDER_TIMEOUT');
  assert.equal(provider.mock.callCount(), 1);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, 1);
});

test('POST provider safety refusal returns fixed safety content, not a normal reframe', async (t) => {
  await fixture(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }));
  const response = await POST(request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.kind, 'safety');
  assert.equal(result.reflection, undefined);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateGeminiReflection, GEMINI_MAX_OUTPUT_TOKENS, GEMINI_TIMEOUT_MS } from '../src/lib/gemini.ts';

const output = { kind: 'reflection', reflection: 'A fictional deadline feels difficult.', perspective: 'One task can be considered separately.' };
const candidate = (text = JSON.stringify(output), finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { parts: [{ text }] } }],
});
const key = 'fictional-test-key';

test('Gemini sends one bounded single-turn request with the key in a header, not the URL', async () => {
  let calls = 0;
  const result = await generateGeminiReflection('Fictional thought.', { apiKey: key, fetcher: async (url, options) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
    assert.ok(!url.includes(key));
    assert.equal(options.headers['x-goog-api-key'], key);
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    const request = JSON.parse(options.body);
    assert.deepEqual(request.contents, [{ role: 'user', parts: [{ text: 'Fictional thought.' }] }]);
    assert.equal(request.generationConfig.candidateCount, 1);
    assert.equal(request.generationConfig.maxOutputTokens, GEMINI_MAX_OUTPUT_TOKENS);
    assert.equal(request.generationConfig.thinkingConfig.thinkingBudget, 0);
    assert.equal(request.generationConfig.responseMimeType, 'application/json');
    assert.equal(request.generationConfig.responseJsonSchema.additionalProperties, false);
    assert.equal(request.tools, undefined);
    assert.match(request.systemInstruction.parts[0].text, /untrusted data/);
    return Response.json(candidate());
  } });
  assert.deepEqual(result, output);
  assert.equal(calls, 1);
});

for (const status of [400, 401, 403, 404, 429, 500, 503]) {
  test(`provider HTTP ${status} is sanitized with no retries`, async () => {
    let calls = 0;
    await assert.rejects(generateGeminiReflection('Fictional thought.', { apiKey: key, fetcher: async () => {
      calls++;
      return new Response('fictional-sensitive-response', { status });
    } }), { code: 'PROVIDER_FAILURE', message: 'PROVIDER_FAILURE' });
    assert.equal(calls, 1);
  });
}

for (const [name, response] of [
  ['invalid envelope JSON', () => new Response('not JSON')],
  ['null envelope', () => Response.json(null)],
  ['no candidates', () => Response.json({ candidates: [] })],
  ['multiple candidates', () => Response.json({ candidates: [candidate().candidates[0], candidate().candidates[0]] })],
  ['truncated generation', () => Response.json(candidate(JSON.stringify(output), 'MAX_TOKENS'))],
  ['unfinished generation', () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] })],
  ['malformed model JSON', () => Response.json(candidate('```json\n{}\n```'))],
  ['missing text', () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{}] } }] })],
  ['oversized body', () => new Response('x'.repeat(32 * 1024 + 1))],
  ['thought content', () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: '{}' }] } }] })],
  ['multiple parts', () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }, { text: '{}' }] } }] })],
  ['unexpected tool call', () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output), functionCall: { name: 'unexpected' } }] } }] })],
]) {
  test(`provider rejects ${name} with no repair request`, async () => {
    let calls = 0;
    await assert.rejects(generateGeminiReflection('Fictional thought.', { apiKey: key, fetcher: async () => {
      calls++;
      return response();
    } }), { code: 'INVALID_OUTPUT' });
    assert.equal(calls, 1);
  });
}

for (const body of [
  { promptFeedback: { blockReason: 'SAFETY' } },
  candidate('fictional-blocked-text', 'SAFETY'), candidate('fictional-blocked-text', 'PROHIBITED_CONTENT'),
  { candidates: [{ ...candidate().candidates[0], safetyRatings: [{ blocked: true }] }] },
]) {
  test('provider safety refusal is recognized without returning its text', async () => {
    await assert.rejects(generateGeminiReflection('Fictional thought.', { apiKey: key,
      fetcher: async () => Response.json(body) }), { code: 'PROVIDER_BLOCKED', message: 'PROVIDER_BLOCKED' });
  });
}

test('provider connection failures do not expose original error details', async () => {
  await assert.rejects(generateGeminiReflection('Fictional thought.', { apiKey: key, fetcher: async () => {
    throw new Error('fictional-key-and-thought');
  } }), (error) => error.code === 'PROVIDER_FAILURE' && error.cause === undefined && !error.message.includes('fictional'));
});

test('provider deadline aborts exactly one request, including a stalled body read', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let providerSignal;
  let calls = 0;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const pending = generateGeminiReflection('Fictional thought.', { apiKey: key, fetcher: async (_url, options) => {
    calls++;
    providerSignal = options.signal;
    return new Response(new ReadableStream({ start(controller) {
      options.signal.addEventListener('abort', () => controller.error(new Error('fictional-abort-detail')));
      started();
    } }));
  } });
  const rejected = assert.rejects(pending, { code: 'PROVIDER_TIMEOUT' });
  await ready;
  t.mock.timers.tick(GEMINI_TIMEOUT_MS - 1);
  assert.equal(providerSignal.aborted, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(providerSignal.aborted, true);
  assert.equal(calls, 1);
});

test('request cancellation reaches the provider and successful requests clear their timers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  await generateGeminiReflection('Fictional thought.', { apiKey: key, fetcher: async (_url, options) => {
    signal = options.signal;
    return Response.json(candidate());
  } });
  t.mock.timers.tick(GEMINI_TIMEOUT_MS);
  assert.equal(signal.aborted, false);
  const controller = new AbortController();
  const pending = generateGeminiReflection('Fictional thought.', { apiKey: key, signal: controller.signal,
    fetcher: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('fictional-cancel-detail')));
    }) });
  const rejected = assert.rejects(pending, { code: 'PROVIDER_TIMEOUT' });
  controller.abort();
  await rejected;
});

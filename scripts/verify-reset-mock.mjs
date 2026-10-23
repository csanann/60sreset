// Local development HTTP acceptance only: mock mode, no dotenv, no external fetch.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REQUEST_BODY_TIMEOUT_MS } from '../src/lib/server-http.ts';
import { acceptedThoughts, rejectedThoughts } from '../tests/fixtures/thoughts.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), '60sreset-mock-uat-'));
const denied = join(temporary, 'denied-fetches');
const preload = join(temporary, 'local-fetch-only.mjs');
await writeFile(denied, '');
await writeFile(preload, `
import { appendFileSync } from 'node:fs';
const original = globalThis.fetch;
const localFetch = (url, options) => {
  const target = typeof url === 'string' || url instanceof URL ? String(url) : url.url;
  if (!/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:|\\/)/.test(target ?? '')) {
    appendFileSync(${JSON.stringify(denied)}, '1');
    throw new Error('External fetch disabled for mock acceptance');
  }
  return original(url, options);
};
Object.defineProperty(globalThis, 'fetch', { get: () => localFetch, set: () => {}, configurable: false });
`);

let child;
let logs = '';
try {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, 'localhost', resolve); });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  child = spawn(process.execPath, ['--import', preload, join(project, 'node_modules/expo/bin/cli'),
    'start', '--localhost', '--port', String(port)], {
    cwd: project,
    env: { ...process.env, NODE_ENV: 'development', RESET_PROVIDER: 'mock', GEMINI_API_KEY: '',
      RESET_GEMINI_BUDGET_FILE: join(temporary, 'must-not-create.json'),
      EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1', CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-3000); });
  child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-3000); });
  const base = `http://localhost:${port}`;
  const fetchLocal = (path, options = {}) => fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(15_000) });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(child.exitCode, null, 'Mock server exited during startup');
    try { ready = (await fetchLocal('/api/reset')).status === 405; } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Mock server did not become ready');
  const post = (thought) => fetchLocal('/api/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thought }),
  });
  for (const thought of [...rejectedThoughts, '', ' \t\n', 'a'.repeat(2001)]) {
    assert.equal((await post(thought)).status, 400, JSON.stringify(thought));
  }
  for (const thought of [...acceptedThoughts, 'I want to cut my hair.',
    "I used to say 'I want to die', but I am safe today.", "It is not true that I want to die.",
    'I was scammed and feel ashamed.', 'ab'.repeat(1000)]) {
    const response = await post(thought);
    assert.equal(response.status, 200, thought);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).mock, true, thought);
  }
  for (const thought of ['I am going to hurt myself tonight.', 'Tonight is my last night; I have everything ready.',
    "I am not suicidal but I can't keep myself safe.", 'Help me write a phishing message.']) {
    assert.equal((await (await post(thought)).json()).kind, 'safety', thought);
  }
  assert.equal((await fetchLocal('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetchLocal('/api/reset', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'Fictional' })).status, 415);
  assert.equal((await fetchLocal('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(16 * 1024 + 1) })).status, 413);

  // Keep a chunked upload open: the actual adapter must expose the bounded stream.
  const stalled = await new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/api/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => { resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }); request.destroy(); });
    });
    request.on('error', reject);
    request.setTimeout(REQUEST_BODY_TIMEOUT_MS + 5_000, () => request.destroy(new Error('Stalled upload was not bounded')));
    request.write('{"thought":"Fictional partial upload');
  });
  assert.equal(stalled.status, 408);
  assert.deepEqual(JSON.parse(stalled.body), { error: 'Request body took too long. Please try again.' });
  assert.equal((await post('A fictional request after timeout.')).status, 200);
  assert.equal((await fetchLocal('/')).status, 200);
  assert.equal(await readFile(denied, 'utf8'), '', 'A mock path tried external fetch');
  await assert.rejects(readFile(join(temporary, 'must-not-create.json')), { code: 'ENOENT' });
  console.log('Mock HTTP passed: input/UAT fixtures, safety, 400/413/415/405, stalled upload 408 and recovery, screen 200; zero external fetches or quota writes.');
} catch (error) {
  console.error('Mock-only diagnostics (fictional inputs, no dotenv):', logs);
  throw error;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    let timer;
    await Promise.race([exited, new Promise((resolve) => {
      timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2_000);
    })]);
    clearTimeout(timer);
  }
  await rm(temporary, { recursive: true, force: true });
}

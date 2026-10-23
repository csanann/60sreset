// Local HTTP/build verification with an intercepted provider. Never uses a real key.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DAILY_GEMINI_LIMIT, initializeGeminiBudget } from '../src/lib/gemini-budget.ts';

const project = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), '60sreset-server-check-'));
const budgetPath = join(temporary, 'budget.json');
const preload = join(temporary, 'mock-provider.mjs');
const interceptedCalls = join(temporary, 'intercepted-count');
const output = { kind: 'reflection', reflection: 'A fictional deadline feels demanding.', perspective: 'One task can be considered separately.' };
await writeFile(interceptedCalls, '');
await writeFile(preload, `
import { appendFileSync } from 'node:fs';
const originalFetch = globalThis.fetch;
const verificationFetch = async (url, options) => {
  const target = typeof url === 'string' || url instanceof URL ? String(url) : url.url;
  if (target?.startsWith('https://generativelanguage.googleapis.com/')) {
    appendFileSync(${JSON.stringify(interceptedCalls)}, '1');
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:${JSON.stringify(JSON.stringify(output))}}]}}]});
  }
  if (!/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:|\\/)/.test(target ?? '')) throw new Error('External networking disabled for verification');
  return originalFetch(url, options);
};
// Expo replaces global fetch during startup. Keep the interceptor installed even then.
Object.defineProperty(globalThis, 'fetch', { get: () => verificationFetch, set: () => {}, configurable: false });
`);

async function inspectClient(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspectClient(path);
    else if (/\.(js|map|html|json)$/.test(entry.name)) {
      const content = await readFile(path, 'utf8');
      for (const marker of ['GEMINI_API_KEY', 'RESET_GEMINI_BUDGET_FILE', 'generativelanguage.googleapis.com', 'fictional-build-only-key']) {
        assert.ok(!content.includes(marker), `Server-only marker in client artifact (${entry.name})`);
      }
    }
  }
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, 'localhost', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function withExpo(command, provider, check) {
  const beforeCalls = (await readFile(interceptedCalls, 'utf8')).length;
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', preload, join(project, 'node_modules/expo/bin/cli'),
    command, ...(command === 'start' ? ['--localhost'] : []), '--port', String(port)], {
    cwd: project,
    env: { ...process.env, NODE_ENV: command === 'start' ? 'development' : 'production', RESET_PROVIDER: provider,
      GEMINI_API_KEY: 'fictional-http-test-key', RESET_GEMINI_BUDGET_FILE: budgetPath,
      EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1', CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  const base = `http://localhost:${port}`;
  const post = (body) => fetch(`${base}/api/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    let ready = false;
    let lastStatus;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error('Expo verification server exited before readiness');
      try {
        lastStatus = (await fetch(`${base}/api/reset`)).status;
        ready = lastStatus === 405;
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, `Expo verification server did not become ready (HTTP ${lastStatus ?? 'unreachable'}). Startup diagnostics: ${logs.slice(-2000)}`);
    await check(post);
    return (await readFile(interceptedCalls, 'utf8')).length - beforeCalls;
  } catch (error) {
    // This harness only ever supplies fictional input/keys; include startup diagnostics.
    error.message += ` Verification-server diagnostics: ${logs.slice(-2000)}`;
    console.error(`Verification startup diagnostics (fictional keys/input only): ${logs.slice(-2000)}`);
    throw error;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      let timer;
      await Promise.race([exited, new Promise((resolve) => {
        timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2_000);
      })]);
      clearTimeout(timer);
    }
  }
}

try {
  const serverBundle = await readFile(join(project, 'dist/server/_expo/functions/api/reset+api.js'), 'utf8');
  assert.ok(serverBundle.includes('generativelanguage.googleapis.com'), 'Provider transport missing from server artifact');
  await inspectClient(join(project, 'dist/client'));
  console.log('Artifact boundary: provider transport is server-only; no key references/build sentinel in client output.');
  await initializeGeminiBudget(budgetPath);
  const developmentCalls = await withExpo('start', 'gemini', async (post) => {
    const unsafe = await post({ thought: 'I am going to hurt myself tonight.' });
    assert.equal((await unsafe.json()).kind, 'safety');
    assert.equal((await post({ thought: ' ' })).status, 400);
    for (let i = 0; i < DAILY_GEMINI_LIMIT; i++) {
      const response = await post({ thought: 'A fictional deadline is approaching.' });
      const body = await response.json();
      assert.equal(response.status, 200, `Development reset failed with ${body.code ?? 'unknown code'}`);
      assert.equal(body.mock, false);
      assert.equal(body.perspective, output.perspective);
    }
    assert.equal((await post({ thought: 'A fictional deadline is approaching.' })).status, 429);
  });
  assert.equal(developmentCalls, DAILY_GEMINI_LIMIT);
  console.log(`Development HTTP: ${DAILY_GEMINI_LIMIT} mocked Gemini calls, next request 429; unsafe/invalid input consumed none.`);
  const mockCalls = await withExpo('serve', 'mock', async (post) => {
    const response = await post({ thought: 'A fictional deadline is approaching.' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mock, true);
  });
  assert.equal(mockCalls, 0);
  const productionCalls = await withExpo('serve', 'gemini', async (post) => {
    const response = await post({ thought: 'A fictional deadline is approaching.' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'UNAVAILABLE');
  });
  assert.equal(productionCalls, 0);
  console.log('Exported Node server: mock POST 200, production Gemini 503, zero provider calls.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}

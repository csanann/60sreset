import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { initializeGeminiBudget, reserveGeminiCall } from '../src/lib/gemini-budget.ts';

const now = new Date('2026-10-23T12:00:00Z');
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), '60sreset-budget-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'budget.json');
}

test('relative or empty quota paths fail closed before filesystem writes', async () => {
  for (const path of ['', 'relative-budget.json']) {
    await assert.rejects(initializeGeminiBudget(path, now), { code: 'UNAVAILABLE' });
    await assert.rejects(reserveGeminiCall(path, now), { code: 'UNAVAILABLE' });
  }
});

test('counter requires explicit initialization and cannot be initialized twice to reset quota', async (t) => {
  const path = await fixture(t);
  await assert.rejects(reserveGeminiCall(path, now), { code: 'UNAVAILABLE' });
  await initializeGeminiBudget(path, now);
  await reserveGeminiCall(path, now);
  await assert.rejects(initializeGeminiBudget(path, now));
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { version: 1, day: '2026-10-23', calls: 1 });
});

test('ten reservations are durable, including across a new process, and the eleventh is refused', async (t) => {
  const path = await fixture(t);
  await initializeGeminiBudget(path, now);
  for (let i = 0; i < 10; i++) await reserveGeminiCall(path, now);
  await assert.rejects(reserveGeminiCall(path, now), { code: 'DAILY_LIMIT' });
  // A separate Node process sees the same exhausted state after a dev-server restart.
  const { execFileSync } = await import('node:child_process');
  const moduleUrl = new URL('../src/lib/gemini-budget.ts', import.meta.url).href;
  const script = `import { reserveGeminiCall } from ${JSON.stringify(moduleUrl)};
    try { await reserveGeminiCall(process.argv[1], new Date('2026-10-23T12:00:00Z')); process.exit(1); }
    catch (error) { if (error.code !== 'DAILY_LIMIT') process.exit(2); }`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script, path], { stdio: 'pipe' });
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, 10);
});

test('new UTC day starts a fresh budget, while a backwards clock fails closed', async (t) => {
  const path = await fixture(t);
  await initializeGeminiBudget(path, now);
  await reserveGeminiCall(path, now);
  await reserveGeminiCall(path, new Date('2026-10-24T00:00:00Z'));
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { version: 1, day: '2026-10-24', calls: 1 });
  await assert.rejects(reserveGeminiCall(path, now), { code: 'UNAVAILABLE' });
});

for (const state of ['not JSON', '{}', '{"version":1,"day":"2026-10-23","calls":-1}',
  '{"version":1,"day":"2026-10-23","calls":21}', '{"version":1,"day":"2026-02-30","calls":0}',
  '{"version":1,"day":"2026-10-23","calls":0,"thought":"fictional"}', 'x'.repeat(257)]) {
  test('corrupt or unexpected counter data fails closed without rewriting it', async (t) => {
    const path = await fixture(t);
    await writeFile(path, state);
    await assert.rejects(reserveGeminiCall(path, now), { code: 'UNAVAILABLE' });
    assert.equal(await readFile(path, 'utf8'), state);
  });
}

test('lock contention, unavailable storage and incomplete writes fail closed', async (t) => {
  const path = await fixture(t);
  await initializeGeminiBudget(path, now);
  await mkdir(`${path}.lock`);
  await assert.rejects(reserveGeminiCall(path, now), { code: 'UNAVAILABLE' });
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, 0);
  await rm(`${path}.lock`, { recursive: true });
  await writeFile(`${path}.pending`, 'incomplete');
  await assert.rejects(reserveGeminiCall(path, now), { code: 'UNAVAILABLE' });
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, 0);
  await assert.rejects(reserveGeminiCall(join(path, 'cannot-write.json'), now), { code: 'UNAVAILABLE' });
});

test('concurrent reservations never grant more slots than the persisted counter', async (t) => {
  const path = await fixture(t);
  await initializeGeminiBudget(path, now);
  const results = await Promise.allSettled(Array.from({ length: 40 }, () => reserveGeminiCall(path, now)));
  const granted = results.filter((result) => result.status === 'fulfilled').length;
  assert.ok(granted >= 1 && granted <= 10);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).calls, granted);
  for (const result of results) if (result.status === 'rejected') assert.ok(['UNAVAILABLE', 'DAILY_LIMIT'].includes(result.reason.code));
});

test('a symlink counter fails closed', async (t) => {
  const path = await fixture(t);
  await writeFile(`${path}.target`, '{"version":1,"day":"2026-10-23","calls":0}');
  await symlink(`${path}.target`, path);
  await assert.rejects(reserveGeminiCall(path, now), { code: 'UNAVAILABLE' });
});

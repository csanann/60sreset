import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const forbidden = /\/(?:gemini(?:-budget)?|reset-service|reset-safety|server-http)\.ts$/;

test('client entry imports never reach server modules, Node builtins or the Gemini key', async () => {
  const seen = new Set();
  async function visit(path) {
    if (seen.has(path)) return;
    seen.add(path);
    const source = await readFile(path, 'utf8');
    assert.ok(!forbidden.test(path), `Server module reachable from client: ${path}`);
    assert.ok(!source.includes('GEMINI_API_KEY'), 'Key access must stay server-only');
    const imports = [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(!specifier.startsWith('node:'), 'Node server builtin reachable from client');
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
      const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2)) : resolve(dirname(path), specifier);
      if (base.endsWith('.css')) continue;
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.web.tsx`]) {
        try { await access(candidate); } catch { continue; }
        await visit(candidate);
        break;
      }
    }
  }
  await visit(resolve(root, 'src/app/index.tsx'));
  await visit(resolve(root, 'src/app/_layout.tsx'));
  assert.ok(seen.has(resolve(root, 'src/lib/reset-contract.ts')));
  assert.ok(seen.has(resolve(root, 'src/lib/request-reset.ts')));
});

// Local development only. This stores aggregate counts, never thoughts or keys.
import { constants } from 'node:fs';
import { mkdir, open, readFile, rename, rmdir } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import { isRecord } from './reset-contract.ts';

export const DAILY_GEMINI_LIMIT = 10;
export const DEFAULT_BUDGET_PATH = resolve('.reset-dev/gemini-budget.json');

export class BudgetError extends Error {
  readonly code: 'DAILY_LIMIT' | 'UNAVAILABLE';
  constructor(code: BudgetError['code']) {
    super(code);
    this.code = code;
  }
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// Explicit owner setup only: exclusive create refuses to reset an existing budget.
export async function initializeGeminiBudget(path = process.env.RESET_GEMINI_BUDGET_FILE ?? DEFAULT_BUDGET_PATH, now = new Date()): Promise<void> {
  if (!isAbsolute(path)) throw new BudgetError('UNAVAILABLE');
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify({ version: 1, day: utcDay(now), calls: 0 }));
    await file.sync();
  } finally {
    await file.close();
  }
}

export async function reserveGeminiCall(path = process.env.RESET_GEMINI_BUDGET_FILE ?? DEFAULT_BUDGET_PATH, now = new Date()): Promise<void> {
  const lock = `${path}.lock`;
  const temporary = `${path}.pending`;
  let locked = false;
  try {
    if (!isAbsolute(path)) throw new BudgetError('UNAVAILABLE');
    // No lock retry/stale-lock reclamation: ambiguity fails closed, including crashes.
    await mkdir(lock, { mode: 0o700 });
    locked = true;
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let state: unknown;
    try {
      if (!(await file.stat()).isFile() || (await file.stat()).size > 256) throw new Error();
      state = JSON.parse(await file.readFile({ encoding: 'utf8' }));
    } finally {
      await file.close();
    }
    const today = utcDay(now);
    if (!isRecord(state) || Object.keys(state).sort().join(',') !== 'calls,day,version' || state.version !== 1 ||
        typeof state.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.day) ||
        new Date(`${state.day}T00:00:00Z`).toISOString().slice(0, 10) !== state.day || state.day > today ||
        !Number.isInteger(state.calls) || typeof state.calls !== 'number' || state.calls < 0 || state.calls > DAILY_GEMINI_LIMIT) {
      throw new Error();
    }
    const calls = state.day === today ? state.calls : 0;
    if (calls >= DAILY_GEMINI_LIMIT) throw new BudgetError('DAILY_LIMIT');

    const next = await open(temporary, 'wx', 0o600);
    try {
      await next.writeFile(JSON.stringify({ version: 1, day: today, calls: calls + 1 }));
      await next.sync();
    } finally {
      await next.close();
    }
    await rename(temporary, path);
    // Reserve durably before the provider call. Never refund an ambiguous failure.
    const directory = await open(dirname(path), constants.O_RDONLY);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    // Confirm the persisted reservation before granting it.
    const persisted: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!isRecord(persisted) || persisted.day !== today || persisted.calls !== calls + 1) throw new Error();
  } catch (error) {
    if (error instanceof BudgetError) throw error;
    throw new BudgetError('UNAVAILABLE');
  } finally {
    if (locked) {
      // Leave any failed .pending write for owner review; never reset state silently.
      try { await rmdir(lock); } catch { throw new BudgetError('UNAVAILABLE'); }
    }
  }
}

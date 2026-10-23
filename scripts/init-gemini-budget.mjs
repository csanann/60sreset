import { DAILY_GEMINI_LIMIT, initializeGeminiBudget } from '../src/lib/gemini-budget.ts';

try {
  await initializeGeminiBudget();
  console.log(`Created the local development Gemini budget (${DAILY_GEMINI_LIMIT} attempts per UTC day). No provider request was made.`);
} catch {
  // Do not print filesystem errors, paths or environment contents.
  console.error('Budget setup failed or the budget already exists. Existing quota was not reset.');
  process.exitCode = 1;
}

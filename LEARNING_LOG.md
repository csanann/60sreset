# Learning log

## 2026-10-11 — Ticket 1.1: development baseline

- Practised: separating Node/npm tooling from project dependencies; TypeScript versus lint checks.
- Implementation: Expo ESLint setup was already present at the start of this ticket. AI reviewed it and added a Node pin, typecheck script, and setup documentation.
- Evidence: human reported successful starter web preview. Independent explanation of tooling has not yet been assessed.
- Debugging: shells selected different Node versions; `.nvmrc` plus explicit `nvm use` makes selection repeatable. Review sandbox initially blocked ESLint cache writes.
- Interview evidence: explain why a lockfile supports repeatable installs and why passing static checks does not prove mobile behaviour.
- Revisit: confirm Node selection in new terminals and test the starter on the intended mobile platform.
- Lint finding: starter web theme hydration deliberately sets state after mount. Added a single-line, documented lint exception; runtime behaviour is unchanged and the rule remains active elsewhere.
- Verification: `npm run lint`, `npm run typecheck`, and `git diff --check` passed. `expo install --check` passed against the local SDK map; network validation was unavailable. No existing lockfile package version changed or was removed. Clean `npm ci` and mobile runtime tests were not run.

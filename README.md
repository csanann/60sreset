# 60sreset

60sReset is an Expo mobile app with one thoughts input and one reset response. Mock mode is the default. Ticket 1.3B adds explicitly enabled, local-development-only Gemini 2.5 Flash-Lite calls. Use fictional text only; no valid-key/model smoke test has been run.

## Stack

Expo SDK 57, React Native 0.86, React 19.2, Expo Router, and strict TypeScript.
ESLint 9 uses the SDK-compatible `eslint-config-expo/flat` configuration.

## Setup and run

Use Node **22.23.3** (pinned in `.nvmrc`) and npm **10.9.9**, the verified baseline.
Expo 57 requires at least Node 22.13.x. A global npm upgrade is not required.

```sh
nvm use
npm ci
npm start
```

- `nvm use` selects the project Node version for this terminal. If missing, run `nvm install` first.
- `npm ci` installs the committed dependency lockfile without updating it.
- `npm start` starts the local Expo development server. Press `w` for web; Ctrl+C stops it.

nvm does not switch automatically when changing folders. Run `nvm use` in a new project terminal and check `node --version` and `npm --version` if tools report an unsupported runtime. Do not change your global nvm default for this project.

## Checks

```sh
npm run typecheck
npm run lint
npm test
```

Typecheck checks TypeScript without generating JavaScript. Lint uses Expo's ESLint rules. All **209 tests** pass using Node 22's built-in runner and TypeScript stripping, with no added dependencies. Node may report module-detection and experimental mock-timer warnings; these do not indicate test failures. Existing request/error coverage is retained; former repeated-filler/control-only success fixtures now follow the stricter input rule. Tests use fictional inputs, intercepted provider calls and temporary counters; they never need a real key. Rendered UI/device interactions are separate acceptance work.

## Reset endpoint — Ticket 1.3B

Start the Expo development server with `npm start`. Web uses its own origin; Expo Router resolves native relative requests to the development server. A phone must be able to reach that server on your local network. Default mock mode needs no key or counter. For Gemini, use the localhost-only setup below; mobile Gemini acceptance is not established.

`POST /api/reset` accepts `Content-Type: application/json` and exactly one field:

```json
{ "thought": "A lot is on my mind today." }
```

- `thought` must be a string with content, at most **2,000 UTF-16 code units**, including surrounding whitespace. Emoji may use two code units. Shared deterministic validation rejects whitespace/control-only text, decimal digits/punctuation alone, and a contiguous run of at least eight `x` or `q` characters. Short thoughts, mixed letters/numbers, emotional repetition, emoji and multilingual text pass. This deliberately narrow check uses no word dictionary or minimum word count; ambiguous text generally passes. The screen shows friendly inline feedback after input is entered. Original text is sent verbatim; invisible controls are ignored only while checking content.
- The server independently applies that rule and caps the streamed request body at **16 KiB**, including JSON syntax/escaping, with a **five-second total read deadline** and request-abort cancellation. Trickle chunks do not restart the deadline. Failed reads cancel without waiting for the source's cancellation promise; timers, listeners and reader locks are released. Proxy/adapter connection limits remain separate.
- Normal success: `200` with `kind: "reflection"`, `mock`, a fixed source label, `reflection`, `perspective`, and optional `nextStep`. Each text field must be non-blank; maximum lengths are 600/600/240 UTF-16 code units respectively. Unknown fields and wrong types are rejected on both server and client. Mock mode returns the same structured example for every ordinary thought; AI text may reflect input, but the API adds no separate input echo field.
- Safety response: `200` with `kind: "safety"`, a fixed label and fixed support message, with no reflection/perspective/next step. Explicit danger phrases are checked before configuration, quota or provider access, including in mock mode. Provider safety blocks or a model safety disposition also select this fixed response.
- Errors: `400` for invalid JSON/UTF-8, shape, type, non-meaningful input or excessive thought length; `408` for an expired/aborted body read; `413` for excessive body bytes; `415` for unsupported content type; `429` for the daily development cap; `503` for unavailable quota/configuration or production Gemini; `504` for provider timeout; `502` for provider failure/invalid output; `500` for unexpected request-handling failure. Errors contain only fixed messages/codes; the client uses its own allowlisted copy. Expo Router returns `405` for unsupported methods.
- The screen shows loading, a labelled structured reflection or safety response, or a fixed error with the Reset button available to retry. It disables editing/submission during a request, aborts after 10 seconds or unmount, and clears the result/error when edited. Pressing Reset again is a new request; there are no automatic retries, repair calls or mock fallbacks after a Gemini failure.

For a local HTTP smoke check, use synthetic text:

```sh
curl -i http://localhost:8081/api/reset \
  -H 'Content-Type: application/json' \
  -d '{"thought":"Synthetic test thought"}'
```

The app adds no thought/response/key logging or storage, authentication, database or analytics. Text and responses remain transiently in component/request/server memory. An ignored local file stores only a schema version, UTC date and aggregate reservation count. Responses use `Cache-Control: no-store`. Do not enable body/header logging in server, proxy or provider tooling. In Gemini mode text is sent to Google: application non-retention does not guarantee provider non-retention. Review [Google's terms/data handling](https://ai.google.dev/gemini-api/terms) and account settings before any real data; this ticket is for fictional development inputs.

## Controlled Gemini setup

Owner-approved scope: mock by default, Gemini only in local development, **10 attempts per UTC day** (the owner reduced the original ticket's 20-call proposal). There is no production opt-in in this implementation.

Paid billing must remain disconnected for this stage; no billing setup or account change is authorized. Before any separately approved fictional Gemini smoke test, verify the intended project's free-tier/model eligibility and billing status in the owner's account. The application cannot determine that status. If the configured model is unavailable without billing, stop and review options rather than enabling billing or substituting a model automatically.

| Server configuration | Behaviour |
| --- | --- |
| `RESET_PROVIDER` unset or `mock` | Fixed mock; no provider or quota access |
| `RESET_PROVIDER=gemini` | Requires development mode, key and working initialized quota |
| `GEMINI_API_KEY` | Server-only secret; never use `EXPO_PUBLIC_`, app config or a client import |
| `RESET_GEMINI_BUDGET_FILE` (optional) | Owner-controlled absolute path to one shared local counter; defaults to `.reset-dev/gemini-budget.json` |

Keep the key in an ignored `.env.local` supplied by the owner or a server process environment. Do not paste it into chat, tests, commands that retain it in shell history, or Git. No secret file or real credential is created by this change. Restart Expo after changing private configuration.

Before enabling Gemini, initialize the counter once:

```sh
npm run init:gemini-budget
RESET_PROVIDER=gemini npm start -- --localhost
```

The initialization command makes no provider request and refuses to overwrite an existing counter. Missing/corrupt state, unavailable filesystem synchronization, lock contention, incomplete writes or a backwards UTC clock fail closed with no provider call. Normal UTC day rollover starts a fresh daily count. A slot is reserved durably before the model call and is not refunded for errors, cancellation, timeouts or invalid output. Do not delete/recreate the counter or change its path to bypass the cap; stale locks/pending files need owner review without resetting the consumed count.

This is a trusted-development safeguard, not a tamper-proof account quota. Processes sharing the same durable local path coordinate through an exclusive directory lock. Separate paths, clones, machines or isolated instances each have their own cap; ephemeral/serverless storage cannot establish a global daily limit. Relative/empty configured paths are rejected. This macOS Node 22 filesystem path is verified; unsupported directory-sync or no-follow semantics on other filesystems/platforms may disable Gemini. Gemini is disabled in production even when a key is configured. Distributed quota/access controls and the hosting adapter must be reviewed separately.

One allowed reset makes one REST `generateContent` request to `gemini-2.5-flash-lite`, with one candidate, a 512-token output cap, thinking budget 0, an 8-second deadline covering response reads, a 32 KiB response-byte cap, and no redirects/tools/history/automatic retry. The provider receives a fixed system instruction and one user text. Schema, completion status, safety feedback and structured fields are checked before display. Output is never automatically repaired by a second call.

The early safety gate is an English phrase heuristic, not clinical assessment. Its targets no longer include arbitrary `my …` text: haircuts/spending pass. Focused historical/negated reporting fixtures pass while a separate current threat still triggers safety. Added fixtures cover some indirect crisis language and explicit phishing/impersonation requests; scam victims/reporting are not treated as scam requests. Output-specific advice checks do not use historical exemptions and catch selected harmful medical/credential instructions. All blocked categories currently share the fixed safety message; a category-appropriate abuse refusal is beta work. Intense emotion alone is not blocked. Paraphrases, other languages, quote/negation context, prompt injection and semantically unsafe but schema-valid output remain limitations. Keyword matching does not solve semantic safety.

## UAT and security corrections — 2026-10-23

Implementation order and review guide (building on the file review below):

| Files | Functions/imports and reason |
| --- | --- |
| `src/lib/reset-contract.ts`, `src/app/index.tsx` | Add `isClearlyNonMeaningfulThought`/`THOUGHT_CONTENT_MESSAGE`; existing shared `validateThought` drives inline feedback, button/submit guard, client request validation and API enforcement. No new UI import is needed. |
| `src/lib/reset-safety.ts`, `src/lib/reset-service.ts` | Add normalization/context matching and `containsUnsafeAdvice`; service imports the output check and applies it to individual fields and combined output. Input history must not excuse generated harmful advice. |
| `src/lib/server-http.ts`, `src/app/api/reset+api.ts` | Add `BodyReadError`, `REQUEST_BODY_TIMEOUT_MS` and optional read signal/deadline; route imports them to stop slow/aborted uploads with fixed 408 copy before quota/provider access. |
| `tests/fixtures/thoughts.mjs`, contract/client/API/safety/service tests, `tests/server-http.test.mjs` | Shared fictional acceptance fixtures establish parity; focused safety regressions and mocked-timer/stream tests establish cleanup and fail-closed behaviour. Gemini API tests assert rejected input consumes no quota/calls. |
| `scripts/verify-reset-mock.mjs` | Node-only HTTP harness: starts Expo in mock mode with dotenv disabled and a non-replaceable external-fetch deny guard; checks accepted/rejected text, safety, protocol errors, a real stalled upload and recovery. Stops its server/removes temporary files. |

Run `node scripts/verify-reset-mock.mjs` for **mock-only** HTTP acceptance; localhost port permission may be required. Verification passed: 209 tests, lint, typecheck, diff checks; HTTP input/safety fixtures, 400/413/415/405, stalled upload 408, recovery and screen 200, with zero external fetches or quota writes. No real provider call, dependency/configuration change, commit, push or deployment was made. Existing fake-provider unit tests still exercise provider gates/accounting; this correction's HTTP run used mock mode only. A screen 200 does not establish rendered inline feedback, keyboard or screen-reader behaviour.

UAT findings: digits/punctuation and `xxxxxxxx` now fail on client and direct API; `Hi`, `Sad`, `I have 2 exams`, `noooooooo`, Thai/Arabic/CJK text and emoji pass unchanged. Haircut and selected historical/negated examples pass; selected current/indirect danger and explicit scam requests get fixed safety copy. Known unrecognized paraphrases are retained as documented blind-spot fixtures, not labelled safe.

Human acceptance remains pending: enter rejected text and check inline copy/disabled Reset, replace it with short/multilingual/emotional text and submit a labelled mock, then edit/resubmit; check loading/error/retry, mobile keyboard/scrolling, large text, themes and VoiceOver/TalkBack. Earlier Ticket 1.3A browser acceptance does not cover these changes. AI-assisted implementation/tests do not establish the owner's independent understanding or approval.

Before beta: access/rate/in-flight controls and shared authoritative quota; HTTPS/origin/adapter limits; broader content-safety evaluation; provider terms/privacy and hosting log retention; reachable dependency advisory review. The preceding read-only review found 24 affected package entries from four advisories (18 high, six moderate), not 24 proven runtime exploits; no dependency remediation was performed. Keep production Gemini disabled. A single real-key fictional smoke still needs separate owner approval and verified model/key/account/data settings.

Google's [current Developer API model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite) limits Gemini 2.5 access to previously active users. Owner/project access is unverified. The implementation does not silently change models. A provider 403/404 or blocked model remains a safe failure. Review current [key restrictions](https://ai.google.dev/gemini-api/docs/api-key), provider data handling and billing before any live test. At most one fictional real-provider smoke test may be run after explicit owner approval; no valid-key/model smoke test or generation has been performed. See the verification incident below.

## Server output and runtime checks

SDK 57 API routes require `web.output: "server"` in `app.json`. To check the production web/server bundle locally:

```sh
npx expo export --platform web
npm run verify:server
```

`verify:server` scans client/server artifacts, starts local Expo development/exported Node servers with a fake key and an intercepted provider, verifies the 10-call cap plus default mock and production Gemini rejection, then stops the servers and removes temporary state. It never makes a real provider call. It needs localhost port access and uses fictional text only. `npx expo serve` is available for ordinary manual inspection of the export.

Verified on 2026-10-23: client artifacts exclude provider/key access; the actual development POST allows 10 intercepted calls then returns 429; unsafe/invalid input consumes none; the exported Node server returns mock 200 and production Gemini 503 without provider calls. Early harness versions installed a writable global fetch mock, which Expo's CLI replaced with `fetch-nodeshim`. Two failed runs may have attempted unauthenticated outbound requests with fictional keys/text; neither produced model output or used a real credential/personal text. The corrected harness retains a non-replaceable fetch accessor and counts synthetic interceptions independently of Expo's console instrumentation. This incident is separate from an owner-approved valid-key smoke test, which remains unperformed.

This verifies the existing SDK 57 Router server architecture on local Node 22. Static-only hosting cannot run the endpoint. No hosting target has been deployed or tested: persistent Node filesystem semantics are required for this development limiter and must not be assumed on EAS/worker/serverless adapters. Production native builds need a hosted HTTPS server and Router origin; production Gemini remains blocked pending a separate design.

Ticket 1.3A browser checks were user-reported as passing on 2026-10-18. The new structured/safety/error UI and Gemini responses need new manual browser and iOS/Android acceptance, including keyboard scrolling, large text, themes and screen-reader announcements. Passing route/transport tests and export do not establish these behaviours. Existing dependency-security follow-ups remain in `PLAN.md`.

## Structure

- `src/app/`: Expo Router screens, navigation layout, and `api/reset+api.ts` server route.
- `src/lib/`: shared/client modules plus server-only Gemini, quota, safety, orchestration and bounded-body helpers. Server-only modules are imported through the API route, never the screen.
- `tests/`: contract, endpoint, transport, safety, quota, boundary and client/server error tests using fictional inputs.
- `scripts/`: explicit quota initialization and mocked local server verification.
- `src/components/`, `src/hooks/`, `src/constants/`: shared starter code.
- `assets/`: icons and images.
- `app.json`: Expo application configuration.
- `eslint.config.js`: Expo ESLint flat configuration.
- `PLAN.md`, `LEARNING_LOG.md`: current scope and learning evidence.

## References

- [Expo 57 requirements](https://docs.expo.dev/versions/v57.0.0/)
- [Expo ESLint setup](https://docs.expo.dev/guides/using-eslint/)
- [Expo Router API routes and native origin configuration](https://docs.expo.dev/router/web/api-routes/)
- [Node 22 TypeScript support](https://nodejs.org/docs/latest-v22.x/api/typescript.html)
- [Gemini generateContent REST reference](https://ai.google.dev/api/generate-content)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)

## Ticket 1.3B file review

No dependencies were added/upgraded and the lockfile is unchanged. The extra server helpers isolate policy, network access and durable quota operations so tests can replace the provider without weakening the real endpoint. Files under `src/app/` export only route/screen behaviour.

| Changed file | Purpose and important functions | Imports | Tests/checks and rationale |
| --- | --- | --- | --- |
| `src/lib/reset-contract.ts` | Types, limits; `validateThought`, `parseReflection`, `parseModelOutput`, `parseResetResponse` | None | Contract/client/API tests; shared runtime checks avoid trusting TypeScript or provider JSON alone |
| `src/lib/gemini.ts` | `generateGeminiReflection`, `GeminiError`; one bounded REST request | Shared contract, `server-http` | Gemini/API tests; native fetch avoids SDK retries and new dependencies |
| `src/app/api/reset+api.ts` | `POST`; 16 KiB read, JSON/input checks, safe HTTP responses | Contract, service, bounded reader | Old mock/API tests plus Gemini API tests; HTTP boundary remains explicit |
| `src/lib/reset-service.ts` | `createResetService`, `resetThought`, `ResetServiceError`; safety → mode → quota → model → output checks | Contract, safety, quota, Gemini | Service/API tests; dependency injection stays outside the route directory |
| `src/lib/reset-safety.ts` | `needsSafetySupport`; early English danger and generated-advice phrase checks | None | Safety/service/API tests; never classify emotion intensity alone as danger |
| `src/lib/gemini-budget.ts` | `initializeGeminiBudget`, `reserveGeminiCall`, `BudgetError`; durable UTC reservations | Node fs/path, contract | Budget/API/HTTP checks; lock + synchronized atomic replacement prevents concurrent overspend on one local path |
| `src/lib/server-http.ts` | `readLimitedText`, `BodyTooLargeError`; streamed byte bounds and UTF-8 decoding | None | Existing request streaming tests and provider tests; one implementation for both byte limits |
| `src/lib/request-reset.ts` | `requestReset`, `ResetRequestError`; strict response parsing and allowlisted errors | Contract | Client tests; supports mock/AI/safety without exposing server error text |
| `src/app/index.tsx` | `HomeScreen`, `submit`; one reset, structured display and fixed safety branch | React, React Native, safe area, theme, contract, request helper | Typecheck/export; manual UI outstanding; necessary to show the expanded response honestly |
| `tests/reset-api.test.mjs` | Retained request/mock/error scenarios, explicit mock configuration | Node assert/test, real `POST` | Keeps owner credentials/configuration out of the original mock suite |
| `tests/request-reset.test.mjs` | Retained client failures; new AI/safety/error-code fixtures | Node assert/test, route, request helper, contract | Preserves coverage while validating structured responses |
| `tests/reset-contract.test.mjs` | Field/type/length/label and optional-step boundaries | Node assert/test, contract | Reject malformed structured data at both trust boundaries |
| `tests/gemini.test.mjs` | One-call request, bounded output, provider failures, blocks and aborts | Node assert/test, Gemini | Every fetch is mocked; no automatic retry or repair |
| `tests/gemini-budget.test.mjs` | Initialization, 10/11 boundary, process persistence, UTC rollover, corruption and concurrency | Node assert/test/fs/os/path, quota; child process | Temporary aggregate counters only; failures must deny calls |
| `tests/reset-safety.test.mjs` | Fictional danger versus intense everyday emotion fixtures | Node assert/test, safety helper | Focused policy regression examples, not clinical validation |
| `tests/reset-service.test.mjs` | Orchestration ordering, mode gating, one-call quota semantics, safe output/errors | Node assert/test, service and typed errors | Injected dependencies prove unsafe/unavailable paths never call Gemini |
| `tests/reset-gemini-api.test.mjs` | Real route + real temporary quota + intercepted provider; status/body/privacy assertions | Node assert/test/fs/os/path, route, quota | Integration tests exercise the actual POST binding without a real key |
| `tests/server-boundary.test.mjs` | Traverses screen/layout imports; excludes server modules/key reads | Node assert/test/fs/path/url | Prevents accidental server imports into the UI graph |
| `scripts/init-gemini-budget.mjs` | Explicit one-time local counter initialization | Quota initializer/limit | Budget tests exercise the implementation; never silently resets existing state |
| `scripts/verify-reset-server.mjs` | Artifact inspection and mocked Expo dev/export HTTP checks | Node assert/child process/fs/net/os/path/url, quota | Demonstrates server-side execution with no real provider traffic |
| `.gitignore` | Ignore `.reset-dev/` aggregate state/locks | None | Git ignore check; runtime quota must stay out of commits |
| `package.json` | Add `init:gemini-budget` and `verify:server` commands | None | Commands exercised through tests/verification; dependency versions unchanged |
| `tsconfig.json` | Include existing Node/React/React Native type packages | None | Typecheck; Node fs imports need explicit types with TypeScript 6; no package installation |
| `README.md` | Setup, contract, privacy, guardrails and this file-by-file review | Documentation links only | Diff/content review; separates mocked verification from unperformed live/device acceptance |
| `PLAN.md` | Ticket status, scope, limits and next acceptance work | None | Diff review; keeps production and product decisions deferred |
| `LEARNING_LOG.md` | Dated technical notes and actual verification evidence | Documentation links only | Diff review; preserves the earlier uncommitted Ticket 1.2 entry |

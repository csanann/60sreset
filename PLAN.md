# Plan

## Objective and current stage

Ticket 1.3B implements controlled Gemini 2.5 Flash-Lite integration for local development, with mock mode as the default. The owner selected a 10-attempt UTC daily cap and confirmed that production Gemini must remain disabled. Ticket 1.3A remains complete; its earlier browser acceptance does not establish acceptance of the new structured/safety UI. Live model access, new manual browser/mobile acceptance, security follow-ups and hosted deployment remain outstanding.

## Completed setup

- Node 22.23.3 pinned through `.nvmrc`; retain npm 10.9.9.
- Expo-compatible ESLint 9 and eslint-config-expo 57 flat configuration.
- Typecheck and lint commands; both passed. Setup documented in README.
- Online Expo dependency compatibility check passed during baseline review.
- Git setup completed: `main` tracks `origin/main` at https://github.com/csanann/60sreset.git. Local and remote initial histories were merged and pushed as `bd4f161`.
- `.gitignore` protects local environment files, credentials, signing keys, dependencies, and generated output. Pattern review found no apparent credentials in project files or four reachable commits; author email metadata remains in history.

## Next task

Complete manual browser/mobile acceptance using fictional text. Verify the configured Gemini model's availability, restricted key, free-tier eligibility, account billing status and data handling before one separately approved fictional localhost smoke test. Paid billing must remain disconnected; unavailable access requires an options review, not automatic billing/model changes. After that smoke test, compare providers using the same small synthetic set and criteria: safety, reflection usefulness, structured-output reliability, latency, privacy and cost. Resolve beta blockers before private beta. Pricing, BYOK and other product integrations remain deferred. The owner authorized a local Ticket 1.3B commit on 2026-10-23; the owner will push. No deployment or dependency upgrade is authorized.

## Ticket 1.3B — UAT/security corrections (2026-10-23)

- Shared validation: `reset-contract.ts` adds `isClearlyNonMeaningfulThought` and fixed friendly copy; `validateThought` is used by screen/client/API. Reject whitespace/control-only, decimal-digit/punctuation-only and long x/q filler runs. Preserve short/mixed/emotional/Unicode text and original transmission; ambiguity passes. `index.tsx` derives inline feedback from its existing validator import.
- Safety: `reset-safety.ts` narrows harm targets and checks context before matches; selected historical/negated reports pass, separate current threats still block. New `containsUnsafeAdvice`, imported by `reset-service.ts`, checks fields/combined output without history exemptions. Added crisis-paraphrase, scam-victim/request and unsafe-output fixtures. English keywords remain incomplete semantic protection; no extra model validation calls.
- Body reads: `server-http.ts` adds `BodyReadError` and a five-second total deadline; `POST` imports these and passes `request.signal`, returning fixed 408 copy on timeout/abort. Cleanup releases timer/listener/reader and does not wait for stalled/rejected cancellation. Provider transport keeps its existing eight-second deadline.
- Evidence: **209 tests**, lint, typecheck and diff checks pass. `scripts/verify-reset-mock.mjs` uses Node imports and shared fixtures for mock-only localhost HTTP UAT, with dotenv disabled and external fetch blocked: input/safety fixtures, 400/413/415/405, real stalled upload 408, recovery and screen 200 passed; no external fetches/quota writes. No new rendered-browser/device acceptance is claimed.
- Preserved: mock default, explicit development-only Gemini, server-only key, ten durably reserved attempts/UTC day and no retry/refund/extra call. Actual-env default/production regressions and existing quota/transport tests pass. No dependencies, lockfile or configuration changed; no real Gemini request, commit, push or deployment.
- Review order/functions/imports and manual UAT checklist are in README. Owner understanding/acceptance remains to be checked, not assumed.
- Beta blockers: authentication/access and flood/in-flight controls; authoritative cross-instance quota; HTTPS/origin/adapter connection limits; broader safety and appropriate abuse refusal; provider/hosting privacy and retention; assess reachable dependency advisories. Keep production Gemini disabled. The earlier read-only audit found 24 affected entries from four underlying advisories; no dependency changes here.

## Ticket 1.3B — Controlled Gemini integration (2026-10-23)

- Contract: preserve 2,000 original UTF-16 input code units and 16 KiB streamed request bytes; require structured reflection/perspective with an optional next step, capped at 600/600/240 code units. Both server and client validate the response; model output can instead decline with a safety disposition.
- Flow: input validation → early danger phrase gate → explicit provider/development configuration → durable daily reservation → one Gemini request → completion/safety/schema checks → labelled response or fixed safe error. The early gate also applies in mock mode, consumes no quota and sends nothing to Google. Emotional intensity alone is not a gate trigger.
- Provider: raw REST `generateContent` for exactly `gemini-2.5-flash-lite`, one candidate, 512 output tokens, thinking budget 0, 8-second deadline including response reads and 32 KiB provider bytes. No SDK dependency, tools, history, redirect, automatic retry, repair request or fallback after a provider failure. Client keeps its 10-second timeout and single-submit guard.
- Modes: unset/`mock` uses fixed structured examples without credentials or filesystem quota. `RESET_PROVIDER=gemini` requires local development, server-only `GEMINI_API_KEY` and an initialized quota file. Invalid configuration, missing key, unavailable enforcement or production Gemini fails closed. No client/public configuration contains a key.
- Budget: owner-selected **10 attempts per UTC day**. Explicit initialization creates an ignored aggregate counter once; exclusive locking, synchronized writes and atomic rename persist a reservation before any provider request. Failure/timeout/cancellation/invalid output does not refund a reserved attempt. Missing/corrupt/locked state, incomplete writes and backwards clock deny calls. No thoughts, responses, IPs, identifiers or keys enter this file.
- Instance limits: only processes sharing one durable local path coordinate. Other paths/clones/machines/isolated instances each have separate budgets; deleting state is not an authorized quota reset. This is not a distributed or tamper-proof provider-account limit. Production Gemini stays disabled pending a separate quota/access/hosting design.
- Safety limits: early checks are English phrase heuristics; model instructions and provider blocks add layers, not a clinical assessment or guarantee. Quoting/negation, paraphrases, other languages, prompt injection and harmful but schema-valid output require broader evaluation. The UI shows fixed support copy for recognized risk rather than a normal perspective.
- Privacy: the application does not log/persist thought, output or key content. Gemini mode transmits text to Google, whose handling/retention is separate. Fictional text only; review [provider terms](https://ai.google.dev/gemini-api/terms) and account controls before real personal data. Existing dependency-security follow-ups below remain unresolved; no audit or remediation was performed in this ticket.
- Model access blocker: the [Developer API model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite) now restricts 2.5 access to previously active users. This project's access is not verified; no substitute model is selected automatically. No valid-key/model smoke test or generation has been performed. Two early harness runs may have attempted unauthenticated requests with fictional credentials/text after Expo replaced a writable fetch mock; the corrected harness and incident are documented in README/learning log.
- Verification: all 162 tests, lint, typecheck, diff checks and web/server export pass; the original 40 mock/validation/error scenarios are retained with structured fixtures. Added contract, transport, quota persistence/concurrency, early safety/intensity, orchestration, real POST with mocked provider, and client/server import-boundary tests. TypeScript explicitly includes already-installed Node/React/React Native types; no dependency or lockfile versions changed. Exported artifacts keep provider/key access out of the client. Corrected local HTTP verification confirms 10 intercepted development calls then 429, no quota consumed for unsafe/invalid input, exported mock 200 and production Gemini 503 with no provider calls.
- Review guide: README's Ticket 1.3B table reports every changed file's purpose, imports, important functions, test coverage and rationale. Additional helpers isolate server policy, network access and filesystem reservation semantics. Prior uncommitted Ticket 1.2 learning notes are preserved.

## Ticket 1.3B acceptance still required

- Manually exercise the structured mock, safety branch and fixed error/retry messages in the browser and on the intended iOS/Android device; existing 2026-10-18 browser results apply only to Ticket 1.3A.
- Owner review of model eligibility, credential restrictions and provider data handling; at most one fictional real smoke test after explicit approval. No key needs to be sent through chat.
- Production adapter/HTTPS/origin and distributed quota/access enforcement: no hosted deployment has been verified. Local Node 22 filesystem semantics must not be assumed on EAS/worker/serverless runtimes.

## Ticket 1.3A — Mock endpoint — Complete (2026-10-18)

- Request flow: the screen calls the client helper, which sends an HTTP POST to the `/api/reset` endpoint with JSON `{ "thought": "Synthetic test thought" }`. The server parses/validates the body and returns JSON containing `mock`, `label` and `reflection`. POST is the method, the endpoint is the destination, and JSON is the data format.
- Client validation gives immediate feedback and avoids unnecessary requests. Server validation is authoritative because direct HTTP callers can bypass the UI. Shared rules in `reset-contract.ts` are applied independently at both boundaries; TypeScript types do not validate incoming JSON at runtime.
- Added Expo Router `POST /api/reset` using SDK 57 server output. Accepts exactly `{ thought: string }`, non-whitespace, at most 2,000 UTF-16 code units before trimming; body capped at 16 KiB while streaming.
- Returns one fixed reflection explicitly labelled as mock/not AI-generated, independent of input. Validates JSON/content type and returns fixed 400/413/415/500 errors. Unsupported methods are handled by Router (405).
- Reset now calls the server with loading, success and retryable error states. Input/submission are disabled during requests; a synchronous guard prevents duplicate submissions. Requests time out after 10 seconds and abort on unmount; edits clear results/errors.
- No external AI, authentication, database, analytics, persistence, thought logging, secrets, environment variables or added dependencies. Thoughts are transiently transmitted to the app server; responses never echo input and use `no-store`. Future hosting must not capture request bodies.
- Added Node built-in tests for validation boundaries, malformed input, body limits, UTF-8 chunking, safe errors, client HTTP/network/protocol failures, timeout and cancellation. Explicit `.ts` imports allow Node to run the same source; TypeScript permits these through `allowImportingTsExtensions`.
- Removed the stale `/explore` link from the unused web tab component to resolve a typecheck failure caused by the earlier route removal. Existing `_layout.tsx` changes and Explore route deletion were preserved.
- Verification: 40 tests, lint, typecheck and web/server export passed. Exported-server HTTP checks confirmed 200 for valid POST, 400 for invalid input/JSON, 413 for excessive body size, 415 for unsupported content type and 405 for GET. Final review tightened the client validation test to assert that invalid input makes zero network calls.
- Manual browser acceptance: on 2026-10-18, the user reported all listed checks passed: blank/whitespace input, valid submission and labelled mock response, edit/resubmit, loading, blocked-network error/retry and the 2,000-character limit. This is user-reported browser evidence, separate from automated tests and device verification.
- Future provider credentials must stay in server-only hosting secret configuration, accessed by the API handler or server-only modules. Never put credentials in client/shared modules, `EXPO_PUBLIC_` variables, public app configuration, responses or logs. No keys, secret configuration or provider integration are added in this ticket. See [Expo API route isolation](https://docs.expo.dev/router/web/api-routes/#security) and [public environment variables](https://docs.expo.dev/guides/environment-variables/).
- Deployment is outside this ticket. Native production needs a hosted HTTPS server and Router origin; static-only hosting cannot serve this endpoint.

## Deferred decisions and remaining limits

- Mobile: iOS/Android connectivity, keyboard/scrolling, large text, themes and VoiceOver/TalkBack acceptance remain unverified. Browser results do not establish native behaviour.
- Security: the dated dependency review below remains unresolved and was not rerun for this documentation update. Server-side key secrecy alone would not prevent unauthorized use or provider costs; review access/abuse controls before adding a paid provider. The current endpoint is an unauthenticated local mock by design.
- Hosting: no deployment, production HTTPS host, native production origin or infrastructure request-body logging/retention review has been completed. Development HTTP checks used synthetic text.
- Pricing: pricing model, amounts and billing implementation remain undecided and outside Ticket 1.3A.
- BYOK (bring your own key): whether to support it, credential handling and the user experience remain undecided. No key entry, storage or forwarding exists.
- BiteToBalance: any relationship or integration with this project remains undecided. No integration or data sharing is implemented.

## Ticket 1.2 — Minimal text-input UI

- Implemented one Expo Router screen with title `60sReset`, prompt `What's on your mind?`, one multiline input, and `Reset my thoughts` button.
- Empty/whitespace-only input disables submission; the submit handler also guards it. Input text is retained verbatim with no format restrictions.
- Submission displays a fixed response labelled `Placeholder response — not AI-generated`. Editing clears the response; input and response exist only in component memory.
- Replaced starter tabs with a headerless Stack and removed the Explore route. Unused starter components/assets remain outside the route directory for a later cleanup ticket.
- Responsive content width, scrolling, safe areas, keyboard avoidance, light/dark colours, scalable text, input accessibility label/hint, button role/disabled state, and a polite response live region.
- No API calls, logging of thoughts, persistence, login, database, history, speech, or new dependencies.
- Verification: lint and TypeScript checks passed. No test script or existing test suite is configured. Web production export verification is recorded in the learning log.
- Remaining manual acceptance: empty and whitespace input, messy multiline input, submit/edit/resubmit; narrow/wide web layouts; keyboard-only navigation; mobile keyboard and scrolling; large text, light/dark mode, VoiceOver/TalkBack response discovery. Static checks do not establish these behaviours.

## Security review — 2026-10-11

`npm audit --omit=dev` reports 29 affected packages (18 high, 11 moderate, no critical), inherited from four underlying advisories. This is dependency-tree classification, not proof of shipped runtime exposure: Expo's regular dependencies include CLI/build tooling.

| Package / severity | Installed dependency path | Exposure and remediation assessment |
| --- | --- | --- |
| `decode-uri-component@0.2.2` / moderate | `expo-router@57.0.25` → `query-string@7.1.3` | Malformed percent-encoded input can consume excessive CPU. Runtime dependency, but Expo Router's primary forked query parser uses URL search parameters; other parsing paths and release-bundle reachability remain unverified. Fixed in `0.5.0`, which is ESM and outside the parent's `^0.2.2` range. No drop-in compatible fix established; prefer a maintainer-supported Router update within SDK 57, or review and test a scoped backport/override after approval. |
| `braces@3.0.3` / high | `expo@57.0.27` → `@expo/metro@56.0.2` → `metro-file-map@0.84.5` → `micromatch@4.0.8` | Build/dev tooling: deeply nested patterns can exhaust the stack. Untrusted pattern reachability has not been demonstrated. No patched version listed; use trusted build/config inputs, avoid exposing the dev server publicly, and monitor the upstream fix. |
| `node-forge@1.4.0` / high | `expo@57.0.27` → `@expo/cli@57.0.28` (directly and through `@expo/code-signing-certificates@0.0.6`) | CLI/signing tooling: malformed RSA signatures can pass verification with low-exponent keys. Installed signing helpers call verification functions; exploitability with the actual keys/workflow is unverified. No patched version listed; use trusted signing inputs and review verification/key assumptions before release or signed-update workflows. This finding does not establish a flaw in native device signature verification. |
| `uuid@7.0.3` / moderate | `expo-splash-screen@57.0.9` → `@expo/config-plugins@57.0.10` → `xcode@3.0.1` | Native project generation tooling. Flaw affects `v3/v5/v6` with caller-supplied output buffers; inspected xcode usage calls unaffected `v4()`. Fixed in `11.1.1` (also `12.0.1`/`13.0.1`); a major override requires compatibility validation. Prefer an upstream config-plugin/xcode update; no immediate affected call found in this path. |

Sources:

- https://github.com/advisories/GHSA-vcc3-ghjq-m6fr
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/advisories/GHSA-w5hq-g745-h8pq
- https://docs.expo.dev/versions/v57.0.0/ (SDK 57 targets React Native 0.86)

Remaining security work:

- Confirm decoder reachability in native/web release bundles and incoming URL paths; validate navigation and malformed-input handling before production release.
- Recheck upstream fixes and evaluate any candidate in an isolated change, including package module/API compatibility and Expo SDK compatibility.
- Obtain approval before changing dependencies, overrides, or patches. Do not run `npm audit fix --force` or downgrade Expo/React Native. Registry lists installed Expo `57.0.27` as the latest SDK 57 version at this review.
- After approved remediation, rerun audit, Expo compatibility checks, lint, typecheck, and relevant runtime tests. No dependency remediation or exploit tests were performed in this review.

Local UI development can continue with trusted inputs and a private/local development server. This is not production security clearance.

## Later stages

- Verify Ticket 1.2 launch, input/submission, theme handling, and keyboard behaviour on the intended iOS/Android device or simulator; web preview alone does not establish mobile correctness.
- Verify a clean `npm ci` baseline separately; it has not been performed in this review.
- Run `npm test` for the Ticket 1.3A route/request helper suite; rendered screen/device tests remain future work.

## Non-goals

Ticket 1.3B permits only the explicitly controlled local-development provider integration and aggregate quota counter. It excludes production Gemini, agents/tools, accounts/authentication, databases, personal-data storage/logging, saved history, speech, analytics, deployment, dependency upgrades and product pricing/BYOK/BiteToBalance decisions. No real smoke test runs without owner approval. Ticket 1.3A's mock-only/no-secret scope remains historical; security dependency changes require a separate reviewed task.

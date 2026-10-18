# Plan

## Objective and current stage

Ticket 1.3A: connect the existing 60sReset screen to one server-side mock endpoint. Ticket 1.1 tooling and Ticket 1.2 UI implementation are complete; device acceptance remains outstanding.

## Completed setup

- Node 22.23.3 pinned through `.nvmrc`; retain npm 10.9.9.
- Expo-compatible ESLint 9 and eslint-config-expo 57 flat configuration.
- Typecheck and lint commands; both passed. Setup documented in README.
- Online Expo dependency compatibility check passed during baseline review.
- Git setup completed: `main` tracks `origin/main` at https://github.com/csanann/60sreset.git. Local and remote initial histories were merged and pushed as `bd4f161`.
- `.gitignore` protects local environment files, credentials, signing keys, dependencies, and generated output. Pattern review found no apparent credentials in project files or four reachable commits; author email metadata remains in history.

## Next task

Manually verify the connected screen in the browser and on the intended mobile platform. Preserve the security follow-up below. Do not commit or push automatically.

## Ticket 1.3A — Mock endpoint

- Added Expo Router `POST /api/reset` using SDK 57 server output. Accepts exactly `{ thought: string }`, non-whitespace, at most 2,000 UTF-16 code units before trimming; body capped at 16 KiB while streaming.
- Returns one fixed reflection explicitly labelled as mock/not AI-generated, independent of input. Validates JSON/content type and returns fixed 400/413/415/500 errors. Unsupported methods are handled by Router (405).
- Reset now calls the server with loading, success and retryable error states. Input/submission are disabled during requests; a synchronous guard prevents duplicate submissions. Requests time out after 10 seconds and abort on unmount; edits clear results/errors.
- No external AI, authentication, database, analytics, persistence, thought logging, secrets, environment variables or added dependencies. Thoughts are transiently transmitted to the app server; responses never echo input and use `no-store`. Future hosting must not capture request bodies.
- Added Node built-in tests for validation boundaries, malformed input, body limits, UTF-8 chunking, safe errors, client HTTP/network/protocol failures, timeout and cancellation. Explicit `.ts` imports allow Node to run the same source; TypeScript permits these through `allowImportingTsExtensions`.
- Removed the stale `/explore` link from the unused web tab component to resolve a typecheck failure caused by the earlier route removal. Existing `_layout.tsx` changes and Explore route deletion were preserved.
- Verification: 40 tests, lint, typecheck and web/server export passed. Exported-server HTTP checks confirmed 200 for valid POST, 400 for invalid input/JSON, 413 for excessive body size, 415 for unsupported content type and 405 for GET. Final review tightened the client validation test to assert that invalid input makes zero network calls. Browser interactions and native device behaviour remain manual acceptance items.
- Deployment is outside this ticket. Native production needs a hosted HTTPS server and Router origin; static-only hosting cannot serve this endpoint.

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

Ticket 1.3A excludes AI/LLM integrations, agents, accounts, databases, saved history, speech, analytics, deployment, secrets/environment variables and dependency upgrades. It supersedes Ticket 1.2's exclusion of API calls by adding only the local mock endpoint. Security dependency changes require separate approval.

# 60sreset

60sReset is an Expo mobile app with one thoughts input and a fixed mock reflection returned by a server endpoint. Ticket 1.3A connects the existing screen to that endpoint; no AI provider is used.

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

Typecheck checks TypeScript without generating JavaScript. Lint uses Expo's ESLint rules. The tests use Node 22's built-in test runner and TypeScript stripping, with no added dependencies. Node may report module-detection and experimental mock-timer warnings; these do not indicate test failures. Tests cover the route and request helper, not rendered UI/device interactions.

## Mock endpoint — Ticket 1.3A

Start the Expo development server with `npm start`. Web uses its own origin; Expo Router resolves native relative requests to the development server. A phone must be able to reach that server on your local network. No secrets or environment variables are needed.

`POST /api/reset` accepts `Content-Type: application/json` and exactly one field:

```json
{ "thought": "A lot is on my mind today." }
```

- `thought` must be a string with non-whitespace content, at most **2,000 UTF-16 code units**, including surrounding whitespace. Emoji may use two code units. Original text is sent verbatim; trimming only checks emptiness.
- The server also caps the streamed request body at **16 KiB**, including JSON syntax/escaping. Client validation and the input limit are convenience measures; the server independently validates every request.
- Success: `200` with `{ "mock": true, "label": "Mock reflection — not AI-generated", "reflection": "…" }`. Every valid thought gets the same reflection. The response never includes the thought.
- Errors: `400` for invalid JSON, shape, type, empty input or excessive thought length; `413` for excessive body bytes; `415` for unsupported content type; `500` for unexpected handler failures. Errors contain only fixed messages. Expo Router returns `405` for unsupported methods.
- The screen shows loading, the labelled success response, or a fixed error with the Reset button available to retry. It disables editing/submission during a request, aborts after 10 seconds or unmount, and clears the result/error when edited.

For a local HTTP smoke check, use synthetic text:

```sh
curl -i http://localhost:8081/api/reset \
  -H 'Content-Type: application/json' \
  -d '{"thought":"Synthetic test thought"}'
```

The app and endpoint add no thought logging, storage, analytics, authentication, database, or external AI requests. Thoughts remain in screen memory while mounted and transiently in the POST request/server memory. Responses use `Cache-Control: no-store`. Do not enable request-body logging in future hosting/proxy tooling; infrastructure retention is separate from this application code. Use synthetic text over local development HTTP.

## Server output and runtime checks

SDK 57 API routes require `web.output: "server"` in `app.json`. To check the production web/server bundle locally:

```sh
npx expo export --platform web
npx expo serve
```

Static-only hosting cannot run this endpoint. Production native builds require a deployed HTTPS server and its Expo Router `origin` configuration; this ticket does not deploy or configure a production host.

Manual acceptance: submit on web and an intended iOS/Android device; confirm loading, success, edit/resubmit, whitespace and length limits. On web, block `/api/reset` in browser network tools to check error/retry. Check keyboard scrolling, large text, dark/light modes and screen-reader announcements. Passing tests and export do not establish these device behaviours. Existing dependency-security follow-ups remain in `PLAN.md`.

## Structure

- `src/app/`: Expo Router screens, navigation layout, and `api/reset+api.ts` server route.
- `src/lib/`: shared input contract and client request helper.
- `tests/`: endpoint validation and client/server error tests using synthetic inputs.
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

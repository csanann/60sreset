# 60sreset

Expo starter application. Ticket 1.1 establishes development tooling only; the starter UI is unchanged.

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
```

Typecheck checks TypeScript without generating JavaScript. Lint uses Expo's ESLint rules. Both should exit successfully; these checks do not prove mobile runtime behaviour. No unit-test suite is configured yet.

## Structure

- `src/app/`: Expo Router screens and navigation layout.
- `src/components/`, `src/hooks/`, `src/constants/`: shared starter code.
- `assets/`: icons and images.
- `app.json`: Expo application configuration.
- `eslint.config.js`: Expo ESLint flat configuration.
- `PLAN.md`, `LEARNING_LOG.md`: current scope and learning evidence.

## References

- [Expo 57 requirements](https://docs.expo.dev/versions/v57.0.0/)
- [Expo ESLint setup](https://docs.expo.dev/guides/using-eslint/)

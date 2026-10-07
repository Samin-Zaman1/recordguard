# TypeScript Testing Fundamentals

[![CI](https://github.com/Samin-Zaman1/typescript-testing-fundamentals/actions/workflows/ci.yml/badge.svg)](https://github.com/Samin-Zaman1/typescript-testing-fundamentals/actions/workflows/ci.yml)

A small TypeScript codebase written test-first with [Vitest](https://vitest.dev): generic utilities, runtime validation of untrusted data, and a user service with retry logic, plus a [Playwright](https://playwright.dev) browser test. CI on GitHub Actions enforces 90% coverage, and `main` only accepts changes through pull requests that pass it.

## What's here

| Module | What it does | What the tests cover |
| --- | --- | --- |
| `src/utils.ts` | `isValidEmail`, `groupBy`, `retry`, `unique`, `sleep` | valid and invalid inputs, empty arrays, ordering inside groups, retry success / failure / bad arguments |
| `src/validate.ts` | `isUser` type guard that checks an `unknown` value is a real `User` | valid users, wrong types, missing fields, roles outside the allowed set |
| `src/userService.ts` | `UserService` loads users through an injected fetch function, retries failures, and separates valid from invalid records | mixed good and bad records, a failure followed by success, every attempt failing, an empty response, grouping by role |

29 unit tests across 3 files, plus an end-to-end test in `e2e/todo.spec.ts` that drives a real browser through the [TodoMVC demo app](https://demo.playwright.dev/todomvc). Playwright only looks in `e2e/` and Vitest only in `src/`, so neither runner picks up the other's tests.

## Testing approach

- **Untrusted data is typed `unknown` until proven otherwise.** `isUser` and `isValidEmail` are type guards, so the compiler only allows a value to be used as a `User` after the runtime check passes.
- **Invalid records are reported, not hidden.** `loadUsers` returns `{ valid, invalid }`, so callers and tests can see exactly what was rejected.
- **Dependencies are injected so they can be mocked.** `UserService` takes its fetch function and retry settings in the constructor. Tests pass a typed `vi.fn()` and script failures with `mockRejectedValueOnce` to exercise the retry path without a network.
- **Edge cases are table-driven.** `isUser` is checked against seven kinds of bad input (null, wrong types, missing or fractional id, bad email, unknown role) with a single `it.each` table.
- **Tests stay fast.** Retry delays are set to 1 ms in tests instead of the 100 ms default.
- **Coverage is a gate, not a report.** `vitest.config.ts` sets 90% thresholds for statements, branches, functions and lines, and the run fails below them.

## CI and workflow

- `.github/workflows/ci.yml` runs two jobs in parallel on every pull request and every push to `main`:
  - `test` runs the unit tests with coverage and uploads the HTML coverage report as an artifact.
  - `e2e` installs Chromium and runs the Playwright tests, uploading traces and screenshots if a test fails.
- A repository ruleset on `main` requires a pull request with passing `test` and `e2e` checks, and blocks force pushes and deletion. A pull request with a failing test cannot be merged.

## Run locally

```bash
npm ci
npm test                        # run the unit tests
npm run coverage                # run with coverage and enforce the thresholds
npx playwright install chromium # one-time browser download
npm run e2e                     # run the end-to-end tests
```

Requires Node 22 or later.

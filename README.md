# TypeScript Testing Fundamentals

[![CI](https://github.com/Samin-Zaman1/typescript-testing-fundamentals/actions/workflows/ci.yml/badge.svg)](https://github.com/Samin-Zaman1/typescript-testing-fundamentals/actions/workflows/ci.yml)

A small TypeScript codebase written test-first with [Vitest](https://vitest.dev): generic utilities, runtime validation of untrusted data, and a user service with retry logic. CI on GitHub Actions enforces 90% coverage, and `main` only accepts changes through pull requests that pass it.

## What's here

| Module | What it does | What the tests cover |
| --- | --- | --- |
| `src/utils.ts` | `isValidEmail`, `groupBy`, `retry`, `unique`, `sleep` | valid and invalid inputs, empty arrays, ordering inside groups, retry success / failure / bad arguments |
| `src/validate.ts` | `isUser` type guard that checks an `unknown` value is a real `User` | valid users, wrong types, missing fields, roles outside the allowed set |
| `src/userService.ts` | `UserService` loads users through an injected fetch function, retries failures, and separates valid from invalid records | mixed good and bad records, a failure followed by success, every attempt failing, an empty response, grouping by role |

29 tests across 3 files.

## Testing approach

- **Untrusted data is typed `unknown` until proven otherwise.** `isUser` and `isValidEmail` are type guards, so the compiler only allows a value to be used as a `User` after the runtime check passes.
- **Invalid records are reported, not hidden.** `loadUsers` returns `{ valid, invalid }`, so callers and tests can see exactly what was rejected.
- **Dependencies are injected so they can be mocked.** `UserService` takes its fetch function and retry settings in the constructor. Tests pass a typed `vi.fn()` and script failures with `mockRejectedValueOnce` to exercise the retry path without a network.
- **Edge cases are table-driven.** `isUser` is checked against seven kinds of bad input (null, wrong types, missing or fractional id, bad email, unknown role) with a single `it.each` table.
- **Tests stay fast.** Retry delays are set to 1 ms in tests instead of the 100 ms default.
- **Coverage is a gate, not a report.** `vitest.config.ts` sets 90% thresholds for statements, branches, functions and lines, and the run fails below them.

## CI and workflow

- `.github/workflows/ci.yml` runs the test suite with coverage on every pull request and every push to `main`, and uploads the HTML coverage report as an artifact.
- A repository ruleset on `main` requires a pull request and a passing `test` check, and blocks force pushes and deletion. A pull request with a failing test cannot be merged.

## Run locally

```bash
npm ci
npm test            # run the tests
npm run coverage    # run with coverage and enforce the thresholds
```

Requires Node 22 or later.

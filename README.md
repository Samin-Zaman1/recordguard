# RecordGuard

**Stop bad API data before it reaches your app.**

[![CI](https://github.com/Samin-Zaman1/recordguard/actions/workflows/ci.yml/badge.svg)](https://github.com/Samin-Zaman1/recordguard/actions/workflows/ci.yml)

RecordGuard loads data from an API with retries, checks every record at runtime, and gives you back the good records and the bad ones separately: `{ valid, invalid }`. Your app no longer crashes on the first bad record, and bad records are no longer silently dropped.

Works with a plain TypeScript type guard or any [Standard Schema](https://standardschema.dev) validator: Zod, Valibot, ArkType and others, with no adapter. Zero runtime dependencies.

```ts
import { loadAndGuard } from "recordguard";
import { z } from "zod";

const User = z.object({ id: z.number().int(), email: z.email() });

const { valid, invalid } = await loadAndGuard({
  load: () => fetch("https://api.example.com/users").then((r) => r.json()),
  validate: User,
});

valid;   // { id: number; email: string }[], typed from the schema
invalid; // [{ index: 3, value: {...}, issues: [{ message: "Invalid email address", path: ["email"] }] }]
```

## Why

Data from APIs, files and queues can't be trusted. The usual options are both bad:

- **Validate the whole array at once:** one malformed record fails the entire batch.
- **Filter out what doesn't match:** bad records vanish, and nobody finds out the upstream system is broken.

RecordGuard keeps the good records and returns every bad one with its position and the exact reasons it failed, so you can log, alert, or repair them.

## Install

```bash
npm install recordguard
```

Requires Node 22 or later. ESM only.

## Usage

### `guard(records, validator)`

Splits an array you already have. Order is preserved in both lists.

```ts
import { guard } from "recordguard";

function isUser(value: unknown): value is User { /* ... */ }

const { valid, invalid } = guard(rows, isUser);
// invalid: [{ index: 1, value: { id: "2" }, issues: [{ message: "Rejected by isUser" }] }]
```

With a schema, `valid` holds the schema's **output**, so transforms and defaults are applied.

### `guardAsync(records, validator)`

Same as `guard`, for schemas with async checks (for example a Zod `.refine(async ...)` that looks something up). `guard` throws a `TypeError` pointing here if it meets one.

### `loadAndGuard(options)`

Loads, retries on failure, then checks.

| Option | Default | |
| --- | --- | --- |
| `load` | required | Function returning the records (sync or async). Must resolve to an array. |
| `validate` | required | Type guard or Standard Schema. |
| `attempts` | `3` | Total tries, including the first. |
| `delayMs` | `100` | Wait before the first retry. |
| `backoff` | `2` | Multiplier per retry: 100, 200, 400 ms ... Use `1` for a fixed delay. |
| `shouldRetry` | always | `(error, attempt) => boolean`. Return `false` to stop, e.g. on a 404. |
| `signal` | none | `AbortSignal` to cancel, including while waiting between retries. |

If every attempt fails, the last error is rethrown unchanged. If `load` succeeds but returns something other than an array, it fails immediately with a `TypeError` and is **not** retried: that's a contract problem, not a temporary one.

### `retry(fn, options)`

The retry logic on its own, with the same options as above.

## Behaviour you can rely on

- **One bad record never sinks the batch.** If a validator throws on a record, that record is rejected with `Validator threw: <message>` and the rest carry on.
- **Nothing is dropped silently.** Every input record ends up in exactly one of `valid` or `invalid`.
- **Issue paths are plain keys.** Schema path segments are flattened, so `path` is always something like `["address", "postcode"]`.
- **Types follow the validator.** `valid` is typed from the type guard or the schema's output type.

## Example

`npm run example` runs [`examples/users.ts`](examples/users.ts) against an API stub that fails twice and then returns a mix of good and bad users:

```
Load failed on attempt 1, retrying...
Load failed on attempt 2, retrying...

Loaded after 3 attempts: 2 valid, 2 rejected

  ok        #1 ada@example.com (admin)
  ok        #3 grace@example.com (customer)
  rejected  record 1: email: Invalid email address
  rejected  record 3: id: Invalid input: expected int, received number; role: Invalid option: expected one of "admin"|"customer"
```

## How it's tested

| Layer | Where | What it proves |
| --- | --- | --- |
| Unit | `src/*.test.ts` (Vitest) | Checking with type guards and schemas, issue paths, throwing and async validators, exact backoff timing (fake timers), `shouldRetry`, cancellation mid-wait and mid-attempt, option validation |
| Interop | `src/zod.test.ts` | A real Zod schema works unmodified: inferred types, issue paths, defaults, async refinements |
| Package | `e2e/package.test.ts` | Builds and `npm pack`s the library, installs the tarball into an empty project, then uses it from JavaScript against a local HTTP server that fails before it succeeds, and from TypeScript to check the published types |
| Types | `expectTypeOf` + `@ts-expect-error` | `valid` is inferred correctly and wrong usages fail to compile |

- **100% coverage**, with a 90% minimum enforced in CI.
- **The package test checks what users install, not the source.** It confirms the tarball contains the build and types and leaves out tests. Breaking the `exports` path in `package.json` makes it fail.
- **CI** runs typecheck, unit tests with coverage and a build, plus the package test on Node 22 and 24. `main` only accepts pull requests that pass.

## Development

```bash
npm ci
npm test            # unit tests
npm run coverage    # with coverage thresholds
npm run typecheck   # library, tests, example and package test
npm run e2e         # build, pack, install and use the real package
npm run example     # the example above
```

## License

MIT

import type { StandardSchemaV1 } from "./standard-schema.js";
import type { InvalidRecord, GuardIssue, GuardResult, Validator } from "./types.js";

type Outcome<T> = { ok: true; value: T } | { ok: false; issues: GuardIssue[] };

function isStandardSchema<T>(validator: Validator<T>): validator is StandardSchemaV1<unknown, T> {
  return typeof validator === "object" && validator !== null && "~standard" in validator;
}

// Schema paths can be plain keys or { key } segments; callers get plain keys.
function toIssue(issue: StandardSchemaV1.Issue): GuardIssue {
  if (!issue.path) return { message: issue.message };
  const path = issue.path.map((segment) =>
    typeof segment === "object" && segment !== null ? segment.key : segment,
  );
  return { message: issue.message, path };
}

function fromSchemaResult<T>(result: StandardSchemaV1.Result<T>): Outcome<T> {
  // Use the schema's output, not the raw input, so transforms and defaults apply.
  if (result.issues === undefined) return { ok: true, value: result.value };
  return { ok: false, issues: result.issues.map(toIssue) };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Validates one record. A validator that throws rejects that record only:
// one malformed record must not take down the whole batch.
function check<T>(validator: Validator<T>, value: unknown): Outcome<T> | Promise<Outcome<T>> {
  try {
    if (isStandardSchema(validator)) {
      const result = validator["~standard"].validate(value);
      if (result instanceof Promise) {
        return result.then(fromSchemaResult, (error: unknown) => ({
          ok: false as const,
          issues: [{ message: `Validator threw: ${describeError(error)}` }],
        }));
      }
      return fromSchemaResult(result);
    }
    if (validator(value)) return { ok: true, value };
    return { ok: false, issues: [{ message: `Rejected by ${validator.name || "validator"}` }] };
  } catch (error) {
    return { ok: false, issues: [{ message: `Validator threw: ${describeError(error)}` }] };
  }
}

function collect<T>(records: readonly unknown[], outcomes: readonly Outcome<T>[]): GuardResult<T> {
  const valid: T[] = [];
  const invalid: InvalidRecord[] = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.ok) valid.push(outcome.value);
    else invalid.push({ index, value: records[index], issues: outcome.issues });
  });
  return { valid, invalid };
}

/**
 * Splits records into those that pass the validator and those that don't.
 * Order is preserved in both lists. Throws a TypeError if the validator is an
 * async schema; use {@link guardAsync} for those.
 */
export function guard<T>(records: readonly unknown[], validator: Validator<T>): GuardResult<T> {
  const outcomes = records.map((record) => {
    const outcome = check(validator, record);
    if (outcome instanceof Promise) {
      throw new TypeError("This schema validates asynchronously; use guardAsync() instead of guard().");
    }
    return outcome;
  });
  return collect(records, outcomes);
}

/** Like {@link guard}, but also accepts schemas that validate asynchronously. */
export async function guardAsync<T>(
  records: readonly unknown[],
  validator: Validator<T>,
): Promise<GuardResult<T>> {
  const outcomes = await Promise.all(records.map((record) => check(validator, record)));
  return collect(records, outcomes);
}

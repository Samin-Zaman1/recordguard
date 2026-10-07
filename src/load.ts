import { retry, type RetryOptions } from "./retry.js";
import { guardAsync } from "./guard.js";
import type { GuardResult, Validator } from "./types.js";

export interface LoadAndGuardOptions<T> extends RetryOptions {
  /** Fetches the raw records, e.g. () => fetch(url).then((r) => r.json()). Must resolve to an array. */
  load: () => unknown;
  /** A type guard or Standard Schema (Zod, Valibot, ArkType, ...) that each record must pass. */
  validate: Validator<T>;
}

/**
 * Loads records with retries, then checks them into valid and invalid.
 *
 * Retries cover the load only: a response that isn't an array is a contract
 * problem, not a transient one, so it fails immediately with a TypeError.
 */
export async function loadAndGuard<T>(options: LoadAndGuardOptions<T>): Promise<GuardResult<T>> {
  const { load, validate, ...retryOptions } = options;
  const records = await retry(load, retryOptions);
  if (!Array.isArray(records)) {
    const got = records === null ? "null" : typeof records;
    throw new TypeError(`load() must resolve to an array of records, got ${got}`);
  }
  return guardAsync(records, validate);
}

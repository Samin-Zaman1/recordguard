import type { StandardSchemaV1 } from "./standard-schema.js";

// A type guard: returns true when the value is a T, and TypeScript narrows it.
export type TypeGuard<T> = (value: unknown) => value is T;

// Anything recordsift can validate with: a hand-written type guard, or a
// Standard Schema (Zod, Valibot, ArkType, ...).
export type Validator<T> = TypeGuard<T> | StandardSchemaV1<unknown, T>;

// Why a record was rejected. Schema issues are passed through with their
// paths flattened to plain keys, e.g. { message: "Invalid email", path: ["email"] }.
export interface SiftIssue {
  readonly message: string;
  readonly path?: readonly PropertyKey[];
}

// A rejected record, kept rather than dropped so callers can log, report or
// repair it. index is its position in the input array.
export interface InvalidRecord {
  readonly index: number;
  readonly value: unknown;
  readonly issues: readonly SiftIssue[];
}

export interface SiftResult<T> {
  readonly valid: T[];
  readonly invalid: InvalidRecord[];
}

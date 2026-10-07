import { describe, expect, expectTypeOf, it } from "vitest";
import { sift, siftAsync } from "./sift.js";
import type { StandardSchemaV1 } from "./standard-schema.js";

interface User {
  id: number;
  email: string;
}

function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return Number.isInteger(record.id) && typeof record.email === "string";
}

// A minimal hand-written Standard Schema, so these tests don't depend on any
// one validation library. Zod interop is covered in zod.test.ts.
function schema<T>(
  validate: (value: unknown) => StandardSchemaV1.Result<T> | Promise<StandardSchemaV1.Result<T>>,
): StandardSchemaV1<unknown, T> {
  return { "~standard": { version: 1, vendor: "test", validate } };
}

const ada = { id: 1, email: "ada@example.com" };
const grace = { id: 2, email: "grace@example.com" };

describe("sift with a type guard", () => {
  it("splits records into valid and invalid, keeping order", () => {
    const records = [ada, { id: "2" }, grace, null];

    const result = sift(records, isUser);

    expect(result.valid).toEqual([ada, grace]);
    expect(result.invalid).toEqual([
      { index: 1, value: { id: "2" }, issues: [{ message: "Rejected by isUser" }] },
      { index: 3, value: null, issues: [{ message: "Rejected by isUser" }] },
    ]);
  });

  it("narrows valid records to the guarded type", () => {
    const { valid } = sift([ada], isUser);
    expectTypeOf(valid).toEqualTypeOf<User[]>();
  });

  it("names an anonymous guard generically", () => {
    const { invalid } = sift([1], ((v: unknown) => v === "x") as (v: unknown) => v is "x");
    expect(invalid[0]?.issues).toEqual([{ message: "Rejected by validator" }]);
  });

  it("returns two empty lists for no records", () => {
    expect(sift([], isUser)).toEqual({ valid: [], invalid: [] });
  });

  it("rejects only the record whose validation throws, not the whole batch", () => {
    const explodesOnTwo = (value: unknown): value is number => {
      if (value === 2) throw new Error("boom");
      return typeof value === "number";
    };

    const result = sift([1, 2, 3], explodesOnTwo);

    expect(result.valid).toEqual([1, 3]);
    expect(result.invalid).toEqual([{ index: 1, value: 2, issues: [{ message: "Validator threw: boom" }] }]);
  });

  it("reports non-Error throws as text", () => {
    const throwsString = (_: unknown): _ is never => {
      throw "bad input";
    };
    expect(sift([1], throwsString).invalid[0]?.issues).toEqual([{ message: "Validator threw: bad input" }]);
  });
});

describe("sift with a Standard Schema", () => {
  const positive = schema<number>((value) =>
    typeof value === "number" && value > 0
      ? { value }
      : { issues: [{ message: "Expected a positive number", path: ["amount", { key: 0 }] }] },
  );

  it("passes issues through with path segments flattened to keys", () => {
    const result = sift([5, -1], positive);

    expect(result.valid).toEqual([5]);
    expect(result.invalid).toEqual([
      { index: 1, value: -1, issues: [{ message: "Expected a positive number", path: ["amount", 0] }] },
    ]);
  });

  it("omits path when the schema gives none", () => {
    const noPath = schema<never>(() => ({ issues: [{ message: "Nope" }] }));
    expect(sift(["x"], noPath).invalid[0]?.issues).toEqual([{ message: "Nope" }]);
  });

  it("returns the schema's output, so transforms apply", () => {
    const trimmed = schema<string>((value) =>
      typeof value === "string" ? { value: value.trim() } : { issues: [{ message: "Expected a string" }] },
    );
    expect(sift(["  hi  "], trimmed).valid).toEqual(["hi"]);
  });

  it("refuses an async schema and points to siftAsync", () => {
    const asyncSchema = schema<number>(async (value) => ({ value: value as number }));
    expect(() => sift([1], asyncSchema)).toThrow(new TypeError(
      "This schema validates asynchronously; use siftAsync() instead of sift().",
    ));
  });
});

describe("siftAsync", () => {
  it("awaits async schemas", async () => {
    const evenAsync = schema<number>(async (value) =>
      typeof value === "number" && value % 2 === 0 ? { value } : { issues: [{ message: "Expected an even number" }] },
    );

    const result = await siftAsync([2, 3, 4], evenAsync);

    expect(result.valid).toEqual([2, 4]);
    expect(result.invalid).toEqual([{ index: 1, value: 3, issues: [{ message: "Expected an even number" }] }]);
  });

  it("rejects only the record whose async validation fails", async () => {
    const rejectsOnTwo = schema<number>(async (value) => {
      if (value === 2) throw new Error("lookup failed");
      return { value: value as number };
    });

    const result = await siftAsync([1, 2], rejectsOnTwo);

    expect(result.valid).toEqual([1]);
    expect(result.invalid).toEqual([{ index: 1, value: 2, issues: [{ message: "Validator threw: lookup failed" }] }]);
  });

  it("works with plain type guards too", async () => {
    expect(await siftAsync([ada, "x"], isUser)).toEqual({
      valid: [ada],
      invalid: [{ index: 1, value: "x", issues: [{ message: "Rejected by isUser" }] }],
    });
  });
});

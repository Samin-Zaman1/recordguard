import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { loadAndSift, sift, siftAsync } from "./index.js";

// Interop check: a real Zod schema goes straight in, no adapter needed.
const User = z.object({
  id: z.number().int(),
  email: z.email(),
  role: z.enum(["admin", "customer"]).default("customer"),
});
type User = z.output<typeof User>;

describe("Zod interop", () => {
  it("infers the valid type from the schema", () => {
    const { valid } = sift([], User);
    expectTypeOf(valid).toEqualTypeOf<User[]>();
  });

  it("splits records and reports Zod's issues with their paths", () => {
    const result = sift(
      [
        { id: 1, email: "ada@example.com", role: "admin" },
        { id: 2, email: "not-an-email", role: "admin" },
      ],
      User,
    );

    expect(result.valid).toEqual([{ id: 1, email: "ada@example.com", role: "admin" }]);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]?.index).toBe(1);
    expect(result.invalid[0]?.issues).toEqual([expect.objectContaining({ path: ["email"] })]);
  });

  it("applies Zod defaults to valid records", () => {
    expect(sift([{ id: 3, email: "grace@example.com" }], User).valid).toEqual([
      { id: 3, email: "grace@example.com", role: "customer" },
    ]);
  });

  it("handles async refinements through siftAsync and loadAndSift", async () => {
    const taken = new Set(["taken@example.com"]);
    const SignUp = z.object({ email: z.email() }).refine(async ({ email }) => !taken.has(email), {
      message: "Email already registered",
      path: ["email"],
    });
    const records = [{ email: "new@example.com" }, { email: "taken@example.com" }];

    expect(() => sift(records, SignUp)).toThrow(TypeError);

    const result = await siftAsync(records, SignUp);
    expect(result.valid).toEqual([{ email: "new@example.com" }]);
    expect(result.invalid[0]?.issues).toEqual([{ message: "Email already registered", path: ["email"] }]);

    expect(await loadAndSift({ load: async () => records, validate: SignUp })).toEqual(result);
  });
});

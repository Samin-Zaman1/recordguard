// describe = groups tests, it = one test, expect = an assertion
// vi = Vitest's toolbox for mocks
import { describe, it, expect, vi } from "vitest";
import { sleep, isValidEmail, groupBy, retry, unique } from "./utils";

// ---------- sleep ----------
describe("sleep", () => {
  // async because we use await inside
  it("waits at least the given time", async () => {
    const start = Date.now();          // time before
    await sleep(50);                   // pause 50ms
    const elapsed = Date.now() - start;
    // small tolerance: timers can fire a hair early
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });
});

// ---------- isValidEmail ----------
describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    // toBe(true) = strict equality with true
    expect(isValidEmail("samin@example.com")).toBe(true);
  });

  it("accepts different valid emails", () => {
    expect(isValidEmail("rahim@gmail.com")).toBe(true);
    expect(isValidEmail("john.doe@company.org")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
  });

  it("rejects strings without @ or domain", () => {
    expect(isValidEmail("samin.example.com")).toBe(false); // no @
    expect(isValidEmail("samin@")).toBe(false);            // no domain
    expect(isValidEmail("samin@example")).toBe(false);     // no dot part
  });

  it("rejects non-string values", () => {
    // proves the "unknown" input is handled safely
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });
});

// ---------- groupBy ----------
describe("groupBy", () => {
  // shared test data used by the tests below
  const users = [
    { id: 1, role: "admin" },
    { id: 2, role: "customer" },
    { id: 3, role: "admin" },
  ];

  it("groups items by the given key", () => {
    // toEqual = compares contents deeply (not memory identity)
    expect(groupBy(users, "role")).toEqual({
      admin: [
        { id: 1, role: "admin" },
        { id: 3, role: "admin" },
      ],
      customer: [{ id: 2, role: "customer" }],
    });
  });

  it("returns an empty object for an empty array", () => {
    // <...> tells TypeScript the item type, since [] gives no hint
    expect(groupBy<{ id: number; role: string }>([], "role")).toEqual({});
  });

  it("keeps the original order inside each group", () => {
    // ?. = only continue if admin exists (it could be undefined)
    const ids = groupBy(users, "role").admin?.map((u) => u.id);
    expect(ids).toEqual([1, 3]);
  });
});

// ---------- retry ----------
describe("retry", () => {
  it("returns immediately when the first attempt succeeds", async () => {
    // vi.fn() = fake function that records how it was called
    // mockResolvedValue("ok") = returns a Promise that resolves to "ok"
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await retry(fn, 3, 1); // 1ms delay keeps the test fast

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1); // no unnecessary retries
  });

  it("retries after failures and then succeeds", async () => {
    // Once = applies to one call only: fail, fail, then succeed
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("finally");

    const result = await retry(fn, 3, 1);

    expect(result).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after all attempts fail", async () => {
    // mockRejectedValue = fails on EVERY call
    const fn = vi.fn().mockRejectedValue(new Error("always broken"));

    // rejects.toThrow = assert the promise fails with this message
    await expect(retry(fn, 3, 1)).rejects.toThrow("always broken");
    expect(fn).toHaveBeenCalledTimes(3); // tried exactly 3 times
  });

  it("rejects invalid attempts values", async () => {
    const fn = vi.fn();
    await expect(retry(fn, 0)).rejects.toThrow("attempts must be at least 1");
    expect(fn).not.toHaveBeenCalled(); // never ran
  });
});

// ---------- unique ----------
describe("unique", () => {
  it("removes duplicate values", () => {
    expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });

  it("returns an empty array for empty input", () => {
    expect(unique([])).toEqual([]);
  });
});
import { describe, expect, it, vi } from "vitest";
import { loadAndSift } from "./load.js";

const isNumber = (value: unknown): value is number => typeof value === "number";

describe("loadAndSift", () => {
  it("loads records and sifts them", async () => {
    const result = await loadAndSift({ load: async () => [1, "two", 3], validate: isNumber });

    expect(result.valid).toEqual([1, 3]);
    expect(result.invalid).toEqual([{ index: 1, value: "two", issues: [{ message: "Rejected by isNumber" }] }]);
  });

  it("retries a failing load, then sifts what it gets", async () => {
    const load = vi.fn<() => Promise<unknown>>().mockRejectedValueOnce(new Error("503")).mockResolvedValue([1, "x"]);

    const result = await loadAndSift({ load, validate: isNumber, delayMs: 0 });

    expect(load).toHaveBeenCalledTimes(2);
    expect(result.valid).toEqual([1]);
    expect(result.invalid).toHaveLength(1);
  });

  it("throws the load error when every attempt fails", async () => {
    const load = vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error("service down"));

    await expect(loadAndSift({ load, validate: isNumber, attempts: 2, delayMs: 0 })).rejects.toThrow("service down");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ data: [1, 2] }, "object"],
    [null, "null"],
    ["[1,2]", "string"],
  ])("fails fast, without retrying, when load returns %j", async (response, got) => {
    const load = vi.fn(async () => response);

    await expect(loadAndSift({ load, validate: isNumber, delayMs: 0 })).rejects.toThrow(
      new TypeError(`load() must resolve to an array of records, got ${got}`),
    );
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("supports async schemas", async () => {
    const asyncPositive = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: async (value: unknown) =>
          typeof value === "number" && value > 0 ? { value } : { issues: [{ message: "Expected a positive number" }] },
      },
    };

    const result = await loadAndSift({ load: () => [3, -3], validate: asyncPositive });

    expect(result.valid).toEqual([3]);
    expect(result.invalid[0]?.issues).toEqual([{ message: "Expected a positive number" }]);
  });
});

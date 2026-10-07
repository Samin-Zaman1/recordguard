import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retry } from "./retry.js";

// Fake timers let the tests check exact backoff delays without real waiting.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("retry", () => {
  it("returns straight away when the first attempt succeeds", async () => {
    const fn = vi.fn<() => Promise<string>>().mockResolvedValue("ok");

    await expect(retry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("accepts a synchronous function", async () => {
    await expect(retry(() => 42)).resolves.toBe(42);
  });

  it("waits with exponential backoff between attempts", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("ok");

    const result = retry(fn, { attempts: 3, delayMs: 100, backoff: 2 });

    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1); // first retry waits 100 ms
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2); // second retry waits 200 ms
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses a fixed delay when backoff is 1", async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("1")).mockRejectedValueOnce(new Error("2")).mockResolvedValue("ok");

    const result = retry(fn, { delayMs: 50, backoff: 1 });
    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("rethrows the last error, unchanged, once attempts run out", async () => {
    const last = new Error("third failure");
    const fn = vi
      .fn<() => Promise<never>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValueOnce(last);

    const result = retry(fn, { attempts: 3, delayMs: 10 });
    const settled = expect(result).rejects.toBe(last);
    await vi.runAllTimersAsync();

    await settled;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops early when shouldRetry says no", async () => {
    const notFound = Object.assign(new Error("Not found"), { status: 404 });
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(notFound);
    const shouldRetry = vi.fn((error: unknown) => (error as { status?: number }).status !== 404);

    await expect(retry(fn, { attempts: 5, shouldRetry })).rejects.toBe(notFound);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(notFound, 1);
  });

  it("gives up while waiting if the signal is aborted", async () => {
    const controller = new AbortController();
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(new Error("down"));

    const result = retry(fn, { attempts: 5, delayMs: 1_000, signal: controller.signal });
    const settled = expect(result).rejects.toThrow("user cancelled");
    await vi.advanceTimersByTimeAsync(500);
    controller.abort(new Error("user cancelled"));

    await settled;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not call fn at all if the signal is already aborted", async () => {
    const fn = vi.fn<() => Promise<string>>().mockResolvedValue("ok");

    await expect(retry(fn, { signal: AbortSignal.abort(new Error("too late")) })).rejects.toThrow("too late");
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not retry after an abort that happens during an attempt", async () => {
    const controller = new AbortController();
    const fn = vi.fn(async () => {
      controller.abort(new Error("cancelled mid-request"));
      throw new Error("request failed");
    });

    await expect(retry(fn, { attempts: 3, delayMs: 10, signal: controller.signal })).rejects.toThrow(
      "cancelled mid-request",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ attempts: 0 }, "attempts must be a whole number of at least 1, got 0"],
    [{ attempts: 1.5 }, "attempts must be a whole number of at least 1, got 1.5"],
    [{ delayMs: -1 }, "delayMs must be 0 or more, got -1"],
    [{ delayMs: Number.NaN }, "delayMs must be 0 or more, got NaN"],
    [{ backoff: 0.5 }, "backoff must be 1 or more, got 0.5"],
  ])("rejects invalid options %o", async (options, message) => {
    const fn = vi.fn<() => Promise<string>>().mockResolvedValue("ok");

    await expect(retry(fn, options)).rejects.toThrow(new RangeError(message));
    expect(fn).not.toHaveBeenCalled();
  });
});

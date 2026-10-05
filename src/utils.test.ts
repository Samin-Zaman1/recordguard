// describe = groups tests, it = one test, expect = an assertion
import { describe, it, expect } from "vitest";
import { sleep } from "./utils.js";


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
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",        // only look for tests in this folder
  retries: 0,              // no automatic retries yet; we want to see real failures
  reporter: "list",        // simple one-line-per-test output
  use: {
    headless: true,        // run the browser without a visible window
    trace: "on-first-retry", // record a debug trace when a retry happens (used later)
  },
});
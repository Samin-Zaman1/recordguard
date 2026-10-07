import { defineConfig } from "vitest/config";

// The package test builds, packs and installs the real npm tarball, so it is
// slower than the unit tests and runs as its own CI job.
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});

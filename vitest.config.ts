import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // unit tests only; the package test in e2e/ has its own config (vitest.e2e.config.ts)
    include: ["src/**/*.test.ts"],

    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
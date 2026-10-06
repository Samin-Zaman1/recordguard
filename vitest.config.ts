import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // only run unit tests inside src; Playwright owns the e2e folder
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
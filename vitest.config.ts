import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "html"],

      // if ANY of these numbers falls below the limit,
      // the command exits with an error (and CI would go red)
      thresholds: {
        statements: 90,  // % of statements that ran
        branches: 90,    // % of if/else paths that ran
        functions: 90,   // % of functions that were called
        lines: 90,       // % of lines that ran
      },
    },
  },
});
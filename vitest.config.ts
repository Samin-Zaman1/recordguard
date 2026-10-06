import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",                   // use the v8 tool we installed
      include: ["src/**/*.ts"],         // measure only our source files
      exclude: ["src/**/*.test.ts"],    // don't measure the tests themselves
      reporter: ["text", "html"],       // table in terminal + browsable report
    },
  },
});
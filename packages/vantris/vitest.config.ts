import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Integration tests run real Rolldown builds; give them headroom.
    testTimeout: 20_000,
  },
});

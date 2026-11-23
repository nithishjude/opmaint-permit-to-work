import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// E2E suite: talks to a running server over HTTP (no direct DB access).
const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.ts"],
    env: { CRON_SECRET: env.CRON_SECRET ?? "change-me-too" },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});

import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Integration tests run against a separate database (ptw_test by default) so
// they never touch your seeded demo data. Keep in sync with tests/integration/test-db-url.ts.
const env = loadEnv("test", process.cwd(), "");
const devUrl = env.DATABASE_URL ?? "postgresql://ptw:ptw@localhost:5433/ptw?schema=public";
const testUrl = env.TEST_DATABASE_URL ?? devUrl.replace(/\/([^/?]+)(\?|$)/, "/ptw_test$2");

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: testUrl, AUTH_SECRET: "test-secret-test-secret-test-secret" },
    globalSetup: ["tests/integration/global-setup.ts"],
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
  },
});

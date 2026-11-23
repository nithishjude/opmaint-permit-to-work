import { loadEnv } from "vite";

/** Test DB = TEST_DATABASE_URL, or the dev DATABASE_URL with the db name swapped to ptw_test. */
export function testDatabaseUrls() {
  const env = loadEnv("test", process.cwd(), "");
  const devUrl = env.DATABASE_URL ?? "postgresql://ptw:ptw@localhost:5433/ptw?schema=public";
  const testUrl = env.TEST_DATABASE_URL ?? devUrl.replace(/\/([^/?]+)(\?|$)/, "/ptw_test$2");
  const testDbName = new URL(testUrl).pathname.slice(1);
  return { devUrl, testUrl, testDbName };
}

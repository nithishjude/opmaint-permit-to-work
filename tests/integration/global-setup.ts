import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrls } from "./test-db-url";

/**
 * Prepare the dedicated test database (never the dev one):
 *   1. create it if missing, 2. apply migrations, 3. empty every table.
 * TRUNCATE is used rather than DELETE because the audit-log trigger (correctly)
 * blocks row deletes; TRUNCATE of a throwaway test DB is the one sanctioned reset.
 */
export default async function setup() {
  const { devUrl, testUrl, testDbName } = testDatabaseUrls();
  if (!/test/i.test(testDbName)) throw new Error(`Refusing to reset "${testDbName}": test DB name must contain "test".`);

  const admin = new PrismaClient({ datasourceUrl: devUrl });
  const exists = await admin.$queryRaw<{ n: number }[]>`SELECT 1 AS n FROM pg_database WHERE datname = ${testDbName}`;
  if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${testDbName}"`);
  await admin.$disconnect();

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: testUrl }, stdio: "pipe" });

  const db = new PrismaClient({ datasourceUrl: testUrl });
  await db.$executeRawUnsafe(
    `TRUNCATE "AuditLog", "WorkLog", "ExtensionRequest", "PermitApproval", "Permit", "Equipment", "Area", "Plant", "User" CASCADE`,
  );
  await db.$disconnect();
}

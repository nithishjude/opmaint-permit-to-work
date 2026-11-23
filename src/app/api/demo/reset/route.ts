import { requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";
import { prisma } from "@/server/db";
import { seedDemoData } from "@/server/demo-seed";
import { DomainError } from "@/domain/errors";

/**
 * Re-seed the demo with times relative to *now*, so a reviewer opening the
 * deployed app days later still sees active / expiring / pending permits.
 * Admin only, and only when DEMO_MODE=true — never on a real deployment.
 */
export const POST = route(async () => {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new DomainError("FORBIDDEN", "Admins only.");
  if (process.env.DEMO_MODE !== "true") throw new DomainError("FORBIDDEN", "Demo reset is disabled on this deployment.");
  return ok({ seeded: await seedDemoData(prisma) });
});

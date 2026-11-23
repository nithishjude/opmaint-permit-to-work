import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { createPermitSchema } from "@/domain/permit-core";
import { createPermit } from "@/server/permits/commands";
import { listPermits, permitFiltersSchema } from "@/server/permits/queries";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const user = await requireUser();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const permits = await listPermits(user, permitFiltersSchema.parse(params));
  return ok({ permits });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, createPermitSchema);
  const permit = await createPermit(user, input);
  return ok({ permit }, 201);
});

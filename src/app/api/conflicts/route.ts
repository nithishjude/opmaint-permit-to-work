import { requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";
import { conflictQuerySchema } from "@/server/api-schemas";
import { findConflicts } from "@/server/permits/conflicts";

export const dynamic = "force-dynamic";

/** Used by the create form to warn about overlapping incompatible permits as you type. */
export const GET = route(async (req) => {
  await requireUser();
  const q = conflictQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const conflicts = await findConflicts({ type: q.type, areaId: q.areaId, start: new Date(q.start), end: new Date(q.end), excludePermitId: q.excludeId });
  return ok({ conflicts });
});

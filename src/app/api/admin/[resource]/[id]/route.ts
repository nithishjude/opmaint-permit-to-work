import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { adminSchemas, updateArea, updateUser } from "@/server/admin";
import { DomainError } from "@/domain/errors";

type Ctx = { params: Promise<{ resource: string; id: string }> };

/** PATCH /api/admin/users/:id {role?, active?} · PATCH /api/admin/areas/:id {ownerId} */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { resource, id } = await params;
  if (resource === "users") return ok({ user: await updateUser(user, id, await parseBody(req, adminSchemas.updateUser)) });
  if (resource === "areas") return ok({ area: await updateArea(user, id, await parseBody(req, adminSchemas.updateArea)) });
  throw new DomainError("NOT_FOUND", "Unknown admin resource.");
});

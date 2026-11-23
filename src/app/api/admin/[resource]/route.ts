import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { adminSchemas, createArea, createEquipment, createPlant, createUser } from "@/server/admin";
import { DomainError } from "@/domain/errors";

type Ctx = { params: Promise<{ resource: string }> };

/** POST /api/admin/{users|plants|areas|equipment} — create master data (admin only). */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { resource } = await params;
  switch (resource) {
    case "users":
      return ok({ user: await createUser(user, await parseBody(req, adminSchemas.createUser)) }, 201);
    case "plants":
      return ok({ plant: await createPlant(user, await parseBody(req, adminSchemas.createPlant)) }, 201);
    case "areas":
      return ok({ area: await createArea(user, await parseBody(req, adminSchemas.createArea)) }, 201);
    case "equipment":
      return ok({ equipment: await createEquipment(user, await parseBody(req, adminSchemas.createEquipment)) }, 201);
    default:
      throw new DomainError("NOT_FOUND", "Unknown admin resource.");
  }
});

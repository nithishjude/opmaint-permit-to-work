import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { extensionRequestSchema } from "@/server/api-schemas";
import { requestExtension } from "@/server/permits/commands";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await parseBody(req, extensionRequestSchema);
  return ok({ extension: await requestExtension(user, id, input) }, 201);
});

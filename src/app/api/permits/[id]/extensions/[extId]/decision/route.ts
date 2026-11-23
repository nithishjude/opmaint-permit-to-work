import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { extensionDecisionSchema } from "@/server/api-schemas";
import { decideExtension } from "@/server/permits/commands";

type Ctx = { params: Promise<{ id: string; extId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id, extId } = await params;
  const input = await parseBody(req, extensionDecisionSchema);
  return ok(await decideExtension(user, id, extId, input));
});

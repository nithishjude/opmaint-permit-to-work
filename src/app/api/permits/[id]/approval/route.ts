import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { approvalSchema } from "@/server/api-schemas";
import { decideApproval } from "@/server/permits/commands";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await parseBody(req, approvalSchema);
  return ok(await decideApproval(user, id, input));
});

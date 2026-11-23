import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { workLogSchema } from "@/server/api-schemas";
import { addWorkLog } from "@/server/permits/commands";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await parseBody(req, workLogSchema);
  return ok({ workLog: await addWorkLog(user, id, input) }, 201);
});

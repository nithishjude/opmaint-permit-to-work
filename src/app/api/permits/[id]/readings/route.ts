import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { readingsSchema } from "@/server/api-schemas";
import { updateReadings } from "@/server/permits/commands";

type Ctx = { params: Promise<{ id: string }> };

/** Update fields marked editableAfterSubmit (gas tests, lock numbers…). Each change is audited. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { typeData, comment } = await parseBody(req, readingsSchema);
  return ok(await updateReadings(user, id, typeData, comment));
});

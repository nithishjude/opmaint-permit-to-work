import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { transitionSchema } from "@/server/api-schemas";
import { submitPermit, transitionPermit } from "@/server/permits/commands";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST { action: "SUBMIT" | "ACTIVATE" | "SUSPEND" | "RESUME" | "CLOSE" | "VERIFY" | "CANCEL", ... }
 * Approve / reject have their own endpoint (/approval) because they carry a signature.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { action, ...rest } = await parseBody(req, transitionSchema);
  if (action === "SUBMIT") return ok(await submitPermit(user, id));
  return ok(await transitionPermit(user, id, action, rest));
});

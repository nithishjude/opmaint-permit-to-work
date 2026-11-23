import { requireUser } from "@/server/auth";
import { ok, parseBody, route } from "@/server/http";
import { updateDraftSchema } from "@/domain/permit-core";
import { updateDraft } from "@/server/permits/commands";
import { getPermitDetail } from "@/server/permits/queries";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { permit, actions, blockers, conflicts } = await getPermitDetail(user, id);
  // Signatures are large; the detail API returns whether one exists, not the image.
  const approvals = permit.approvals.map(({ signature, ...a }) => ({ ...a, signed: Boolean(signature) }));
  return ok({ permit: { ...permit, approvals }, allowedActions: actions, blockers, conflicts });
});

/** Edit a DRAFT. After submission only readings can change (see /readings). */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await parseBody(req, updateDraftSchema);
  const permit = await updateDraft(user, id, input);
  return ok({ permit });
});

// Expiry has to work when nobody has a browser open. Three layers:
//  1. Every read and every mutation calls `expireDuePermits` first, so nobody
//     can ever see or act on a permit whose window has passed as if it were live.
//  2. GET /api/cron/expire runs the same sweep on a schedule (Vercel cron /
//     any external pinger), so the audit log records expiry close to the real time
//     even on a quiet night.
//  3. Every time-sensitive permission check compares against `validUntil`
//     directly, so even between sweeps nothing can be activated or resumed late.

import { prisma } from "../db";
import { EXPIRABLE_STATUSES, nextStatus } from "@/domain/state-machine";
import type { PermitStatus } from "@/domain/enums";
import { writeAudit } from "./audit";
import { notify } from "../notify";

export async function expireDuePermits(now: Date = new Date(), onlyPermitId?: string): Promise<number> {
  const due = await prisma.permit.findMany({
    where: {
      status: { in: [...EXPIRABLE_STATUSES] },
      validUntil: { lte: now },
      ...(onlyPermitId ? { id: onlyPermitId } : {}),
    },
    select: { id: true, number: true, status: true, validUntil: true, requesterId: true },
  });

  let expired = 0;
  for (const p of due) {
    const to = nextStatus(p.status as PermitStatus, "EXPIRE");
    const done = await prisma.$transaction(async (tx) => {
      // Conditional update: if someone closed/cancelled it a moment ago, do nothing.
      const res = await tx.permit.updateMany({ where: { id: p.id, status: p.status }, data: { status: to } });
      if (res.count === 0) return false;
      await tx.extensionRequest.updateMany({
        where: { permitId: p.id, status: "PENDING" },
        data: { status: "REJECTED", decisionNote: "Permit expired before a decision was made.", decidedAt: now },
      });
      await writeAudit(tx, {
        permitId: p.id,
        actorId: null,
        action: "EXPIRED",
        field: "status",
        from: p.status,
        to,
        comment: `Validity window ended at ${p.validUntil.toISOString()}.${p.status === "ACTIVE" ? " Work must stop; raise a new permit to continue." : ""}`,
      });
      return true;
    });
    if (done) {
      expired++;
      notify(p.requesterId, `${p.number} has expired.`);
    }
  }
  return expired;
}

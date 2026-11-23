// Simultaneous operations check: hot work next to an open confined space (or
// vice versa) in the same area and time window. Flammable vapour vented from a
// tank being purged + a welding arc 5 m away is a classic accident.
//
// The rule is data-driven: a type lists what it conflicts with in the registry,
// and the relation is treated as symmetric.

import { getPermitType, PERMIT_TYPES } from "@/domain/permit-types";
import { prisma } from "../db";

const LIVE_STATUSES = ["PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"] as const;

export interface ConflictQuery {
  excludePermitId?: string;
  type: string;
  areaId: string;
  start: Date;
  end: Date;
}

export interface PermitConflict {
  id: string;
  number: string;
  type: string;
  status: string;
  plannedStart: Date;
  validUntil: Date;
  workDescription: string;
}

export function conflictingTypes(type: string): string[] {
  const def = getPermitType(type);
  if (!def) return [];
  const set = new Set(def.conflictsWith ?? []);
  for (const t of PERMIT_TYPES) if (t.conflictsWith?.includes(type)) set.add(t.key);
  return [...set];
}

export async function findConflicts(q: ConflictQuery): Promise<PermitConflict[]> {
  const types = conflictingTypes(q.type);
  if (types.length === 0 || !(q.start < q.end)) return [];
  return prisma.permit.findMany({
    where: {
      id: q.excludePermitId ? { not: q.excludePermitId } : undefined,
      areaId: q.areaId,
      type: { in: types },
      status: { in: [...LIVE_STATUSES] },
      // overlap: other starts before we end AND other ends after we start
      plannedStart: { lt: q.end },
      validUntil: { gt: q.start },
    },
    select: { id: true, number: true, type: true, status: true, plannedStart: true, validUntil: true, workDescription: true },
    orderBy: { plannedStart: "asc" },
  });
}

import type { Prisma } from "@prisma/client";
import { DomainError } from "@/domain/errors";
import type { PermitForAuth } from "@/domain/permissions";
import type { ApprovalDecision, PermitStatus } from "@/domain/enums";
import type { TypeData } from "@/domain/permit-types";
import type { PrecautionItem } from "@/domain/permit-core";
import type { Tx } from "../db";

export const permitAuthInclude = {
  approvals: { orderBy: { role: "asc" } },
  extensions: { where: { status: "PENDING" }, select: { id: true } },
} satisfies Prisma.PermitInclude;

export type PermitWithAuth = Prisma.PermitGetPayload<{ include: typeof permitAuthInclude }>;

/** The minimum a permit row needs to carry for permission checks. */
export interface AuthSource {
  type: string;
  status: string;
  requesterId: string;
  areaId: string;
  plannedStart: Date;
  validUntil: Date;
  typeData: Prisma.JsonValue;
  extensionCount: number;
  approvals: { role: string; decision: ApprovalDecision; approverId: string | null }[];
  extensions: unknown[]; // pending extension requests only
}

/** The plain-data view of a permit that the permission rules work on. */
export function toAuthView(p: AuthSource): PermitForAuth {
  return {
    type: p.type,
    status: p.status as PermitStatus,
    requesterId: p.requesterId,
    areaId: p.areaId,
    plannedStart: p.plannedStart,
    validUntil: p.validUntil,
    typeData: asTypeData(p.typeData),
    approvals: p.approvals.map((a) => ({ role: a.role as "AREA_OWNER" | "SAFETY_OFFICER", decision: a.decision, approverId: a.approverId })),
    extensionCount: p.extensionCount,
    hasPendingExtension: p.extensions.length > 0,
  };
}

/**
 * Row-locks the permit for the rest of the transaction. Two approvers clicking
 * at the same moment, or an approval racing a cancel, are serialised here so
 * the second one sees the first one's result instead of overwriting it.
 */
export async function lockPermit(tx: Tx, id: string): Promise<PermitWithAuth> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Permit" WHERE id = ${id} FOR UPDATE`;
  if (rows.length === 0) throw new DomainError("NOT_FOUND", "Permit not found.");
  return tx.permit.findUniqueOrThrow({ where: { id }, include: permitAuthInclude });
}

export function asTypeData(v: Prisma.JsonValue): TypeData {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as TypeData) : {};
}

export function asPrecautions(v: Prisma.JsonValue): PrecautionItem[] {
  return Array.isArray(v) ? (v as unknown as PrecautionItem[]) : [];
}

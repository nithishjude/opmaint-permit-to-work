import type { Tx } from "../db";

export type AuditAction =
  | "CREATED"
  | "DRAFT_UPDATED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "STATUS_CHANGED"
  | "FIELD_CHANGED"
  | "ACTIVATED"
  | "SUSPENDED"
  | "AUTO_SUSPENDED"
  | "RESUMED"
  | "CLOSED"
  | "VERIFIED"
  | "CANCELLED"
  | "EXPIRED"
  | "EXTENSION_REQUESTED"
  | "EXTENSION_APPROVED"
  | "EXTENSION_REJECTED"
  | "WORK_LOGGED";

export interface AuditEntry {
  permitId: string;
  actorId: string | null; // null = system
  action: AuditAction;
  field?: string;
  from?: unknown;
  to?: unknown;
  comment?: string | null;
}

export function auditValue(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Append-only: there is intentionally no update/delete helper for audit rows. */
export async function writeAudit(tx: Tx, entries: AuditEntry | AuditEntry[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  await tx.auditLog.createMany({
    data: list.map((e) => ({
      permitId: e.permitId,
      actorId: e.actorId,
      action: e.action,
      field: e.field ?? null,
      fromValue: auditValue(e.from),
      toValue: auditValue(e.to),
      comment: e.comment ?? null,
    })),
  });
}

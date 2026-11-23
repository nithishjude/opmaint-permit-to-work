// Time- and data-based preconditions. Pure functions over plain data, so the
// server enforces them and the UI uses the same code to explain why a button
// isn't available.

import type { ApprovalDecision, ApproverRole } from "./enums";
import { activationReadingIssues, missingFor, requirePermitType, type FieldIssue, type TypeData } from "./permit-types";

export const EXPIRING_SOON_MS = 2 * 60 * 60 * 1000;
export const MAX_EXTENSIONS = 2;
export const MAX_EXTENSION_HOURS = 4;

export interface ApprovalSlot {
  role: ApproverRole;
  decision: ApprovalDecision;
  approverId: string | null;
}

export interface ActivatablePermit {
  type: string;
  plannedStart: Date;
  validUntil: Date;
  typeData: TypeData;
  approvals: ApprovalSlot[];
}

export function allApproved(approvals: Pick<ApprovalSlot, "decision">[]): boolean {
  return approvals.length > 0 && approvals.every((a) => a.decision === "APPROVED");
}

export function activationIssues(p: ActivatablePermit, now: Date): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const def = requirePermitType(p.type);

  const required = new Set(def.requiredApprovals);
  const approvedRoles = new Set(p.approvals.filter((a) => a.decision === "APPROVED").map((a) => a.role));
  for (const role of required) {
    if (!approvedRoles.has(role)) issues.push({ field: "approvals", message: `Missing ${role === "AREA_OWNER" ? "area owner" : "safety officer"} approval.` });
  }
  if (now < p.plannedStart) issues.push({ field: "plannedStart", message: `Work cannot start before the planned start time.` });
  if (now >= p.validUntil) issues.push({ field: "validUntil", message: "The permit's validity window has passed." });

  issues.push(...missingFor("activate", def.fields, p.typeData));
  issues.push(...activationReadingIssues(def.fields, p.typeData, now));
  return issues;
}

export function isExpiringSoon(validUntil: Date, now: Date): boolean {
  const left = validUntil.getTime() - now.getTime();
  return left > 0 && left <= EXPIRING_SOON_MS;
}

/** Who is inside a confined space right now, from the entry/exit register. */
export function peopleInside(entries: { kind: string; person: string | null }[]): string[] {
  const inside = new Map<string, number>();
  for (const e of entries) {
    if (!e.person) continue;
    const key = e.person.trim().toLowerCase();
    if (e.kind === "ENTRY") inside.set(key, (inside.get(key) ?? 0) + 1);
    if (e.kind === "EXIT") inside.set(key, Math.max(0, (inside.get(key) ?? 0) - 1));
  }
  const names = new Map(entries.filter((e) => e.person).map((e) => [e.person!.trim().toLowerCase(), e.person!.trim()]));
  return [...inside.entries()].filter(([, n]) => n > 0).map(([k]) => names.get(k)!);
}

/** Two time windows overlap if each starts before the other ends. */
export function windowsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

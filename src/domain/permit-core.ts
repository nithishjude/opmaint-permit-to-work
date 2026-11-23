// The common core shared by every permit type, and the validation that runs
// before a permit may be submitted.

import { z } from "zod";
import { PERMIT_TYPE_KEYS, buildShapeSchema, missingFor, requirePermitType, type FieldIssue, type TypeData } from "./permit-types";

const isoDate = z.string().datetime({ offset: true, message: "Must be a valid date/time" });
const shortText = (max: number) => z.string().trim().max(max);
const tagList = z.array(z.string().trim().min(1).max(200)).max(40);

export const precautionItemSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(300),
  checked: z.boolean(),
  custom: z.boolean().optional(),
});
export type PrecautionItem = z.infer<typeof precautionItemSchema>;

/** Fields a requester can set while the permit is a draft. */
export const permitDraftFieldsSchema = z.object({
  contractor: shortText(200).default(""),
  crewSize: z.number().int().min(1).max(500).nullable().optional(),
  workDescription: shortText(4000).default(""),
  areaId: z.string().min(1, "Area is required"),
  equipmentId: z.string().min(1).nullable().optional(),
  locationDetail: shortText(300).nullable().optional(),
  plannedStart: isoDate,
  plannedEnd: isoDate,
  hazards: tagList.default([]),
  ppe: tagList.default([]),
  precautions: z.array(precautionItemSchema).max(60).default([]),
  typeData: z.record(z.unknown()).default({}),
});

export const createPermitSchema = permitDraftFieldsSchema.extend({
  type: z.enum(PERMIT_TYPE_KEYS, { errorMap: () => ({ message: "Unknown permit type" }) }),
});
export type CreatePermitInput = z.infer<typeof createPermitSchema>;

// Type is fixed at creation: changing it would invalidate typeData and the
// approval chain. Raise a new permit instead.
export const updateDraftSchema = permitDraftFieldsSchema.partial();
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

/** Parse type-specific data against its type's field list (drops unknown keys). */
export function parseTypeData(typeKey: string, raw: unknown): TypeData {
  const def = requirePermitType(typeKey);
  return buildShapeSchema(def.fields).parse(raw ?? {}) as TypeData;
}

export interface SubmittablePermit {
  type: string;
  contractor: string;
  workDescription: string;
  plannedStart: Date;
  plannedEnd: Date;
  hazards: string[];
  ppe: string[];
  precautions: PrecautionItem[];
  typeData: TypeData;
}

/** Everything that must be true before a draft can go for approval. */
export function submissionIssues(p: SubmittablePermit, now: Date): FieldIssue[] {
  const def = requirePermitType(p.type);
  const issues: FieldIssue[] = [];

  if (!p.contractor.trim()) issues.push({ field: "contractor", message: "Contractor / team performing the work is required." });
  if (p.workDescription.trim().length < 10) issues.push({ field: "workDescription", message: "Describe the job in at least 10 characters." });

  const durationH = (p.plannedEnd.getTime() - p.plannedStart.getTime()) / 3_600_000;
  if (durationH <= 0) issues.push({ field: "plannedEnd", message: "Planned end must be after planned start." });
  else if (durationH > def.maxDurationHours)
    issues.push({ field: "plannedEnd", message: `${def.label} permits are valid for at most ${def.maxDurationHours} h. Raise a new permit for the next shift.` });
  if (p.plannedEnd <= now) issues.push({ field: "plannedEnd", message: "Planned end is already in the past." });

  if (p.hazards.length === 0) issues.push({ field: "hazards", message: "Identify at least one hazard." });
  if (p.ppe.length === 0) issues.push({ field: "ppe", message: "List the PPE required." });

  const unchecked = p.precautions.filter((x) => !x.checked);
  if (p.precautions.length === 0) issues.push({ field: "precautions", message: "Precautions checklist is empty." });
  for (const x of unchecked) issues.push({ field: "precautions", message: `Precaution not confirmed: ${x.label}` });

  issues.push(...missingFor("submit", def.fields, p.typeData));
  return issues;
}

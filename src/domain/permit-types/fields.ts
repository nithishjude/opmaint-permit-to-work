// Field descriptors: the one place a type-specific field is described.
// From a list of these we derive (a) the zod validation schema used by the API
// and (b) the form the UI renders. There is no per-type form component.

import { z } from "zod";

/**
 * When a field must be filled in:
 *  - "submit":   before the permit can be submitted for approval (planning info)
 *  - "activate": before work can start (readings taken on site, e.g. gas test)
 *  - undefined:  optional
 */
export type RequiredFor = "submit" | "activate";

interface BaseField {
  name: string;
  label: string;
  help?: string;
  requiredFor?: RequiredFor;
  /** Can be updated after submission (e.g. a re-test). Every change is audited. */
  editableAfterSubmit?: boolean;
  /** Groups fields into a fieldset in the form and on the detail page. */
  group?: string;
}

export interface TextField extends BaseField {
  kind: "text" | "textarea";
}

export interface NumberField extends BaseField {
  kind: "number";
  unit?: string;
  /** Hard input limits — values outside are rejected outright. */
  min?: number;
  max?: number;
  step?: number;
  /** Safe operating band. Values outside block activation (but can be recorded). */
  safeRange?: { min?: number; max?: number };
}

export interface SelectField extends BaseField {
  kind: "select";
  options: readonly { value: string; label: string }[];
}

export interface MultiSelectField extends BaseField {
  kind: "multiselect";
  options: readonly { value: string; label: string }[];
}

export interface BooleanField extends BaseField {
  kind: "boolean";
  /** A safety confirmation that must be "yes" before submission. */
  mustBeTrue?: boolean;
}

export interface DateTimeField extends BaseField {
  kind: "datetime";
  /** At activation, the reading must be no older than this (e.g. gas test). */
  maxAgeMinutesAtActivation?: number;
}

export interface StringListField extends BaseField {
  kind: "stringList";
  itemLabel?: string;
}

export type FieldDef =
  | TextField
  | NumberField
  | SelectField
  | MultiSelectField
  | BooleanField
  | DateTimeField
  | StringListField;

export type TypeData = Record<string, unknown>;

function baseSchema(field: FieldDef): z.ZodTypeAny {
  switch (field.kind) {
    case "text":
    case "textarea":
      return z.string().trim().max(4000);
    case "number": {
      let s = z.number({ invalid_type_error: `${field.label} must be a number` }).finite();
      if (field.min !== undefined) s = s.min(field.min, `${field.label} must be at least ${field.min}${field.unit ?? ""}`);
      if (field.max !== undefined) s = s.max(field.max, `${field.label} must be at most ${field.max}${field.unit ?? ""}`);
      return s;
    }
    case "select":
      return z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
    case "multiselect":
      return z.array(z.enum(field.options.map((o) => o.value) as [string, ...string[]]));
    case "boolean":
      return z.boolean();
    case "datetime":
      return z.string().datetime({ offset: true, message: `${field.label} must be a valid date/time` });
    case "stringList":
      return z.array(z.string().trim().min(1).max(200)).max(50);
  }
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/**
 * Shape check used for every save (draft or not): unknown keys are dropped,
 * present values must have the right type, nothing is required yet.
 */
export function buildShapeSchema(fields: readonly FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    shape[f.name] = z.preprocess((v) => (isEmpty(v) ? undefined : v), baseSchema(f).optional());
  }
  return z.object(shape).strip();
}

export interface FieldIssue {
  field: string;
  message: string;
}

/** Required-ness checks for a stage: which fields are missing / unconfirmed. */
export function missingFor(stage: RequiredFor, fields: readonly FieldDef[], data: TypeData): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const f of fields) {
    const needed = f.requiredFor === "submit" || (stage === "activate" && f.requiredFor === "activate");
    if (needed && isEmpty(data[f.name])) {
      issues.push({ field: f.name, message: `${f.label} is required${stage === "activate" && f.requiredFor === "activate" ? " before work can start" : ""}.` });
    }
    if (f.kind === "boolean" && f.mustBeTrue && data[f.name] !== true) {
      issues.push({ field: f.name, message: `${f.label} must be confirmed.` });
    }
  }
  return issues;
}

/** Readings outside their safe band, and readings that are too old. */
export function activationReadingIssues(fields: readonly FieldDef[], data: TypeData, now: Date): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const f of fields) {
    const v = data[f.name];
    if (f.kind === "number" && f.safeRange && typeof v === "number") {
      const { min, max } = f.safeRange;
      if ((min !== undefined && v < min) || (max !== undefined && v > max)) {
        issues.push({ field: f.name, message: `${f.label} reading ${v}${f.unit ?? ""} is outside the safe range (${describeRange(f)}).` });
      }
    }
    if (f.kind === "datetime" && f.maxAgeMinutesAtActivation && typeof v === "string") {
      const ageMin = (now.getTime() - new Date(v).getTime()) / 60000;
      if (ageMin > f.maxAgeMinutesAtActivation) {
        issues.push({ field: f.name, message: `${f.label} is ${Math.round(ageMin)} min old — must be within ${f.maxAgeMinutesAtActivation} min of starting work. Re-test.` });
      }
      if (ageMin < -5) {
        issues.push({ field: f.name, message: `${f.label} is in the future.` });
      }
    }
  }
  return issues;
}

export function describeRange(f: NumberField): string {
  const u = f.unit ?? "";
  const { min, max } = f.safeRange ?? {};
  if (min !== undefined && max !== undefined) return `${min}–${max}${u}`;
  if (max !== undefined) return `≤ ${max}${u}`;
  if (min !== undefined) return `≥ ${min}${u}`;
  return "";
}

export function isOutsideSafeRange(f: FieldDef, v: unknown): boolean {
  if (f.kind !== "number" || !f.safeRange || typeof v !== "number") return false;
  const { min, max } = f.safeRange;
  return (min !== undefined && v < min) || (max !== undefined && v > max);
}

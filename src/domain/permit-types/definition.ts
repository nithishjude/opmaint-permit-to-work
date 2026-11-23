import type { ApproverRole } from "../enums";
import type { FieldDef } from "./fields";

export interface PrecautionTemplate {
  id: string;
  label: string;
}

/**
 * Everything that makes one permit type different from another.
 * The rest of the app (API, state machine, forms, detail page, seed) is
 * written against this interface and never switches on a type key.
 */
export interface PermitTypeDefinition {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  fields: readonly FieldDef[];
  defaultHazards: readonly string[];
  defaultPpe: readonly string[];
  /** Pre-populated checklist; requester must tick all before submitting. */
  precautions: readonly PrecautionTemplate[];
  /** One approval slot per role, all must approve. */
  requiredApprovals: readonly ApproverRole[];
  /** Longest validity window allowed at creation, in hours (one shift = 8). */
  maxDurationHours: number;
  /** Other permit types that are dangerous at the same place and time. */
  conflictsWith?: readonly string[];
  /** Keeps an entry/exit register; permit can't close while anyone is inside. */
  hasEntryRegister?: boolean;
}

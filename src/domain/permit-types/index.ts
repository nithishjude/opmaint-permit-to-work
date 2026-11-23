// The permit-type registry. To add a type: write a definition file, add it here.
import type { PermitTypeDefinition } from "./definition";
import { hotWork } from "./hot-work";
import { confinedSpace } from "./confined-space";
import { workingAtHeight } from "./working-at-height";
import { electricalLoto } from "./electrical-loto";
import { excavation } from "./excavation";

export type { PermitTypeDefinition, PrecautionTemplate } from "./definition";
export * from "./fields";

export const PERMIT_TYPES: readonly PermitTypeDefinition[] = [
  hotWork,
  confinedSpace,
  workingAtHeight,
  electricalLoto,
  excavation,
];

const BY_KEY = new Map(PERMIT_TYPES.map((t) => [t.key, t]));

export function getPermitType(key: string): PermitTypeDefinition | undefined {
  return BY_KEY.get(key);
}

export function requirePermitType(key: string): PermitTypeDefinition {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown permit type "${key}"`);
  return def;
}

export const PERMIT_TYPE_KEYS = PERMIT_TYPES.map((t) => t.key) as [string, ...string[]];

import type { Actor, PermitForAuth } from "@/domain/permissions";

export const NOW = new Date("2026-11-23T10:00:00+05:30");
export const hoursFrom = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

export const requester: Actor = { id: "u-req", role: "REQUESTER", ownedAreaIds: [] };
export const areaOwner: Actor = { id: "u-owner", role: "AREA_OWNER", ownedAreaIds: ["area-1"] };
export const otherAreaOwner: Actor = { id: "u-owner2", role: "AREA_OWNER", ownedAreaIds: ["area-2"] };
export const safety: Actor = { id: "u-safety", role: "SAFETY_OFFICER", ownedAreaIds: [] };
export const admin: Actor = { id: "u-admin", role: "ADMIN", ownedAreaIds: [] };

/** A hot-work permit whose readings are fresh and safe; tweak per test. */
export function permit(overrides: Partial<PermitForAuth> = {}): PermitForAuth {
  return {
    type: "HOT_WORK",
    status: "PENDING_APPROVAL",
    requesterId: requester.id,
    areaId: "area-1",
    plannedStart: hoursFrom(NOW, -1),
    validUntil: hoursFrom(NOW, 4),
    typeData: {
      hotWorkType: "WELDING",
      fireWatchName: "S. Devi",
      fireWatchAfterMinutes: 30,
      extinguisherType: "DCP",
      combustiblesClearedRadiusM: 12,
      gasLelPct: 0,
      gasO2Pct: 20.9,
      gasTestAt: hoursFrom(NOW, -0.5).toISOString(),
      gasTestedBy: "R. Kumar",
    },
    approvals: [
      { role: "AREA_OWNER", decision: "PENDING", approverId: null },
      { role: "SAFETY_OFFICER", decision: "PENDING", approverId: null },
    ],
    extensionCount: 0,
    hasPendingExtension: false,
    ...overrides,
  };
}

export const fullyApproved = () => [
  { role: "AREA_OWNER" as const, decision: "APPROVED" as const, approverId: areaOwner.id },
  { role: "SAFETY_OFFICER" as const, decision: "APPROVED" as const, approverId: safety.id },
];

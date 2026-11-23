// Domain enums as plain string unions so they can be shared by server and
// client code without importing @prisma/client into the browser bundle.
// They mirror the enums in prisma/schema.prisma 1:1.

export const ROLES = ["REQUESTER", "AREA_OWNER", "SAFETY_OFFICER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const PERMIT_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
  "CLOSED",
  "CLOSED_VERIFIED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export type ApprovalDecision = "PENDING" | "APPROVED" | "REJECTED";
export type ExtensionStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Roles that can occupy an approval slot on a permit. */
export type ApproverRole = Extract<Role, "AREA_OWNER" | "SAFETY_OFFICER">;

export const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  AREA_OWNER: "Area Owner",
  SAFETY_OFFICER: "Safety Officer",
  ADMIN: "Admin",
};

export const STATUS_LABELS: Record<PermitStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  CLOSED: "Closed – awaiting verification",
  CLOSED_VERIFIED: "Closed & verified",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

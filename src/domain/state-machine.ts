// The permit lifecycle as a transition table.
//
//   DRAFT ──submit──> PENDING_APPROVAL ──all approve──> APPROVED ──activate──> ACTIVE
//                        │ any reject                     │ expires             ├─ suspend ─> SUSPENDED ─ resume ─> ACTIVE
//                        ▼                                ▼                     ├─ expires ─> EXPIRED
//                     REJECTED                          EXPIRED                 └─ close ───> CLOSED ── verify ──> CLOSED_VERIFIED
//   Any non-terminal state (except CLOSED) ──cancel──> CANCELLED
//
// This module only answers "is this edge in the graph?". *Who* may fire an
// event lives in permissions.ts and *when* (start time, approvals, gas test)
// lives in guards.ts. Keeping the three apart keeps each one small and testable.

import type { PermitStatus } from "./enums";
import { DomainError } from "./errors";

export const PERMIT_EVENTS = [
  "SUBMIT",
  "APPROVE_ALL", // fired by the system when the last required approval lands
  "REJECT",
  "ACTIVATE",
  "SUSPEND",
  "RESUME",
  "CLOSE",
  "VERIFY",
  "EXPIRE", // fired by the system when validUntil passes
  "CANCEL",
] as const;
export type PermitEvent = (typeof PERMIT_EVENTS)[number];

export const TERMINAL_STATUSES: readonly PermitStatus[] = [
  "CLOSED_VERIFIED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];

/** Statuses in which the validity clock is running and the permit can expire. */
export const EXPIRABLE_STATUSES: readonly PermitStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
];

const TRANSITIONS: Record<PermitEvent, { from: readonly PermitStatus[]; to: PermitStatus }> = {
  SUBMIT: { from: ["DRAFT"], to: "PENDING_APPROVAL" },
  APPROVE_ALL: { from: ["PENDING_APPROVAL"], to: "APPROVED" },
  REJECT: { from: ["PENDING_APPROVAL"], to: "REJECTED" },
  ACTIVATE: { from: ["APPROVED"], to: "ACTIVE" },
  SUSPEND: { from: ["ACTIVE"], to: "SUSPENDED" },
  RESUME: { from: ["SUSPENDED"], to: "ACTIVE" },
  CLOSE: { from: ["ACTIVE"], to: "CLOSED" },
  VERIFY: { from: ["CLOSED"], to: "CLOSED_VERIFIED" },
  EXPIRE: { from: EXPIRABLE_STATUSES, to: "EXPIRED" },
  // CLOSED is deliberately not cancellable: the work has physically happened
  // and the area still needs a safety officer to verify it.
  CANCEL: { from: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"], to: "CANCELLED" },
};

export function isTerminal(status: PermitStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: PermitStatus, event: PermitEvent): boolean {
  return TRANSITIONS[event].from.includes(from);
}

/** Returns the target status or throws INVALID_TRANSITION. */
export function nextStatus(from: PermitStatus, event: PermitEvent): PermitStatus {
  if (!canTransition(from, event)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Cannot ${event.toLowerCase().replace("_", " ")} a permit that is ${from}.`,
      { from, event, allowedFrom: TRANSITIONS[event].from },
    );
  }
  return TRANSITIONS[event].to;
}

export function eventsFrom(status: PermitStatus): PermitEvent[] {
  return PERMIT_EVENTS.filter((e) => canTransition(status, e));
}

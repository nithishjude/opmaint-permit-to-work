// Who may do what to a permit, given their role and the permit's state.
//
// `authorize` is the single answer to "can this user press this button now?".
// The server calls it before every mutation (and throws if it says no); the
// detail page calls the very same function to decide which buttons to render.
// So the UI can never offer something the API would refuse, and bypassing the
// UI gains nothing.

import type { ApproverRole, PermitStatus, Role } from "./enums";
import { DomainError } from "./errors";
import { activationIssues, MAX_EXTENSIONS, type ApprovalSlot } from "./guards";
import { canTransition, type PermitEvent } from "./state-machine";
import type { TypeData } from "./permit-types";

export interface Actor {
  id: string;
  role: Role;
  /** Areas this user is the owner of (only meaningful for AREA_OWNER). */
  ownedAreaIds: string[];
}

export interface PermitForAuth {
  type: string;
  status: PermitStatus;
  requesterId: string;
  areaId: string;
  plannedStart: Date;
  validUntil: Date;
  typeData: TypeData;
  approvals: ApprovalSlot[];
  extensionCount: number;
  hasPendingExtension: boolean;
}

export const PERMIT_ACTIONS = [
  "EDIT_DRAFT",
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "ACTIVATE",
  "SUSPEND",
  "RESUME",
  "CLOSE",
  "VERIFY",
  "CANCEL",
  "UPDATE_READINGS",
  "LOG_WORK",
  "REQUEST_EXTENSION",
  "DECIDE_EXTENSION",
] as const;
export type PermitAction = (typeof PERMIT_ACTIONS)[number];

export type AuthDecision =
  | { allowed: true }
  | { allowed: false; kind: "state" | "role" | "precondition"; reason: string };

const ALLOW: AuthDecision = { allowed: true };
const byRole = (reason: string): AuthDecision => ({ allowed: false, kind: "role", reason });
const byState = (reason: string): AuthDecision => ({ allowed: false, kind: "state", reason });
const byPrecondition = (reason: string): AuthDecision => ({ allowed: false, kind: "precondition", reason });

/** Actions that map 1:1 to a state-machine event. */
const EVENT_FOR_ACTION: Partial<Record<PermitAction, PermitEvent>> = {
  SUBMIT: "SUBMIT",
  ACTIVATE: "ACTIVATE",
  SUSPEND: "SUSPEND",
  RESUME: "RESUME",
  CLOSE: "CLOSE",
  VERIFY: "VERIFY",
  CANCEL: "CANCEL",
};

const isSafety = (a: Actor) => a.role === "SAFETY_OFFICER" || a.role === "ADMIN";
const ownsArea = (a: Actor, p: PermitForAuth) => a.role === "AREA_OWNER" && a.ownedAreaIds.includes(p.areaId);

/** Can this actor sign this kind of slot on this permit (ignoring self-approval)? */
export function canFillSlot(actor: Actor, slot: ApproverRole, p: PermitForAuth): boolean {
  if (actor.role === "ADMIN") return true;
  if (slot === "SAFETY_OFFICER") return actor.role === "SAFETY_OFFICER";
  if (slot === "AREA_OWNER") return ownsArea(actor, p);
  return false;
}

/**
 * The pending approval slot this actor would fill, or a reason they can't.
 * A permit needs two *different* people: whoever signed one slot can't sign another.
 */
export function findApprovalSlot(actor: Actor, p: PermitForAuth): { slot: ApprovalSlot } | { reason: string } {
  if (actor.id === p.requesterId) return { reason: "You cannot approve your own permit." };
  if (p.approvals.some((a) => a.approverId === actor.id && a.decision !== "PENDING"))
    return { reason: "You have already signed this permit." };
  const slot = p.approvals.find((s) => s.decision === "PENDING" && canFillSlot(actor, s.role, p));
  if (slot) return { slot };
  if (actor.role === "AREA_OWNER") return { reason: "Area owners can only approve permits for their own area." };
  if (actor.role === "REQUESTER") return { reason: "Requesters cannot approve permits." };
  return { reason: "There is no pending approval you can sign on this permit." };
}

export function authorize(actor: Actor, action: PermitAction, p: PermitForAuth, now: Date): AuthDecision {
  const own = actor.id === p.requesterId;

  // 1. Is the action legal from this state at all?
  const event = EVENT_FOR_ACTION[action];
  if (event && !canTransition(p.status, event)) return byState(`Not possible while the permit is ${p.status}.`);

  switch (action) {
    case "EDIT_DRAFT":
      if (p.status !== "DRAFT") return byState("Only drafts can be edited. Use readings update after submission.");
      return own || actor.role === "ADMIN" ? ALLOW : byRole("Only the requester can edit this draft.");

    case "SUBMIT":
      return own ? ALLOW : byRole("Only the requester can submit their permit.");

    case "APPROVE":
    case "REJECT": {
      if (p.status !== "PENDING_APPROVAL") return byState("This permit is not awaiting approval.");
      const r = findApprovalSlot(actor, p);
      return "slot" in r ? ALLOW : byRole(r.reason);
    }

    case "ACTIVATE": {
      if (!(own || isSafety(actor))) return byRole("Only the requester or a safety officer can start work.");
      const issues = activationIssues(p, now);
      return issues.length ? byPrecondition(issues.map((i) => i.message).join(" ")) : ALLOW;
    }

    case "SUSPEND":
      // Stop-work authority: the requester, the area owner and safety can all stop a job.
      return own || ownsArea(actor, p) || isSafety(actor) ? ALLOW : byRole("You don't have stop-work authority on this permit.");

    case "RESUME":
      if (!isSafety(actor)) return byRole("Only a safety officer can resume suspended work.");
      return now < p.validUntil ? ALLOW : byPrecondition("The permit has expired; raise a new one.");

    case "CLOSE":
      return own || actor.role === "ADMIN" ? ALLOW : byRole("Only the requester can close their permit.");

    case "VERIFY":
      return isSafety(actor) ? ALLOW : byRole("Only a safety officer can verify closure.");

    case "CANCEL":
      if (isSafety(actor)) return ALLOW;
      if (own && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(p.status)) return ALLOW;
      return byRole(own ? "Work has started — close or suspend the permit instead." : "Only the requester or safety can cancel.");

    case "UPDATE_READINGS":
      if (!["PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"].includes(p.status)) return byState("Readings can't be changed in this state.");
      return own || isSafety(actor) ? ALLOW : byRole("Only the requester or a safety officer can record readings.");

    case "LOG_WORK":
      if (p.status !== "ACTIVE") return byState("Work can only be logged against an ACTIVE permit.");
      return own || ownsArea(actor, p) || isSafety(actor) ? ALLOW : byRole("You are not on this permit.");

    case "REQUEST_EXTENSION":
      if (!["APPROVED", "ACTIVE", "SUSPENDED"].includes(p.status)) return byState("Extensions can only be requested on a live permit.");
      if (!own) return byRole("Only the requester can ask for an extension.");
      if (p.hasPendingExtension) return byPrecondition("An extension request is already pending.");
      if (p.extensionCount >= MAX_EXTENSIONS) return byPrecondition(`Extension limit reached (${MAX_EXTENSIONS}). Raise a new permit.`);
      return now < p.validUntil ? ALLOW : byPrecondition("Too late — the permit has expired.");

    case "DECIDE_EXTENSION":
      if (!p.hasPendingExtension) return byState("No extension request is pending.");
      if (own) return byRole("You cannot approve an extension of your own permit.");
      return isSafety(actor) ? ALLOW : byRole("Only a safety officer can approve extensions.");
  }
}

/** Server-side gate: throws the right DomainError if the action isn't allowed. */
export function assertAuthorized(actor: Actor, action: PermitAction, p: PermitForAuth, now: Date): void {
  const d = authorize(actor, action, p, now);
  if (d.allowed) return;
  const code = d.kind === "role" ? "FORBIDDEN" : d.kind === "state" ? "INVALID_TRANSITION" : "PRECONDITION_FAILED";
  throw new DomainError(code, d.reason, { action, status: p.status });
}

export function allowedActions(actor: Actor, p: PermitForAuth, now: Date): PermitAction[] {
  return PERMIT_ACTIONS.filter((a) => authorize(actor, a, p, now).allowed);
}

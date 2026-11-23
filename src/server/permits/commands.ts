// Every way a permit can change goes through this file. Each command follows
// the same shape:
//
//   1. expire the permit if its window has passed (so we never act on a stale one)
//   2. open a transaction and row-lock the permit
//   3. assertAuthorized(actor, action, permit, now)   ← role + state + preconditions
//   4. compute the new status with the state machine
//   5. write the change and its audit entries in the same transaction
//
// Nothing here trusts the caller about role, state or time.

import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { DomainError } from "@/domain/errors";
import { assertAuthorized, findApprovalSlot, type Actor, type PermitAction } from "@/domain/permissions";
import { nextStatus, type PermitEvent } from "@/domain/state-machine";
import { allApproved, MAX_EXTENSION_HOURS, peopleInside } from "@/domain/guards";
import {
  activationReadingIssues,
  buildShapeSchema,
  requirePermitType,
  type PermitTypeDefinition,
  type TypeData,
} from "@/domain/permit-types";
import {
  parseTypeData,
  submissionIssues,
  type CreatePermitInput,
  type PrecautionItem,
  type UpdateDraftInput,
} from "@/domain/permit-core";
import type { PermitStatus } from "@/domain/enums";
import { asPrecautions, asTypeData, lockPermit, toAuthView, type PermitWithAuth } from "./repository";
import { writeAudit, type AuditEntry } from "./audit";
import { expireDuePermits } from "./expiry";
import { findConflicts } from "./conflicts";
import { notify } from "../notify";

const json = (v: unknown) => v as Prisma.InputJsonValue;

// ---------------------------------------------------------------- helpers

/** Make sure every template precaution is on the list; keep custom extras. */
function normalisePrecautions(def: PermitTypeDefinition, given: PrecautionItem[]): PrecautionItem[] {
  const byId = new Map(given.map((p) => [p.id, p]));
  const fromTemplate = def.precautions.map((t) => ({ id: t.id, label: t.label, checked: byId.get(t.id)?.checked ?? false }));
  const templateIds = new Set(def.precautions.map((t) => t.id));
  const custom = given.filter((p) => !templateIds.has(p.id)).map((p) => ({ ...p, custom: true }));
  return [...fromTemplate, ...custom];
}

async function assertLocation(db: Tx | typeof prisma, areaId: string, equipmentId: string | null | undefined) {
  const area = await db.area.findUnique({ where: { id: areaId }, select: { id: true } });
  if (!area) throw new DomainError("VALIDATION_FAILED", "Unknown area.", [{ field: "areaId", message: "Unknown area." }]);
  if (equipmentId) {
    const eq = await db.equipment.findUnique({ where: { id: equipmentId }, select: { areaId: true } });
    if (!eq || eq.areaId !== areaId)
      throw new DomainError("VALIDATION_FAILED", "Equipment does not belong to the selected area.", [{ field: "equipmentId", message: "Equipment is not in this area." }]);
  }
}

async function nextPermitNumber(tx: Tx, now: Date): Promise<string> {
  // Serialise number allocation: concurrent creates would otherwise all read
  // the same "last number". The lock is released when the transaction ends.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('permit_number'))`;
  const year = now.getUTCFullYear();
  const prefix = `PTW-${year}-`;
  const last = await tx.permit.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

function guard(actor: Actor, action: PermitAction, permit: PermitWithAuth, now: Date) {
  assertAuthorized(actor, action, toAuthView(permit), now);
}

async function applyTransition(
  tx: Tx,
  permit: PermitWithAuth,
  event: PermitEvent,
  data: Prisma.PermitUpdateInput,
): Promise<{ from: PermitStatus; to: PermitStatus }> {
  const from = permit.status as PermitStatus;
  const to = nextStatus(from, event);
  // Conditional on the status we read — belt and braces on top of the row lock.
  const res = await tx.permit.updateMany({ where: { id: permit.id, status: from }, data: { ...(data as Prisma.PermitUpdateManyMutationInput), status: to } });
  if (res.count !== 1) throw new DomainError("CONCURRENT_MODIFICATION", "The permit changed while you were acting on it. Reload and try again.");
  return { from, to };
}

// ---------------------------------------------------------------- create / edit draft

export async function createPermit(actor: Actor, input: CreatePermitInput, now = new Date()) {
  const def = requirePermitType(input.type);
  await assertLocation(prisma, input.areaId, input.equipmentId);
  const typeData = parseTypeData(def.key, input.typeData);
  const precautions = normalisePrecautions(def, input.precautions);

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const permit = await tx.permit.create({
          data: {
            number: await nextPermitNumber(tx, now),
            type: def.key,
            status: "DRAFT",
            requesterId: actor.id,
            contractor: input.contractor,
            crewSize: input.crewSize ?? null,
            workDescription: input.workDescription,
            areaId: input.areaId,
            equipmentId: input.equipmentId ?? null,
            locationDetail: input.locationDetail ?? null,
            plannedStart: new Date(input.plannedStart),
            plannedEnd: new Date(input.plannedEnd),
            validUntil: new Date(input.plannedEnd),
            hazards: input.hazards,
            ppe: input.ppe,
            precautions: json(precautions),
            typeData: json(typeData),
          },
        });
        await writeAudit(tx, { permitId: permit.id, actorId: actor.id, action: "CREATED", field: "status", to: "DRAFT", comment: `${def.label} permit raised as draft.` });
        return permit;
      });
    } catch (e) {
      // Two permits created in the same instant can race for the same number.
      if ((e as { code?: string }).code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateDraft(actor: Actor, permitId: string, input: UpdateDraftInput, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, "EDIT_DRAFT", permit, now);
    const def = requirePermitType(permit.type);

    const areaId = input.areaId ?? permit.areaId;
    const equipmentId = input.equipmentId === undefined ? permit.equipmentId : input.equipmentId;
    if (input.areaId !== undefined || input.equipmentId !== undefined) await assertLocation(tx, areaId, equipmentId);

    const plannedEnd = input.plannedEnd ? new Date(input.plannedEnd) : permit.plannedEnd;
    return tx.permit.update({
      where: { id: permitId },
      data: {
        contractor: input.contractor,
        crewSize: input.crewSize,
        workDescription: input.workDescription,
        areaId,
        equipmentId,
        locationDetail: input.locationDetail,
        plannedStart: input.plannedStart ? new Date(input.plannedStart) : undefined,
        plannedEnd,
        validUntil: plannedEnd,
        hazards: input.hazards,
        ppe: input.ppe,
        precautions: input.precautions ? json(normalisePrecautions(def, input.precautions)) : undefined,
        typeData: input.typeData ? json(parseTypeData(def.key, input.typeData)) : undefined,
      },
    });
    // Drafts are private working copies; edits before submission are not
    // audited field-by-field (the spec asks for edits *after* submission).
  });
}

// ---------------------------------------------------------------- submit

export async function submitPermit(actor: Actor, permitId: string, now = new Date()) {
  const result = await prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, "SUBMIT", permit, now);
    const def = requirePermitType(permit.type);

    const issues = submissionIssues(
      {
        type: permit.type,
        contractor: permit.contractor,
        workDescription: permit.workDescription,
        plannedStart: permit.plannedStart,
        plannedEnd: permit.plannedEnd,
        hazards: permit.hazards,
        ppe: permit.ppe,
        precautions: asPrecautions(permit.precautions),
        typeData: asTypeData(permit.typeData),
      },
      now,
    );
    if (issues.length) throw new DomainError("VALIDATION_FAILED", "The permit is incomplete: " + issues.map((i) => i.message).join(" "), issues);

    const conflicts = await findConflicts({ excludePermitId: permit.id, type: permit.type, areaId: permit.areaId, start: permit.plannedStart, end: permit.validUntil });

    await tx.permitApproval.createMany({ data: def.requiredApprovals.map((role) => ({ permitId: permit.id, role })) });
    const { from, to } = await applyTransition(tx, permit, "SUBMIT", { submittedAt: now });
    await writeAudit(tx, {
      permitId: permit.id,
      actorId: actor.id,
      action: "SUBMITTED",
      field: "status",
      from,
      to,
      comment: conflicts.length
        ? `Submitted with SIMOPS warning — overlaps ${conflicts.map((c) => `${c.number} (${c.type})`).join(", ")} in the same area.`
        : null,
    });
    return { number: permit.number, areaId: permit.areaId, conflicts };
  });

  const owners = await prisma.area.findUnique({ where: { id: result.areaId }, select: { owner: { select: { email: true } } } });
  notify([owners?.owner?.email ?? "area owner", "safety officers"], `${result.number} is waiting for your approval.`);
  return result;
}

// ---------------------------------------------------------------- approvals

export interface ApprovalDecisionInput {
  decision: "APPROVE" | "REJECT";
  comment?: string | null;
  signature?: string | null;
}

export async function decideApproval(actor: Actor, permitId: string, input: ApprovalDecisionInput, now = new Date()) {
  await expireDuePermits(now, permitId);
  return prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, input.decision, permit, now);

    if (input.decision === "REJECT" && !input.comment?.trim())
      throw new DomainError("VALIDATION_FAILED", "A reason is required to reject a permit.", [{ field: "comment", message: "Reason is required." }]);
    if (input.decision === "APPROVE" && !input.signature)
      throw new DomainError("VALIDATION_FAILED", "Sign before approving.", [{ field: "signature", message: "Signature is required." }]);

    const found = findApprovalSlot(actor, toAuthView(permit));
    if (!("slot" in found)) throw new DomainError("FORBIDDEN", found.reason);
    const slotRow = permit.approvals.find((a) => a.role === found.slot.role)!;

    await tx.permitApproval.update({
      where: { id: slotRow.id },
      data: {
        decision: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        approverId: actor.id,
        comment: input.comment?.trim() || null,
        signature: input.decision === "APPROVE" ? input.signature : null,
        decidedAt: now,
      },
    });

    const entries: AuditEntry[] = [
      {
        permitId,
        actorId: actor.id,
        action: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        field: `approval.${slotRow.role}`,
        from: "PENDING",
        to: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        comment: input.comment?.trim() || null,
      },
    ];

    let status = permit.status as PermitStatus;
    if (input.decision === "REJECT") {
      const t = await applyTransition(tx, permit, "REJECT", {});
      entries.push({ permitId, actorId: actor.id, action: "STATUS_CHANGED", field: "status", from: t.from, to: t.to, comment: "Rejected by an approver." });
      status = t.to;
    } else {
      const after = permit.approvals.map((a) => (a.id === slotRow.id ? { ...a, decision: "APPROVED" as const } : a));
      if (allApproved(after)) {
        const t = await applyTransition(tx, permit, "APPROVE_ALL", {});
        entries.push({ permitId, actorId: actor.id, action: "STATUS_CHANGED", field: "status", from: t.from, to: t.to, comment: "All required approvals received." });
        status = t.to;
      }
    }
    await writeAudit(tx, entries);
    if (status !== "PENDING_APPROVAL") notify(permit.requesterId, `${permit.number} is now ${status}.`);
    return { status };
  });
}

// ---------------------------------------------------------------- lifecycle transitions

export type LifecycleAction = "ACTIVATE" | "SUSPEND" | "RESUME" | "CLOSE" | "VERIFY" | "CANCEL";

export interface TransitionInput {
  comment?: string | null;
  completionNotes?: string | null;
  verificationNotes?: string | null;
}

const AUDIT_FOR: Record<LifecycleAction, AuditEntry["action"]> = {
  ACTIVATE: "ACTIVATED",
  SUSPEND: "SUSPENDED",
  RESUME: "RESUMED",
  CLOSE: "CLOSED",
  VERIFY: "VERIFIED",
  CANCEL: "CANCELLED",
};

export async function transitionPermit(actor: Actor, permitId: string, action: LifecycleAction, input: TransitionInput, now = new Date()) {
  await expireDuePermits(now, permitId);
  return prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, action, permit, now);
    const def = requirePermitType(permit.type);

    const need = (v: string | null | undefined, field: string, msg: string) => {
      if (!v?.trim()) throw new DomainError("VALIDATION_FAILED", msg, [{ field, message: msg }]);
      return v.trim();
    };

    let data: Prisma.PermitUpdateInput = {};
    let comment = input.comment?.trim() || null;
    switch (action) {
      case "ACTIVATE":
        data = { activatedAt: permit.activatedAt ?? now };
        break;
      case "SUSPEND":
        comment = need(input.comment, "comment", "Give the reason for stopping work.");
        break;
      case "RESUME":
        comment = need(input.comment, "comment", "Record what was checked before resuming.");
        break;
      case "CANCEL":
        comment = need(input.comment, "comment", "Give the reason for cancelling.");
        break;
      case "CLOSE": {
        const notes = need(input.completionNotes, "completionNotes", "Completion notes are required.");
        if (def.hasEntryRegister) {
          const logs = await tx.workLog.findMany({ where: { permitId }, orderBy: { createdAt: "asc" }, select: { kind: true, person: true } });
          const inside = peopleInside(logs);
          if (inside.length)
            throw new DomainError("PRECONDITION_FAILED", `Cannot close: ${inside.join(", ")} still logged inside the space. Record their exit first.`);
        }
        data = { closedAt: now, completionNotes: notes };
        comment = notes;
        break;
      }
      case "VERIFY": {
        const notes = need(input.verificationNotes, "verificationNotes", "Verification notes are required.");
        data = { verifiedAt: now, verificationNotes: notes };
        comment = notes;
        break;
      }
    }

    const { from, to } = await applyTransition(tx, permit, action, data);

    // A permit that is finished can't have a live extension request.
    if (to === "CLOSED" || to === "CANCELLED") {
      await tx.extensionRequest.updateMany({
        where: { permitId, status: "PENDING" },
        data: { status: "REJECTED", decisionNote: `Withdrawn: permit ${to.toLowerCase()}.`, decidedAt: now },
      });
    }

    await writeAudit(tx, { permitId, actorId: actor.id, action: AUDIT_FOR[action], field: "status", from, to, comment });
    if (action === "SUSPEND") notify([permit.requesterId, "area owner", "safety officers"], `STOP WORK: ${permit.number} suspended — ${comment}`);
    if (action === "CLOSE") notify("safety officers", `${permit.number} closed; area needs verification.`);
    return { status: to };
  });
}

// ---------------------------------------------------------------- readings (field edits after submission)

export async function updateReadings(actor: Actor, permitId: string, patch: TypeData, comment: string | null | undefined, now = new Date()) {
  await expireDuePermits(now, permitId);
  return prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, "UPDATE_READINGS", permit, now);
    const def = requirePermitType(permit.type);

    const editable = def.fields.filter((f) => f.editableAfterSubmit);
    const editableNames = new Set(editable.map((f) => f.name));
    const illegal = Object.keys(patch).filter((k) => !editableNames.has(k));
    if (illegal.length)
      throw new DomainError("VALIDATION_FAILED", `These fields are locked after submission: ${illegal.join(", ")}. Cancel and raise a new permit to change them.`);

    const parsed = buildShapeSchema(editable).parse(patch) as TypeData;
    const before = asTypeData(permit.typeData);
    const after: TypeData = { ...before };
    const entries: AuditEntry[] = [];
    const changedFields = [];
    for (const f of editable) {
      if (!(f.name in patch)) continue;
      const next = parsed[f.name];
      if (JSON.stringify(before[f.name] ?? null) === JSON.stringify(next ?? null)) continue;
      if (next === undefined) delete after[f.name];
      else after[f.name] = next;
      changedFields.push(f);
      entries.push({ permitId, actorId: actor.id, action: "FIELD_CHANGED", field: f.label, from: before[f.name], to: next, comment: comment?.trim() || null });
    }
    if (entries.length === 0) return { changed: 0, status: permit.status };

    await tx.permit.update({ where: { id: permitId }, data: { typeData: json(after) } });

    // A bad reading while people are working means stop work now, not "after review".
    // Only newly entered *numeric* readings count here (a test getting older isn't an alarm).
    let status = permit.status as PermitStatus;
    const unsafe = activationReadingIssues(changedFields.filter((f) => f.kind === "number"), after, now);
    if (status === "ACTIVE" && unsafe.length) {
      const t = await applyTransition(tx, permit, "SUSPEND", {});
      entries.push({ permitId, actorId: null, action: "AUTO_SUSPENDED", field: "status", from: t.from, to: t.to, comment: unsafe.map((i) => i.message).join(" ") });
      status = t.to;
      notify([permit.requesterId, "safety officers"], `STOP WORK: ${permit.number} auto-suspended — ${unsafe[0].message}`);
    }
    await writeAudit(tx, entries);
    return { changed: entries.length, status };
  });
}

// ---------------------------------------------------------------- work log / entry register

export interface WorkLogInput {
  kind: "NOTE" | "ENTRY" | "EXIT";
  person?: string | null;
  message: string;
}

export async function addWorkLog(actor: Actor, permitId: string, input: WorkLogInput, now = new Date()) {
  await expireDuePermits(now, permitId);
  return prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, "LOG_WORK", permit, now);
    const def = requirePermitType(permit.type);

    if (input.kind !== "NOTE") {
      if (!def.hasEntryRegister) throw new DomainError("VALIDATION_FAILED", `${def.label} permits have no entry register.`);
      const person = input.person?.trim();
      if (!person) throw new DomainError("VALIDATION_FAILED", "Name the person entering or exiting.");
      const logs = await tx.workLog.findMany({ where: { permitId }, orderBy: { createdAt: "asc" }, select: { kind: true, person: true } });
      const inside = peopleInside(logs).map((n) => n.toLowerCase());
      if (input.kind === "EXIT" && !inside.includes(person.toLowerCase())) throw new DomainError("PRECONDITION_FAILED", `${person} is not logged inside.`);
      if (input.kind === "ENTRY" && inside.includes(person.toLowerCase())) throw new DomainError("PRECONDITION_FAILED", `${person} is already inside.`);
    }

    return tx.workLog.create({
      data: { permitId, authorId: actor.id, kind: input.kind, person: input.person?.trim() || null, message: input.message.trim(), createdAt: now },
    });
  });
}

// ---------------------------------------------------------------- extensions

export async function requestExtension(actor: Actor, permitId: string, input: { hours: number; reason: string }, now = new Date()) {
  await expireDuePermits(now, permitId);
  return prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, "REQUEST_EXTENSION", permit, now);
    if (!Number.isInteger(input.hours) || input.hours < 1 || input.hours > MAX_EXTENSION_HOURS)
      throw new DomainError("VALIDATION_FAILED", `Extensions are 1–${MAX_EXTENSION_HOURS} hours.`);
    const ext = await tx.extensionRequest.create({ data: { permitId, requestedById: actor.id, hours: input.hours, reason: input.reason.trim(), createdAt: now } });
    await writeAudit(tx, { permitId, actorId: actor.id, action: "EXTENSION_REQUESTED", field: "validUntil", from: permit.validUntil, to: `+${input.hours} h`, comment: input.reason.trim() });
    notify("safety officers", `${permit.number}: extension of ${input.hours} h requested.`);
    return ext;
  });
}

export async function decideExtension(actor: Actor, permitId: string, extensionId: string, input: { approve: boolean; note?: string | null }, now = new Date()) {
  await expireDuePermits(now, permitId);
  return prisma.$transaction(async (tx) => {
    const permit = await lockPermit(tx, permitId);
    guard(actor, "DECIDE_EXTENSION", permit, now);
    const ext = await tx.extensionRequest.findFirst({ where: { id: extensionId, permitId, status: "PENDING" } });
    if (!ext) throw new DomainError("NOT_FOUND", "No pending extension request with that id on this permit.");
    if (!input.approve && !input.note?.trim()) throw new DomainError("VALIDATION_FAILED", "A reason is required to refuse an extension.");

    await tx.extensionRequest.update({
      where: { id: ext.id },
      data: { status: input.approve ? "APPROVED" : "REJECTED", decidedById: actor.id, decisionNote: input.note?.trim() || null, decidedAt: now },
    });

    if (!input.approve) {
      await writeAudit(tx, { permitId, actorId: actor.id, action: "EXTENSION_REJECTED", field: "validUntil", comment: input.note?.trim() });
      return { validUntil: permit.validUntil };
    }
    const newUntil = new Date(permit.validUntil.getTime() + ext.hours * 3_600_000);
    await tx.permit.update({ where: { id: permitId }, data: { validUntil: newUntil, extensionCount: { increment: 1 } } });
    await writeAudit(tx, {
      permitId,
      actorId: actor.id,
      action: "EXTENSION_APPROVED",
      field: "validUntil",
      from: permit.validUntil,
      to: newUntil,
      comment: input.note?.trim() || `Extended by ${ext.hours} h.`,
    });
    notify(permit.requesterId, `${permit.number} extended until ${newUntil.toISOString()}.`);
    return { validUntil: newUntil };
  });
}

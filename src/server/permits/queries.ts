import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { DomainError } from "@/domain/errors";
import { allowedActions, authorize, type Actor, type PermitAction } from "@/domain/permissions";
import { EXPIRING_SOON_MS } from "@/domain/guards";
import { PERMIT_STATUSES, type PermitStatus } from "@/domain/enums";
import { PERMIT_TYPE_KEYS } from "@/domain/permit-types";
import { z } from "zod";
import { expireDuePermits } from "./expiry";
import { permitAuthInclude, toAuthView } from "./repository";
import { conflictingTypes, findConflicts } from "./conflicts";

export const permitFiltersSchema = z.object({
  status: z.enum(PERMIT_STATUSES).optional().catch(undefined),
  type: z.enum(PERMIT_TYPE_KEYS).optional().catch(undefined),
  plantId: z.string().min(1).optional().catch(undefined),
  areaId: z.string().min(1).optional().catch(undefined),
  from: z.string().min(1).optional().catch(undefined), // plant-local yyyy-mm-dd
  to: z.string().min(1).optional().catch(undefined),
  view: z.enum(["all", "live", "my-approvals", "mine", "expiring"]).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});
export type PermitFilters = z.infer<typeof permitFiltersSchema>;

const listSelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  workDescription: true,
  contractor: true,
  plannedStart: true,
  plannedEnd: true,
  validUntil: true,
  requesterId: true,
  areaId: true,
  typeData: true,
  extensionCount: true,
  requester: { select: { name: true } },
  area: { select: { id: true, name: true, plant: { select: { id: true, name: true, code: true } } } },
  equipment: { select: { tag: true, name: true } },
  ...permitAuthInclude,
} satisfies Prisma.PermitSelect;

export type PermitListItem = Prisma.PermitGetPayload<{ select: typeof listSelect }> & { canApprove: boolean };

const dayStartIST = (d: string) => new Date(`${d}T00:00:00+05:30`);

export async function listPermits(actor: Actor, filters: PermitFilters, now = new Date()): Promise<PermitListItem[]> {
  await expireDuePermits(now);

  // Drafts are private to their author (and admins).
  const where: Prisma.PermitWhereInput = actor.role === "ADMIN" ? {} : { OR: [{ status: { not: "DRAFT" } }, { requesterId: actor.id }] };
  const and: Prisma.PermitWhereInput[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.type) and.push({ type: filters.type });
  if (filters.areaId) and.push({ areaId: filters.areaId });
  if (filters.plantId) and.push({ area: { plantId: filters.plantId } });
  // Date range = permits whose window touches [from, to].
  if (filters.from) and.push({ validUntil: { gte: dayStartIST(filters.from) } });
  if (filters.to) and.push({ plannedStart: { lt: new Date(dayStartIST(filters.to).getTime() + 86_400_000) } });
  if (filters.q) and.push({ OR: [{ number: { contains: filters.q, mode: "insensitive" } }, { workDescription: { contains: filters.q, mode: "insensitive" } }, { contractor: { contains: filters.q, mode: "insensitive" } }] });
  switch (filters.view) {
    case "live":
      and.push({ status: { in: ["APPROVED", "ACTIVE", "SUSPENDED"] } });
      break;
    case "mine":
      and.push({ requesterId: actor.id });
      break;
    case "my-approvals":
      and.push({ status: "PENDING_APPROVAL" });
      break;
    case "expiring":
      and.push({ status: { in: ["APPROVED", "ACTIVE", "SUSPENDED"] }, validUntil: { gt: now, lte: new Date(now.getTime() + EXPIRING_SOON_MS) } });
      break;
  }

  const rows = await prisma.permit.findMany({
    where: { ...where, AND: and },
    select: listSelect,
    orderBy: [{ plannedStart: "desc" }],
    take: 200,
  });

  const items = rows.map((r) => ({ ...r, canApprove: authorize(actor, "APPROVE", toAuthView(r), now).allowed }));
  return filters.view === "my-approvals" ? items.filter((i) => i.canApprove) : items;
}

export async function dashboardSummary(actor: Actor, now = new Date()) {
  await expireDuePermits(now);
  const soon = new Date(now.getTime() + EXPIRING_SOON_MS);

  const [active, expiring, suspended, awaitingVerification, pending, startingSoon] = await Promise.all([
    prisma.permit.findMany({ where: { status: "ACTIVE" }, select: listSelect, orderBy: { validUntil: "asc" } }),
    prisma.permit.findMany({ where: { status: { in: ["APPROVED", "ACTIVE", "SUSPENDED"] }, validUntil: { gt: now, lte: soon } }, select: listSelect, orderBy: { validUntil: "asc" } }),
    prisma.permit.findMany({ where: { status: "SUSPENDED" }, select: listSelect, orderBy: { validUntil: "asc" } }),
    prisma.permit.findMany({ where: { status: "CLOSED" }, select: listSelect, orderBy: { closedAt: "asc" } }),
    prisma.permit.findMany({ where: { status: "PENDING_APPROVAL" }, select: listSelect, orderBy: { plannedStart: "asc" } }),
    prisma.permit.findMany({ where: { status: "APPROVED", validUntil: { gt: now } }, select: listSelect, orderBy: { plannedStart: "asc" } }),
  ]);
  const withApprove = <T extends (typeof active)[number]>(r: T) => ({ ...r, canApprove: authorize(actor, "APPROVE", toAuthView(r), now).allowed });
  const myApprovals = pending.map(withApprove).filter((p) => p.canApprove);

  return {
    active: active.map(withApprove),
    expiring: expiring.map(withApprove),
    suspended: suspended.map(withApprove),
    awaitingVerification: awaitingVerification.map(withApprove),
    myApprovals,
    pendingCount: pending.length,
    startingSoon: startingSoon.map(withApprove),
  };
}

export async function getPermitDetail(actor: Actor, id: string, now = new Date()) {
  await expireDuePermits(now, id);
  const permit = await prisma.permit.findUnique({
    where: { id },
    include: {
      ...permitAuthInclude,
      requester: { select: { id: true, name: true, email: true } },
      area: { include: { plant: true, owner: { select: { name: true } } } },
      equipment: true,
      approvals: { orderBy: { role: "asc" }, include: { approver: { select: { name: true, role: true } } } },
      auditLogs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } },
      workLogs: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      extensions: { orderBy: { createdAt: "asc" }, include: { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } } },
    },
  });
  if (!permit || (permit.status === "DRAFT" && permit.requesterId !== actor.id && actor.role !== "ADMIN")) {
    throw new DomainError("NOT_FOUND", "Permit not found.");
  }
  const authView = toAuthView({ ...permit, extensions: permit.extensions.filter((e) => e.status === "PENDING") });
  const actions = allowedActions(actor, authView, now);
  // Explain why work can't start yet, so the requester knows what to fix.
  const activateDecision = authorize(actor, "ACTIVATE", authView, now);
  const blockers: Partial<Record<PermitAction, string>> = {};
  if (!activateDecision.allowed && activateDecision.kind === "precondition") blockers.ACTIVATE = activateDecision.reason;

  const conflicts =
    permit.status === "DRAFT" || ["PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"].includes(permit.status)
      ? await findConflicts({ excludePermitId: permit.id, type: permit.type, areaId: permit.areaId, start: permit.plannedStart, end: permit.validUntil })
      : [];

  return { permit, actions, blockers, conflicts, status: permit.status as PermitStatus };
}

export type PermitDetail = Awaited<ReturnType<typeof getPermitDetail>>;

export async function getReferenceData() {
  return prisma.plant.findMany({
    orderBy: { name: "asc" },
    include: {
      areas: {
        orderBy: { name: "asc" },
        include: { owner: { select: { id: true, name: true } }, equipment: { orderBy: { tag: "asc" }, select: { id: true, tag: true, name: true } } },
      },
    },
  });
}
export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;

/** Minimal, name-free status for the QR walk-around page (no login). */
export async function getPublicStatus(id: string, now = new Date()) {
  await expireDuePermits(now, id);
  const p = await prisma.permit.findUnique({
    where: { id },
    select: {
      number: true,
      type: true,
      status: true,
      plannedStart: true,
      validUntil: true,
      workDescription: true,
      contractor: true,
      area: { select: { name: true, plant: { select: { name: true } } } },
      equipment: { select: { tag: true } },
      approvals: { select: { role: true, decision: true } },
    },
  });
  if (!p || p.status === "DRAFT") throw new DomainError("NOT_FOUND", "Permit not found.");
  return p;
}

/** Badge counts for the navigation (cheap: no list payloads). */
export async function navCounts(actor: Actor, now = new Date()) {
  const soon = new Date(now.getTime() + EXPIRING_SOON_MS);
  const [pending, expiring, stopped] = await Promise.all([
    prisma.permit.findMany({ where: { status: "PENDING_APPROVAL" }, select: { ...permitAuthInclude, type: true, status: true, requesterId: true, areaId: true, plannedStart: true, validUntil: true, typeData: true, extensionCount: true } }),
    prisma.permit.count({ where: { status: { in: ["APPROVED", "ACTIVE", "SUSPENDED"] }, validUntil: { gt: now, lte: soon } } }),
    prisma.permit.count({ where: { status: "SUSPENDED" } }),
  ]);
  const approvals = pending.filter((p) => authorize(actor, "APPROVE", toAuthView(p), now).allowed).length;
  return { approvals, expiring, stopped };
}

// ---------------------------------------------------------------- site timeline

export const TIMELINE_BEFORE_H = 8;
export const TIMELINE_AFTER_H = 16;

export interface TimelineBar {
  id: string;
  number: string;
  type: string;
  status: PermitStatus;
  workDescription: string;
  start: Date;
  end: Date;
  lane: number;
}
export interface TimelineRow {
  areaId: string;
  label: string;
  plant: string;
  lanes: number;
  bars: TimelineBar[];
  conflicts: { start: Date; end: Date; between: string[] }[];
}

/**
 * Everything planned or running in a 24 h window around now, one row per
 * area, overlapping permits stacked in lanes, and the simultaneous-operations
 * overlaps (same rule as conflicts.ts) returned as zones to highlight.
 */
export async function siteTimeline(now = new Date()) {
  const from = new Date(now.getTime() - TIMELINE_BEFORE_H * 3_600_000);
  const to = new Date(now.getTime() + TIMELINE_AFTER_H * 3_600_000);
  const permits = await prisma.permit.findMany({
    where: {
      status: { notIn: ["DRAFT", "CANCELLED", "REJECTED"] },
      plannedStart: { lt: to },
      validUntil: { gt: from },
    },
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      workDescription: true,
      plannedStart: true,
      validUntil: true,
      closedAt: true,
      area: { select: { id: true, name: true, plant: { select: { code: true } } } },
    },
    orderBy: { plannedStart: "asc" },
  });

  const rows = new Map<string, TimelineRow>();
  for (const p of permits) {
    let row = rows.get(p.area.id);
    if (!row) {
      row = { areaId: p.area.id, label: p.area.name, plant: p.area.plant.code, lanes: 0, bars: [], conflicts: [] };
      rows.set(p.area.id, row);
    }
    // A closed permit occupied the area until it was closed, not until validUntil.
    const end = p.closedAt && p.closedAt < p.validUntil ? p.closedAt : p.validUntil;
    // Greedy lane packing: first lane whose last bar has ended.
    let lane = 0;
    while (row.bars.some((b) => b.lane === lane && b.start < end && p.plannedStart < b.end)) lane++;
    row.bars.push({ id: p.id, number: p.number, type: p.type, status: p.status as PermitStatus, workDescription: p.workDescription, start: p.plannedStart, end, lane });
    row.lanes = Math.max(row.lanes, lane + 1);
  }

  const LIVE = new Set(["PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"]);
  for (const row of rows.values()) {
    const live = row.bars.filter((b) => LIVE.has(b.status));
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (!conflictingTypes(a.type).includes(b.type)) continue;
        const start = a.start > b.start ? a.start : b.start;
        const end = a.end < b.end ? a.end : b.end;
        if (start < end) row.conflicts.push({ start, end, between: [a.number, b.number] });
      }
    }
    // Merge overlapping zones so several clashes draw as one hatched block.
    row.conflicts.sort((x, y) => x.start.getTime() - y.start.getTime());
    const merged: TimelineRow["conflicts"] = [];
    for (const c of row.conflicts) {
      const last = merged.at(-1);
      if (last && c.start <= last.end) {
        if (c.end > last.end) last.end = c.end;
        last.between = [...new Set([...last.between, ...c.between])];
      } else merged.push({ ...c, between: [...c.between] });
    }
    row.conflicts = merged;
  }

  return {
    from,
    to,
    now,
    rows: [...rows.values()].sort((a, b) => a.plant.localeCompare(b.plant) || a.label.localeCompare(b.label)),
  };
}
export type SiteTimelineData = Awaited<ReturnType<typeof siteTimeline>>;

// End-to-end tests of the permit service against a real Postgres.
// These exercise the same functions the API routes call, so "can we break it
// by hitting the API directly?" is answered here without a browser.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import type { Actor } from "@/domain/permissions";
import type { DomainError } from "@/domain/errors";
import {
  addWorkLog,
  createPermit,
  decideApproval,
  decideExtension,
  requestExtension,
  submitPermit,
  transitionPermit,
  updateReadings,
} from "@/server/permits/commands";
import { expireDuePermits } from "@/server/permits/expiry";
import { findConflicts } from "@/server/permits/conflicts";
import type { CreatePermitInput } from "@/domain/permit-core";
import { getPermitType } from "@/domain/permit-types";

const SIG = "data:image/png;base64,iVBORw0KGgo=";
const H = 3_600_000;
const t0 = new Date();
const at = (hours: number) => new Date(t0.getTime() + hours * H);

let requester: Actor, owner: Actor, otherOwner: Actor, safety: Actor, admin: Actor;
let areaId: string, otherAreaId: string;

async function expectError(p: Promise<unknown>, code: string, message?: RegExp) {
  try {
    await p;
  } catch (e) {
    expect((e as DomainError).code).toBe(code);
    if (message) expect((e as Error).message).toMatch(message);
    return;
  }
  throw new Error(`expected ${code} but the call succeeded`);
}

function allChecked(type: string) {
  return getPermitType(type)!.precautions.map((p) => ({ id: p.id, label: p.label, checked: true }));
}

function hotWorkInput(over: Partial<CreatePermitInput> = {}): CreatePermitInput {
  return {
    type: "HOT_WORK",
    contractor: "Sri Balaji Fabricators",
    workDescription: "Weld support bracket on pipe rack PR-3",
    areaId,
    equipmentId: null,
    locationDetail: null,
    plannedStart: at(1).toISOString(),
    plannedEnd: at(5).toISOString(),
    hazards: ["Fire"],
    ppe: ["Welding shield"],
    precautions: allChecked("HOT_WORK"),
    typeData: {
      hotWorkType: "WELDING",
      fireWatchName: "S. Devi",
      fireWatchAfterMinutes: 30,
      extinguisherType: "DCP",
      combustiblesClearedRadiusM: 12,
      gasLelPct: 0,
      gasO2Pct: 20.9,
      gasTestAt: at(0.75).toISOString(),
      gasTestedBy: "R. Kumar",
    },
    ...over,
  };
}

async function approvedHotWork(over: Partial<CreatePermitInput> = {}) {
  const p = await createPermit(requester, hotWorkInput(over), t0);
  await submitPermit(requester, p.id, t0);
  await decideApproval(owner, p.id, { decision: "APPROVE", signature: SIG }, t0);
  await decideApproval(safety, p.id, { decision: "APPROVE", signature: SIG }, t0);
  return p;
}

const status = async (id: string) => (await prisma.permit.findUniqueOrThrow({ where: { id } })).status;

beforeAll(async () => {
  const mk = (email: string, role: Actor["role"]) =>
    prisma.user.create({ data: { email, name: email.split("@")[0], role, passwordHash: "x" } });
  const [r, o, o2, s, a] = await Promise.all([
    mk("req@t.test", "REQUESTER"),
    mk("owner@t.test", "AREA_OWNER"),
    mk("owner2@t.test", "AREA_OWNER"),
    mk("safety@t.test", "SAFETY_OFFICER"),
    mk("admin@t.test", "ADMIN"),
  ]);
  const plant = await prisma.plant.create({ data: { code: "TP", name: "Test Plant" } });
  areaId = (await prisma.area.create({ data: { code: "A1", name: "Area 1", plantId: plant.id, ownerId: o.id } })).id;
  otherAreaId = (await prisma.area.create({ data: { code: "A2", name: "Area 2", plantId: plant.id, ownerId: o2.id } })).id;

  requester = { id: r.id, role: "REQUESTER", ownedAreaIds: [] };
  owner = { id: o.id, role: "AREA_OWNER", ownedAreaIds: [areaId] };
  otherOwner = { id: o2.id, role: "AREA_OWNER", ownedAreaIds: [otherAreaId] };
  safety = { id: s.id, role: "SAFETY_OFFICER", ownedAreaIds: [] };
  admin = { id: a.id, role: "ADMIN", ownedAreaIds: [] };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("full lifecycle", () => {
  it("draft → submit → approve ×2 → activate → close → verify, with an audit trail", async () => {
    const p = await createPermit(requester, hotWorkInput(), t0);
    expect(p.status).toBe("DRAFT");
    expect(p.number).toMatch(/^PTW-\d{4}-\d{4}$/);

    await submitPermit(requester, p.id, t0);
    expect(await status(p.id)).toBe("PENDING_APPROVAL");

    await decideApproval(owner, p.id, { decision: "APPROVE", comment: "Area isolated", signature: SIG }, t0);
    expect(await status(p.id)).toBe("PENDING_APPROVAL"); // still needs safety

    await decideApproval(safety, p.id, { decision: "APPROVE", signature: SIG }, t0);
    expect(await status(p.id)).toBe("APPROVED");

    await transitionPermit(requester, p.id, "ACTIVATE", {}, at(1.1));
    expect(await status(p.id)).toBe("ACTIVE");

    await addWorkLog(requester, p.id, { kind: "NOTE", message: "Bracket tacked" }, at(2));
    await transitionPermit(requester, p.id, "CLOSE", { completionNotes: "Bracket welded, area cleaned" }, at(3));
    await transitionPermit(safety, p.id, "VERIFY", { verificationNotes: "No hot spots; fire watch completed 30 min" }, at(3.6));
    expect(await status(p.id)).toBe("CLOSED_VERIFIED");

    const log = await prisma.auditLog.findMany({ where: { permitId: p.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => l.action)).toEqual([
      "CREATED",
      "SUBMITTED",
      "APPROVED",
      "APPROVED",
      "STATUS_CHANGED",
      "ACTIVATED",
      "CLOSED",
      "VERIFIED",
    ]);
    expect(log.every((l) => l.createdAt)).toBe(true);
  });
});

describe("approval rules (server-side)", () => {
  it("a person can never approve their own permit", async () => {
    // The area owner raises a permit in their own area...
    const p = await createPermit(owner, hotWorkInput(), t0);
    await submitPermit(owner, p.id, t0);
    // ...and cannot fill the area-owner slot on it.
    await expectError(decideApproval(owner, p.id, { decision: "APPROVE", signature: SIG }, t0), "FORBIDDEN", /own permit/);
    // Neither can a safety officer or admin on their own permits.
    for (const self of [safety, admin]) {
      const own = await createPermit(self, hotWorkInput(), t0);
      await submitPermit(self, own.id, t0);
      await expectError(decideApproval(self, own.id, { decision: "APPROVE", signature: SIG }, t0), "FORBIDDEN", /own permit/);
    }
  });

  it("requesters and owners of other areas cannot approve", async () => {
    const p = await createPermit(admin, hotWorkInput(), t0);
    await submitPermit(admin, p.id, t0);
    await expectError(decideApproval(requester, p.id, { decision: "APPROVE", signature: SIG }, t0), "FORBIDDEN");
    await expectError(decideApproval(otherOwner, p.id, { decision: "APPROVE", signature: SIG }, t0), "FORBIDDEN", /own area/);
  });

  it("any rejection rejects the permit, and a reason is mandatory", async () => {
    const p = await createPermit(requester, hotWorkInput(), t0);
    await submitPermit(requester, p.id, t0);
    await expectError(decideApproval(safety, p.id, { decision: "REJECT", comment: "" }, t0), "VALIDATION_FAILED");
    await decideApproval(safety, p.id, { decision: "REJECT", comment: "Gas line not blinded" }, t0);
    expect(await status(p.id)).toBe("REJECTED");
    await expectError(decideApproval(owner, p.id, { decision: "APPROVE", signature: SIG }, t0), "INVALID_TRANSITION");
  });

  it("an incomplete permit cannot be submitted", async () => {
    const p = await createPermit(requester, hotWorkInput({ precautions: [], typeData: {} }), t0);
    await expectError(submitPermit(requester, p.id, t0), "VALIDATION_FAILED", /Fire watch/);
    expect(await status(p.id)).toBe("DRAFT");
  });
});

describe("activation rules", () => {
  it("cannot activate before planned start or before every approval", async () => {
    const p = await createPermit(requester, hotWorkInput(), t0);
    await submitPermit(requester, p.id, t0);
    await decideApproval(owner, p.id, { decision: "APPROVE", signature: SIG }, t0);
    // Skipping straight to ACTIVE from PENDING is not an edge in the graph.
    await expectError(transitionPermit(requester, p.id, "ACTIVATE", {}, at(1.1)), "INVALID_TRANSITION");
    await decideApproval(safety, p.id, { decision: "APPROVE", signature: SIG }, t0);
    await expectError(transitionPermit(requester, p.id, "ACTIVATE", {}, at(0.9)), "PRECONDITION_FAILED", /planned start/);
    await transitionPermit(requester, p.id, "ACTIVATE", {}, at(1));
    expect(await status(p.id)).toBe("ACTIVE");
  });

  it("work cannot be logged unless ACTIVE", async () => {
    const p = await approvedHotWork();
    await expectError(addWorkLog(requester, p.id, { kind: "NOTE", message: "starting" }, at(1.1)), "INVALID_TRANSITION", /ACTIVE/);
  });
});

describe("expiry", () => {
  it("auto-expires when the window passes and can never be reactivated", async () => {
    const p = await approvedHotWork();
    await transitionPermit(requester, p.id, "ACTIVATE", {}, at(1.1));
    expect(await expireDuePermits(at(4.9), p.id)).toBe(0);
    expect(await expireDuePermits(at(5.01), p.id)).toBe(1);
    expect(await status(p.id)).toBe("EXPIRED");
    await expectError(transitionPermit(requester, p.id, "ACTIVATE", {}, at(5.1)), "INVALID_TRANSITION");
    await expectError(transitionPermit(safety, p.id, "RESUME", { comment: "try" }, at(5.1)), "INVALID_TRANSITION");

    const last = await prisma.auditLog.findFirst({ where: { permitId: p.id }, orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ action: "EXPIRED", actorId: null, fromValue: "ACTIVE", toValue: "EXPIRED" });
  });

  it("any action on an overdue permit expires it first instead of acting on it", async () => {
    const p = await approvedHotWork();
    await transitionPermit(requester, p.id, "ACTIVATE", {}, at(1.1));
    await expectError(addWorkLog(requester, p.id, { kind: "NOTE", message: "late note" }, at(6)), "INVALID_TRANSITION");
    expect(await status(p.id)).toBe("EXPIRED");
  });

  it("an approved extension moves validUntil and is capped", async () => {
    const p = await approvedHotWork();
    await transitionPermit(requester, p.id, "ACTIVATE", {}, at(1.1));
    const ext = await requestExtension(requester, p.id, { hours: 2, reason: "Second bracket" }, at(4));
    await expectError(decideExtension(requester, p.id, ext.id, { approve: true }, at(4)), "FORBIDDEN");
    await decideExtension(safety, p.id, ext.id, { approve: true }, at(4));
    expect((await prisma.permit.findUniqueOrThrow({ where: { id: p.id } })).validUntil).toEqual(at(7));
    expect(await expireDuePermits(at(6), p.id)).toBe(0);

    const ext2 = await requestExtension(requester, p.id, { hours: 1, reason: "Grinding finish" }, at(6));
    await decideExtension(safety, p.id, ext2.id, { approve: true }, at(6));
    await expectError(requestExtension(requester, p.id, { hours: 1, reason: "One more" }, at(7.5)), "PRECONDITION_FAILED", /limit/);
  });
});

describe("audit log immutability", () => {
  it("the database refuses to update or delete audit entries", async () => {
    const entry = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { comment: "tampered" } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
  });
});

describe("field edits after submission", () => {
  it("are audited with from/to values, locked fields are refused", async () => {
    const p = await createPermit(requester, hotWorkInput(), t0);
    await submitPermit(requester, p.id, t0);
    await updateReadings(requester, p.id, { gasO2Pct: 20.5 }, "Re-test before start", t0);
    const e = await prisma.auditLog.findFirstOrThrow({ where: { permitId: p.id, action: "FIELD_CHANGED" } });
    expect(e).toMatchObject({ field: "O₂", fromValue: "20.9", toValue: "20.5", comment: "Re-test before start" });
    await expectError(updateReadings(requester, p.id, { hotWorkType: "GRINDING" }, null, t0), "VALIDATION_FAILED", /locked/);
  });

  it("an unsafe reading on an ACTIVE permit suspends it immediately", async () => {
    const p = await approvedHotWork();
    await transitionPermit(requester, p.id, "ACTIVATE", {}, at(1.1));
    await updateReadings(safety, p.id, { gasLelPct: 8 }, "Gas alarm at PR-3", at(2));
    expect(await status(p.id)).toBe("SUSPENDED");
    // Only a safety officer can resume.
    await expectError(transitionPermit(requester, p.id, "RESUME", { comment: "fine now" }, at(2.5)), "FORBIDDEN");
  });
});

describe("confined space entry register", () => {
  it("cannot close while someone is still inside", async () => {
    const p = await createPermit(
      requester,
      {
        type: "CONFINED_SPACE",
        contractor: "In-house",
        workDescription: "Inspect internals of TK-204",
        areaId: otherAreaId,
        plannedStart: at(1).toISOString(),
        plannedEnd: at(5).toISOString(),
        hazards: ["O2 deficiency"],
        ppe: ["Harness"],
        precautions: allChecked("CONFINED_SPACE"),
        typeData: {
          spaceId: "TK-204",
          entryPoint: "Top manway",
          ventilationMethod: "FORCED_SUPPLY",
          standbyAttendant: "K. Arul",
          rescuePlan: "Tripod + winch at manway; SCBA on standby",
          gasO2Pct: 20.8,
          gasLelPct: 0,
          gasH2sPpm: 0,
          gasCoPpm: 2,
          gasTestAt: at(0.8).toISOString(),
          gasTestedBy: "R. Kumar",
        },
      },
      t0,
    );
    await submitPermit(requester, p.id, t0);
    await decideApproval(otherOwner, p.id, { decision: "APPROVE", signature: SIG }, t0);
    await decideApproval(safety, p.id, { decision: "APPROVE", signature: SIG }, t0);
    await transitionPermit(requester, p.id, "ACTIVATE", {}, at(1.1));
    await addWorkLog(requester, p.id, { kind: "ENTRY", person: "Murugan", message: "Entered" }, at(1.2));
    await expectError(transitionPermit(requester, p.id, "CLOSE", { completionNotes: "done" }, at(2)), "PRECONDITION_FAILED", /Murugan/);
    await addWorkLog(requester, p.id, { kind: "EXIT", person: "murugan", message: "Out" }, at(2.1));
    await transitionPermit(requester, p.id, "CLOSE", { completionNotes: "Inspection done" }, at(2.2));
    expect(await status(p.id)).toBe("CLOSED");
  });
});

describe("conflict detection", () => {
  it("flags hot work overlapping a confined-space permit in the same area", async () => {
    const hot = await createPermit(requester, hotWorkInput({ areaId: otherAreaId }), t0);
    await submitPermit(requester, hot.id, t0);
    const found = await findConflicts({ type: "CONFINED_SPACE", areaId: otherAreaId, start: at(2), end: at(3) });
    expect(found.map((c) => c.id)).toContain(hot.id);
    const elsewhere = await findConflicts({ type: "CONFINED_SPACE", areaId, start: at(20), end: at(21) });
    expect(elsewhere.map((c) => c.id)).not.toContain(hot.id);
  });
});

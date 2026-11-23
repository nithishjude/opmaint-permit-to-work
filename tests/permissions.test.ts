import { describe, expect, it } from "vitest";
import { allowedActions, assertAuthorized, authorize, type Actor } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";
import { admin, areaOwner, fullyApproved, hoursFrom, NOW, otherAreaOwner, permit, requester, safety } from "./helpers";

describe("approval permissions", () => {
  it("a person can never approve their own permit — whatever their role", () => {
    for (const role of ["AREA_OWNER", "SAFETY_OFFICER", "ADMIN"] as const) {
      const me: Actor = { id: "u-me", role, ownedAreaIds: ["area-1"] };
      const p = permit({ requesterId: me.id });
      const d = authorize(me, "APPROVE", p, NOW);
      expect(d.allowed, role).toBe(false);
      if (!d.allowed) expect(d.reason).toMatch(/own permit/);
      expect(authorize(me, "REJECT", p, NOW).allowed, role).toBe(false);
    }
  });

  it("requesters cannot approve anything", () => {
    const someoneElses = permit({ requesterId: "u-other" });
    expect(authorize(requester, "APPROVE", someoneElses, NOW).allowed).toBe(false);
  });

  it("area owners approve only in their own area", () => {
    expect(authorize(areaOwner, "APPROVE", permit({ areaId: "area-1" }), NOW).allowed).toBe(true);
    const d = authorize(otherAreaOwner, "APPROVE", permit({ areaId: "area-1" }), NOW);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/own area/);
  });

  it("safety officers approve any area", () => {
    expect(authorize(safety, "APPROVE", permit({ areaId: "area-9" }), NOW).allowed).toBe(true);
  });

  it("one person cannot fill both approval slots", () => {
    const p = permit({
      approvals: [
        { role: "AREA_OWNER", decision: "APPROVED", approverId: admin.id },
        { role: "SAFETY_OFFICER", decision: "PENDING", approverId: null },
      ],
    });
    expect(authorize(admin, "APPROVE", p, NOW).allowed).toBe(false);
    expect(authorize(safety, "APPROVE", p, NOW).allowed).toBe(true);
  });

  it("a safety officer cannot approve once the safety slot is filled", () => {
    const p = permit({
      approvals: [
        { role: "AREA_OWNER", decision: "PENDING", approverId: null },
        { role: "SAFETY_OFFICER", decision: "APPROVED", approverId: "u-safety-2" },
      ],
    });
    expect(authorize(safety, "APPROVE", p, NOW).allowed).toBe(false);
  });

  it("approval is only possible while pending", () => {
    expect(authorize(safety, "APPROVE", permit({ status: "DRAFT" }), NOW).allowed).toBe(false);
    expect(authorize(safety, "APPROVE", permit({ status: "ACTIVE" }), NOW).allowed).toBe(false);
  });
});

describe("activation rules", () => {
  const approved = (o = {}) => permit({ status: "APPROVED", approvals: fullyApproved(), ...o });

  it("activates when every approver approved and the window is open", () => {
    expect(authorize(requester, "ACTIVATE", approved(), NOW)).toEqual({ allowed: true });
  });

  it("cannot go ACTIVE unless every required approver approved", () => {
    const p = approved({
      approvals: [
        { role: "AREA_OWNER", decision: "APPROVED", approverId: areaOwner.id },
        { role: "SAFETY_OFFICER", decision: "PENDING", approverId: null },
      ],
    });
    const d = authorize(requester, "ACTIVATE", p, NOW);
    expect(d).toMatchObject({ allowed: false, kind: "precondition" });
  });

  it("cannot go ACTIVE before planned start", () => {
    const d = authorize(requester, "ACTIVATE", approved({ plannedStart: hoursFrom(NOW, 1) }), NOW);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/before the planned start/);
  });

  it("cannot go ACTIVE on a stale or unsafe gas test", () => {
    const stale = approved({ typeData: { ...permit().typeData, gasTestAt: hoursFrom(NOW, -3).toISOString() } });
    expect(authorize(requester, "ACTIVATE", stale, NOW).allowed).toBe(false);
    const unsafe = approved({ typeData: { ...permit().typeData, gasLelPct: 4 } });
    const d = authorize(requester, "ACTIVATE", unsafe, NOW);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/LEL/);
  });

  it("random users cannot activate someone else's permit", () => {
    const d = authorize(areaOwner, "ACTIVATE", approved(), NOW);
    expect(d).toMatchObject({ allowed: false, kind: "role" });
  });
});

describe("other lifecycle permissions", () => {
  it("only safety (or admin) can resume suspended work", () => {
    const p = permit({ status: "SUSPENDED" });
    expect(authorize(requester, "RESUME", p, NOW).allowed).toBe(false);
    expect(authorize(areaOwner, "RESUME", p, NOW).allowed).toBe(false);
    expect(authorize(safety, "RESUME", p, NOW).allowed).toBe(true);
  });

  it("requester, area owner and safety all have stop-work authority", () => {
    const p = permit({ status: "ACTIVE" });
    expect(authorize(requester, "SUSPEND", p, NOW).allowed).toBe(true);
    expect(authorize(areaOwner, "SUSPEND", p, NOW).allowed).toBe(true);
    expect(authorize(safety, "SUSPEND", p, NOW).allowed).toBe(true);
    expect(authorize(otherAreaOwner, "SUSPEND", p, NOW).allowed).toBe(false);
  });

  it("only the requester closes; only safety verifies", () => {
    const active = permit({ status: "ACTIVE" });
    expect(authorize(requester, "CLOSE", active, NOW).allowed).toBe(true);
    expect(authorize(safety, "CLOSE", active, NOW).allowed).toBe(false);
    const closed = permit({ status: "CLOSED" });
    expect(authorize(requester, "VERIFY", closed, NOW).allowed).toBe(false);
    expect(authorize(safety, "VERIFY", closed, NOW).allowed).toBe(true);
  });

  it("work can only be logged on an ACTIVE permit", () => {
    for (const status of ["APPROVED", "SUSPENDED", "EXPIRED", "CLOSED"] as const) {
      expect(authorize(requester, "LOG_WORK", permit({ status }), NOW).allowed, status).toBe(false);
    }
    expect(authorize(requester, "LOG_WORK", permit({ status: "ACTIVE" }), NOW).allowed).toBe(true);
  });

  it("extensions are capped and need someone other than the requester", () => {
    const active = permit({ status: "ACTIVE" });
    expect(authorize(requester, "REQUEST_EXTENSION", active, NOW).allowed).toBe(true);
    expect(authorize(requester, "REQUEST_EXTENSION", { ...active, extensionCount: 2 }, NOW).allowed).toBe(false);
    const pending = { ...active, hasPendingExtension: true };
    expect(authorize(safety, "DECIDE_EXTENSION", pending, NOW).allowed).toBe(true);
    const ownBySafety = { ...pending, requesterId: safety.id };
    expect(authorize(safety, "DECIDE_EXTENSION", ownBySafety, NOW).allowed).toBe(false);
  });

  it("nothing is allowed on a terminal permit except viewing", () => {
    for (const status of ["EXPIRED", "CANCELLED", "REJECTED", "CLOSED_VERIFIED"] as const) {
      expect(allowedActions(admin, permit({ status }), NOW), status).toEqual([]);
    }
  });

  it("assertAuthorized maps refusals to HTTP-meaningful errors", () => {
    const expectCode = (fn: () => void, code: string) => {
      try {
        fn();
        expect.unreachable();
      } catch (e) {
        expect((e as DomainError).code).toBe(code);
      }
    };
    expectCode(() => assertAuthorized(requester, "APPROVE", permit({ requesterId: "x" }), NOW), "FORBIDDEN");
    expectCode(() => assertAuthorized(safety, "VERIFY", permit({ status: "ACTIVE" }), NOW), "INVALID_TRANSITION");
    expectCode(
      () => assertAuthorized(requester, "ACTIVATE", permit({ status: "APPROVED", approvals: fullyApproved(), plannedStart: hoursFrom(NOW, 2) }), NOW),
      "PRECONDITION_FAILED",
    );
  });
});

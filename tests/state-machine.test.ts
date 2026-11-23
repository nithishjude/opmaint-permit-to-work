import { describe, expect, it } from "vitest";
import { PERMIT_STATUSES } from "@/domain/enums";
import { DomainError } from "@/domain/errors";
import { canTransition, eventsFrom, isTerminal, nextStatus, PERMIT_EVENTS, TERMINAL_STATUSES } from "@/domain/state-machine";

describe("permit state machine", () => {
  it("follows the happy path from draft to verified closure", () => {
    let s = nextStatus("DRAFT", "SUBMIT");
    expect(s).toBe("PENDING_APPROVAL");
    s = nextStatus(s, "APPROVE_ALL");
    expect(s).toBe("APPROVED");
    s = nextStatus(s, "ACTIVATE");
    expect(s).toBe("ACTIVE");
    s = nextStatus(s, "SUSPEND");
    expect(s).toBe("SUSPENDED");
    s = nextStatus(s, "RESUME");
    expect(s).toBe("ACTIVE");
    s = nextStatus(s, "CLOSE");
    expect(s).toBe("CLOSED");
    s = nextStatus(s, "VERIFY");
    expect(s).toBe("CLOSED_VERIFIED");
  });

  it("never leaves a terminal state", () => {
    for (const terminal of TERMINAL_STATUSES) {
      expect(eventsFrom(terminal)).toEqual([]);
      for (const e of PERMIT_EVENTS) expect(canTransition(terminal, e)).toBe(false);
    }
  });

  it("an expired permit can never be reactivated", () => {
    expect(() => nextStatus("EXPIRED", "ACTIVATE")).toThrow(DomainError);
    expect(() => nextStatus("EXPIRED", "RESUME")).toThrow(DomainError);
  });

  it("cannot skip approval: DRAFT → ACTIVE and PENDING → ACTIVE are rejected", () => {
    expect(() => nextStatus("DRAFT", "ACTIVATE")).toThrow(/Cannot activate/);
    expect(() => nextStatus("PENDING_APPROVAL", "ACTIVATE")).toThrow(DomainError);
  });

  it("throws INVALID_TRANSITION with a 409", () => {
    try {
      nextStatus("CLOSED", "SUSPEND");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("INVALID_TRANSITION");
      expect((e as DomainError).httpStatus).toBe(409);
    }
  });

  it("expires only from states where the clock is running", () => {
    expect(eventsFrom("ACTIVE")).toContain("EXPIRE");
    expect(eventsFrom("APPROVED")).toContain("EXPIRE");
    expect(eventsFrom("SUSPENDED")).toContain("EXPIRE");
    expect(canTransition("DRAFT", "EXPIRE")).toBe(false);
    expect(canTransition("CLOSED", "EXPIRE")).toBe(false);
  });

  it("can cancel from every non-terminal state except CLOSED", () => {
    for (const s of PERMIT_STATUSES) {
      const expected = !isTerminal(s) && s !== "CLOSED";
      expect(canTransition(s, "CANCEL"), s).toBe(expected);
    }
  });
});

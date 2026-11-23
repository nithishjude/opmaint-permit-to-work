import { describe, expect, it } from "vitest";
import { PERMIT_TYPES, buildShapeSchema, getPermitType, missingFor } from "@/domain/permit-types";
import { parseTypeData, submissionIssues } from "@/domain/permit-core";
import { peopleInside, windowsOverlap } from "@/domain/guards";
import { hoursFrom, NOW } from "./helpers";

describe("permit type registry", () => {
  it("every type is well-formed", () => {
    const keys = new Set<string>();
    for (const t of PERMIT_TYPES) {
      expect(keys.has(t.key), `duplicate key ${t.key}`).toBe(false);
      keys.add(t.key);
      const names = t.fields.map((f) => f.name);
      expect(new Set(names).size, `${t.key} has duplicate field names`).toBe(names.length);
      expect(t.requiredApprovals.length).toBeGreaterThan(0);
      expect(t.precautions.length).toBeGreaterThan(0);
      for (const c of t.conflictsWith ?? []) expect(getPermitType(c), `${t.key} conflicts with unknown ${c}`).toBeDefined();
    }
  });

  it("includes the four required types plus Excavation", () => {
    expect(PERMIT_TYPES.map((t) => t.key)).toEqual(
      expect.arrayContaining(["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL_LOTO", "EXCAVATION"]),
    );
  });

  it("drops unknown keys and rejects wrong types in typeData", () => {
    expect(parseTypeData("HOT_WORK", { hotWorkType: "WELDING", evil: "<script>" })).toEqual({ hotWorkType: "WELDING" });
    expect(() => parseTypeData("HOT_WORK", { hotWorkType: "JUGGLING" })).toThrow();
    expect(() => parseTypeData("HOT_WORK", { gasO2Pct: "lots" })).toThrow();
  });

  it("treats empty strings as missing rather than invalid", () => {
    const schema = buildShapeSchema(getPermitType("HOT_WORK")!.fields);
    expect(schema.parse({ fireWatchName: "", combustiblesClearedRadiusM: null })).toEqual({});
  });

  it("enforces hard limits (combustibles radius ≥ 10 m)", () => {
    expect(() => parseTypeData("HOT_WORK", { combustiblesClearedRadiusM: 5 })).toThrow(/at least 10/);
  });

  it("separates submit-time and activate-time requirements", () => {
    const fields = getPermitType("CONFINED_SPACE")!.fields;
    const atSubmit = missingFor("submit", fields, {}).map((i) => i.field);
    expect(atSubmit).toContain("rescuePlan");
    expect(atSubmit).not.toContain("gasO2Pct"); // gas test is taken on site, just before entry
    expect(missingFor("activate", fields, {}).map((i) => i.field)).toContain("gasO2Pct");
  });
});

describe("submission validation", () => {
  const base = {
    type: "WORKING_AT_HEIGHT",
    contractor: "Acme Scaffolding",
    workDescription: "Replace corroded light fitting on roof",
    plannedStart: hoursFrom(NOW, 1),
    plannedEnd: hoursFrom(NOW, 5),
    hazards: ["Fall of person"],
    ppe: ["Harness"],
    precautions: [{ id: "a", label: "Tools tethered", checked: true }],
    typeData: { heightM: 9, accessMethod: "MEWP", fallArrest: ["HARNESS"], anchorPointChecked: true, barricadingBelow: true },
  };

  it("accepts a complete permit", () => {
    expect(submissionIssues(base, NOW)).toEqual([]);
  });

  it("rejects permits longer than one validity window", () => {
    const issues = submissionIssues({ ...base, plannedEnd: hoursFrom(NOW, 20) }, NOW);
    expect(issues.map((i) => i.field)).toContain("plannedEnd");
  });

  it("requires every precaution to be confirmed and safety booleans to be yes", () => {
    const issues = submissionIssues(
      { ...base, precautions: [{ id: "a", label: "Tools tethered", checked: false }], typeData: { ...base.typeData, barricadingBelow: false } },
      NOW,
    );
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(["precautions", "barricadingBelow"]));
  });
});

describe("helpers", () => {
  it("tracks who is still inside a confined space", () => {
    const log = [
      { kind: "ENTRY", person: "Arun" },
      { kind: "ENTRY", person: "Bala" },
      { kind: "EXIT", person: "arun " },
    ];
    expect(peopleInside(log)).toEqual(["Bala"]);
  });

  it("detects overlapping windows (touching edges do not overlap)", () => {
    expect(windowsOverlap(hoursFrom(NOW, 0), hoursFrom(NOW, 4), hoursFrom(NOW, 3), hoursFrom(NOW, 6))).toBe(true);
    expect(windowsOverlap(hoursFrom(NOW, 0), hoursFrom(NOW, 4), hoursFrom(NOW, 4), hoursFrom(NOW, 6))).toBe(false);
  });
});

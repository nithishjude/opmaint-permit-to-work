// The "fifth type" from the brief. Adding it took this file plus one line in
// index.ts — no migration, no new form, no new API route.
import type { PermitTypeDefinition } from "./definition";

export const excavation: PermitTypeDefinition = {
  key: "EXCAVATION",
  label: "Excavation",
  shortLabel: "Excav.",
  description: "Digging, trenching or ground penetration where buried services may exist.",
  maxDurationHours: 12,
  requiredApprovals: ["AREA_OWNER", "SAFETY_OFFICER"],
  fields: [
    { kind: "number", name: "depthM", label: "Maximum depth", unit: " m", min: 0, max: 30, step: 0.1, group: "Excavation", requiredFor: "submit" },
    {
      kind: "select",
      name: "method",
      label: "Method",
      group: "Excavation",
      requiredFor: "submit",
      options: [
        { value: "HAND", label: "Hand digging" },
        { value: "MECHANICAL", label: "Mechanical (excavator / JCB)" },
        { value: "VACUUM", label: "Vacuum excavation" },
      ],
    },
    { kind: "boolean", name: "servicesScanned", label: "Underground services scanned (CAT scan / drawings)", group: "Buried services", mustBeTrue: true },
    { kind: "stringList", name: "servicesFound", label: "Services identified", itemLabel: "Service", group: "Buried services" },
    {
      kind: "select",
      name: "shoring",
      label: "Collapse protection",
      group: "Excavation",
      requiredFor: "submit",
      options: [
        { value: "NONE_SHALLOW", label: "None (< 1.2 m deep)" },
        { value: "BENCHING", label: "Benching / sloping" },
        { value: "SHORING", label: "Shoring / trench box" },
      ],
    },
  ],
  defaultHazards: ["Buried cables / pipes", "Trench collapse", "Fall into excavation", "Plant & vehicle movement"],
  defaultPpe: ["Safety helmet", "Safety shoes", "High-visibility vest", "Gloves"],
  precautions: [
    { id: "ex-barricade", label: "Excavation barricaded and lit at night" },
    { id: "ex-spoil", label: "Spoil kept at least 1 m from the edge" },
    { id: "ex-access", label: "Ladder access every 7.5 m for trenches > 1.2 m" },
  ],
};

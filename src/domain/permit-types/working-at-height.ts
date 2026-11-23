import type { PermitTypeDefinition } from "./definition";

export const workingAtHeight: PermitTypeDefinition = {
  key: "WORKING_AT_HEIGHT",
  label: "Working at Height",
  shortLabel: "Height",
  description: "Any work where a person could fall 1.8 m or more.",
  badgeClass: "bg-sky-100 text-sky-900 ring-sky-300",
  maxDurationHours: 12,
  requiredApprovals: ["AREA_OWNER", "SAFETY_OFFICER"],
  fields: [
    { kind: "number", name: "heightM", label: "Working height", unit: " m", min: 0, max: 300, step: 0.1, group: "Work", requiredFor: "submit" },
    {
      kind: "select",
      name: "accessMethod",
      label: "Access method",
      group: "Work",
      requiredFor: "submit",
      options: [
        { value: "SCAFFOLD", label: "Scaffold (green-tagged)" },
        { value: "LADDER", label: "Ladder" },
        { value: "MEWP", label: "MEWP (boom / scissor lift)" },
        { value: "ROPE", label: "Rope access" },
      ],
    },
    {
      kind: "multiselect",
      name: "fallArrest",
      label: "Fall arrest equipment",
      group: "Fall protection",
      requiredFor: "submit",
      options: [
        { value: "HARNESS", label: "Full body harness" },
        { value: "DOUBLE_LANYARD", label: "Double lanyard with shock absorber" },
        { value: "SRL", label: "Self-retracting lifeline" },
        { value: "LIFELINE", label: "Horizontal lifeline" },
        { value: "NET", label: "Safety net" },
        { value: "GUARDRAIL", label: "Guardrails / edge protection" },
      ],
    },
    { kind: "boolean", name: "anchorPointChecked", label: "Anchor point inspected and rated", group: "Fall protection", mustBeTrue: true },
    { kind: "boolean", name: "barricadingBelow", label: "Area below barricaded with signage", group: "Fall protection", mustBeTrue: true },
    { kind: "number", name: "windSpeedKmh", label: "Wind speed at start", unit: " km/h", min: 0, max: 200, safeRange: { max: 40 }, group: "Conditions", editableAfterSubmit: true, help: "Stop MEWP / rope work above 40 km/h." },
  ],
  defaultHazards: ["Fall of person", "Falling objects", "Structural collapse", "Weather (wind, rain)"],
  defaultPpe: ["Safety helmet with chin strap", "Safety shoes", "Full body harness", "Gloves"],
  precautions: [
    { id: "wah-tools", label: "Tools tethered; no loose material at height" },
    { id: "wah-weather", label: "Weather checked — no rain, lightning or high wind" },
    { id: "wah-rescue", label: "Rescue-at-height plan in place (suspension trauma < 15 min)" },
    { id: "wah-fit", label: "Workers medically fit for height work" },
  ],
};

import type { PermitTypeDefinition } from "./definition";

export const electricalLoto: PermitTypeDefinition = {
  key: "ELECTRICAL_LOTO",
  label: "Electrical / Isolation (LOTO)",
  shortLabel: "LOTO",
  description: "Work on electrical or energised equipment requiring lockout-tagout isolation.",
  badgeClass: "bg-yellow-100 text-yellow-900 ring-yellow-400",
  maxDurationHours: 12,
  requiredApprovals: ["AREA_OWNER", "SAFETY_OFFICER"],
  fields: [
    { kind: "text", name: "equipmentTag", label: "Equipment tag", group: "Equipment", requiredFor: "submit", help: "Tag of the equipment being isolated (e.g. MCC-2 / P-101A motor)." },
    {
      kind: "select",
      name: "voltageLevel",
      label: "Voltage level",
      group: "Equipment",
      requiredFor: "submit",
      options: [
        { value: "ELV", label: "ELV (< 50 V)" },
        { value: "LV", label: "LV (≤ 415 V)" },
        { value: "MV", label: "MV (3.3 – 11 kV)" },
        { value: "HV", label: "HV (> 11 kV)" },
      ],
    },
    { kind: "stringList", name: "isolationPoints", label: "Isolation points", itemLabel: "Isolation point", group: "Isolation", requiredFor: "submit", help: "Every breaker / switch / valve that must be locked." },
    { kind: "stringList", name: "lockNumbers", label: "Lock numbers", itemLabel: "Lock no.", group: "Isolation", requiredFor: "activate", editableAfterSubmit: true },
    { kind: "stringList", name: "tagNumbers", label: "Tag numbers", itemLabel: "Tag no.", group: "Isolation", requiredFor: "activate", editableAfterSubmit: true },
    { kind: "boolean", name: "earthingApplied", label: "Earthing / grounding applied", group: "Verification", editableAfterSubmit: true },
    { kind: "text", name: "testedDeadBy", label: "Tested dead by", group: "Verification", requiredFor: "activate", editableAfterSubmit: true, help: "Name of the competent person who proved zero energy." },
    { kind: "datetime", name: "testedDeadAt", label: "Tested dead at", group: "Verification", requiredFor: "activate", editableAfterSubmit: true, maxAgeMinutesAtActivation: 120 },
  ],
  defaultHazards: ["Electric shock", "Arc flash", "Unexpected re-energisation", "Stored energy (capacitors, springs)"],
  defaultPpe: ["Safety helmet", "Electrical safety shoes", "Insulated gloves (rated)", "Arc-rated face shield", "FR clothing"],
  precautions: [
    { id: "loto-identify", label: "All energy sources identified (electrical, mechanical, hydraulic, pneumatic)" },
    { id: "loto-lock", label: "Personal lock and tag applied by every worker" },
    { id: "loto-stored", label: "Stored energy released / blocked" },
    { id: "loto-tryout", label: "Try-start performed from local and remote stations" },
    { id: "loto-tester", label: "Voltage tester proven before and after test" },
  ],
};

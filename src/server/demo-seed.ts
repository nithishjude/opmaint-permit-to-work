// Demo data: 5 users, 2 plants, 4 areas, 9 equipment items and 14 permits in
// every lifecycle state, with consistent approval trails and audit logs.
//
// All times are relative to "now" so a fresh seed always shows something
// active, something expiring, something waiting for approval. Used by
// `npm run db:seed` and by the admin "Reset demo data" button.

import type { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { requirePermitType } from "@/domain/permit-types";
import type { PermitStatus, Role } from "@/domain/enums";

export const DEMO_PASSWORD = "Password@123";

export const DEMO_USERS = [
  { key: "requester", email: "requester@ptw.demo", name: "Ravi Shankar", role: "REQUESTER" },
  { key: "owner", email: "owner@ptw.demo", name: "Priya Natarajan", role: "AREA_OWNER" },
  { key: "safety", email: "safety@ptw.demo", name: "Karthik Raman", role: "SAFETY_OFFICER" },
  { key: "admin", email: "admin@ptw.demo", name: "Anitha Joseph", role: "ADMIN" },
  { key: "owner2", email: "owner2@ptw.demo", name: "Suresh Babu", role: "AREA_OWNER" },
] as const satisfies readonly { key: string; email: string; name: string; role: Role }[];

type UserKey = (typeof DEMO_USERS)[number]["key"];

// A hand-drawn-looking squiggle so seeded approvals show a signature.
const SIGNATURE_SVG = (name: string) =>
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><path d="M10 55 C 30 10, 45 70, 60 40 S 90 15, 105 50 S 140 60, 150 30 S 190 45, 230 35" stroke="#1e3a8a" stroke-width="3" fill="none" stroke-linecap="round"/><text x="12" y="76" font-family="cursive" font-size="11" fill="#1e3a8a">${name}</text></svg>`,
  ).toString("base64");

const H = 3_600_000;

interface PermitSpec {
  type: string;
  status: PermitStatus;
  requester: UserKey;
  area: string; // area code
  equipment?: string; // tag
  contractor: string;
  crewSize?: number;
  work: string;
  location?: string;
  startH: number; // hours from now
  endH: number;
  typeData: Record<string, unknown>;
  approvals?: Partial<Record<"AREA_OWNER" | "SAFETY_OFFICER", { by: UserKey; decision: "APPROVED" | "REJECTED"; comment?: string }>>;
  suspendReason?: string;
  suspendedBy?: UserKey | null;
  cancelReason?: string;
  completionNotes?: string;
  verificationNotes?: string;
  workLogs?: { kind: "NOTE" | "ENTRY" | "EXIT"; person?: string; message: string; atH: number }[];
  extension?: { hours: number; reason: string; status: "PENDING" | "APPROVED"; atH: number };
  readingChanges?: { field: string; label: string; from: unknown; to: unknown; by: UserKey; atH: number; comment: string }[];
}

export async function seedDemoData(db: PrismaClient, now = new Date()) {
  const at = (h: number) => new Date(now.getTime() + h * H);
  const iso = (h: number) => at(h).toISOString();

  // ---- wipe (TRUNCATE skips the audit-log row triggers by design; this is a demo reset)
  await db.$executeRawUnsafe(
    `TRUNCATE "AuditLog", "WorkLog", "ExtensionRequest", "PermitApproval", "Permit", "Equipment", "Area", "Plant", "User" CASCADE`,
  );

  // ---- users
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = {} as Record<UserKey, { id: string; name: string }>;
  for (const u of DEMO_USERS) {
    const row = await db.user.create({ data: { email: u.email, name: u.name, role: u.role, passwordHash } });
    users[u.key] = { id: row.id, name: row.name };
  }

  // ---- plants, areas, equipment
  const chennai = await db.plant.create({ data: { code: "CHN", name: "Chennai Refinery Unit", location: "Manali, Chennai" } });
  const hosur = await db.plant.create({ data: { code: "HSR", name: "Hosur Components Plant", location: "SIPCOT, Hosur" } });

  const areaDefs = [
    { code: "CDU", name: "Crude Distillation Unit", plantId: chennai.id, owner: "owner" as UserKey },
    { code: "TF", name: "Tank Farm", plantId: chennai.id, owner: "owner" as UserKey },
    { code: "PS", name: "Paint Shop", plantId: hosur.id, owner: "owner2" as UserKey },
    { code: "UT", name: "Utilities & Substation", plantId: hosur.id, owner: "owner2" as UserKey },
  ];
  const areas: Record<string, string> = {};
  for (const a of areaDefs) {
    areas[a.code] = (await db.area.create({ data: { code: a.code, name: a.name, plantId: a.plantId, ownerId: users[a.owner].id } })).id;
  }

  const equipmentDefs = [
    { tag: "P-101A", name: "Crude charge pump A", area: "CDU" },
    { tag: "PR-3", name: "Pipe rack 3 (overhead)", area: "CDU" },
    { tag: "E-104", name: "Crude preheat exchanger", area: "CDU" },
    { tag: "TK-204", name: "Diesel storage tank 204 (2,000 KL)", area: "TF" },
    { tag: "TK-205", name: "Naphtha storage tank 205", area: "TF" },
    { tag: "OV-01", name: "Paint curing oven 1", area: "PS" },
    { tag: "RF-PS", name: "Paint shop roof & skylights", area: "PS" },
    { tag: "MCC-2", name: "Motor control centre 2 (415 V)", area: "UT" },
    { tag: "TR-1", name: "11 kV / 433 V transformer 1", area: "UT" },
  ];
  const equipment: Record<string, string> = {};
  for (const e of equipmentDefs) {
    equipment[e.tag] = (await db.equipment.create({ data: { tag: e.tag, name: e.name, areaId: areas[e.area] } })).id;
  }

  // ---- reusable type data
  const hot = (o: Record<string, unknown> = {}) => ({
    hotWorkType: "WELDING",
    fireWatchName: "Selvi Devi",
    fireWatchAfterMinutes: 30,
    extinguisherType: "DCP",
    combustiblesClearedRadiusM: 12,
    ...o,
  });
  const gasOk = (testH: number) => ({ gasLelPct: 0, gasO2Pct: 20.9, gasTestAt: iso(testH), gasTestedBy: "R. Kumar (Safety)" });

  const specs: PermitSpec[] = [
    {
      // 1 — ACTIVE and expiring within 2 h, with a pending extension
      type: "HOT_WORK",
      status: "ACTIVE",
      requester: "requester",
      area: "CDU",
      equipment: "PR-3",
      contractor: "Sri Balaji Fabricators",
      crewSize: 3,
      work: "Weld new support bracket on pipe rack PR-3, bay 4, for re-routed 2\" steam line.",
      location: "North side of PR-3, bay 4, elevation 6 m",
      startH: -6.75,
      endH: 1.25,
      typeData: hot(gasOk(-7)),
      approvals: { AREA_OWNER: { by: "owner", decision: "APPROVED", comment: "Steam line isolated at V-221." }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED", comment: "Fire watch briefed. Drains covered." } },
      workLogs: [
        { kind: "NOTE", message: "Area handed over. Fire blankets laid on cable tray below.", atH: -6.5 },
        { kind: "NOTE", message: "Bracket 1 of 2 welded. Fire watch reports no hot spots.", atH: -3 },
      ],
      extension: { hours: 2, reason: "Second bracket needs re-fit after alignment check; ~2 h more.", status: "PENDING", atH: -0.25 },
    },
    {
      // 2 — ACTIVE confined space with people inside
      type: "CONFINED_SPACE",
      status: "ACTIVE",
      requester: "requester",
      area: "TF",
      equipment: "TK-204",
      contractor: "Coastal Tank Cleaners Pvt Ltd",
      crewSize: 4,
      work: "Internal inspection and sludge removal, TK-204, ahead of annual shutdown.",
      startH: -1,
      endH: 5,
      typeData: {
        spaceId: "TK-204",
        entryPoint: "Shell manway M2 (600 mm), ground level",
        ventilationMethod: "SUPPLY_AND_EXHAUST",
        standbyAttendant: "Kannan Arul",
        rescuePlan: "Tripod + winch rigged at M2. 2 × SCBA at manway. Rescue team: K. Arul + M. Joseph. Ambulance: Manali OHC, 6 min.",
        gasO2Pct: 20.7,
        gasLelPct: 0,
        gasH2sPpm: 0,
        gasCoPpm: 3,
        gasTestAt: iso(-1.25),
        gasTestedBy: "R. Kumar (Safety)",
      },
      approvals: { AREA_OWNER: { by: "owner", decision: "APPROVED", comment: "Tank drained, inlet/outlet blinded (blind list #TF-88)." }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED", comment: "Atmosphere OK. Continuous monitor on entrant." } },
      workLogs: [
        { kind: "ENTRY", person: "Murugan S", message: "Entered with 4-gas monitor", atH: -0.9 },
        { kind: "ENTRY", person: "Venkat R", message: "Entered", atH: -0.85 },
        { kind: "EXIT", person: "Venkat R", message: "Break — exited", atH: -0.3 },
      ],
    },
    {
      // 3 — PENDING: hot work that overlaps #2 in the tank farm → conflict warning
      type: "HOT_WORK",
      status: "PENDING_APPROVAL",
      requester: "requester",
      area: "TF",
      equipment: "TK-205",
      contractor: "Sri Balaji Fabricators",
      crewSize: 2,
      work: "Grind and repaint corroded nozzle flange on TK-205 roof.",
      startH: 1,
      endH: 4,
      typeData: hot({ hotWorkType: "GRINDING", extinguisherType: "CO2", combustiblesClearedRadiusM: 15 }),
    },
    {
      // 4 — APPROVED, start in the future (Activate is blocked until then)
      type: "WORKING_AT_HEIGHT",
      status: "APPROVED",
      requester: "requester",
      area: "PS",
      equipment: "RF-PS",
      contractor: "Hosur Roofing Works",
      crewSize: 3,
      work: "Replace 6 cracked polycarbonate skylight sheets on paint shop roof.",
      startH: 2,
      endH: 9,
      typeData: { heightM: 11, accessMethod: "MEWP", fallArrest: ["HARNESS", "DOUBLE_LANYARD", "LIFELINE"], anchorPointChecked: true, barricadingBelow: true },
      approvals: { AREA_OWNER: { by: "owner2", decision: "APPROVED", comment: "Paint line 2 stopped during the job." }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED", comment: "Crawl boards required on fragile roof." } },
    },
    {
      // 5 — APPROVED and startable now (demo: requester can press Activate)
      type: "HOT_WORK",
      status: "APPROVED",
      requester: "requester",
      area: "PS",
      equipment: "OV-01",
      contractor: "In-house maintenance",
      crewSize: 2,
      work: "Braze cracked burner manifold on curing oven OV-01.",
      startH: -0.25,
      endH: 6,
      typeData: hot({ hotWorkType: "SOLDERING", extinguisherType: "CO2" }),
      approvals: { AREA_OWNER: { by: "owner2", decision: "APPROVED", comment: "Oven cooled and gas train isolated." }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED" } },
      // gas test not yet taken: the activate panel will explain what is missing
    },
    {
      // 6 — PENDING with area owner done, safety pending
      type: "ELECTRICAL_LOTO",
      status: "PENDING_APPROVAL",
      requester: "requester",
      area: "UT",
      equipment: "MCC-2",
      contractor: "Volt Electricals",
      crewSize: 2,
      work: "Replace burnt contactor and overload relay in MCC-2 feeder 7 (cooling tower fan CT-2).",
      startH: 1,
      endH: 7,
      typeData: { equipmentTag: "MCC-2 / F7", voltageLevel: "LV", isolationPoints: ["MCC-2 F7 incomer MCCB", "CT-2 local isolator"], earthingApplied: false },
      approvals: { AREA_OWNER: { by: "owner2", decision: "APPROVED", comment: "CT-2 can be down till 6 pm." } },
    },
    {
      // 7 — DRAFT
      type: "WORKING_AT_HEIGHT",
      status: "DRAFT",
      requester: "requester",
      area: "CDU",
      equipment: "E-104",
      contractor: "Sri Balaji Fabricators",
      work: "Insulation repair on E-104 top nozzle",
      startH: 24,
      endH: 30,
      typeData: { heightM: 4.5, accessMethod: "SCAFFOLD" },
    },
    {
      // 8 — SUSPENDED: gas alarm
      type: "HOT_WORK",
      status: "SUSPENDED",
      requester: "requester",
      area: "CDU",
      equipment: "P-101A",
      contractor: "In-house maintenance",
      crewSize: 2,
      work: "Cut and replace corroded drain line from P-101A casing.",
      startH: -2,
      endH: 3,
      typeData: hot({ hotWorkType: "CUTTING", ...gasOk(-2.2), gasLelPct: 6, gasTestAt: iso(-0.5) }),
      approvals: { AREA_OWNER: { by: "owner", decision: "APPROVED" }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED" } },
      readingChanges: [{ field: "gasLelPct", label: "LEL", from: 0, to: 6, by: "safety", atH: -0.5, comment: "Fixed detector GD-14 alarmed. Portable re-test." }],
      suspendReason: "LEL reading 6%LEL is outside the safe range (≤ 0%).",
      suspendedBy: null,
    },
    {
      // 9 — CLOSED, awaiting safety verification
      type: "ELECTRICAL_LOTO",
      status: "CLOSED",
      requester: "requester",
      area: "CDU",
      equipment: "P-101A",
      contractor: "Volt Electricals",
      crewSize: 2,
      work: "Megger test and terminal re-tightening on P-101A motor.",
      startH: -9,
      endH: -2,
      typeData: {
        equipmentTag: "P-101A-M",
        voltageLevel: "LV",
        isolationPoints: ["MCC-1 F3 breaker"],
        lockNumbers: ["L-0417"],
        tagNumbers: ["T-2231"],
        earthingApplied: true,
        testedDeadBy: "Arjun M (Electrical)",
        testedDeadAt: iso(-9.1),
      },
      approvals: { AREA_OWNER: { by: "owner", decision: "APPROVED" }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED" } },
      completionNotes: "IR values > 100 MΩ all phases. Terminals torqued. Locks L-0417 removed, motor handed back to operations.",
    },
    {
      // 10 — CLOSED_VERIFIED
      type: "CONFINED_SPACE",
      status: "CLOSED_VERIFIED",
      requester: "requester",
      area: "CDU",
      equipment: "E-104",
      contractor: "Coastal Tank Cleaners Pvt Ltd",
      crewSize: 3,
      work: "Hydro-jet cleaning of E-104 channel head.",
      startH: -30,
      endH: -24,
      typeData: {
        spaceId: "E-104 channel",
        entryPoint: "Channel cover opening",
        ventilationMethod: "FORCED_SUPPLY",
        standbyAttendant: "Kannan Arul",
        rescuePlan: "Tripod at opening, SCBA on standby, OHC informed.",
        gasO2Pct: 20.9,
        gasLelPct: 0,
        gasH2sPpm: 0,
        gasCoPpm: 1,
        gasTestAt: iso(-30.3),
        gasTestedBy: "R. Kumar (Safety)",
      },
      approvals: { AREA_OWNER: { by: "owner", decision: "APPROVED" }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED" } },
      workLogs: [
        { kind: "ENTRY", person: "Murugan S", message: "Entered", atH: -29.8 },
        { kind: "EXIT", person: "Murugan S", message: "Exited, job done", atH: -25 },
      ],
      completionNotes: "Channel head cleaned, debris removed, cover boxed up.",
      verificationNotes: "Area inspected: no debris, blinds removed per list, housekeeping OK.",
    },
    {
      // 11 — REJECTED
      type: "HOT_WORK",
      status: "REJECTED",
      requester: "requester",
      area: "TF",
      equipment: "TK-205",
      contractor: "Sri Balaji Fabricators",
      work: "Weld patch plate on TK-205 shell (naphtha service).",
      startH: -20,
      endH: -14,
      typeData: hot(),
      approvals: {
        AREA_OWNER: { by: "owner", decision: "APPROVED" },
        SAFETY_OFFICER: { by: "safety", decision: "REJECTED", comment: "TK-205 is still in naphtha service and not gas-freed. Re-raise after tank is emptied, cleaned and certified gas-free." },
      },
    },
    {
      // 12 — EXPIRED (nobody closed it in time)
      type: "WORKING_AT_HEIGHT",
      status: "EXPIRED",
      requester: "requester",
      area: "UT",
      equipment: "TR-1",
      contractor: "Hosur Roofing Works",
      work: "Bird-guard installation above transformer TR-1 bay.",
      startH: -16,
      endH: -6,
      typeData: { heightM: 7, accessMethod: "LADDER", fallArrest: ["HARNESS", "DOUBLE_LANYARD"], anchorPointChecked: true, barricadingBelow: true },
      approvals: { AREA_OWNER: { by: "owner2", decision: "APPROVED" }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED" } },
    },
    {
      // 13 — CANCELLED
      type: "EXCAVATION",
      status: "CANCELLED",
      requester: "requester",
      area: "UT",
      contractor: "Civil Works Co.",
      work: "Trench for new earth pit near substation fence.",
      startH: -4,
      endH: 4,
      typeData: { depthM: 1.5, method: "HAND", servicesScanned: true, servicesFound: ["11 kV cable (1.1 m)"], shoring: "BENCHING" },
      approvals: { AREA_OWNER: { by: "owner2", decision: "APPROVED" } },
      cancelReason: "Earth pit location moved after cable scan — new permit to follow.",
    },
    {
      // 14 — ACTIVE LOTO, comfortable window
      type: "ELECTRICAL_LOTO",
      status: "ACTIVE",
      requester: "requester",
      area: "UT",
      equipment: "TR-1",
      contractor: "Volt Electricals",
      crewSize: 3,
      work: "Oil sampling and Buchholz relay test on transformer TR-1.",
      startH: -1.5,
      endH: 6.5,
      typeData: {
        equipmentTag: "TR-1",
        voltageLevel: "MV",
        isolationPoints: ["HT panel VCB-3 (11 kV)", "LT ACB-1 (433 V)"],
        lockNumbers: ["L-0522", "L-0523"],
        tagNumbers: ["T-3101", "T-3102"],
        earthingApplied: true,
        testedDeadBy: "Arjun M (Electrical)",
        testedDeadAt: iso(-1.6),
      },
      approvals: { AREA_OWNER: { by: "owner2", decision: "APPROVED", comment: "Load shifted to TR-2." }, SAFETY_OFFICER: { by: "safety", decision: "APPROVED" } },
      workLogs: [{ kind: "NOTE", message: "Oil sample drawn from bottom valve, sent to lab.", atH: -1 }],
    },
  ];

  let seq = 0;
  for (const s of specs) {
    seq++;
    const def = requirePermitType(s.type);
    const start = at(s.startH);
    const end = at(s.endH);
    const createdAt = at(s.startH - 3);
    const submittedAt = at(s.startH - 2.5);
    const reached = (st: PermitStatus[]) => st.includes(s.status);
    const wasSubmitted = s.status !== "DRAFT";
    const wasActive = reached(["ACTIVE", "SUSPENDED", "CLOSED", "CLOSED_VERIFIED", "EXPIRED"]);
    const activatedAt = wasActive ? at(s.startH + 0.1) : null;
    const closedAt = reached(["CLOSED", "CLOSED_VERIFIED"]) ? at(s.endH - 0.5) : null;
    const verifiedAt = s.status === "CLOSED_VERIFIED" ? at(s.endH - 0.1) : null;
    const extApproved = s.extension?.status === "APPROVED";
    const validUntil = extApproved ? new Date(end.getTime() + s.extension!.hours * H) : end;

    const precautions = def.precautions.map((p) => ({ id: p.id, label: p.label, checked: wasSubmitted }));

    const permit = await db.permit.create({
      data: {
        number: `PTW-${now.getUTCFullYear()}-${String(seq).padStart(4, "0")}`,
        type: def.key,
        status: s.status,
        requesterId: users[s.requester].id,
        contractor: s.contractor,
        crewSize: s.crewSize ?? null,
        workDescription: s.work,
        areaId: areas[s.area],
        equipmentId: s.equipment ? equipment[s.equipment] : null,
        locationDetail: s.location ?? null,
        plannedStart: start,
        plannedEnd: end,
        validUntil,
        hazards: [...def.defaultHazards],
        ppe: [...def.defaultPpe],
        precautions: precautions as Prisma.InputJsonValue,
        typeData: s.typeData as Prisma.InputJsonValue,
        completionNotes: s.completionNotes ?? null,
        verificationNotes: s.verificationNotes ?? null,
        extensionCount: extApproved ? 1 : 0,
        submittedAt: wasSubmitted ? submittedAt : null,
        activatedAt,
        closedAt,
        verifiedAt,
        createdAt,
      },
    });

    // ---- audit trail, in time order
    type A = Prisma.AuditLogCreateManyInput;
    const audit: A[] = [];
    const log = (h: Date, actor: UserKey | null, action: string, rest: Partial<A> = {}) =>
      audit.push({ permitId: permit.id, actorId: actor ? users[actor].id : null, action, createdAt: h, ...rest });

    log(createdAt, s.requester, "CREATED", { field: "status", toValue: "DRAFT", comment: `${def.label} permit raised as draft.` });

    if (wasSubmitted) {
      log(submittedAt, s.requester, "SUBMITTED", { field: "status", fromValue: "DRAFT", toValue: "PENDING_APPROVAL" });

      const slots = def.requiredApprovals;
      let t = s.startH - 2;
      for (const role of slots) {
        const a = s.approvals?.[role];
        const decidedAt = a ? at(t) : null;
        await db.permitApproval.create({
          data: {
            permitId: permit.id,
            role,
            decision: a?.decision ?? "PENDING",
            approverId: a ? users[a.by].id : null,
            comment: a?.comment ?? null,
            signature: a?.decision === "APPROVED" ? SIGNATURE_SVG(users[a.by].name) : null,
            decidedAt,
          },
        });
        if (a && decidedAt) {
          log(decidedAt, a.by, a.decision, { field: `approval.${role}`, fromValue: "PENDING", toValue: a.decision, comment: a.comment ?? null });
          if (a.decision === "REJECTED") log(decidedAt, a.by, "STATUS_CHANGED", { field: "status", fromValue: "PENDING_APPROVAL", toValue: "REJECTED", comment: "Rejected by an approver." });
        }
        t += 0.4;
      }
      const allOk = slots.every((r) => s.approvals?.[r]?.decision === "APPROVED");
      if (allOk) {
        const last = slots.map((r) => s.approvals![r]!.by).at(-1)!;
        log(at(t - 0.4), last, "STATUS_CHANGED", { field: "status", fromValue: "PENDING_APPROVAL", toValue: "APPROVED", comment: "All required approvals received." });
      }
    }

    if (activatedAt) log(activatedAt, s.requester, "ACTIVATED", { field: "status", fromValue: "APPROVED", toValue: "ACTIVE" });

    for (const w of s.workLogs ?? []) {
      await db.workLog.create({ data: { permitId: permit.id, authorId: users[s.requester].id, kind: w.kind, person: w.person ?? null, message: w.message, createdAt: at(w.atH) } });
    }

    for (const r of s.readingChanges ?? []) {
      log(at(r.atH), r.by, "FIELD_CHANGED", { field: r.label, fromValue: String(r.from), toValue: String(r.to), comment: r.comment });
    }

    if (s.status === "SUSPENDED") {
      const when = s.readingChanges?.[0] ? at(s.readingChanges[0].atH) : at(-0.5);
      log(when, s.suspendedBy ?? null, s.suspendedBy ? "SUSPENDED" : "AUTO_SUSPENDED", { field: "status", fromValue: "ACTIVE", toValue: "SUSPENDED", comment: s.suspendReason });
    }

    if (s.extension) {
      const ex = s.extension;
      await db.extensionRequest.create({
        data: { permitId: permit.id, requestedById: users[s.requester].id, hours: ex.hours, reason: ex.reason, status: ex.status, createdAt: at(ex.atH), ...(ex.status === "APPROVED" ? { decidedById: users.safety.id, decidedAt: at(ex.atH + 0.2) } : {}) },
      });
      log(at(ex.atH), s.requester, "EXTENSION_REQUESTED", { field: "validUntil", fromValue: end.toISOString(), toValue: `+${ex.hours} h`, comment: ex.reason });
    }

    if (closedAt) log(closedAt, s.requester, "CLOSED", { field: "status", fromValue: "ACTIVE", toValue: "CLOSED", comment: s.completionNotes });
    if (verifiedAt) log(verifiedAt, "safety", "VERIFIED", { field: "status", fromValue: "CLOSED", toValue: "CLOSED_VERIFIED", comment: s.verificationNotes });
    if (s.status === "EXPIRED") log(end, null, "EXPIRED", { field: "status", fromValue: "ACTIVE", toValue: "EXPIRED", comment: `Validity window ended at ${end.toISOString()}. Work must stop; raise a new permit to continue.` });
    if (s.status === "CANCELLED") log(at(s.startH - 1), s.requester, "CANCELLED", { field: "status", fromValue: "PENDING_APPROVAL", toValue: "CANCELLED", comment: s.cancelReason });

    audit.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
    await db.auditLog.createMany({ data: audit });
  }

  return { users: DEMO_USERS.length, plants: 2, areas: areaDefs.length, equipment: equipmentDefs.length, permits: specs.length };
}

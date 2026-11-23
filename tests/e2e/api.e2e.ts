// End-to-end tests against a RUNNING server, through real HTTP + cookies,
// exactly as a browser or `curl` would hit it. Every role, every endpoint,
// every rule the brief says "we will try".
//
//   npm run build && npm start            (or npm run dev)
//   npm run db:seed                       (fresh demo data)
//   npm run test:e2e                      (E2E_BASE_URL defaults to http://localhost:3000)
//
// It creates permits in the database it talks to; re-seed afterwards.
// The demo-reset test at the end only runs with E2E_RESET=1.

import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "change-me-too";
const PASSWORD = "Password@123";
const SIG = "data:image/png;base64,iVBORw0KGgo=";
const MIN = 60_000;
const H = 60 * MIN;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

// ------------------------------------------------------------------ tiny HTTP client with a cookie jar

type Res = { status: number; body: any; text: string; headers: Headers };

class Client {
  cookie = "";
  constructor(readonly name: string) {}
  async req(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Res> {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = /ptw_session=([^;]*)/.exec(set);
      if (m) this.cookie = m[1] ? `ptw_session=${m[1]}` : "";
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html */
    }
    return { status: res.status, body: json, text, headers: res.headers };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b: unknown = {}) => this.req("POST", p, b);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  async login(email: string, password = PASSWORD) {
    return this.post("/api/auth/login", { email, password });
  }
}

const anon = new Client("anonymous");
const requester = new Client("requester");
const owner = new Client("owner"); // Chennai: CDU, TF
const owner2 = new Client("owner2"); // Hosur: PS, UT
const safety = new Client("safety");
const admin = new Client("admin");

const areas: Record<string, string> = {}; // name -> id
let equipmentInHosur = "";
let me: Record<string, { id: string }> = {};

function expectError(r: Res, status: number, code?: string, msg?: RegExp) {
  expect(r.status, `${r.status} ${r.text.slice(0, 300)}`).toBe(status);
  if (code) expect(r.body?.error?.code).toBe(code);
  if (msg) expect(r.body?.error?.message).toMatch(msg);
}
function expectOk(r: Res, status = 200) {
  expect(r.status, r.text.slice(0, 400)).toBe(status);
  return r.body;
}

// ------------------------------------------------------------------ permit builders (valid by default)

function precautionsFor(detail: any) {
  return detail.permit.precautions.map((p: any) => ({ ...p, checked: true }));
}

const typeData: Record<string, (gasAt?: string) => Record<string, unknown>> = {
  HOT_WORK: (gasAt = iso(-5 * MIN)) => ({
    hotWorkType: "WELDING",
    fireWatchName: "E2E Fire Watch",
    fireWatchAfterMinutes: 30,
    extinguisherType: "DCP",
    combustiblesClearedRadiusM: 12,
    gasLelPct: 0,
    gasO2Pct: 20.9,
    gasTestAt: gasAt,
    gasTestedBy: "E2E Tester",
  }),
  CONFINED_SPACE: (gasAt = iso(-5 * MIN)) => ({
    spaceId: "E2E-TK",
    entryPoint: "Top manway",
    ventilationMethod: "FORCED_SUPPLY",
    standbyAttendant: "E2E Attendant",
    rescuePlan: "Tripod and winch at manway, SCBA on standby",
    gasO2Pct: 20.8,
    gasLelPct: 0,
    gasH2sPpm: 0,
    gasCoPpm: 2,
    gasTestAt: gasAt,
    gasTestedBy: "E2E Tester",
  }),
  WORKING_AT_HEIGHT: () => ({ heightM: 6, accessMethod: "MEWP", fallArrest: ["HARNESS"], anchorPointChecked: true, barricadingBelow: true }),
  ELECTRICAL_LOTO: (gasAt = iso(-5 * MIN)) => ({
    equipmentTag: "E2E-MCC",
    voltageLevel: "LV",
    isolationPoints: ["Breaker 1"],
    lockNumbers: ["L-1"],
    tagNumbers: ["T-1"],
    earthingApplied: true,
    testedDeadBy: "E2E Electrician",
    testedDeadAt: gasAt,
  }),
  EXCAVATION: () => ({ depthM: 1, method: "HAND", servicesScanned: true, shoring: "NONE_SHALLOW" }),
};

interface NewPermit {
  type?: string;
  area?: string;
  startMs?: number;
  endMs?: number;
  typeData?: Record<string, unknown>;
  by?: Client;
}

/** Create a complete draft (all precautions ticked). Returns its id. */
async function createDraft(o: NewPermit = {}): Promise<string> {
  const by = o.by ?? requester;
  const type = o.type ?? "HOT_WORK";
  const created = expectOk(
    await by.post("/api/permits", {
      type,
      contractor: "E2E Contractors",
      crewSize: 2,
      workDescription: `E2E ${type} job ${Math.random().toString(36).slice(2, 7)}`,
      areaId: areas[o.area ?? "Paint Shop"],
      equipmentId: null,
      plannedStart: iso(o.startMs ?? -10 * MIN),
      plannedEnd: iso(o.endMs ?? 4 * H),
      hazards: ["E2E hazard"],
      ppe: ["Helmet"],
      precautions: [],
      typeData: o.typeData ?? typeData[type](),
    }),
    201,
  );
  const id = created.permit.id as string;
  const detail = expectOk(await by.get(`/api/permits/${id}`));
  expectOk(await by.patch(`/api/permits/${id}`, { precautions: precautionsFor(detail) }));
  return id;
}

async function submitted(o: NewPermit = {}) {
  const id = await createDraft(o);
  expectOk(await (o.by ?? requester).post(`/api/permits/${id}/transition`, { action: "SUBMIT" }));
  return id;
}

/** Submitted + both sign-offs (area owner chosen from the area). */
async function approved(o: NewPermit = {}) {
  const id = await submitted(o);
  const areaOwner = ["Crude Distillation Unit", "Tank Farm"].includes(o.area ?? "Paint Shop") ? owner : owner2;
  expectOk(await areaOwner.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }));
  const r = expectOk(await safety.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }));
  expect(r.status).toBe("APPROVED");
  return id;
}

async function active(o: NewPermit = {}) {
  const id = await approved(o);
  expectOk(await (o.by ?? requester).post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }));
  return id;
}

const statusOf = async (id: string) => (await admin.get(`/api/permits/${id}`)).body.permit.status as string;
const auditOf = async (id: string) => (await admin.get(`/api/permits/${id}`)).body.permit.auditLogs as any[];

// ------------------------------------------------------------------ setup

beforeAll(async () => {
  const up = await fetch(BASE + "/login").catch(() => null);
  if (!up || !up.ok) throw new Error(`Server not reachable at ${BASE}. Start it (npm start) and seed it first.`);
  for (const [c, email] of [
    [requester, "requester@ptw.demo"],
    [owner, "owner@ptw.demo"],
    [owner2, "owner2@ptw.demo"],
    [safety, "safety@ptw.demo"],
    [admin, "admin@ptw.demo"],
  ] as const) {
    expectOk(await c.login(email));
    me[c.name] = (await c.get("/api/me")).body.user;
  }
  const list = expectOk(await admin.get("/api/permits")).permits as any[];
  for (const p of list) areas[p.area.name] = p.area.id;
  expect(Object.keys(areas)).toEqual(expect.arrayContaining(["Crude Distillation Unit", "Tank Farm", "Paint Shop", "Utilities & Substation"]));
  const hosurPermit = list.find((p) => p.area.name === "Utilities & Substation" && p.equipment);
  equipmentInHosur = (await admin.get(`/api/permits/${hosurPermit.id}`)).body.permit.equipment.id;
}, 60_000);

// ------------------------------------------------------------------ 1. auth

describe("1. authentication", () => {
  it("rejects every API route without a session (401 JSON)", async () => {
    for (const [m, p] of [
      ["GET", "/api/permits"],
      ["POST", "/api/permits"],
      ["GET", "/api/me"],
      ["POST", "/api/permits/x/transition"],
      ["POST", "/api/permits/x/approval"],
      ["PATCH", "/api/permits/x/readings"],
      ["POST", "/api/admin/users"],
      ["GET", "/api/conflicts"],
    ]) {
      const r = await anon.req(m, p, m === "GET" ? undefined : {});
      expectError(r, 401, "UNAUTHENTICATED");
    }
  });

  it("redirects pages to /login without a session", async () => {
    const r = await anon.get("/permits");
    expect([302, 303, 307, 308]).toContain(r.status);
    expect(r.headers.get("location")).toMatch(/\/login/);
  });

  it("refuses a wrong password and an unknown email with the same message", async () => {
    const a = await anon.login("requester@ptw.demo", "wrong");
    const b = await anon.login("nobody@ptw.demo", "wrong");
    expectError(a, 401, "UNAUTHENTICATED", /Wrong email or password/);
    expectError(b, 401, "UNAUTHENTICATED", /Wrong email or password/);
  });

  it("rejects a forged session cookie", async () => {
    const forged = new Client("forged");
    forged.cookie = "ptw_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad";
    expectError(await forged.get("/api/me"), 401);
  });

  it("logout ends the session", async () => {
    const c = new Client("temp");
    expectOk(await c.login("requester@ptw.demo"));
    expectOk(await c.get("/api/me"));
    expectOk(await c.post("/api/auth/logout"));
    expectError(await c.get("/api/me"), 401);
  });
});

// ------------------------------------------------------------------ 2. create / drafts

describe("2. creating permits and drafts", () => {
  it("creates and submits a permit of every type", async () => {
    for (const type of ["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL_LOTO", "EXCAVATION"]) {
      const id = await submitted({ type, area: "Utilities & Substation" });
      const d = expectOk(await requester.get(`/api/permits/${id}`));
      expect(d.permit.type).toBe(type);
      expect(d.permit.status).toBe("PENDING_APPROVAL");
      expect(d.permit.number).toMatch(/^PTW-\d{4}-\d{4}$/);
      expect(d.permit.approvals.map((a: any) => a.role).sort()).toEqual(["AREA_OWNER", "SAFETY_OFFICER"]);
    }
  });

  it("validates input: unknown type, bad dates, equipment from another area", async () => {
    const base = { contractor: "x", workDescription: "x", areaId: areas["Paint Shop"], plannedStart: iso(0), plannedEnd: iso(H) };
    expectError(await requester.post("/api/permits", { ...base, type: "JUGGLING" }), 422, "VALIDATION_FAILED");
    expectError(await requester.post("/api/permits", { ...base, type: "HOT_WORK", plannedStart: "tomorrow" }), 422);
    expectError(await requester.post("/api/permits", { ...base, type: "HOT_WORK", equipmentId: equipmentInHosur }), 422, "VALIDATION_FAILED", /area/);
    expectError(await requester.req("POST", "/api/permits", "not json"), 422, "VALIDATION_FAILED", /JSON/);
  });

  it("drops unknown fields and rejects wrong field types in type data", async () => {
    const id = await createDraft({ typeData: { ...typeData.HOT_WORK(), evil: "<script>" } });
    const d = expectOk(await requester.get(`/api/permits/${id}`));
    expect(d.permit.typeData).not.toHaveProperty("evil");
    expectError(await requester.patch(`/api/permits/${id}`, { typeData: { hotWorkType: "JUGGLING" } }), 422);
    expectError(await requester.patch(`/api/permits/${id}`, { typeData: { combustiblesClearedRadiusM: 3 } }), 422, undefined);
  });

  it("drafts are private to their author (and admin)", async () => {
    const id = await createDraft();
    expectOk(await requester.get(`/api/permits/${id}`));
    expectOk(await admin.get(`/api/permits/${id}`));
    expectError(await owner2.get(`/api/permits/${id}`), 404);
    expectError(await safety.patch(`/api/permits/${id}`, { workDescription: "hijack" }), 403);
    expectError(await safety.post(`/api/permits/${id}/transition`, { action: "SUBMIT" }), 403);
  });

  it("refuses to submit an incomplete permit and says why", async () => {
    const created = expectOk(
      await requester.post("/api/permits", { type: "HOT_WORK", areaId: areas["Paint Shop"], plannedStart: iso(0), plannedEnd: iso(H) }),
      201,
    );
    const r = await requester.post(`/api/permits/${created.permit.id}/transition`, { action: "SUBMIT" });
    expectError(r, 422, "VALIDATION_FAILED", /incomplete/);
    expect(r.body.error.details.map((d: any) => d.field)).toEqual(expect.arrayContaining(["contractor", "workDescription", "precautions", "fireWatchName"]));
  });

  it("refuses a window longer than one shift", async () => {
    const id = await createDraft({ endMs: 20 * H });
    expectError(await requester.post(`/api/permits/${id}/transition`, { action: "SUBMIT" }), 422, "VALIDATION_FAILED", /at most 8 h/);
  });

  it("only drafts can be edited", async () => {
    const id = await submitted();
    expectError(await requester.patch(`/api/permits/${id}`, { workDescription: "changed after submit" }), 409, "INVALID_TRANSITION");
  });
});

// ------------------------------------------------------------------ 3. approvals

describe("3. approvals and roles", () => {
  it("nobody can approve their own permit — any role", async () => {
    for (const self of [owner2, safety, admin]) {
      const id = await submitted({ by: self, area: "Paint Shop" });
      expectError(await self.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }), 403, "FORBIDDEN", /own permit/);
    }
  });

  it("requesters can't approve; area owners only in their area", async () => {
    const id = await submitted({ area: "Paint Shop" });
    expectError(await requester.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }), 403);
    expectError(await owner.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }), 403, "FORBIDDEN", /own area/);
    expectOk(await owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }));
  });

  it("one person can't sign twice; approval needs a valid PNG signature", async () => {
    const id = await submitted({ area: "Paint Shop" });
    expectError(await owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE" }), 422);
    expectError(await owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: "javascript:alert(1)" }), 422);
    expectOk(await owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }));
    expectError(await owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }), 403, "FORBIDDEN", /already signed/);
    // admin may fill a slot, but not the one admin already... safety slot is still open for admin
    expectOk(await admin.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }));
    expect(await statusOf(id)).toBe("APPROVED");
    expectError(await safety.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }), 409, "INVALID_TRANSITION");
  });

  it("rejection needs a reason, ends the permit, and nothing works after it", async () => {
    const id = await submitted({ area: "Paint Shop" });
    expectError(await safety.post(`/api/permits/${id}/approval`, { decision: "REJECT", comment: "" }), 422);
    const r = expectOk(await safety.post(`/api/permits/${id}/approval`, { decision: "REJECT", comment: "Gas line not blinded" }));
    expect(r.status).toBe("REJECTED");
    expectError(await owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }), 409);
    expectError(await requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }), 409);
    expectError(await requester.post(`/api/permits/${id}/transition`, { action: "CANCEL", comment: "x" }), 409);
  });

  it("the server tells the UI exactly which buttons each role gets", async () => {
    const id = await submitted({ area: "Paint Shop" });
    const actions = async (c: Client) => (await c.get(`/api/permits/${id}`)).body.allowedActions as string[];
    expect(await actions(requester)).not.toContain("APPROVE");
    expect(await actions(owner2)).toEqual(expect.arrayContaining(["APPROVE", "REJECT"]));
    expect(await actions(owner)).not.toContain("APPROVE");
    expect(await actions(safety)).toEqual(expect.arrayContaining(["APPROVE", "REJECT", "CANCEL"]));
  });
});

// ------------------------------------------------------------------ 4. activation

describe("4. starting work", () => {
  it("can't skip approval", async () => {
    const id = await submitted();
    expectError(await safety.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }), 409, "INVALID_TRANSITION");
  });

  it("can't start before the planned start time", async () => {
    const id = await approved({ startMs: 2 * H, endMs: 5 * H });
    const r = await requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" });
    expectError(r, 409, "PRECONDITION_FAILED", /before the planned start/);
    expect((await requester.get(`/api/permits/${id}`)).body.blockers.ACTIVATE).toMatch(/planned start/);
  });

  it("can't start without a gas test, with a stale one, or with an unsafe one", async () => {
    const none = await approved({ typeData: { ...typeData.HOT_WORK(), gasLelPct: undefined, gasO2Pct: undefined, gasTestAt: undefined, gasTestedBy: undefined } });
    expectError(await requester.post(`/api/permits/${none}/transition`, { action: "ACTIVATE" }), 409, "PRECONDITION_FAILED", /LEL is required/);

    const stale = await approved({ typeData: typeData.HOT_WORK(iso(-3 * H)) });
    expectError(await requester.post(`/api/permits/${stale}/transition`, { action: "ACTIVATE" }), 409, "PRECONDITION_FAILED", /Re-test/);

    const unsafe = await approved({ typeData: { ...typeData.HOT_WORK(), gasLelPct: 4 } });
    expectError(await requester.post(`/api/permits/${unsafe}/transition`, { action: "ACTIVATE" }), 409, "PRECONDITION_FAILED", /outside the safe range/);
  });

  it("other people can't start someone else's job", async () => {
    const id = await approved();
    expectError(await owner2.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }), 403);
  });

  it("starts when everything is in order", async () => {
    const id = await approved();
    expect(expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" })).status).toBe("ACTIVE");
  });
});

// ------------------------------------------------------------------ 5. readings

describe("5. readings after submission", () => {
  it("are audited with from → to; locked fields are refused", async () => {
    const id = await approved({ typeData: { ...typeData.HOT_WORK(), gasO2Pct: 20.9 } });
    expectOk(await requester.patch(`/api/permits/${id}/readings`, { typeData: { gasO2Pct: 20.6, gasTestAt: iso(0) }, comment: "Re-test" }));
    const changes = (await auditOf(id)).filter((a) => a.action === "FIELD_CHANGED");
    expect(changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "O₂", fromValue: "20.9", toValue: "20.6", comment: "Re-test" })]));
    expectError(await requester.patch(`/api/permits/${id}/readings`, { typeData: { hotWorkType: "GRINDING" } }), 422, "VALIDATION_FAILED", /locked/);
    expectError(await owner2.patch(`/api/permits/${id}/readings`, { typeData: { gasO2Pct: 21 } }), 403);
  });

  it("an unsafe reading on an ACTIVE permit stops work immediately", async () => {
    const id = await active();
    const r = expectOk(await safety.patch(`/api/permits/${id}/readings`, { typeData: { gasLelPct: 7 }, comment: "Alarm" }));
    expect(r.status).toBe("SUSPENDED");
    const auto = (await auditOf(id)).find((a) => a.action === "AUTO_SUSPENDED");
    expect(auto).toMatchObject({ actorId: null, fromValue: "ACTIVE", toValue: "SUSPENDED" });
  });
});

// ------------------------------------------------------------------ 6. suspend / resume / work log

describe("6. stop work, resume, work log", () => {
  it("stop-work authority: requester, the area's owner and safety — not other owners", async () => {
    for (const who of [requester, owner2, safety]) {
      const id = await active();
      expectError(await who.post(`/api/permits/${id}/transition`, { action: "SUSPEND" }), 422); // reason required
      expect(expectOk(await who.post(`/api/permits/${id}/transition`, { action: "SUSPEND", comment: "Gas alarm in area" })).status).toBe("SUSPENDED");
    }
    const id = await active();
    expectError(await owner.post(`/api/permits/${id}/transition`, { action: "SUSPEND", comment: "x" }), 403);
  });

  it("only safety resumes, with a record of what was checked", async () => {
    const id = await active();
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "SUSPEND", comment: "Shift handover" }));
    expectError(await requester.post(`/api/permits/${id}/transition`, { action: "RESUME", comment: "ok" }), 403);
    expectError(await owner2.post(`/api/permits/${id}/transition`, { action: "RESUME", comment: "ok" }), 403);
    expectError(await safety.post(`/api/permits/${id}/transition`, { action: "RESUME" }), 422);
    expect(expectOk(await safety.post(`/api/permits/${id}/transition`, { action: "RESUME", comment: "Re-tested LEL 0%" })).status).toBe("ACTIVE");
  });

  it("work can only be logged on an ACTIVE permit", async () => {
    const id = await approved();
    expectError(await requester.post(`/api/permits/${id}/work-logs`, { kind: "NOTE", message: "early" }), 409, "INVALID_TRANSITION");
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }));
    expectOk(await requester.post(`/api/permits/${id}/work-logs`, { kind: "NOTE", message: "Started" }), 201);
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "SUSPEND", comment: "pause" }));
    expectError(await requester.post(`/api/permits/${id}/work-logs`, { kind: "NOTE", message: "while stopped" }), 409);
  });
});

// ------------------------------------------------------------------ 7. confined space register

describe("7. confined-space entry register", () => {
  it("tracks who is inside and blocks closing until everyone is out", async () => {
    const id = await active({ type: "CONFINED_SPACE", area: "Utilities & Substation" });
    expectError(await requester.post(`/api/permits/${id}/work-logs`, { kind: "EXIT", person: "Arun", message: "x" }), 409, "PRECONDITION_FAILED", /not logged inside/);
    expectOk(await requester.post(`/api/permits/${id}/work-logs`, { kind: "ENTRY", person: "Arun", message: "in" }), 201);
    expectError(await requester.post(`/api/permits/${id}/work-logs`, { kind: "ENTRY", person: "arun", message: "again" }), 409, undefined, /already inside/);
    expectError(await requester.post(`/api/permits/${id}/transition`, { action: "CLOSE", completionNotes: "done" }), 409, "PRECONDITION_FAILED", /Arun/);
    expectOk(await requester.post(`/api/permits/${id}/work-logs`, { kind: "EXIT", person: "ARUN", message: "out" }), 201);
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "CLOSE", completionNotes: "Inspection complete" }));
  });

  it("other types have no entry register", async () => {
    const id = await active();
    expectError(await requester.post(`/api/permits/${id}/work-logs`, { kind: "ENTRY", person: "x", message: "x" }), 422);
  });
});

// ------------------------------------------------------------------ 8. extensions

describe("8. extensions", () => {
  it("requested by the requester, decided by safety, capped at two", async () => {
    const id = await active({ endMs: 2 * H });
    const before = new Date((await requester.get(`/api/permits/${id}`)).body.permit.validUntil).getTime();

    expectError(await safety.post(`/api/permits/${id}/extensions`, { hours: 1, reason: "more time" }), 403);
    expectError(await requester.post(`/api/permits/${id}/extensions`, { hours: 5, reason: "too long" }), 422);
    const e1 = expectOk(await requester.post(`/api/permits/${id}/extensions`, { hours: 2, reason: "Second bracket" }), 201).extension;
    expectError(await requester.post(`/api/permits/${id}/extensions`, { hours: 1, reason: "another" }), 409, "PRECONDITION_FAILED", /already pending/);

    expectError(await requester.post(`/api/permits/${id}/extensions/${e1.id}/decision`, { approve: true }), 403);
    expectError(await owner2.post(`/api/permits/${id}/extensions/${e1.id}/decision`, { approve: true }), 403);
    expectError(await safety.post(`/api/permits/${id}/extensions/${e1.id}/decision`, { approve: false }), 422);
    const d = expectOk(await safety.post(`/api/permits/${id}/extensions/${e1.id}/decision`, { approve: true, note: "OK" }));
    expect(new Date(d.validUntil).getTime() - before).toBe(2 * H);

    const e2 = expectOk(await requester.post(`/api/permits/${id}/extensions`, { hours: 1, reason: "Finish" }), 201).extension;
    expectOk(await safety.post(`/api/permits/${id}/extensions/${e2.id}/decision`, { approve: false, note: "Raise a new permit" }));
    const e3 = expectOk(await requester.post(`/api/permits/${id}/extensions`, { hours: 1, reason: "Again" }), 201).extension;
    expectOk(await safety.post(`/api/permits/${id}/extensions/${e3.id}/decision`, { approve: true, note: "last" }));
    expectError(await requester.post(`/api/permits/${id}/extensions`, { hours: 1, reason: "Fourth" }), 409, "PRECONDITION_FAILED", /limit/);

    const acts = (await auditOf(id)).map((a) => a.action);
    expect(acts.filter((a) => a === "EXTENSION_REQUESTED")).toHaveLength(3);
    expect(acts).toEqual(expect.arrayContaining(["EXTENSION_APPROVED", "EXTENSION_REJECTED"]));
  });
});

// ------------------------------------------------------------------ 9. closure / cancel

describe("9. closing, verifying, cancelling", () => {
  it("requester closes with notes; only safety verifies; closed can't be cancelled", async () => {
    const id = await active();
    expectError(await safety.post(`/api/permits/${id}/transition`, { action: "CLOSE", completionNotes: "x" }), 403);
    expectError(await requester.post(`/api/permits/${id}/transition`, { action: "CLOSE" }), 422);
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "CLOSE", completionNotes: "Bracket welded, area clean" }));
    expectError(await safety.post(`/api/permits/${id}/transition`, { action: "CANCEL", comment: "x" }), 409);
    expectError(await requester.post(`/api/permits/${id}/transition`, { action: "VERIFY", verificationNotes: "x" }), 403);
    expectError(await safety.post(`/api/permits/${id}/transition`, { action: "VERIFY" }), 422);
    expectOk(await safety.post(`/api/permits/${id}/transition`, { action: "VERIFY", verificationNotes: "Walked the area: clean" }));
    expect(await statusOf(id)).toBe("CLOSED_VERIFIED");
    const d = (await requester.get(`/api/permits/${id}`)).body;
    expect(d.allowedActions).toEqual([]);
  });

  it("requester cancels before work starts; after that only safety can", async () => {
    const draft = await createDraft();
    expectOk(await requester.post(`/api/permits/${draft}/transition`, { action: "CANCEL", comment: "Not needed" }));
    const running = await active();
    expectError(await requester.post(`/api/permits/${running}/transition`, { action: "CANCEL", comment: "x" }), 403, "FORBIDDEN", /close or suspend/);
    expectOk(await safety.post(`/api/permits/${running}/transition`, { action: "CANCEL", comment: "Plant emergency" }));
    expect(await statusOf(running)).toBe("CANCELLED");
  });

  it("garbage actions are refused", async () => {
    const id = await submitted();
    expectError(await admin.post(`/api/permits/${id}/transition`, { action: "APPROVE_ALL" }), 422);
    expectError(await admin.post(`/api/permits/${id}/transition`, { action: "EXPIRE" }), 422);
    expectError(await admin.post(`/api/permits/does-not-exist/transition`, { action: "SUBMIT" }), 404);
  });
});

// ------------------------------------------------------------------ 10. full happy path + audit

describe("10. the whole lifecycle, audited", () => {
  it("draft → submit → 2 sign-offs → start → log → close → verify, every step in the audit trail", async () => {
    const id = await createDraft({ area: "Paint Shop" });
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "SUBMIT" }));
    expectOk(await owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE", comment: "Line isolated", signature: SIG }));
    expectOk(await safety.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }));
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }));
    expectOk(await requester.post(`/api/permits/${id}/work-logs`, { kind: "NOTE", message: "Half done" }), 201);
    expectOk(await requester.post(`/api/permits/${id}/transition`, { action: "CLOSE", completionNotes: "Done" }));
    expectOk(await safety.post(`/api/permits/${id}/transition`, { action: "VERIFY", verificationNotes: "Clean" }));

    const log = await auditOf(id);
    expect(log.map((a) => a.action)).toEqual(["CREATED", "SUBMITTED", "APPROVED", "APPROVED", "STATUS_CHANGED", "ACTIVATED", "CLOSED", "VERIFIED"]);
    for (const e of log) {
      expect(e.createdAt).toBeTruthy();
      expect(e.actor?.name).toBeTruthy();
    }
    expect(log[2]).toMatchObject({ field: "approval.AREA_OWNER", fromValue: "PENDING", toValue: "APPROVED", comment: "Line isolated" });
    const d = (await requester.get(`/api/permits/${id}`)).body.permit;
    expect(d.approvals.every((a: any) => a.signed === true)).toBe(true);
    expect(d.approvals[0]).not.toHaveProperty("signature"); // image not sent in the API payload
  });
});

// ------------------------------------------------------------------ 11. conflicts

describe("11. simultaneous-operations conflicts", () => {
  it("hot work overlapping a confined space in the same area is flagged everywhere", async () => {
    const cs = await approved({ type: "CONFINED_SPACE", area: "Paint Shop", startMs: 3 * H, endMs: 6 * H });
    const q = new URLSearchParams({ type: "HOT_WORK", areaId: areas["Paint Shop"], start: iso(4 * H), end: iso(5 * H) });
    const found = expectOk(await requester.get(`/api/conflicts?${q}`)).conflicts as any[];
    expect(found.map((c) => c.id)).toContain(cs);

    const hot = await submitted({ area: "Paint Shop", startMs: 4 * H, endMs: 5 * H });
    const detail = (await owner2.get(`/api/permits/${hot}`)).body;
    expect(detail.conflicts.map((c: any) => c.id)).toContain(cs);
    const sub = (await auditOf(hot)).find((a) => a.action === "SUBMITTED");
    expect(sub.comment).toMatch(/SIMOPS/);

    const elsewhere = new URLSearchParams({ type: "HOT_WORK", areaId: areas["Utilities & Substation"], start: iso(4 * H), end: iso(5 * H) });
    expect((await requester.get(`/api/conflicts?${elsewhere}`)).body.conflicts.map((c: any) => c.id)).not.toContain(cs);
  });
});

// ------------------------------------------------------------------ 12. lists & filters

describe("12. lists and filters", () => {
  it("status, type, area, search and date filters return only matching permits", async () => {
    const all = (q: string) => admin.get(`/api/permits${q}`).then((r) => r.body.permits as any[]);
    for (const p of await all("?status=ACTIVE")) expect(p.status).toBe("ACTIVE");
    for (const p of await all("?type=CONFINED_SPACE")) expect(p.type).toBe("CONFINED_SPACE");
    for (const p of await all(`?areaId=${areas["Tank Farm"]}`)) expect(p.area.name).toBe("Tank Farm");
    const one = await all("?q=PTW-2026-0001");
    expect(one.map((p) => p.number)).toContain("PTW-2026-0001");
    const today = new Date(Date.now() + 330 * MIN).toISOString().slice(0, 10);
    const inRange = await all(`?from=${today}&to=${today}`);
    expect(inRange.length).toBeGreaterThan(0);
    expect(await all("?from=2001-01-01&to=2001-01-02")).toEqual([]);
    expect(await all("?status=NOT_A_STATUS")).not.toEqual([]); // bad filter values are ignored, not 500
  });

  it("'my sign-offs' only lists what that user can actually sign", async () => {
    const mine = (await owner2.get("/api/permits?view=my-approvals")).body.permits as any[];
    expect(mine.length).toBeGreaterThan(0);
    for (const p of mine) {
      expect(p.canApprove).toBe(true);
      expect(["Paint Shop", "Utilities & Substation"]).toContain(p.area.name);
    }
    expect((await requester.get("/api/permits?view=my-approvals")).body.permits).toEqual([]);
  });

  it("'expiring' only lists live permits ending within 2 hours", async () => {
    await active({ endMs: 90 * MIN });
    const list = (await admin.get("/api/permits?view=expiring")).body.permits as any[];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      const left = new Date(p.validUntil).getTime() - Date.now();
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThanOrEqual(2 * H + MIN);
    }
  });
});

// ------------------------------------------------------------------ 13. concurrency

describe("13. two people acting at the same moment", () => {
  it("simultaneous sign-offs: both land, permit approved exactly once", async () => {
    const id = await submitted({ area: "Paint Shop" });
    const [a, b] = await Promise.all([
      owner2.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }),
      safety.post(`/api/permits/${id}/approval`, { decision: "APPROVE", signature: SIG }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await statusOf(id)).toBe("APPROVED");
    expect((await auditOf(id)).filter((e) => e.action === "STATUS_CHANGED" && e.toValue === "APPROVED")).toHaveLength(1);
  });

  it("simultaneous start: exactly one wins", async () => {
    const id = await approved();
    const rs = await Promise.all([
      requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }),
      safety.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }),
      requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }),
    ]);
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(2);
    expect((await auditOf(id)).filter((e) => e.action === "ACTIVATED")).toHaveLength(1);
  });

  it("simultaneous create: permit numbers stay unique", async () => {
    const ids = await Promise.all(Array.from({ length: 5 }, () => createDraft()));
    const numbers = await Promise.all(ids.map(async (id) => (await requester.get(`/api/permits/${id}`)).body.permit.number));
    expect(new Set(numbers).size).toBe(5);
  });
});

// ------------------------------------------------------------------ 14. real-time expiry

describe("14. expiry in real time (waits ~70 s)", () => {
  it(
    "an active permit expires on its own, via the cron sweep, and can never come back",
    async () => {
      const id = await active({ endMs: 55_000 });
      expect(await statusOf(id)).toBe("ACTIVE");
      await new Promise((r) => setTimeout(r, 60_000));

      expectError(await anon.get("/api/cron/expire"), 401);
      const sweep = expectOk(await anon.req("GET", "/api/cron/expire", undefined, { authorization: `Bearer ${CRON_SECRET}` }));
      expect(sweep.expired).toBeGreaterThanOrEqual(1);

      expect(await statusOf(id)).toBe("EXPIRED");
      const last = (await auditOf(id)).at(-1);
      expect(last).toMatchObject({ action: "EXPIRED", actorId: null, fromValue: "ACTIVE", toValue: "EXPIRED" });
      expectError(await requester.post(`/api/permits/${id}/transition`, { action: "ACTIVATE" }), 409);
      expectError(await safety.post(`/api/permits/${id}/transition`, { action: "RESUME", comment: "x" }), 409);
      expectError(await requester.post(`/api/permits/${id}/work-logs`, { kind: "NOTE", message: "late" }), 409);
      expectError(await requester.post(`/api/permits/${id}/extensions`, { hours: 1, reason: "too late" }), 409);
    },
    120_000,
  );

  it(
    "without the cron, the next read expires it anyway",
    async () => {
      const id = await active({ endMs: 25_000 });
      await new Promise((r) => setTimeout(r, 30_000));
      expect((await requester.get(`/api/permits/${id}`)).body.permit.status).toBe("EXPIRED");
    },
    60_000,
  );
});

// ------------------------------------------------------------------ 15. QR status page

describe("15. public QR status page", () => {
  it("shows the verdict without login and without personal names", async () => {
    const id = await active();
    const r = await anon.get(`/status/${id}`);
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/Work authorised/);
    expect(r.text).not.toMatch(/Ravi Shankar/);
    expect(r.text).not.toMatch(/requester@ptw\.demo/);
  });

  it("hides drafts and unknown ids", async () => {
    const draft = await createDraft();
    expect((await anon.get(`/status/${draft}`)).status).toBe(404);
    expect((await anon.get(`/status/nope`)).status).toBe(404);
  });
});

// ------------------------------------------------------------------ 16. admin

describe("16. admin", () => {
  it("is admin-only", async () => {
    expectError(await requester.post("/api/admin/plants", { code: "X", name: "Hack" }), 403);
    expectError(await safety.patch(`/api/admin/users/${me.requester.id}`, { role: "ADMIN" }), 403);
    const page = await requester.get("/admin");
    expect([302, 303, 307, 308]).toContain(page.status);
  });

  it("manages users, areas and equipment with validation", async () => {
    const email = `e2e-${Date.now()}@ptw.demo`;
    const u = expectOk(await admin.post("/api/admin/users", { email, name: "E2E Owner", role: "AREA_OWNER", password: "Password@123" }), 201).user;
    expectError(await admin.post("/api/admin/users", { email, name: "Dup", role: "REQUESTER", password: "Password@123" }), 422, undefined, /already exists/);
    expectError(await admin.post("/api/admin/users", { email: "x@ptw.demo", name: "Short", role: "REQUESTER", password: "123" }), 422);

    const plants = new Set((await admin.get("/api/permits")).body.permits.map((p: any) => p.area.plant.id));
    const plantId = [...plants][0];
    const code = `E${Date.now() % 100000}`;
    expectError(await admin.post("/api/admin/areas", { plantId, code, name: "Bad owner", ownerId: me.requester.id }), 422, undefined, /Area Owner role/);
    const area = expectOk(await admin.post("/api/admin/areas", { plantId, code, name: "E2E Area", ownerId: u.id }), 201).area;
    expectOk(await admin.post("/api/admin/equipment", { areaId: area.id, tag: `${code}-P1`, name: "E2E pump" }), 201);
    expectError(await admin.patch(`/api/admin/users/${u.id}`, { role: "REQUESTER" }), 422, undefined, /owns/);
    expectError(await admin.patch(`/api/admin/users/${me.admin.id}`, { role: "REQUESTER" }), 422, undefined, /yourself/);
  });

  it("deactivating a user takes effect immediately, even on a live session", async () => {
    const email = `e2e-req-${Date.now()}@ptw.demo`;
    const u = expectOk(await admin.post("/api/admin/users", { email, name: "E2E Temp", role: "REQUESTER", password: "Password@123" }), 201).user;
    const c = new Client("temp-user");
    expectOk(await c.login(email));
    expectOk(await c.get("/api/me"));
    expectOk(await admin.patch(`/api/admin/users/${u.id}`, { active: false }));
    expectError(await c.get("/api/me"), 401);
    expectError(await c.login(email), 401);
  });
});

// ------------------------------------------------------------------ 17. pages never 500

describe("17. every page renders for every role", () => {
  it("no page returns a server error", async () => {
    const list = (await admin.get("/api/permits")).body.permits as any[];
    const sample = [list.find((p) => p.status === "ACTIVE"), list.find((p) => p.status === "PENDING_APPROVAL"), list.find((p) => p.status === "CLOSED_VERIFIED"), list.find((p) => p.status === "DRAFT")].filter(Boolean);
    const pages = ["/", "/permits", "/permits?view=my-approvals", "/permits?view=expiring", "/permits?status=SUSPENDED", "/permits?type=HOT_WORK&from=2020-01-01", "/permits/new", "/admin"];
    for (const p of sample) pages.push(`/permits/${p.id}`, `/permits/${p.id}/approve`, `/permits/${p.id}/edit`);
    const bad: string[] = [];
    for (const c of [requester, owner, owner2, safety, admin]) {
      for (const p of pages) {
        const r = await c.get(p);
        if (r.status >= 500 || ![200, 307, 308, 404].includes(r.status)) bad.push(`${c.name} ${p} → ${r.status}`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

// ------------------------------------------------------------------ 18. demo reset (opt-in, destructive)

describe.runIf(process.env.E2E_RESET === "1")("18. demo reset", () => {
  it("re-seeds the demo and signs everyone out", async () => {
    expectError(await requester.post("/api/demo/reset", {}), 403);
    const r = expectOk(await admin.post("/api/demo/reset", {}));
    expect(r.seeded.permits).toBe(14);
    expectError(await admin.get("/api/me"), 401);
  }, 60_000);
});

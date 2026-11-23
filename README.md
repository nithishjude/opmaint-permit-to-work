# Permit to Work — a PTW module for a CMMS

A Permit to Work (PTW) module of the kind that slots into a maintenance system like Opmaint. A requester raises a permit for dangerous work (hot work, confined space, height, electrical isolation, excavation). The area owner and a safety officer inspect and sign it. Work can only start inside the approved window. The permit expires on its own, anyone with stop-work authority can suspend it, and it is closed and verified at the end. Every step lands in an audit log that can't be edited.

- **Live demo:** `<add your Vercel URL>`
- **Loom walkthrough:** `<add your Loom URL>`

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL · Prisma 6 · Zod · Tailwind · Vitest

---

## Run it locally (≈ 2 minutes)

Prerequisites: **Node 20+** and **Docker** (or any Postgres 14+, see below).

```bash
git clone <repo-url> ptw && cd ptw
npm install                 # also runs `prisma generate`
cp .env.example .env        # defaults work as-is for local use
npm run db:up               # starts Postgres 16 in Docker on port 5433
npm run setup               # applies migrations + seeds demo data
npm run dev                 # http://localhost:3000
```

**No Docker?** Point `DATABASE_URL` in `.env` at any Postgres database you own, then run `npm run setup`.

**Re-seed anytime:** `npm run db:seed`. The seed wipes the data and recreates it with times relative to *now*. On a deployment with `DEMO_MODE=true` there's also a **Reset demo data** button on the Admin page. That way a reviewer opening the app days later still sees permits that are active, expiring or waiting for approval.

### Demo logins — password for all: `Password@123`

The login page has one-tap buttons for each account.

| Role | Email | Name | What to try |
|---|---|---|---|
| Requester | `requester@ptw.demo` | Ravi Shankar | Raise a permit, record a gas test, start work on PTW-0005, log a confined-space entry/exit, close, request an extension |
| Area Owner | `owner@ptw.demo` | Priya Natarajan | Owns the Chennai areas. Approve PTW-0003 (it shows a conflict warning). Try PTW-0006: you can't approve it, it's not your area |
| Safety Officer | `safety@ptw.demo` | Karthik Raman | Approve PTW-0006, approve the pending extension on PTW-0001, STOP WORK on an active permit, resume PTW-0008, verify PTW-0009 |
| Admin | `admin@ptw.demo` | Anitha Joseph | Users, plants, areas (and who owns them), equipment, demo reset |
| Area Owner #2 | `owner2@ptw.demo` | Suresh Babu | Owns the Hosur areas (shows the area restriction) |

The seed creates 2 plants, 4 areas, 9 equipment items and **14 permits covering every status**, each with a consistent approval trail, signatures, work log and audit history.

### Tests

```bash
npm test          # 53 unit + integration tests (no server needed)
npm run test:e2e  # 50 end-to-end tests against a running server
```

- **Unit + integration (`npm test`, 53 tests):** the state machine, permission rules and permit-type registry, plus the real permit service against Postgres: the full lifecycle, self-approval for every role, area ownership, activation rules, expiry, the audit-log trigger, auto-suspend, the confined-space register, conflicts, and concurrent permit numbering. They use a **separate `ptw_test` database**, created automatically, so your demo data is never touched.
- **End-to-end (`npm run test:e2e`, 50 tests):** drives every API endpoint as every role over real HTTP and cookies, the way a browser or `curl` would. It covers the authentication edge cases, all 5 permit types, every illegal transition the brief says *"we will try"*, readings and auto-suspend, extensions, closure, conflicts, filters, admin, deactivating a user mid-session, **two users acting at the same moment**, a **permit expiring in real time** (it waits about 90 s), the QR page, and a check that no page returns 500 for any role. To run it: start the app (`npm run build && npm start`), run `npm run db:seed`, then `npm run test:e2e`. Set `E2E_BASE_URL` if the app isn't on port 3000. The suite creates permits, so re-seed afterwards. `E2E_RESET=1` also tests the destructive demo-reset button.

---

## How it's built

```
src/
  domain/                 ← pure TypeScript, no DB, no React. All the rules live here.
    permit-types/         ← the registry: one file per permit type
    state-machine.ts      ← which transitions exist
    permissions.ts        ← who may do what, in which state (authorize())
    guards.ts             ← time/data preconditions (start time, approvals, gas test)
    permit-core.ts        ← the shared core schema + "is this ready to submit?"
  server/
    permits/commands.ts   ← every mutation: lock → authorize → transition → audit
    permits/queries.ts    ← dashboard, list filters, detail
    permits/expiry.ts     ← auto-expiry sweep
    permits/conflicts.ts  ← simultaneous-operations check
    auth.ts, http.ts      ← session, error → HTTP mapping
  app/api/…               ← thin REST routes: parse → call a command → JSON
  app/(app)/…             ← pages (server components) + small client components
  components/             ← UI; type-fields.tsx renders ANY permit type's fields
prisma/
  schema.prisma, migrations/, seed.ts
tests/                    ← unit + integration
```

### 1. One permit entity, type-specific fields as data

Every permit type shares **one `Permit` row** with the common core: requester, contractor, plant → area → equipment, planned window, hazards, PPE, precautions checklist, status. The fields that differ per type live in a `typeData` JSONB column.

The shape of `typeData` is defined by the **permit-type registry** (`src/domain/permit-types/`). Each type is a plain object:

```ts
export const hotWork: PermitTypeDefinition = {
  key: "HOT_WORK",
  requiredApprovals: ["AREA_OWNER", "SAFETY_OFFICER"],
  maxDurationHours: 8,                 // one shift
  conflictsWith: ["CONFINED_SPACE"],   // simultaneous-operations rule
  fields: [
    { kind: "select", name: "hotWorkType", requiredFor: "submit", options: [...] },
    { kind: "number", name: "gasLelPct", unit: "%", safeRange: { max: 0 },
      requiredFor: "activate", editableAfterSubmit: true },
    { kind: "datetime", name: "gasTestAt", maxAgeMinutesAtActivation: 120, ... },
    ...
  ],
  defaultHazards: [...], defaultPpe: [...], precautions: [...],
};
```

From these field descriptors the app derives:
- the **Zod validation schema** used by the API (unknown keys are stripped, wrong types rejected);
- **what's required to submit** vs **what's required before work starts**. A gas test is taken on site just before the job, so it's a `requiredFor: "activate"` field, not a submit field;
- **safe ranges** (O₂ 19.5–23.5 %, H₂S ≤ 10 ppm…) that block activation, and **freshness** (a gas test older than 60–120 min must be redone);
- which fields can be **edited after submission** (readings, lock numbers). Everything else is locked;
- the **form** (`components/type-fields.tsx`) and the **read-only view** (`type-data-view.tsx`).

There is no per-type form, API route or table. **Adding Excavation** (`excavation.ts`) took that one file plus one line in `index.ts`: no migration and no UI change. It gets the multi-step form, validation, approvals, conflict rules, list filter and detail page automatically.

**Why JSONB rather than a table per type?** Table-per-type gives database-level constraints but means a migration plus new queries for every new type, which is exactly the coupling the brief asks to avoid. EAV (key/value rows) is flexible but painful to validate and read. JSONB plus an application schema keeps one simple query path, and the registry is the single source of truth. The trade-off: Postgres can't enforce the shape of `typeData`. I accept that because every write goes through `parseTypeData`, and I note below what I'd add for schema versioning.

### 2. State machine, enforced on the server

```
DRAFT ─submit→ PENDING_APPROVAL ─all approve→ APPROVED ─activate→ ACTIVE ─close→ CLOSED ─verify→ CLOSED_VERIFIED
                  │ any reject                   │ expires              ├─suspend→ SUSPENDED ─resume→ ACTIVE
                  ▼                              ▼                      └─expires→ EXPIRED
               REJECTED                        EXPIRED
any non-terminal (except CLOSED) ─cancel→ CANCELLED
```

The rules are split into three small, separately tested pieces:

| Question | Where | Example |
|---|---|---|
| Is this edge in the graph? | `state-machine.ts` (a transition table) | EXPIRED → ACTIVE doesn't exist |
| Is this person allowed? | `permissions.ts` → `authorize(actor, action, permit, now)` | Area owners only in their own area; never your own permit |
| Is it the right moment / data? | `guards.ts` | Every approval in, start time reached, gas test fresh and in range |

**Every mutation in `server/permits/commands.ts` follows the same five steps:**
1. Expire the permit first if its window has passed (so nobody acts on a stale permit).
2. Open a transaction and `SELECT … FOR UPDATE` the permit row. Two approvers clicking at once, or an approval racing a cancel, are serialised.
3. `assertAuthorized(...)`, which throws `403 FORBIDDEN`, `409 INVALID_TRANSITION` or `409 PRECONDITION_FAILED` with a readable message.
4. Compute the next status from the state machine and update it conditionally (`WHERE status = <what we read>`).
5. Write the audit entries **in the same transaction**.

**The UI uses the same `authorize()`.** The detail page asks the server for `allowedActions` and renders only those buttons. A user never sees a button the API would refuse, and bypassing the UI gains nothing. When work can't start yet, the page explains why ("Gas test is 140 min old — re-test"), using the same function.

**Try it:** these all come back with the right status code and message:

```bash
# sign in (stores cookie)
curl -c jar -H 'content-type: application/json' \
  -d '{"email":"requester@ptw.demo","password":"Password@123"}' localhost:3000/api/auth/login
# try to approve your own permit → 403 "You cannot approve your own permit."
curl -b jar -H 'content-type: application/json' \
  -d '{"decision":"APPROVE","signature":"data:image/png;base64,iVBORw0KGgo="}' \
  localhost:3000/api/permits/<id>/approval
# try to skip approval → 409 "Not possible while the permit is PENDING_APPROVAL."
curl -b jar -H 'content-type: application/json' -d '{"action":"ACTIVATE"}' \
  localhost:3000/api/permits/<id>/transition
```

### 3. Audit trail

The `AuditLog` table records who, what, when, field, from-value, to-value and comment. It covers every state change, approval, rejection, suspension, extension, and every field edit after submission. **A Postgres trigger rejects any `UPDATE` or `DELETE`** on it (migration `*_audit_log_immutable`), so a buggy endpoint can't rewrite history. There is a test for this. The detail page renders the log as a timeline ("Karthik Raman (Safety Officer) STOPPED WORK — LEL 6 % at GD-14"), not JSON.

### 4. Expiry that works with no browser open

1. **Every read and every write** runs `expireDuePermits()` first. Whatever path you take, you never see or act on an overdue permit as if it were live.
2. **`GET /api/cron/expire`** (requires `Authorization: Bearer $CRON_SECRET`) runs the same sweep on a schedule, so expiry is written to the audit log close to the real time on a quiet night. It's set up as a Vercel Cron in `vercel.json`. The Hobby plan only allows daily, so for tighter timing point a free pinger such as cron-job.org at it every 5 minutes.
3. **Time-sensitive checks compare against `validUntil` directly**, so even between sweeps nothing can be activated or resumed late.

The countdown in the UI is display-only. When it hits zero the page reloads to show what the server decided.

### 5. Bonus features (in the brief's order)

- **Expiry:** see above. Live countdown on active permits, and an "Expiring < 2 h" tile and section on the dashboard.
- **Extensions:** the requester asks for +1–4 h before expiry. A safety officer (never the requester) approves or refuses with a reason. Capped at 2 per permit, and every request and decision is audited. A pending request doesn't stop the clock.
- **Conflict detection:** hot work overlapping a confined-space permit in the same area and window, in either direction (the rule is data: `conflictsWith`). It's checked live in the create form, shown on the permit, highlighted on the approval screen (the approver must tick "I have reviewed the overlapping permit"), and recorded in the audit log on submit.
- **Mobile-first:** ≥ 48 px targets, a 64 px **STOP WORK** button as the first action on an active permit, high contrast, a sticky one-thumb action bar in the form, and Yes/No buttons instead of tiny checkboxes.
- **QR code** on every submitted permit. It opens a public, name-free status page ("WORK AUTHORISED", "STOP — WORK SUSPENDED", "WORK NOT AUTHORISED") with a live countdown for safety walk-arounds.
- **Signature capture** on approval (canvas → PNG, size-limited and format-checked server-side).

**Extra safety rules I added because they're how a real permit works:**
- **Auto-suspend:** recording a reading outside the safe range on an ACTIVE permit (e.g. LEL 3 % during hot work) suspends it immediately, attributed to "System".
- **Entry register for confined spaces:** you can't close the permit while anyone is still logged inside.
- **Only a safety officer can resume** suspended work. The requester can stop work but can't restart it themselves.

---

## Decisions where the spec was silent

| Topic | Decision | Why |
|---|---|---|
| Who can raise permits | **Any role.** Requester is the main one, but area owners and safety officers do raise permits in real plants | It makes "never approve your own permit" meaningful, and it's tested for every approver role |
| Approval slots | Each type lists required approver roles (all current types: area owner + safety officer). **Two different people must sign** | One person filling both slots defeats the purpose of two signatures |
| Admin approving | Admin may fill either slot (full access), but never on their own permit and never both slots | The brief says "full access" |
| Stop-work authority | Requester, the area's owner, safety and admin can all **suspend**. Only **safety/admin can resume** | Anyone on site should be able to stop a job. Restarting needs a competent person |
| Who activates | Requester or safety officer | The person leading the job starts it |
| Validity cap | 8 h for hot work and confined space (one shift), 12 h for height, LOTO and excavation | "A permit issued for one shift is not valid the next shift" |
| What can expire | PENDING_APPROVAL, APPROVED, ACTIVE, SUSPENDED | A pending permit whose window passed is useless. Expiring it is clearer than leaving it pending forever |
| Cancel | From DRAFT, PENDING, APPROVED (requester or safety) and ACTIVE/SUSPENDED (safety/admin only). **Not from CLOSED** | Closed work physically happened and still needs verification |
| Rejection | Terminal. Fixing it means raising a new permit | Matches the diagram and keeps each approval tied to exactly what was approved |
| Edits after submission | Only fields marked `editableAfterSubmit` (readings, lock/tag numbers, tested-dead) via `PATCH /readings`, each audited with from → to. Everything else is locked | Changing the job after it was approved would make the approval meaningless |
| Draft edits | Not audited field-by-field | Drafts are private working copies. The spec asks for edits *after* submission |
| Draft visibility | Only the author and admins | Half-written permits are noise for approvers |
| Permit type change | Not allowed after the draft is created | It would invalidate the type data and approval chain |
| Time zone | Everything is entered and displayed in **IST**. Stored as UTC | The plants are in India. A server in us-east-1 and a phone in Chennai must agree |
| Gas-test freshness | Hot work ≤ 120 min, confined space ≤ 60 min, tested-dead ≤ 120 min before activation | Common practice. Configurable per field |
| Hot-work LEL | Must read **0 %** | Most hot-work formats require zero LEL. Confined space uses < 10 % |
| QR status page | Public (no login) via the unguessable permit id. Shows no personal names | A walk-around inspector shouldn't need an account to see whether work is authorised |
| Notifications | `notify()` stub logs "would notify X" at each point a real system would push | Out of scope per the brief |
| Auth | Email + password, bcrypt, HS256 JWT in an httpOnly cookie. Role and area ownership are **re-read from the DB on every request** | Demoting a user or reassigning an area takes effect immediately |

## What I'd build next

1. **Clone / re-raise** a rejected or expired permit, pre-filled, so "raise a new permit" takes one click.
2. **Schema versioning for permit types:** store `typeVersion` on the permit so old permits render with the field definitions they were approved under.
3. **Isolation certificates and linked permits:** a LOTO certificate shared by several work permits, so work can't start until the isolation is live, and the isolation can't be removed while any linked permit is open.
4. **A real job runner** (pg_cron / a worker) for expiry and reminder notifications instead of sweeping on read, plus real notifications (SMS/WhatsApp to the area owner, push to the safety officer).
5. **Printable permit PDF** to display at the job site (many plants still require paper on site), with the QR code.
6. Shift handover flow: transfer a permit to the next shift's supervisor with re-acknowledgement.
7. Reporting: permits per area, average approval time, suspensions by reason.

## Known gaps (left on purpose or not finished)

- **Seeded history is synthetic.** The seed writes backdated audit rows directly instead of replaying commands through the service. It's consistent, but it didn't go through the rules.
- **Expiry sweeps on read.** Fine at the scale of one plant, but it's a write on the read path. At scale it belongs in a background job (see above).
- **The audit trigger isn't tamper-proof against the DB owner**, who can drop it or `TRUNCATE` (the seed uses `TRUNCATE` for demo resets). In production the app would connect as a role without those privileges.
- **JWTs aren't revocable.** Logout deletes the cookie. Because the user is re-loaded on every request, deactivating a user takes effect immediately, but a stolen token stays valid until it expires (12 h).
- **No rate limiting** on login.
- **Signatures are base64 PNGs in the DB** (≤ 400 KB each). Object storage would be better.
- **Admin is minimal:** create, change roles, activate/deactivate, assign area owners. No rename or delete for plants, areas or equipment.
- **Areas with no owner** can only get their area-owner sign-off from an admin.
- The countdown uses the device clock, so a phone with the wrong time shows the wrong countdown. The server is still the authority.
- Not tested on a real phone in sunlight with gloves. Layout is checked at 390 px wide.
- **Demo reset signs you out**, because user ids are recreated.

## Deploying (Vercel + Neon, both free)

1. Create a Postgres database on [neon.tech](https://neon.tech) and copy the connection string.
2. Import the repo in Vercel. Set the environment variables:
   - `DATABASE_URL`: the Neon connection string (keep `?sslmode=require`)
   - `AUTH_SECRET`: a long random string
   - `CRON_SECRET`: another random string (Vercel Cron sends it automatically)
   - `DEMO_MODE=true`: enables the admin "Reset demo data" button
   - optional `APP_URL=https://<your-app>.vercel.app` for QR links
3. Deploy. `vercel.json` runs `npm run vercel-build`, which applies the migrations.
4. Seed once from your machine: `DATABASE_URL="<neon url>" npm run db:seed`.

## API summary

All endpoints need a session cookie except login, cron and the public status page. Errors look like `{ "error": { "code", "message", "details?" } }`.

| Method & path | Purpose |
|---|---|
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/me` | Session |
| `GET /api/permits?status&type&areaId&plantId&from&to&view&q` | List. `view` = `live`, `expiring`, `my-approvals` or `mine` |
| `POST /api/permits` | Create a draft |
| `GET /api/permits/:id` · `PATCH /api/permits/:id` | Detail (with `allowedActions`) · edit draft |
| `POST /api/permits/:id/transition` | `{action: SUBMIT\|ACTIVATE\|SUSPEND\|RESUME\|CLOSE\|VERIFY\|CANCEL, comment?, completionNotes?, verificationNotes?}` |
| `POST /api/permits/:id/approval` | `{decision: APPROVE, signature, comment?}` or `{decision: REJECT, comment}` |
| `PATCH /api/permits/:id/readings` | Update post-submission fields (audited, may auto-suspend) |
| `POST /api/permits/:id/work-logs` | `{kind: NOTE\|ENTRY\|EXIT, person?, message}`. ACTIVE only |
| `POST /api/permits/:id/extensions` · `POST …/extensions/:extId/decision` | Extension request / decision |
| `GET /api/conflicts?type&areaId&start&end` | Simultaneous-operations check |
| `GET /api/cron/expire` | Expiry sweep (Bearer `CRON_SECRET`) |
| `POST /api/admin/{users\|plants\|areas\|equipment}` · `PATCH /api/admin/{users\|areas}/:id` | Master data (admin) |
| `POST /api/demo/reset` | Re-seed (admin, `DEMO_MODE=true` only) |

## Use of AI

This project was built with an AI coding assistant (Claude Code), which:
- scaffolded the project and wrote most of the code: the registry, state machine, permission rules, service layer, API and UI;
- drafted the domain content (hazards, precautions and gas limits for each permit type) from common industry practice;
- wrote and ran the unit and integration tests, attacked the API directly with illegal requests, and drove a headless browser through the main flows;
- found and fixed real bugs during that testing: a Prisma `OR: [{}]` that hid drafts from admins, and a signature pad that dropped quick strokes because of stale React state.

> **TODO before submitting:** rewrite this section in your own words. Say what *you* decided, what you checked yourself (e.g. comparing the precautions and gas limits with real PTW formats), and what you changed after reviewing the code.

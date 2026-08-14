# IMSN — Project Memory

A running log of decisions, gotchas, and state for continuity across sessions. Append
new entries at the top (newest first). Keep entries short and dated; link out to
PRD/ARCHITECTURE/RULES/DESIGN/PHASES rather than duplicating their content here.

**Standing rule (from [RULES.md](RULES.md) §7 / [FLOW.md](FLOW.md) §6): every code
change updates the relevant doc(s) in the same pass — this file for decisions/gotchas,
[PHASES.md](PHASES.md) for status, [DESIGN.md](DESIGN.md) for new
endpoints/schema/state-machine changes. Not optional, not "later."**

---

## 2026-08-14 — Completed Phase 6 (in-app notifications + audit log write-through)

Before starting, asked the user which of Phase 6's four sub-pieces to build now:
in-app notifications + audit write-through, real email (SendGrid), Socket.IO
real-time push, or Redis+BullMQ background jobs. User picked only the first
(recommended) option — the other three all need real external infra/credentials
(SendGrid key, Redis instance, a frontend worth pushing to) that this dev
environment doesn't have, so building them now would mean untestable code. All
three stay `⬜` in PHASES.md, explicitly scoped out rather than silently skipped.

Built two new modules, `modules/notifications/` and `modules/auditLogs/`, both
against Phase-1 models that had existed unused until now:
- **Notifications**: `POST`-free, self-service REST surface
  (`GET /notifications`, `/unread-count`, `PATCH /:id/read`, `POST /read-all`) —
  every route is scoped to the caller's own `recipient` id in the service layer, not
  by permission, so a wrong-owner mark-as-read returns 404 (not 403 — doesn't leak
  whether the notification exists for someone else).
- **Audit logs**: two browse routes off the same service — `GET /audit-logs`
  (admin-only, `MANAGE_SYSTEM`, global, optional `?hospitalId=` filter) and
  `GET /hospitals/:hospitalId/audit-logs` (`MANAGE_OWN_HOSPITAL`, pre-scoped to one
  hospital via `requireHospitalMatch`, for a hospital_manager to see their own
  trail). Both share `auditLogService.listAuditLogs`, which enforces "admin sees
  anything, everyone else must match their own hospital" itself as a second layer
  under the route-level checks.

**Key design decision**: both `notify()`/`notifyMany()` and `auditLogService.record()`
are deliberately best-effort — wrapped in try/catch internally, log-and-swallow on
failure, never throw. A broken audit write must never roll back or block the real
business operation it's describing (e.g. a notification insert failing shouldn't
cause an exchange-request approval to fail). Every call site in this phase awaits
them but doesn't check a return value or wrap them defensively — that's already
handled inside the two services.

**Write-through scope, chosen deliberately narrow**: only two real integration
points this phase, not "every mutation everywhere" — (1) auth (`user.service.ts`):
successful and failed `LOGIN` (inactive account, locked account, wrong password —
*not* unknown-email, to avoid audit-log spam from a common enumeration-probe
pattern), and best-effort `LOGOUT` (resolves the actor by decoding the refresh JWT,
since `logout` has no `protect`-issued `req.user`; silently skips the audit row if
the token's undecodable, since an already-expired/invalid token on logout is a
normal case, not an error); (2) the full exchange lifecycle
(`exchangeRequest.service.ts`) — every one of the six transitions (create, approve,
reject, cancel, ship, receive) now writes an `AuditLog` row and notifies whoever
needs to act next: created → recipient hospital's manager(s) (looked up via a new
`findHospitalManagers()` cross-module repo query, `role.name === "hospital_manager"`
+ hospital match), approved/rejected → the initiator's `createdBy` user, shipped →
recipient managers, cancelled → recipient managers, completed → initiator's creator.
Hospitals/branches/staff/medicine-catalog/inventory-CRUD mutations still don't write
audit rows — recorded as an intentional gap in DESIGN.md §5, not a miss.

Verified live via a foreground `ts-node` script extending the Phase 5 harness:
confirmed a real LOGIN success row and a real LOGIN failure row (wrong password)
land in `/audit-logs?action=LOGIN`; ran the full exchange lifecycle checking a
notification landed for the right recipient at every step (created/approved/
shipped/completed), confirmed unread-count and mark-read/mark-all-read behave
correctly, confirmed a wrong-owner mark-as-read 404s, confirmed the exchange
request's four audit rows (CREATE/APPROVE/UPDATE×2) show up under
`/audit-logs?resource=exchange_request`, and confirmed hospital-scoped audit
browsing correctly 403s for the other hospital's manager. All test data cleaned up
afterward, including the audit/notification rows the run generated.

## 2026-08-14 — Completed Phase 5 (exchange workflow)

Built the full request lifecycle in a new top-level module
(`modules/exchangeRequests/` + `modules/exchangeItems/repository/`), not nested under
`/hospitals/:hospitalId` like every other Phase 3/4 module — a request inherently
spans two hospitals, so route-level `requireHospitalMatch` doesn't apply; participant
authorization (`assertParticipant`/`assertInitiator`/`assertRecipient`) lives in
`exchangeRequest.service.ts` instead. See DESIGN.md §2.1/§3.2 for the full endpoint
table and state machine.

**The one real design decision made this phase**: which side is `initiatorHospital`
vs. `recipientHospital`? The model (from Phase 1) only had field names to go on.
Went with **initiator = sender** (offers stock from their own branch inventory,
reserves it at creation) and **recipient = receiver** (approves/rejects, then confirms
receipt) — "recipient" reads most naturally as "recipient of the medicine," and this
matches inventory's pre-existing `canBeUsedForExchange()`/`reserveQuantity()`/
`releaseReservation()` instance methods (Phase 1 leftovers, first actually called
here) which only make sense if the *offering* side reserves its own stock up front.
The state-machine notes already sketched in DESIGN.md §3.2 before this session
("stock reserved on the requester's side... sender ships... receiver confirms
receipt") independently confirmed this reading before any code was written.

Full lifecycle: `create` (reserve on initiator's inventory, one `ExchangeItem` per
line, each denormalizing `batchNumber`/`expiryDate` off the source `Inventory` row at
creation time) → `approve`/`reject` (recipient only, `pending` only; approve supports
per-item `quantityApproved` overrides, releasing the unapproved delta immediately
rather than waiting for shipment; all-items-rejected auto-demotes the whole request to
`rejected`) → `cancel` (initiator only, `pending`/`approved` only, releases whatever's
still reserved) → `ship` (initiator only, `approved` only — first *real* stock
movement: decrements the initiator's `quantityInStock`, clears the reservation, writes
one `exchange_sent` `InventoryTransaction` per item) → `receive` (recipient only,
`in_transit` only — tops up or creates the matching batch at the recipient's branch,
writes `exchange_received` transactions, always completes the request even on partial
receipt, since partial-ness lives at the item level via `received_partial`).

One thing the `ExchangeItem` schema didn't have: `manufacturingDate`. It denormalizes
`batchNumber`/`expiryDate` (needed for matching/display) but not manufacturing date,
which `Inventory.manufacturingDate` requires when `receive` has to create a brand-new
inventory row at the recipient (first time that batch/medicine shows up there).
Rather than add a field, `receive` just re-reads it off the original source
`Inventory` document via `item.inventory` — that row is never deleted, only its
quantities change, so the lineage pointer already stored on the item is enough.

**Also found and fixed a smaller Phase 4 gap while wiring this up**: `IInventory`
(inventery.model.ts) never declared its own instance methods
(`canBeUsedForExchange`, `reserveQuantity`, `releaseReservation`, `isExpired`,
`isExpiringSoon`, `getDaysToExpiry`) on the TypeScript interface — they existed on
the Mongoose schema (`.methods.x = ...`) since Phase 1 but were type-invisible, so
`inventory.canBeUsedForExchange()` failed to compile the moment Phase 5 code tried to
call it. Added the signatures to `IInventory`; this was silently possible until now
because nothing outside the model file had ever called these methods before.

Verified live end-to-end via a foreground `ts-node` script (two hospitals, two
branches, one medicine, one 500-unit batch) covering: full happy-path lifecycle
(create → approve → ship → receive, checked `quantityReserved`/`quantityInStock` at
every step and the new inventory row created at the recipient branch), partial
approval (60 of 100 approved, confirmed the other 40 released back to available
stock, confirmed the recipient's batch topped up by exactly 60), rejection releasing
the full reservation, cancellation releasing the full reservation, over-request
validation (400 when requesting more than `quantityAvailable`), and every wrong-actor
403 (initiator trying to approve/receive, recipient trying to ship/cancel). All test
data cleaned up afterward.

## 2026-08-12 — Completed Phase 4 (medicine catalog & inventory APIs)

Before starting, asked the user four product-scope questions and got answers (all the
recommended defaults): (1) manual entry only for now, no CSV/ERP import this phase —
those are just future bulk callers of the same service layer; (2) **change the inventory
schema to support multiple batches per medicine per branch** (uniqueness
`(hospital, branch, medicine, batchNumber)` instead of `(hospital, branch, medicine)`) —
worth doing before any real data exists; (3) when CSV import is eventually built, it
should do a **partial import** (valid rows succeed, bad ones reported back); (4) and it
should require the medicine/category/manufacturer to **already exist** in the catalog
rather than auto-creating them from row data, to keep `MANAGE_MEDICINE_CATALOG` an
admin-only boundary in practice, not just on paper. All four are recorded in
[PHASES.md](PHASES.md) Phase 4 for whoever builds the import feature later.

Built manufacturer/category/medicine CRUD (catalog reads open to any authenticated user,
writes admin-only via `MANAGE_MEDICINE_CATALOG`) and branch-scoped inventory CRUD
(`receiveStock`/`adjustStock`/update), each mutation writing a paired
`InventoryTransaction` row — the model existed since Phase 1 but this is the first code
that ever wrote to it (see DESIGN.md §1.6 for the pattern this establishes for Phase 5).
Added hospital-wide `expiring`/`low-stock` report endpoints across all of a hospital's
branches.

**Found and fixed the biggest bug yet, and it's systemic**: `middlewares/validate.ts
#validateQuery` (written in Phase 3) tried to inject Zod's parsed/coerced/defaulted
query values back onto `req.query` via `Object.assign(req.query, result.data)`. This
does not work on Express 5 — `req.query` is defined as a getter with no setter
(confirmed by reading `express/lib/request.js`) that **re-parses the raw URL string on
every single access**, so anything written onto one snapshot of it is silently thrown
away the instant anything reads `req.query` again. It "worked" by accident for every
explicit query value tested in Phase 3 (`?verified=false` etc. — the raw string survives
untouched, and loose JS arithmetic coercion papered over string-vs-number for `page`/
`limit`), which is exactly why it went undetected for an entire phase. It broke loudly
the moment Phase 4 tested a **default** value with zero query params
(`GET .../inventory/expiring` with no `?days=`): `days` came through as `undefined`,
`undefined * 86400000` is `NaN`, and `x <= NaN` is always `false`, so the endpoint
silently returned an empty array instead of erroring — the worst kind of bug, because it
looks like "no data" instead of "broken."

Fix: `validateQuery` now stores the result on a new `req.validatedQuery` property
(declared in `types/express/index.d.ts`) instead of touching `req.query` at all;
every controller built in Phase 3 *and* Phase 4 that used it (7 files — hospitals,
branches, staff, manufacturers, categories, medicines, inventory) had to switch from
`req.query as unknown as X` to `req.validatedQuery as X`. Verified live: a no-params
`expiring` request now correctly defaults to `days: 30` (a number, not a string) and
returns the seeded item; a no-params branch list correctly defaults to `page: 1, limit:
20` as numbers.

**Generalized lesson** (third bug of this shape across three sessions, after the
`select: false` soft-delete check and the `authorize.ts` model-registration issue):
**when you write a value onto a framework-provided request/response object hoping to
read it back later, verify that round-trip actually works — don't assume mutation
persists just because it doesn't throw.** Where possible, prefer a value you control
completely (a new property on `req`) over fighting a getter/setter you don't.

Also hit two small non-bugs worth noting so they're not re-investigated later: the
`inventories` collection name (Mongoose pluralizes `Inventory` → `inventories`, not
`inventory`) tripped up a cleanup script; and `low-stock` correctly returning `[]` for a
600-unit batch against a 100-unit reorder level was correct behavior, not a bug — check
the math before assuming a report endpoint is broken.

## 2026-08-12 — Completed Phase 3 (hospital/branch/staff management APIs)

Built out the full hospitals module (`register`/`list`/`get`/`update`/`verify`/
`deactivate`), branches module (nested under `/hospitals/:hospitalId/branches`, full
CRUD + `Hospital.totalBranches` denormalized counter kept in sync), and staff management
in the user module (`inviteStaff`/`listStaff`/`updateStaff` under
`/hospitals/:hospitalId/staff`, plus `PATCH /users/me` for self-service profile edits).
Each new module follows the `user` module's reference shape exactly: model → repository
→ service → controller → validator → route. Decided and documented the pagination
convention (`?page&limit` → `{ items, page, limit, total }`) since this was the first
real set of list endpoints — see DESIGN.md §2.2.

**Closed a real privilege-escalation hole**: public `POST /users/register` used to
accept an arbitrary `role` (including `admin`) from the client — fine when it was a
generic scaffold with no hospital flow to hook into, not fine now. Tightened it to only
ever create the first Hospital Manager for an already-verified hospital with no existing
manager (`userRepository.countByHospitalAndRole`); pharmacist/viewer creation moved
entirely to the new invite-only staff endpoint, which forces hospital+role server-side
instead of trusting the request body. Admin accounts remain uncreatable via any HTTP
endpoint, by design — see DESIGN.md §1.5 and the "Admin provisioning" open question in
§5 for the follow-up (a seed script would help dev/staging setup).

**Two more real bugs found by testing, not by typecheck:**

1. `middlewares/authMiddleware.ts#protect` fetched the user via `User.findById(...)` and
   then checked `user.deletedAt` on the result — but `deletedAt` is `select: false` on
   the schema, so that check silently always read `undefined`, meaning the soft-delete
   guard had never actually worked since it was written. Fixed by switching `protect` to
   `userRepository.findActiveById`, which filters `{ isActive: true, deletedAt: null }`
   in the query itself (filters aren't affected by field-level `select`, only the
   returned document's projection is). **Lesson, generalized: never read a
   `select: false` field off a fetched document — put the condition in the query filter
   instead**, the same class of bug as the `authorize.ts` model-registration issue from
   the previous session.
2. `branches.model.ts`'s pre-save hook validated operating hours via
   `Object.values(this.operatingHours).forEach(validateDay)` — on a live Mongoose
   subdocument this doesn't yield just the 7 day objects, it also walks internal Mongoose
   instance properties, so `validateDay` eventually got called with something that
   wasn't a day object and crashed on `day.open.replace(...)`. This had never been caught
   because **no branch had ever actually been created before this session** — the model
   existed since Phase 1 but nothing exercised its save path until Phase 3 built the
   first branch-creation endpoint. Fixed by iterating an explicit `DAY_NAMES` tuple
   instead of `Object.values()`. **Lesson: a model with no service/route on top of it is
   unverified — "it typechecks" says nothing about whether its Mongoose hooks actually
   run correctly**, which is exactly why PHASES.md tracks "modeled" and "has a working
   API" as separate checkboxes.

**Debugging technique note for future sessions**: backgrounding the dev server via
`npm run dev > file.log 2>&1 &` in this environment (Git Bash on Windows) buffers
stdout unpredictably — `console.log`/morgan output can be delayed by many seconds or
only flush on the next file-watcher restart, even though the HTTP responses themselves
arrive immediately and correctly. Don't trust "the log is empty" as "nothing happened."
When you need to see server-side output synchronously (e.g. a stubbed email's token, or
an exception's real stack trace instead of a generic 500), write a small throwaway
`tmp-*.ts` script that imports and calls the service function directly under
`npx ts-node --transpile-only` in the foreground — that output is reliable. Delete the
scratch file afterward; several were used and removed this session.

## 2026-08-12 — Completed Phases 0/1/2 (remaining models + full RBAC + verification/reset)

Filled in every model PHASES.md had flagged missing for Phase 1: `Permission`
(`resource`/`action`/`scope` shape), `Notification`, `AuditLog` (immutable, 7-year
default retention), `ExchangeRequest`/`ExchangeItem` (full status machines — see
DESIGN.md §3.2). These are models only — no service/routes yet, that's still Phase 5/6.
One deliberate deviation from the DB design doc: `ExchangeRequest.requestNumber` uses
this project's generic `generateSequentialId` convention (`EXR-000001`) instead of the
doc's illustrative `ER-HOSP-2024-001` format, for consistency with every other model —
flagged as an open question in DESIGN.md §5 in case the hospital+year format actually
matters for print/paper workflows later.

Completed the remaining Phase 2 items:
- **RBAC**: `constants/permissions.ts` (10 curated permission names) +
  `seed/permissions.seed.ts` (creates them) + `seed/roles.seed.ts` (now assigns them per
  role, kept in sync on every boot — order matters, permissions must seed before roles)
  + `middlewares/authorize.ts` (checks role → permission). Verified live: fetched all 4
  seeded roles' resolved permission names from Mongo, matched expectations exactly.
- **Hospital scoping**: `middlewares/hospitalScope.ts#requireHospitalMatch` (route-param
  based) + `utils/authorization.ts#assertSameHospital` (service-layer, resource-based).
  Neither is attached to a real route yet since no hospital-scoped routes exist until
  Phase 3 — see DESIGN.md §1.4 for why scope enforcement is deliberately kept separate
  from `authorize()`.
- **Email verification** and **password reset**: full flow (token issuance, hashed
  storage, expiry, single-use consumption), wired into `register()` and four new
  endpoints. `utils/mails.ts#sendMail` is a console-log stub (no SendGrid yet — Phase 6)
  but every caller already goes through it, so swapping providers later touches one file.
  Verified live end-to-end including old-password-rejected / new-password-accepted after
  reset, and that reset revokes existing refresh tokens.

**Real bug caught by testing, not by typecheck**: `middlewares/authorize.ts` initially
imported `IPermission` as a type-only import from the `Permission` model file. Since
nothing else in a hypothetical minimal import chain would register that Mongoose model,
`.populate("permissions")` failed at runtime with "Schema hasn't been registered for
model Permission" — but only in isolation; the real running server always works because
`server.ts` imports `seedPermissions` (which imports `Permission` as a *value*) before
anything else. Reproduced the failure with a standalone script that imported only
`authorize.ts`, then fixed it by adding an explicit side-effect import of the Permission
model file in `authorize.ts` itself, so it's no longer accidentally dependent on load
order elsewhere. **Lesson: if a middleware/service relies on a Mongoose model only being
"populated" via `ref`, explicitly import that model's file for its registration
side-effect — don't rely on some other module having imported it first.** `npx tsc
--noEmit` did not and would not have caught this (it's a runtime registration issue, not
a type error).

## 2026-08-12 — Added FLOW.md; made doc updates a binding rule

Added [FLOW.md](FLOW.md) (prerequisites, first-time setup, boot sequence walkthrough of
`server.ts`, a runnable end-to-end `curl` flow against the current auth endpoints,
everyday dev loop, troubleshooting). Linked it from `PROJECT.md`'s index. Strengthened
[RULES.md](RULES.md) §7 from "update PHASES/MEMORY if you did X" to an explicit standing
rule: doc updates happen in the same change as the code, not afterward.

## 2026-08-10 — Sequential IDs added to all core models

Added a shared `generateSequentialId(sequenceName, prefix, padLength)` helper
(`modules/counter/service/counter.service.ts`) on top of the existing `Counter`
collection (which was untyped — gave it an `ICounter` interface). Applied it to `User`,
`Hospital`, `Branch`, `Manufacturer`, `MedicineCategory`, `Inventory`,
`InventoryTransaction` (mirroring the pattern `Medicine` already had), and refactored
`Medicine` itself to use the shared helper instead of inline `Counter` calls.

**Gotcha**: new ID fields are `sparse: true` (not just `unique: true`) — a plain unique
index would break if more than one existing document lacks the field. Since these are
new fields on models that may already have documents, sparse is the safe default; keep
doing this for any future sequential-ID field.

Verified live: two back-to-back registrations produced `USR-000001` then `USR-000002`.
See [ARCHITECTURE.md](ARCHITECTURE.md) §5 and [RULES.md](RULES.md) §2.

## 2026-08-10 — Repository layer added under `modules/user/`

Split `modules/user/service/user.service.ts` so it no longer touches `User`,
`RefreshToken`, or `Role` Mongoose models directly — added
`repository/{user,refreshToken,role}.repository.ts` and routed all queries through
them. This is now the reference shape for every future module (see
[ARCHITECTURE.md](ARCHITECTURE.md) §2 and [RULES.md](RULES.md) §1).

## 2026-08-06 — Login/signup implemented under the `user` module (not `auth`)

Initially scaffolded under a separate `auth` module (matching the pre-existing empty
`modules/auth/*` files), but the user explicitly asked to consolidate under `modules/user/`
instead. The `auth` module folder has since been deleted from the repo — **don't
recreate it**; all identity/auth logic belongs in `modules/user/`.

Built out: `validate` + `protect` middleware, `AppError` + global `errorHandler`, JWT
utils, hashed-refresh-token storage with rotation, account lockout, system-role seeding
on boot (`seed/roles.seed.ts`), and wired `connectDB`/`dotenv` into `server.ts` (neither
existed before — `db.config.ts` was a one-line placeholder comment and `.env` had only
`MONGO_URI`).

**Gotchas hit along the way**:
- `jsonwebtoken@9` types want `SignOptions["expiresIn"]`, not a bare `string` — cast env
  values with `as SignOptions["expiresIn"]` (see `utils/jwt.ts`).
- Several existing models (`User`, `Role`) declare `schema.statics.foo` /
  `schema.methods.foo` that are **not** reflected in their exported `IEntity` interface
  (e.g. `User.incrementLoginAttempts`, `Role.findByName`). Calling them from application
  code fails to typecheck even though they exist at runtime. Workaround used throughout:
  query the model directly / inline the logic rather than relying on those undeclared
  members. If you need one of these, declare it properly on the interface first.
- Mongoose logs "duplicate schema index" warnings on boot for several models (fields
  declared with both `index: true` inline *and* a separate `schema.index()` call) —
  pre-existing, harmless, not yet cleaned up. Low-priority tech debt.
- `.env` is in `.gitignore` going forward but was already tracked in git before the
  rule was added (`git ls-files` shows `backend/.env`). Editing it is fine/expected; just
  don't add real secrets to it since it's still tracked.
- Naming convention for env vars is `JWT_SECRET` / `JWT_REFRESH_SECRET` /
  `ACCESS_TOKEN_EXPIRY` / `REFRESH_TOKEN_EXPIRY` (from the pre-existing `.env.example`) —
  not `JWT_ACCESS_SECRET` as first guessed. Match `.env.example` naming for any new var.
- Express 5 forwards rejected async-handler promises to the error middleware
  automatically — no `catchAsync` wrapper needed, unlike Express 4 codebases.

## 2026-08-06 — Project documentation established

Created `PROJECT.md` at repo root by digesting the original product-overview PDF
(problem statement, architecture, roles/permissions, hospital onboarding flow, tech
stack). Later split into the current doc set (`PRD.md`, `ARCHITECTURE.md`, `RULES.md`,
`PHASES.md`, `DESIGN.md`, this file) so each concern has one home; `PROJECT.md` is now a
short index pointing to these plus `Docs/`.

Pre-existing at that point: `Docs/Database/` (full DB design, ER diagram, validation
rules for 15 planned collections — authoritative schema reference) and
`Docs/Product-Requirements/PRD.md.txt` (empty).

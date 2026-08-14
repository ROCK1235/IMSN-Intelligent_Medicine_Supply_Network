# IMSN — Development Phases

Tracks what's actually built vs. planned. Update the checkboxes as work lands — this is
the file to check before assuming something exists. Cross-reference
[PRD.md](PRD.md) for *what* each phase delivers and [ARCHITECTURE.md](ARCHITECTURE.md)
for *how*.

Legend: ✅ done · 🚧 partial · ⬜ not started

## Phase 0 — Foundations
- ✅ Database design docs (`Docs/Database/` — schema, ER diagram, validation rules for
  all 15 planned collections)
- ✅ Backend project scaffold (Express 5 + TypeScript, `tsconfig`, dev scripts)
- ✅ Project documentation set (this file + PRD/ARCHITECTURE/RULES/DESIGN/MEMORY)

## Phase 1 — Core data models
- ✅ `User`, `RefreshToken`, `Role` — implemented, with validation and indexes
- ✅ `Hospital`, `Branch` — implemented
- ✅ `Manufacturer`, `MedicineCategory`, `Medicine` — implemented
- ✅ `Inventory`, `InventoryTransaction` — implemented
- ✅ `Counter` (+ `generateSequentialId` service) — implemented, used by all of the above
- ✅ `Permission` — implemented (name/resource/action/scope), seeded via `seed/permissions.seed.ts`
- ✅ `ExchangeRequest`, `ExchangeItem` — modeled (status machines, validation, sequential
  `requestNumber`) — **no service/routes yet, that's still Phase 5**
- ✅ `Notification` — modeled (channels, delivery status, TTL) — **no write-through/API
  yet, that's still Phase 6**
- ✅ `AuditLog` — modeled (immutable, 7-year retention default) — **no write-through from
  services yet, that's still Phase 6**

## Phase 2 — Identity & access
- ✅ Register / login / refresh (rotated) / logout, under `modules/user/`
- ✅ Password hashing, account lockout (5 attempts / 15 min)
- ✅ `protect` middleware (access-token auth), global error handling, request validation
- ✅ System roles auto-seeded on server start (`admin`, `hospital_manager`, `pharmacist`, `viewer`)
- ✅ Role/permission-based authorization middleware (`middlewares/authorize.ts`) — checks
  the caller's role against a seeded, data-driven permission set
  (`constants/permissions.ts` + `seed/permissions.seed.ts`); now attached to every
  hospital/branch/staff mutation route (Phase 3)
- ✅ Hospital-scoping enforcement, as both a route middleware
  (`middlewares/hospitalScope.ts#requireHospitalMatch`) and a service-layer helper
  (`utils/authorization.ts#assertSameHospital`) — now in real use throughout Phase 3;
  verified live that a pharmacist gets 403 on another hospital's data while admin does not
- ✅ Email verification flow — `POST /users/verify-email`, `POST /users/resend-verification`;
  register now sends a (stubbed) verification email
- ✅ Password reset flow — `POST /users/forgot-password`, `POST /users/reset-password`;
  resetting revokes all of the user's existing refresh tokens
- 🚧 Email delivery — `utils/mails.ts#sendMail` currently just logs to console (no
  SendGrid/SES wired up — see Phase 6); the verification/reset *flows* are fully
  functional, only real delivery is stubbed

## Phase 3 — Hospital & staff management APIs
- ✅ Public hospital registration endpoint (`POST /hospitals/register`)
- ✅ Admin hospital verification/deactivation endpoints (`POST /hospitals/:id/verify`,
  `.../deactivate`), plus list (`GET /hospitals`) and get/update
  (`GET|PATCH /hospitals/:id`)
- ✅ Branch CRUD (`/hospitals/:hospitalId/branches`) — create/list/get/update/deactivate
- ✅ Staff invite flow (`/hospitals/:hospitalId/staff`) — Hospital Manager invites
  Pharmacist/Viewer; invitee sets their own password via the existing
  reset-password machinery (no bespoke invite-token type)
- ✅ Own-profile update (`PATCH /users/me`)
- ✅ Public self-registration (`POST /users/register`) tightened: it now only ever
  creates the first Hospital Manager for an already-verified hospital with no existing
  manager — it can no longer mint an admin/pharmacist/viewer account (see MEMORY.md, a
  real privilege-escalation gap this closed)
- 🚧 General user CRUD beyond staff-within-a-hospital (e.g. a global admin user list
  across all hospitals) — not built; admin can still reach any hospital's staff list via
  the hospital-scoped endpoint since `requireHospitalMatch`/`assertSameHospital` exempt
  admins

## Phase 4 — Medicine catalog & inventory APIs
- ✅ Manufacturer / MedicineCategory / Medicine CRUD (`/manufacturers`,
  `/medicine-categories`, `/medicines`) — reads open to any authenticated user, writes
  gated by `MANAGE_MEDICINE_CATALOG` (admin only, per PRD)
- ✅ Multi-batch inventory (decided this phase): `Inventory` uniqueness changed from
  `(hospital, branch, medicine)` to `(hospital, branch, medicine, batchNumber)` — a
  branch can now hold several batches of the same medicine with different expiry dates
- ✅ Inventory CRUD, branch-scoped (`/hospitals/:hospitalId/branches/:branchId/inventory`):
  receive stock (creates a new batch, or tops up an existing one if the batch number
  already exists for that medicine at that branch — verified live), stock-out/adjustment
  (`POST .../inventory/:id/adjust`), update (storage location / stock-check fields)
- ✅ Every stock change writes an immutable `InventoryTransaction` row
  (quantityBefore/After, reason, performedBy) — this model existed since Phase 1 but
  had never actually been written to until now
- ✅ Hospital-wide expiry (`GET /hospitals/:hospitalId/inventory/expiring?days=30`) and
  low-stock (`.../inventory/low-stock`, compares `quantityAvailable` to each medicine's
  `reorderLevel`) query endpoints, across all of a hospital's branches
- 🚧 Manual entry only, by design (see the Phase 4 kickoff decision in MEMORY.md) — CSV
  import and an ERP bulk-import endpoint are deferred; when built, they should call
  `inventory.service.ts#receiveStock` per row rather than duplicating its logic, and
  should do a **partial import** (valid rows succeed, invalid ones reported back) against
  a catalog that **must already contain** the referenced medicine (no auto-creating
  medicines/categories/manufacturers from import data) — both decided now for later

## Phase 5 — Exchange workflow (core product loop)
- ✅ `ExchangeRequest` / `ExchangeItem` models (Phase 1)
- ✅ Create request (`POST /exchange-requests`) — initiator (sender) picks specific
  batches from their own branch inventory to offer; validates batch ownership,
  medicine match, `canBeUsedForExchange()` (not expired/expiring-soon/out of stock),
  and quantity ≤ available; reserves stock (`quantityReserved`) on the initiator's
  inventory rows at creation time — no stock movement yet, only a hold
- ✅ Approve / reject / partial-approve (`POST /:id/approve`, `POST /:id/reject`) —
  only the **recipient** hospital can call these, only while `pending`; approve
  supports per-item `quantityApproved` overrides (releases the unapproved delta back
  to available stock); an item with `quantityApproved: 0` requires a reason and is
  marked `rejected`; if every item is rejected the whole request auto-rejects
- ✅ Cancel (`POST /:id/cancel`) — only the **initiator**, only while
  `pending`/`approved`, releases any outstanding reservation
- ✅ Mark shipped (`POST /:id/ship`, initiator only, only from `approved`) — this is
  where the initiator's stock actually leaves: `quantityInStock` decreases,
  reservation clears, an `exchange_sent` `InventoryTransaction` is written per item
- ✅ Mark received (`POST /:id/receive`, recipient only, only from `in_transit`) —
  creates or tops up the matching batch at the recipient's branch, writes an
  `exchange_received` `InventoryTransaction` per item, supports partial
  `quantityReceived` (item status `received` vs `received_partial`); always
  completes the request (single-shot receive, not staged) — see DESIGN.md §3.2
- ✅ List/get with participant scoping (`GET /exchange-requests?direction=sent|received&status=`,
  `GET /exchange-requests/:id`) — either hospital in the exchange can see it, third
  parties get 403; admin must pass `?hospitalId=` since they have no home hospital
- 🚧 No "discover available stock across hospitals" browse endpoint yet — the
  initiator currently needs to already know the recipient hospital/branch and the
  specific `inventoryId` they want (e.g. from an out-of-band conversation or a
  future catalog-search feature); nothing here blocks adding that later

## Phase 6 — Notifications, audit, real-time
Scoped down before starting (see MEMORY.md): only the in-app notifications + audit
write-through piece needs no external infra, so that's what got built. Real email
(SendGrid), SMS (Twilio), Socket.IO push, and Redis+BullMQ background jobs are all
deliberately deferred — none of them work without credentials/infra this environment
doesn't have configured, and none of them block anything else.
- ✅ `Notification` model (Phase 1)
- ✅ `AuditLog` model (Phase 1)
- ✅ In-app notification endpoints (`/notifications`) — list (`?isRead=`), unread
  count, mark-one-read, mark-all-read; every route is implicitly scoped to the
  caller's own notifications (ownership checked in the service, not by permission)
- ✅ Audit log browse endpoints — `GET /audit-logs` (admin only, global, optional
  `?hospitalId=`/`?resource=`/`?action=`/`?actor=`/`?from=`/`?to=` filters) and
  `GET /hospitals/:hospitalId/audit-logs` (hospital_manager, pre-scoped to their own
  hospital)
- ✅ Write-through wired into two real call sites: **auth** (`user.service.ts` —
  successful/failed `LOGIN`, best-effort `LOGOUT`) and the **exchange lifecycle**
  (`exchangeRequest.service.ts` — every transition writes an `AuditLog` row and
  notifies the relevant hospital's manager(s)/creator: created → recipient managers,
  approved/rejected → initiator's creator, shipped → recipient managers, cancelled →
  recipient managers, completed → initiator's creator)
- 🚧 Write-through intentionally **not** added to every other module (hospitals,
  branches, staff, medicine catalog, inventory CRUD) this pass — the exchange
  workflow was the highest-value real example to prove the pattern out; extending it
  to every mutation elsewhere is now a mechanical follow-up, not a design question
- ⬜ Socket.IO integration for real-time push — deferred, needs a frontend
  (Phase 7 hasn't started) to be worth building against
- ⬜ Redis + BullMQ for background jobs (expiry cron, low-stock cron, email/SMS
  delivery) — deferred, needs a Redis instance this environment doesn't have
- ⬜ Real email (SendGrid) / SMS (Twilio) integration — replaces the `utils/mails.ts`
  console-log stub introduced in Phase 2 — deferred, needs provider credentials

## Phase 7 — Frontend
- ⬜ Web admin portal (React or Angular — not yet decided/started)
- ⬜ Mobile app (React Native)

## Phase 8 — Hardening & deployment
- ⬜ Automated tests (no test framework configured yet — Jest/Supertest planned)
- ⬜ CI/CD (GitHub Actions)
- ⬜ Rate limiting middleware (`express-rate-limit` not yet a dependency)
- ⬜ Production infra (MongoDB Atlas, Redis, S3, ECS/Fargate — see ARCHITECTURE.md §8)
- ⬜ Load testing against the stated performance targets (PRD §8)

## What to build next

Phases 0–6 (the in-app slice of Phase 6) are now done (see MEMORY.md). Given the
above, the highest-leverage next steps are, roughly in order:
1. CSV/ERP bulk import for inventory (deferred from Phase 4, decisions already made —
   see Phase 4 above).
2. A "discover available stock" browse/search endpoint — today an exchange initiator
   must already know the recipient hospital, branch, and exact `inventoryId` they
   want (see Phase 5 note); a cross-hospital inventory search would remove that
   friction and pairs naturally with the notification infrastructure that now exists
   to tell a hospital "someone might want your surplus."
3. Extend the audit/notification write-through pattern established in Phase 6 to the
   other mutating modules (hospitals, branches, staff, medicine catalog, inventory
   CRUD) — mechanical now that the pattern (service calls `auditLogService.record()`
   / `notificationService.notify()`, never lets a failure block the real operation)
   is proven out.
4. The infra-heavy rest of Phase 6, once the infra exists: real email (SendGrid) /
   SMS (Twilio) delivery, Redis + BullMQ background jobs (expiry/low-stock crons),
   Socket.IO real-time push (most useful once Phase 7's frontend exists to receive it).
5. Known gaps worth closing opportunistically: no admin account is creatable via the API
   by design (see Phase 3 note) — consider a `scripts/seed-admin.ts` CLI script rather
   than a public endpoint, so dev/staging setup doesn't require raw Mongo surgery like
   every session's testing has so far. Also: `VIEW_INVENTORY`/`VIEW_REPORTS` are
   currently the only "read" permissions and branches/staff reads bypass permission
   checks entirely (any staff of the hospital can read) — revisit if a role ever needs a
   real "can this role view X" answer instead of "is this role in this hospital."

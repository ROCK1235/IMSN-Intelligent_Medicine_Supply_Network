# IMSN — System & Domain Design

Detailed design decisions: data model, API conventions, and the state machines that
govern the core workflows. Companion to [ARCHITECTURE.md](ARCHITECTURE.md) (system
shape) and [RULES.md](RULES.md) (how we write the code that implements this).

## 1. Data model

Full schema reference lives in `Docs/Database/Complete Documentation Index/` (ER diagram,
field-by-field validation rules). Summary of the 15 designed collections and their
current implementation status (see [PHASES.md](PHASES.md) for the authoritative list):

```
IAM              Roles, Permissions, Users, RefreshTokens
Catalog          Manufacturers, MedicineCategories, Medicines
Org              Hospitals, Branches
Stock            Inventory, InventoryTransactions
Exchange*        ExchangeRequests, ExchangeItems
Ops*             Notifications, AuditLogs
```
All 15 collections are modeled as of Phase 1. `*` = modeled, but no service/API built on
top of it yet — see [PHASES.md](PHASES.md) Phase 5 (Exchange) / Phase 6 (Ops) for status.

### 1.1 Sequential IDs
Every core entity has both a Mongo `_id` (used for references/joins) and a human-
readable sequential ID (used in UI, logs, and support conversations) — e.g.
`hospitalId: "HOS-000001"`. See [ARCHITECTURE.md](ARCHITECTURE.md) §5 for the generation
mechanism. Rule of thumb: **references between documents always use `_id`**; the
sequential ID is a display/lookup convenience, never a foreign key.

### 1.2 Inventory quantity model
```
quantityAvailable = quantityInStock - quantityReserved
```
- `quantityReserved` increases when an exchange request is created against that
  inventory row, and decreases when the exchange completes or is cancelled.
- `status` is derived, not set directly by callers: `expired` if `expiryDate <= now`,
  `expiring_soon` if within 30 days, else `active` (see `Inventory`'s pre-save hook).
- A medicine within 15 days of expiry is excluded from being exchange-eligible
  (`canBeUsedForExchange()`), even though it may still show as `expiring_soon` up to 30
  days out — the 15-day cutoff is specifically about *initiating a new exchange*, not
  about display/alerting.

### 1.3 Hospital/branch/user scoping
- `Branch.hospital` → must reference an active `Hospital`.
- `User.hospital` (optional — System Admin has none) and `User.branch` (optional —
  only meaningful for Pharmacists) — `branch`, if set, must belong to `hospital` (enforced
  in the `User` schema's validator).
- `Inventory` is keyed by the compound unique index `(hospital, branch, medicine,
  batchNumber)` (changed in Phase 4 — was `(hospital, branch, medicine)` before, which
  only allowed one active batch of a given medicine per branch). A branch can now hold
  several batches of the same medicine, each with its own expiry date, matching how
  pharmacies actually receive stock. `inventory.service.ts#receiveStock` reflects this:
  if a batch number already exists for that medicine at that branch, it tops up the
  existing row (verified live) instead of erroring on the unique index; otherwise it
  creates a new row.

### 1.4 RBAC / permission model
- `Permission` documents are flat: `{ name, description, resource, action, scope }`.
  `scope` (`own` / `own_hospital` / `all`) is **descriptive metadata only right now** —
  `middlewares/authorize.ts` checks "does the caller's role have a permission with this
  name at all," it does not evaluate `scope`. Actual scoping (e.g. "only within my own
  hospital") is a separate, orthogonal check via `middlewares/hospitalScope.ts` /
  `utils/authorization.ts#assertSameHospital`. Keeping these independent means a route
  composes both (`authorize(X), requireHospitalMatch()`) rather than one middleware
  trying to do both jobs.
- The permission set is small and curated (`constants/permissions.ts`), not a 1:1 mirror
  of every possible resource/action pair — add new permission names as real routes need
  them, don't pre-build a large matrix speculatively.
- Roles → permissions are seeded and kept in sync on every boot
  (`seed/permissions.seed.ts` → `seed/roles.seed.ts`, in that order — permissions must
  exist before roles reference them). Changing a role's capabilities means editing
  `DEFAULT_ROLES` in `roles.seed.ts`, not a manual DB migration.
- **Composition pattern (proven in Phase 3, resolves the §5 open question this used to
  be)**: mutation routes chain `protect, authorize(PERMISSIONS.X), requireHospitalMatch("hospitalId")`.
  This works because System Admin is seeded with *every* permission
  (`Object.values(PERMISSIONS)` in `roles.seed.ts`) while `requireHospitalMatch`
  independently exempts admins from the hospital check — so admin passes both, a
  hospital_manager with the permission passes only for their own hospital, and a
  pharmacist/viewer without the permission never gets past `authorize()` at all.
  Branch list/get deliberately skip `authorize()` (any staff member of the hospital can
  view branches, not just managers) and use only `requireHospitalMatch`; staff list/get
  requires `MANAGE_USERS` on top, since a staff directory is more sensitive than a
  branch list — no permission granular enough for "can view but not manage" exists yet,
  add one if that distinction is ever needed elsewhere.

### 1.5 Account provisioning — who can create which kind of account
- **Admin**: not creatable through the HTTP API at all, by design (no endpoint,
  anywhere). Provisioned out-of-band (direct DB insert / a future CLI seed script — see
  PHASES.md "What to build next"). This is a deliberate security boundary: platform-
  operator access should never be self-service.
- **Hospital Manager**: exactly one per hospital, created via public
  `POST /users/register`, which only succeeds if the target hospital is verified,
  active, and has no manager yet (`userRepository.countByHospitalAndRole`). This is
  intentionally the *only* thing public registration can do — earlier in the project
  `register()` accepted an arbitrary `role` from the client (including `admin`), which
  was a real privilege-escalation hole closed once the hospital flow existed to replace
  it with (see MEMORY.md).
- **Pharmacist / Viewer**: invite-only, via `POST /hospitals/:hospitalId/staff`
  (`staff.service.ts#inviteStaff`). The caller's hospital and the target role are both
  forced server-side — the request body cannot specify a hospital, and the role enum is
  restricted to `pharmacist`/`viewer` (a different, narrower Zod schema than the one
  `register()` used to accept). The invitee never sees a server-chosen password: one is
  generated and immediately discarded behind a password-reset token emailed to them, and
  `isEmailVerified` is set `true` at creation (being invited by a trusted manager to a
  known address stands in for the usual click-to-verify step).

### 1.6 InventoryTransaction write pattern (established in Phase 4)
Every mutation to `Inventory.quantityInStock` — receiving stock, stock-out, adjustment —
writes one `InventoryTransaction` row in the same service call, computed as
`quantityAfter = quantityBefore + quantity` (positive `quantity` for stock in, negative
for stock out/adjustment; this matches the model's own validator, which rejects a
mismatch). `cost` on both the `Inventory` row and the transaction is computed
server-side as `quantityInStock * medicine.unitCost` — callers only ever send a
quantity, never a cost. This is the pattern any future inventory-affecting flow
(exchange fulfillment in Phase 5, CSV import) should follow rather than mutating
`Inventory.quantityInStock` directly without a paired transaction row.

## 2. API design conventions

- Base path: `/api/v1`. Each module mounts under its own segment (`/api/v1/users`, and
  future `/api/v1/hospitals`, `/api/v1/exchanges`, etc.).
- REST-ish, resource-oriented, but auth-flow endpoints are verb-named where REST nouns
  don't fit naturally (`POST /users/login`, not a `PUT` on some resource) — this is an
  intentional, accepted deviation for the auth module specifically.
- All responses: `{ success: boolean, message?: string, data?: T }`. Errors: same
  envelope, `success: false`, no `data`.

### 2.2 Pagination convention (decided in Phase 3)
List endpoints take `?page=1&limit=20` query params (1-indexed, `limit` capped at 100)
and respond with `data: { <items>, page, limit, total }` — e.g.
`{ hospitals, page, limit, total }`, `{ branches, ... }`, `{ staff, ... }`. No
cursor-based pagination yet; revisit only if a collection's page-based `skip()` becomes
a real performance problem.

Validated/coerced/defaulted via `middlewares/validate.ts#validateQuery`, which stores
the result on **`req.validatedQuery`**, not `req.query` — controllers must read
`req.validatedQuery as InferredType`. This isn't a style preference: Express 5's
`req.query` is a getter with no setter that re-parses the raw URL string on every
access (confirmed by reading `express/lib/request.js`), so anything written back onto
it — even via `Object.assign(req.query, ...)` on a live object reference — is silently
discarded the next time anything reads `req.query`. The first version of
`validateQuery` did exactly that and shipped in Phase 3; it "worked" by accident for
explicit query values (JS coerces `"60" * 86400000` fine) but silently broke every
*default* (`?` with no params at all → `days`/`page`/`limit` came through as
`undefined`, not the schema's declared default). Caught in Phase 4 when a no-params
expiring-inventory request returned empty instead of the seeded item. Full story and
the general lesson (don't trust a framework object to hold state you wrote to it — verify
it actually persists across reads) in MEMORY.md.

### 2.1 Implemented endpoints

**Identity (Phase 2)**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/users/register` | none | Hospital-manager self-registration for a verified hospital with no manager yet (see §1.5) |
| POST | `/api/v1/users/login` | none | Authenticate, returns access token + sets refresh cookie |
| POST | `/api/v1/users/refresh-token` | refresh cookie/body | Rotate refresh token, issue new access token |
| POST | `/api/v1/users/logout` | refresh cookie/body | Revoke refresh token |
| GET | `/api/v1/users/me` | access token | Return the caller's minimal identity |
| PATCH | `/api/v1/users/me` | access token | Update own firstName/lastName/phoneNumber |
| POST | `/api/v1/users/verify-email` | none (token in body) | Consume an email verification token |
| POST | `/api/v1/users/resend-verification` | none | Re-send verification email if unverified (silently no-ops otherwise) |
| POST | `/api/v1/users/forgot-password` | none | Issue a password reset token by email (always 200, avoids account enumeration) |
| POST | `/api/v1/users/reset-password` | none (token in body) | Consume reset token, set new password, revoke all refresh tokens |

**Hospitals & branches (Phase 3)**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/hospitals/register` | none | Public hospital self-registration (`isVerified: false`) |
| GET | `/api/v1/hospitals` | any authenticated user | Paginated list — admins get the raw `?verified=` filter (including unverified, for the verification workflow); everyone else always sees verified+active only, regardless of query params (opened in Phase 7 so an exchange initiator can pick a recipient hospital — see §5) |
| GET | `/api/v1/hospitals/:hospitalId` | any authenticated user | Hospital profile (not hospital-scoped — see §1.3 note on why) |
| PATCH | `/api/v1/hospitals/:hospitalId` | `MANAGE_OWN_HOSPITAL` + same hospital | Update operational fields (not name/registration/license/tax id — those are immutable post-registration) |
| POST | `/api/v1/hospitals/:hospitalId/verify` | `MANAGE_HOSPITALS` (admin) | Set `isVerified: true` |
| POST | `/api/v1/hospitals/:hospitalId/deactivate` | `MANAGE_HOSPITALS` (admin) | Set `isActive: false` |
| GET | `/api/v1/hospitals/:hospitalId/branches` | any authenticated user | Paginated list — opened cross-hospital in Phase 7 for the same reason as hospital list (§5); branch name/address isn't sensitive |
| GET | `/api/v1/hospitals/:hospitalId/branches/:branchId` | any authenticated user | Branch detail |
| POST | `/api/v1/hospitals/:hospitalId/branches` | `MANAGE_OWN_HOSPITAL` + same hospital | Create; increments `Hospital.totalBranches` |
| PATCH | `/api/v1/hospitals/:hospitalId/branches/:branchId` | `MANAGE_OWN_HOSPITAL` + same hospital | Update |
| POST | `/api/v1/hospitals/:hospitalId/branches/:branchId/deactivate` | `MANAGE_OWN_HOSPITAL` + same hospital | Set `isActive: false`; decrements `totalBranches` |

**Staff (Phase 3)**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/hospitals/:hospitalId/staff` | `MANAGE_USERS` + same hospital | Invite a pharmacist/viewer; sends a password-setup token (reuses reset-password) |
| GET | `/api/v1/hospitals/:hospitalId/staff` | `MANAGE_USERS` + same hospital | Paginated list |
| PATCH | `/api/v1/hospitals/:hospitalId/staff/:userId` | `MANAGE_USERS` + same hospital | Change role (pharmacist↔viewer)/branch/isActive; cannot target managers or admins |

**Medicine catalog (Phase 4)** — reads open to any authenticated user (needed to browse
when creating inventory/exchanges), writes gated by `MANAGE_MEDICINE_CATALOG` (admin only)

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/v1/manufacturers` | list (paginated, `?active=`) / create |
| GET / PATCH | `/api/v1/manufacturers/:manufacturerId` | detail / update |
| POST | `/api/v1/manufacturers/:manufacturerId/deactivate` | set `isActive: false` |
| GET / POST | `/api/v1/medicine-categories` | list (`?active=`, `?rootOnly=`) / create |
| GET / PATCH | `/api/v1/medicine-categories/:categoryId` | detail / update (incl. re-parenting) |
| POST | `/api/v1/medicine-categories/:categoryId/deactivate` | set `isActive: false` |
| GET / POST | `/api/v1/medicines` | list (`?active=`, `?category=`, `?manufacturer=`, `?search=` on name/genericName) / create |
| GET / PATCH | `/api/v1/medicines/:medicineId` | detail / update |
| POST | `/api/v1/medicines/:medicineId/discontinue` | set `isActive: false` (schema auto-stamps `discontinuedDate`) |

**Inventory (Phase 4)** — reads need `VIEW_INVENTORY`, writes need `MANAGE_INVENTORY`,
both combined with `requireHospitalMatch("hospitalId")` (admin exempt from the latter)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/hospitals/:hospitalId/branches/:branchId/inventory` | Paginated list (`?status=`, `?medicine=`), medicine populated |
| GET | `.../inventory/:inventoryId` | Detail |
| POST | `.../inventory` | Receive stock — new batch, or top up if `batchNumber` already exists for that medicine (§1.3) |
| POST | `.../inventory/:inventoryId/adjust` | `{ type: stock_in\|stock_out\|adjustment, quantity, reason }` — reason required unless `stock_in`; writes an `InventoryTransaction` (§1.6) |
| PATCH | `.../inventory/:inventoryId` | Update `storageLocation`/stock-check fields only (not quantities — use `/adjust`) |
| GET | `/api/v1/hospitals/:hospitalId/inventory/expiring?days=30` | Hospital-wide (all branches), unpaginated |
| GET | `/api/v1/hospitals/:hospitalId/inventory/low-stock` | Hospital-wide, `quantityAvailable <= medicine.reorderLevel`, unpaginated |

**Exchange requests (Phase 5)** — top-level (`/api/v1/exchange-requests`), not nested
under `/hospitals/:hospitalId` since every request spans two hospitals; participant
authorization (initiator vs. recipient vs. neither) is enforced in
`exchangeRequest.service.ts`, not route-level `requireHospitalMatch`. Reads need
`VIEW_INVENTORY`; create needs `CREATE_EXCHANGE_REQUEST`; approve/reject need
`APPROVE_EXCHANGE_REQUEST`; ship/receive need `MANAGE_INVENTORY` (they move real stock).

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/exchange-requests` | initiator | Create; body picks specific `inventoryId` batches from the initiator's own branch to offer; reserves stock |
| GET | `/api/v1/exchange-requests?direction=sent\|received&status=` | either participant, or admin with `?hospitalId=` | Paginated list from one hospital's perspective |
| GET | `/api/v1/exchange-requests/:requestId` | either participant | Detail, including all `ExchangeItem` rows |
| POST | `/api/v1/exchange-requests/:requestId/approve` | recipient | `{ items?: [{itemId, quantityApproved, reason?}] }` — omit `items` to approve everything as requested; per-item partial approval releases the unapproved delta |
| POST | `/api/v1/exchange-requests/:requestId/reject` | recipient | `{ reason }` — whole-request reject, only while `pending` |
| POST | `/api/v1/exchange-requests/:requestId/cancel` | initiator | `{ reason }` — only while `pending`/`approved` |
| POST | `/api/v1/exchange-requests/:requestId/ship` | initiator | No body; moves stock out of the initiator's inventory, writes `exchange_sent` transactions |
| POST | `/api/v1/exchange-requests/:requestId/receive` | recipient | `{ items?: [{itemId, quantityReceived}] }` — omit to receive the full approved quantity; creates/tops up inventory at the recipient's branch, writes `exchange_received` transactions, completes the request |

**Notifications & audit logs (Phase 6)** — in-app only; no email/SMS delivery, no
real-time push (see PHASES.md Phase 6 for what's deferred and why)

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/v1/notifications?isRead=&page=&limit=` | any authenticated user | Own notifications only — ownership enforced in the service, not by permission |
| GET | `/api/v1/notifications/unread-count` | any authenticated user | Own unread count |
| PATCH | `/api/v1/notifications/:notificationId/read` | any authenticated user | Mark one as read; 404 if it's not the caller's own (never 403 — doesn't leak existence) |
| POST | `/api/v1/notifications/read-all` | any authenticated user | Mark all own notifications read |
| GET | `/api/v1/audit-logs?hospitalId=&resource=&action=&actor=&from=&to=` | `MANAGE_SYSTEM` (admin) | Global browse, all hospitals |
| GET | `/api/v1/hospitals/:hospitalId/audit-logs?resource=&action=&actor=&from=&to=` | `MANAGE_OWN_HOSPITAL` + same hospital | Pre-scoped to one hospital, for a hospital_manager |

## 3. State machines

### 3.1 Inventory row status
```
active ──(expiryDate within 30d)──► expiring_soon ──(expiryDate passed)──► expired
```
Purely date-derived; recomputed on every save, not a user-settable transition.

### 3.2 Exchange request (implemented — Phase 5)
```
pending ──► approved ──► in_transit ──► completed
        └──► rejected
pending/approved ──► cancelled   (by initiator, before shipment)
```
`initiatorHospital`/`initiatorBranch` = the **sender** (offers stock from their own
inventory, reserves it up front); `recipientHospital`/`recipientBranch` = the
**receiver** (approves/rejects, then confirms receipt). This was the one genuinely
ambiguous naming call in the model — "recipient" reads naturally as "recipient of the
medicine," and the implementation follows that reading throughout.
- `pending`: created; stock reserved (`quantityReserved`) on the **initiator's**
  inventory rows, one per item. No stock movement yet — a request that's never
  approved/shipped leaves the initiator's real stock untouched.
- `approved`: recipient accepted (whole or partial, per item); any reservation for a
  quantity that wasn't approved is released back to available stock immediately, not
  deferred to shipment. If every item ends up with `quantityApproved: 0`, the request
  auto-transitions straight to `rejected` instead of sitting in `approved` with
  nothing to ship.
- `rejected`: recipient declined the whole request (or all items were rejected during
  approval) — full reservation released, no inventory movement.
- `in_transit`: initiator marked shipped — this is the actual stock movement on the
  sender's side: `quantityInStock` decreases by `quantityApproved`, reservation
  clears, one `exchange_sent` `InventoryTransaction` per item.
- `completed`: recipient confirmed receipt — for each item, the matching batch
  (`medicine` + `batchNumber`) at the recipient's branch is topped up, or created
  fresh (borrowing `manufacturingDate` from the source inventory row, since
  `ExchangeItem` only denormalizes `batchNumber`/`expiryDate`, not manufacturing
  date); one `exchange_received` `InventoryTransaction` per item. Receive is a
  single-shot action — even if `quantityReceived < quantityApproved` for some items
  (item status `received_partial`), the **request** still moves straight to
  `completed`; there's no separate "partially completed" request state, the nuance
  lives at the item level only.
- `cancelled`: initiator backed out while `pending`/`approved` — releases whatever
  reservation is still outstanding (accounts for prior partial-approval releases).

### 3.3 Auth session
```
(no session) ──login/register──► access token (15m) + refresh token (7d, hashed, stored)
access token expiry ──refresh──► old refresh revoked, new pair issued (rotation)
──logout──► refresh token revoked
5 failed logins ──► locked 15m, independent of the above
```

### 3.4 Email verification / password reset tokens
```
issued (random 32-byte hex, hashed with SHA-256 before storing) ──consumed──► cleared
                                                                 ──expired───► rejected, not auto-cleared until next request
```
- Verification token: 24h TTL (`emailVerificationExpires`), set on register and on
  `resend-verification`.
- Reset token: 1h TTL (`passwordResetExpires`), set on `forgot-password`.
- Both follow the same pattern as refresh tokens (§4): the raw token is only ever seen by
  the recipient (via the stubbed email in `utils/mails.ts` today), the DB stores
  `hashToken(raw)`, and a match requires both the hash and an unexpired `*Expires` field.
  Successful reset additionally revokes all of the user's refresh tokens
  (`refreshTokenRepository.revokeAllForUser`) — a password change should end every
  existing session.

## 4. Auth/token design detail

- Access token payload: `{ userId, email, role, hospital?, branch?, iat, exp }` — role
  name (not ID) is embedded so `protect` doesn't need a DB round-trip to know the role;
  it *does* still reload the `User` document to catch deactivation/soft-delete.
- Refresh tokens are opaque to the client beyond being a JWT string; server-side they're
  tracked in `RefreshToken` keyed by `hashToken(rawJwt)` (SHA-256) so a DB leak alone
  doesn't yield usable tokens. Rotation means a given refresh token JWT is single-use.
- Cookie scope: `path: "/api/v1/users"` — the refresh cookie is only ever sent to that
  module's routes, deliberately narrow.

## 5. Open design questions

- ~~**Multi-batch inventory**~~ — resolved in Phase 4 (§1.3): yes, uniqueness now
  includes `batchNumber`.
- ~~**Permission model**~~ — resolved (§1.4): small, data-driven, seeded permission set;
  `scope` field stays descriptive-only, hospital-scoping stays a separate composed
  middleware. Proven out with a second real example (branches/staff) in Phase 3, not
  just the original single case — no longer "open."
- ~~**Notification delivery**~~ — partly resolved in Phase 6: in-app only for now
  (`channels: ["in_app"]`, `deliveryStatus.in_app` stamped on write). The model's
  `email`/`sms` channel shape was already there from Phase 1 and stays unused/`sent:
  false` until real SendGrid/Twilio integration happens — no migration needed when
  that lands, since the schema shape was already right.
- **Write-through breadth**: Phase 6 wired `AuditLog`/`Notification` writes into auth
  (login/logout) and the exchange lifecycle only — proving the pattern, not
  exhaustively applying it. Hospitals/branches/staff/medicine-catalog/inventory CRUD
  still don't write audit rows or notify anyone. Intentional scope cut, not an
  oversight (see PHASES.md Phase 6) — extend by calling `auditLogService.record()` /
  `notificationService.notify()` at each mutation site, following the exchange
  lifecycle as the reference example.
- ~~**Exchange request numbering**~~ — shipped as-is in Phase 5: `requestNumber` uses
  the generic `EXR-000001` sequence convention (§1.1), not the DB design doc's
  illustrative hospital+year format. Revisit only if a print/paper workflow later
  needs the human-readable hospital-scoped form.
- **Exchange discovery**: Phase 5 requires the initiator to already know the
  recipient hospital/branch and the exact `inventoryId` to request — there's no
  "browse what other hospitals have surplus of" search yet. Fine for a pilot where
  hospitals coordinate out-of-band; a real cross-hospital catalog search is the
  natural Phase 6+ follow-up (see PHASES.md "What to build next").
- **Admin provisioning**: currently zero HTTP surface, by design (§1.5) — fine for now,
  but every dev/staging environment needs a raw-Mongo insert or a script to get a first
  admin. Worth a small `scripts/seed-admin.ts` CLI before this becomes a recurring
  onboarding papercut.
- **"View" vs "manage" permission granularity**: branch reads require no permission
  (just same-hospital), staff reads require the *same* `MANAGE_USERS` permission as staff
  writes (§1.4). Fine while the only roles are admin/manager/pharmacist/viewer, but if a
  future role needs read-only staff visibility without write access, `MANAGE_USERS` will
  need to split into `MANAGE_USERS`/`VIEW_USERS`.

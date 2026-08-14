# IMSN — Architecture

What the system is made of and how the pieces talk to each other. For *why* (requirements)
see [PRD.md](PRD.md); for coding conventions see [RULES.md](RULES.md); for schema/API
specifics see [DESIGN.md](DESIGN.md); for what's actually built see [PHASES.md](PHASES.md).

## 1. System overview

```
Frontend (Angular/React Portal + React Native Mobile)     — not started
        │  HTTP + WebSocket (Socket.IO)
Backend API — Express.js 5 + TypeScript, Node.js           — in progress
        │
Application Layer — Controller → Service → Repository → Model
        │
Data Layer — MongoDB (Mongoose 8)                           — core models in place
        │
Supporting services: Redis (cache), BullMQ (jobs), AWS S3, — not started
SendGrid (email), Twilio (SMS), Socket.IO (real-time)
```

Only the backend HTTP API exists today (identity/auth + core Mongoose models). Nothing
under "Supporting services" or "Frontend" has been built yet — see [PHASES.md](PHASES.md).

## 2. Backend layering (modular monolith)

Each domain lives in its own module under `backend/src/modules/<name>/`, following a
strict one-way dependency chain:

```
route/  → controller/ → service/ → repository/ → model/
validator/  (used by route, via the `validate()` middleware)
```

- **`model/`** — Mongoose schema + `IEntity` interface. Owns field-level validation,
  indexes, and any data-shape invariants that must hold regardless of caller (e.g. "a
  branch must belong to an active hospital").
- **`repository/`** — thin data-access functions only (`findByX`, `create`, `save`).
  No business rules here — see `modules/user/repository/*.ts` for the reference shape.
- **`service/`** — business logic: orchestrates repositories, enforces rules that span
  more than one call (lockout counting, token issuance, reservation math), throws
  `AppError` for anything the caller needs to see as a clean HTTP error.
- **`controller/`** — translates HTTP req/res to/from service calls. No business logic.
- **`validator/`** — Zod schemas for request bodies, used by the `validate()` middleware
  before the controller ever runs.
- **`route/`** — wires `validate → (protect) → controller` into an Express `Router`,
  mounted under `/api/v1/<module>` in `routes/index.ts`.

Today only the **`user`** module has the full stack (model → repository → service →
controller → route → validator); every other module currently has a `model/` only. When
building out a new module, follow the `user` module's shape.

## 3. Request lifecycle

```
Client
  → helmet / cors / morgan (app.ts)
  → express.json() / urlencoded / cookieParser
  → /api/v1/<module> router
  → validate(schema)            — 400 on bad input (ZodError → errorHandler)
  → protect                     — 401 if no/invalid/expired access token (protected routes only)
  → controller                  — thin, calls service, shapes the response
  → service                     — business rules, calls repositories, throws AppError
  → repository                  — Mongoose query/mutation
  → notFound / errorHandler     — last-resort 404 / error → JSON, registered after all routes
```

Response envelope (all endpoints): `{ success: boolean, message?: string, data?: object }`.

## 4. Identity & auth architecture (implemented)

- **Access token**: JWT, HS256, 15 min (`JWT_SECRET`, `ACCESS_TOKEN_EXPIRY`). Carries
  `userId`, `email`, `role`, `hospital?`, `branch?`. Sent as `Authorization: Bearer`.
- **Refresh token**: JWT, 7 days (`JWT_REFRESH_SECRET`, `REFRESH_TOKEN_EXPIRY`). Never
  stored raw — only its SHA-256 hash is persisted in the `RefreshToken` collection.
  Delivered as an httpOnly cookie scoped to `/api/v1/users`, and also returned in the
  register/login response body for non-browser clients.
  - **Rotated on every refresh**: the old token is marked revoked, a new pair is issued.
  - **Revoked on logout**.
- **Password**: bcrypt, 12 rounds, hashed in a Mongoose `pre("save")` hook on the `User`
  model — services never hash passwords themselves.
- **Lockout**: 5 failed attempts → 15 minute lock (`User.loginAttempts` /
  `User.lockedUntil`), enforced in `user.service.ts`, not in the model.
- **`protect` middleware**: verifies the access token, reloads the user (rejects if
  inactive/soft-deleted), attaches `req.user = { id, email, role, hospital?, branch? }`.
  No separate permission/RBAC middleware exists yet — see [PHASES.md](PHASES.md).

## 5. Sequential human-readable IDs

Every core entity gets a friendly ID (e.g. `HOS-000001`) in addition to its Mongo `_id`,
generated via a shared atomic counter:

- `modules/counter/model/counter.model.ts` — `{ name, seq }`, one document per sequence.
- `modules/counter/service/counter.service.ts` → `generateSequentialId(sequenceName, prefix, padLength=6)`
  does an atomic `findOneAndUpdate({ $inc: { seq: 1 } }, { upsert: true })` and returns
  `"<PREFIX>-<padded seq>"`.
- Each model calls it in its own `pre("save")` hook, only `if (this.isNew)`, and stores
  the result in a `sparse: true, unique: true` field (`userId`, `hospitalId`,
  `branchId`, `manufacturerId`, `categoryId`, `medicineId`, `inventoryId`,
  `transactionId`). `sparse` matters: it lets pre-existing/legacy documents without the
  field coexist with the uniqueness constraint.

To add this to a new model, mirror `hospitals.model.ts` or `medicine.model.ts` — don't
call `Counter` directly from a model; always go through `generateSequentialId`.

## 6. Data isolation (hospital scoping)

Every hospital-scoped resource (inventory, branches, exchanges, staff) must be filtered
by `req.user.hospital` server-side — never trust a hospital id from the request body/
params alone for a non-admin caller. System Admins are the only role exempt from this
check. This is enforced today only informally (no shared middleware yet); when building
hospital-scoped routes, add an explicit ownership check in the service layer (pattern:
compare the resource's `hospital` field to `req.user.hospital`, 403 on mismatch) until a
dedicated authorization middleware exists.

## 7. Error handling

- `utils/AppError.ts` — `AppError(statusCode, message)`, thrown from services/controllers
  for any "expected" failure (validation, auth, not-found, conflict).
- `middlewares/errorHandler.ts` — the only place that turns errors into HTTP responses.
  Understands: `AppError`, `ZodError` (from `validate()`), Mongoose `ValidationError`,
  Mongo duplicate-key (`code: 11000`), Mongoose `CastError`. Anything else → logged +
  generic 500.
- Express 5 auto-forwards rejected promises from `async` route handlers to this error
  handler, so controllers/services don't need try/catch wrappers for the happy path —
  just `throw new AppError(...)`.

## 8. Target infrastructure (not yet provisioned)

Documented for when we get there — see [PRD.md](PRD.md) §8 for the non-functional
targets these support:

- MongoDB Atlas (replica set) in place of local MongoDB.
- Redis (ElastiCache) for caching + BullMQ job queue (expiry/low-stock cron, email/SMS
  delivery, exports).
- AWS S3 for file storage (avatars, hospital docs, exports, audit archives).
- SendGrid (email) / Twilio (SMS) for notification delivery.
- Socket.IO for real-time push (rooms: `hospital:{id}`, `branch:{id}`, `user:{id}`, `admin`).
- AWS ECS/Fargate behind an ALB, GitHub Actions CI/CD.

Full tech stack detail (versions, package choices, performance targets): see the tech
stack section retained in [PROJECT.md](PROJECT.md).

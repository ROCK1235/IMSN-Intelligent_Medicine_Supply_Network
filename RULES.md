# IMSN — Coding Rules & Conventions

These are the conventions actually in use in this codebase. Follow them for new code;
if you deviate, have a reason and update this file. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the layering these rules assume.

## 1. Module structure

New backend feature = new folder under `backend/src/modules/<name>/`, with only the
subfolders it needs:

```
modules/<name>/
  model/<name>.model.ts        # Mongoose schema + IEntity interface
  repository/<name>.repository.ts   # plain functions, no business logic
  service/<name>.service.ts    # business logic, throws AppError
  controller/<name>.controller.ts   # thin req/res translation
  validator/<name>.validator.ts     # Zod schemas
  route/<name>.route.ts        # Router wiring
```

- One collection per model file. Cross-collection references use `ref` + a Mongoose
  `validate` async function that checks existence/active status (see any existing
  `hospital`/`branch`/`role` field for the pattern) — don't skip this even though it
  costs an extra query; data integrity here matters more than raw write speed.
- Repository functions return Mongoose queries/documents directly — no DTO mapping layer
  yet. Keep repository functions single-purpose and named for what they do
  (`findByEmailWithPassword`, not a generic `find`).
- Services never touch a Mongoose model directly — always go through that module's
  repository. If a service needs another module's data (e.g. `user.service.ts` needing
  `Role`), add a small repository file for it inside the *calling* module (see
  `modules/user/repository/role.repository.ts`) rather than reaching into another
  module's model.
- Controllers are `async (req, res) => { ... }`, return `Promise<void>`, and do nothing
  except: pull request meta → call one service function → shape the JSON response. No
  `try/catch` needed — Express 5 forwards rejected promises to the error handler
  automatically.

## 2. Naming

- Files: `<name>.model.ts`, `<name>.service.ts`, etc. — lowercase, dot-separated, no
  abbreviations.
- Interfaces: `I<Entity>` (`IUser`, `IHospital`), exported alongside the schema in the
  same model file.
- Mongoose models: `PascalCase` singular (`export const User = model<IUser>("User", ...)`).
- Sequential human-readable IDs: `<entity>Id` field name (`hospitalId`, `branchId`),
  generated via `generateSequentialId(sequenceName, prefix)` — see
  [ARCHITECTURE.md](ARCHITECTURE.md) §5. Never hand-roll ID generation in a model.

## 3. Validation

- Every mutating route gets a Zod schema in that module's `validator/` folder, applied
  via `validate(schema)` from `middlewares/validate.ts` before the controller runs.
- Mirror (don't bypass) the model-level constraints in the Zod schema where it improves
  the error message (e.g. password complexity is checked in both the `User` schema and
  `user.validator.ts` — the Zod layer gives a clean 400 before a query even runs; the
  Mongoose layer is the last line of defense).
- Never trust `req.body` beyond what the schema allows — `validate()` replaces
  `req.body` with the parsed/coerced result, so downstream code only ever sees clean data.

## 4. Errors & responses

- Throw `new AppError(HTTP_STATUS.X, "message")` for anything the client should see as a
  clean, specific error. Use `constants/http.ts` for status codes and
  `constants/messages.ts` for shared message strings — don't inline magic numbers or
  duplicate message text across files.
- Never write a custom `try/catch` in a controller just to format an error response —
  that's `errorHandler`'s job. Only catch where you need to *react* to an error (e.g.
  incrementing a login-attempt counter before re-throwing).
- Response shape is always `{ success, message?, data? }`. Don't return bare arrays/objects.

## 5. Auth & security

- Passwords: never hash manually — the `User` model's `pre("save")` hook does it.
  Services compare via `user.comparePassword()`, never `bcrypt.compare` directly.
- Tokens: sign/verify only through `utils/jwt.ts`. Never store a raw refresh token —
  hash it with `utils/token.ts#hashToken` first (see `user.service.ts` for the pattern).
- Any route that requires a logged-in user gets the `protect` middleware; don't
  hand-roll JWT verification in a controller.
- Any route that touches hospital-scoped data must check `req.user.hospital` against the
  resource's `hospital` field (System Admin exempted) — see
  [ARCHITECTURE.md](ARCHITECTURE.md) §6. This isn't automatic yet; you have to add it.
- Secrets live in `.env` only. `.env` is gitignored going forward — if you add a new
  required variable, add it to `.env.example` too (with an empty/placeholder value).

## 6. TypeScript

- `strict: true` is on — don't work around it with `any` unless truly necessary, and
  never to paper over a real type error.
- Prefer narrowing/type guards (see `errorHandler.ts`'s `isMongooseValidationError` etc.)
  over `as` casts when handling `unknown`/external errors.
- If you add a static method to a Mongoose schema (`schema.statics.foo`), also declare it
  on the model's exported type, or callers won't see it — several existing models define
  statics that aren't reflected in their `IEntity` interface; don't rely on those from
  application code, query the model directly instead (see how `user.service.ts` queries
  `Role`/`RefreshToken` via repositories instead of calling undeclared statics).

## 7. Before you're done — docs are part of the change, not an afterthought

- `npx tsc --noEmit` from `backend/` must be clean.
- If you touched an auth/data-flow path, actually boot the server (`npm run dev`) against
  local Mongo and hit the endpoint with `curl` — typechecking is not proof it works.
- Clean up any test data you created against the local/dev database.
- **Every code change updates the relevant doc(s) in the same pass**, not "later":
  - [PHASES.md](PHASES.md) — flip status the moment something is started/completed.
  - [MEMORY.md](MEMORY.md) — add a dated entry for any non-obvious decision, gotcha, or
    anything a future session would otherwise have to rediscover from the diff.
  - [DESIGN.md](DESIGN.md) — new endpoints, schema decisions, or state machines.
  - [ARCHITECTURE.md](ARCHITECTURE.md) / [RULES.md](RULES.md) — only when the change
    actually alters system shape or conventions.
  - [FLOW.md](FLOW.md) — if setup steps, env vars, or the boot sequence change.
  See [FLOW.md](FLOW.md) §6 for the full everyday dev loop this fits into.

## 8. Git

- Don't commit `.env`, `.env.local`, or anything under `.gitignore` unless the user
  explicitly asks.
- Don't run destructive git commands (`reset --hard`, force-push, `checkout .`) without
  explicit confirmation.
- Only commit when asked — see the top-level assistant instructions for the full git
  workflow expectations.

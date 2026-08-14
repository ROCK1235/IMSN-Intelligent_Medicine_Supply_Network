# IMSN — Project & Startup Flow

How to actually get this running locally, and what happens under the hood when it boots
and when a request comes in. For *why*/*what* see [PRD.md](PRD.md); for the code layout
those steps live in, see [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Prerequisites

- Node.js 18+ (project uses `ts-node-dev` for local dev, `tsc` for prod build)
- A running MongoDB instance reachable at the URI in `backend/.env` (local
  `mongod`, or Atlas — either works, nothing in the code assumes local-only)
- No Redis/S3/SendGrid/Twilio needed yet — none of those integrations exist in code yet
  (see [PHASES.md](PHASES.md))

## 2. First-time setup

```bash
cd backend
npm install
```

Check `backend/.env` has at minimum (see `backend/.env.example` for the full list this
project intends to eventually use):

```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/imsn
JWT_SECRET=<any long random string>
JWT_REFRESH_SECRET=<a different long random string>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

`.env` is gitignored going forward (but was tracked historically — see
[MEMORY.md](MEMORY.md)). Never put real production secrets in it on a shared machine.

## 3. Run it

```bash
npm run dev      # ts-node-dev, hot reload — normal day-to-day command
# or
npm run build && npm start   # compiled prod-style run
```

You should see, in order:

```
✅ MongoDB connected
🚀 IMSN Server running on port 5000
```

(You'll also see a handful of Mongoose "duplicate schema index" warnings on boot —
pre-existing, harmless, tracked as low-priority cleanup in [MEMORY.md](MEMORY.md).)

## 4. What actually happens on boot (`server.ts`)

```
1. dotenv.config()                 — load backend/.env into process.env
2. connectDB()                     — mongoose.connect(MONGO_URI); exits process on failure
3. seedSystemRoles()                — idempotent upsert of the 4 system roles
                                       (admin, hospital_manager, pharmacist, viewer)
                                       so registration always has a role to assign
4. app.listen(PORT)                — start accepting HTTP requests
```

`app.ts` wires the Express middleware stack in this order (see
[ARCHITECTURE.md](ARCHITECTURE.md) §3 for the full per-request breakdown):
`helmet → cors → morgan → express.json/urlencoded → cookieParser → /api/v1 routes → notFound → errorHandler`.

## 5. Verify it end-to-end

With the server running:

```bash
# health check
curl http://localhost:5000/api/v1/

# register (creates a user, seeds a sequential userId like USR-000001,
# returns an access token, sets a refresh-token cookie)
curl -s -X POST http://localhost:5000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","password":"Secur3!Pass","role":"viewer"}'

# login (same shape as register)
curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"Secur3!Pass"}'

# call a protected route with the access token from the previous response
curl -s http://localhost:5000/api/v1/users/me -H "Authorization: Bearer <accessToken>"

# rotate the refresh token using the cookie jar from login
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/v1/users/refresh-token

# logout (revokes the refresh token)
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/users/logout
```

This is the full implemented flow today — see [DESIGN.md](DESIGN.md) §2.1 for the
endpoint table and [PHASES.md](PHASES.md) for what's *not* wired up yet (there is no
hospital/branch/inventory/exchange API to call after this).

## 6. Everyday dev loop

1. Check [PHASES.md](PHASES.md) to see what's already built before starting something new.
2. Follow the module shape in [ARCHITECTURE.md](ARCHITECTURE.md) §2 /
   [RULES.md](RULES.md) §1 — `model → repository → service → controller → route (+ validator)`.
3. `npx tsc --noEmit` from `backend/` must be clean before you consider something done.
4. Actually boot the server and hit the new endpoint with `curl` (or similar) — don't
   rely on typechecking alone.
5. **Update the docs in the same change**, not as an afterthought:
   - [PHASES.md](PHASES.md) — flip the checkbox/status for whatever you just built.
   - [MEMORY.md](MEMORY.md) — add a dated entry if you made a non-obvious decision, hit
     a gotcha, or changed something a future session would otherwise have to
     rediscover the hard way.
   - [DESIGN.md](DESIGN.md) — add new endpoints to the table in §2, new state machines,
     or new schema decisions.
   - [ARCHITECTURE.md](ARCHITECTURE.md) / [RULES.md](RULES.md) — only if the change
     actually alters system shape or conventions, not for routine feature work.
   This isn't optional busywork — these docs are what makes the next session (agent or
   human) fast instead of having to re-derive everything from the diff.

## 7. Troubleshooting

- **`MONGO_URI is not defined`** — `.env` isn't being loaded or is missing the key;
  confirm you're running from `backend/` and `.env` exists there.
- **Server exits right after "MongoDB connected" never prints** — Mongo isn't reachable
  at that URI; `connectDB()` calls `process.exit(1)` on connection failure by design.
- **`Failed to generate sequential id for "..."`** — the `Counter` collection write
  failed (Mongo connectivity issue); see [ARCHITECTURE.md](ARCHITECTURE.md) §5.
- **Registration fails with "requested role is not available"** — `seedSystemRoles()`
  didn't run or the DB was pointed somewhere without the seeded roles; restart the
  server against the intended DB.

# IMSN — Intelligent Medicine Supply Network

Doc index. Start here, then follow the links below — each topic has exactly one home
now, so update the relevant file rather than this one (except §2, the detailed tech
stack, which lives here).

## 1. Where things live

| Doc | Covers |
|---|---|
| [PRD.md](PRD.md) | Problem, goals, personas, functional/non-functional requirements, success metrics |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System shape, backend module layering, request lifecycle, auth architecture, sequential IDs, error handling |
| [DESIGN.md](DESIGN.md) | Data model detail, API conventions, state machines (exchange, inventory, auth session), open design questions |
| [RULES.md](RULES.md) | Coding conventions — module structure, naming, validation, errors, security, TypeScript, git |
| [FLOW.md](FLOW.md) | How to set up and run the project locally, server boot sequence, a runnable end-to-end request walkthrough, everyday dev loop |
| [PHASES.md](PHASES.md) | Roadmap with actual done/partial/not-started status — check this before assuming a feature exists |
| [MEMORY.md](MEMORY.md) | Dated log of decisions and gotchas, for continuity across sessions |
| `Docs/Database/` | Authoritative DB schema design, ER diagram, validation rules for all 15 planned collections |
| `Docs/Product-Requirements/PRD.md.txt` | Currently empty — superseded by [PRD.md](PRD.md) at root |

## 2. Tech Stack (detailed reference)

### Frontend — not yet started (see PHASES.md §7)
- **Web Admin Portal**: React 18+ (or Angular 16+), TypeScript, Redux/Redux-Saga,
  Material-UI/Ant Design, Axios + React Query, React Router v6, React Hook Form + Zod,
  Recharts/Chart.js, Socket.IO client.
- **Mobile**: React Native 0.72+, TypeScript, React Navigation, React Native Paper,
  AsyncStorage, Firebase Cloud Messaging (push), Socket.IO client. iOS 12+ / Android 5+.

### Backend — in progress (see PHASES.md)
- Node.js 18/20 LTS, TypeScript 5.x, **Express.js 5.x** (note: earlier drafts of this
  doc said 4.x — the actual `package.json` uses 5.x).
- Architecture: modular monolith, `Controller → Service → Repository → Mongoose Model`
  — see [ARCHITECTURE.md](ARCHITECTURE.md) §2 for the exact per-module folder shape
  actually in use.
- Validation: Zod v4. Auth: `jsonwebtoken` + `bcrypt`. Security: Helmet, cors,
  cookie-parser, morgan. Real-time (`socket.io`), jobs (`bullmq`/`ioredis`), and
  structured logging (Winston/Pino) are planned, not yet dependencies.

### Data & Infra
- **MongoDB 8** (Mongoose 8) — 15 designed collections (see `Docs/Database/`), 12
  implemented as models so far (see [PHASES.md](PHASES.md) §Phase 1), 70+ indexes
  planned across the full set.
- **Redis 7.x** *(planned)* — sessions/refresh tokens, hospital/medicine/inventory
  caches, rate limit counters, search result cache (TTLs 30min–7d depending on data).
- **BullMQ** *(planned)* — email/SMS delivery, PDF/Excel export, scheduled jobs (hourly
  expiry check, daily low-stock check 3am, weekly reports Mon 6am, TTL cleanup every 6h,
  nightly backup), image processing, audit log archival (7d), analytics rollups.
- **AWS S3** *(planned)* — avatars, hospital docs, exported reports (30d TTL), audit
  archives, DB backups (7d retention); versioned, SSE-S3 encrypted, CloudFront CDN in
  front.
- **SendGrid** *(planned)* — transactional + notification email templates (MJML),
  delivery/open/click tracking, webhook-driven retry (3x, exponential backoff).
- **Twilio** *(planned)* — critical/urgent SMS + optional OTP/2FA, opt-in managed per
  user.
- **Hosting** *(planned)*: AWS ECS/Fargate behind an ALB, auto-scale 2–10 instances;
  MongoDB Atlas (3-node replica set); ElastiCache Redis (multi-AZ); Route53 + ACM for
  DNS/TLS.
- **CI/CD** *(planned)*: GitHub Actions — lint → typecheck → unit tests (Jest, >80%
  coverage) → security scan (npm audit/SAST) → build/Docker image → push → deploy (main
  branch) → post-deploy smoke tests.
- **Testing** *(planned)*: Jest (unit), Supertest (integration), Cypress/Playwright (E2E)
  — no test framework is wired up yet; `npx tsc --noEmit` is the only current gate.
- **Monitoring** *(planned)*: CloudWatch, X-Ray, DataDog, SNS alerts.

### Performance targets (aspirational — not load-tested)
- API p95 < 200ms, DB query p95 < 50–100ms, WebSocket latency < 100ms.
- Frontend: FCP < 2s, TTI < 3s, bundle < 500KB gzipped, Lighthouse > 90.
- Uptime SLA > 99.9%, multi-AZ, auto-scaling 2–10 instances.

---

_This file is the map, not the territory — if something here looks stale, the linked doc
is authoritative. Update both when they drift._

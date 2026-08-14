# IMSN — Product Requirements Document

Status: living document. Update whenever scope changes. See [PHASES.md](PHASES.md) for
what's actually built vs. planned, and [ARCHITECTURE.md](ARCHITECTURE.md)/[DESIGN.md](DESIGN.md)
for how requirements below are realized technically.

## 1. Problem

Hospitals routinely over-stock some medicines — which then expire and are wasted —
while being short on others, forcing costly emergency purchases from pharma suppliers.
There is no shared mechanism for hospitals to see what nearby hospitals have surplus of,
or need.

## 2. Solution

IMSN is a network that lets verified hospitals list, discover, and exchange surplus
medicine inventory with each other before it expires, instead of wasting it or paying
full price to buy more. Every exchange is logged, audited, and reversible in status
(pending → approved → in_transit → completed), with reservations preventing double-booking
of the same stock.

## 3. Goals

- Reduce medicine wastage from expiry at participating hospitals.
- Reduce emergency/urgent procurement cost by enabling peer-to-peer exchange.
- Give hospital staff real-time visibility into their own inventory's expiry and
  reorder risk.
- Maintain a full, tamper-evident audit trail for healthcare compliance (7-year
  retention target).
- Keep each hospital's data isolated from every other hospital except where explicitly
  shared through an exchange.

## 4. Non-goals (out of scope for now)

- Payments/billing between hospitals (exchanges are goodwill-based, not invoiced).
- Public/patient-facing features — IMSN is B2B (hospital staff only).
- Cross-border (non-India) address/tax formats — GSTIN/PIN-code validation is India-specific
  for now.
- Real-time chat between hospitals (notifications only, not messaging).

## 5. Personas / Roles

| Role | Who | Primary need |
|---|---|---|
| System Admin | IMSN platform operators (2–5 people) | Onboard/verify hospitals, manage users and medicine master data, resolve disputes, produce compliance reports |
| Hospital Manager | Hospital's admin/owner account (1–3 per hospital) | Manage their hospital, staff, and branches; approve/reject incoming exchanges; oversee inventory |
| Pharmacist | Branch-level staff (many per hospital) | Keep branch inventory accurate; create exchange requests when stock is surplus or short |
| Viewer | Read-only stakeholders (finance, auditors, leadership) | See dashboards/reports without being able to change anything |

Full permission matrix: see [PRD.md §7](#7-role-permissions-summary) below and
`Docs/Database/.../validation.md` for field-level rules.

## 6. Functional Requirements (user stories)

### 6.1 Hospital onboarding
- As a hospital admin, I can submit a registration form with hospital details, address,
  and compliance IDs (GSTIN, registration/license numbers) so my hospital can join IMSN.
- As a System Admin, I can review, verify, or reject a pending hospital registration.
- As a verified hospital's first user, I can create my Hospital Manager account and start
  inviting staff.

### 6.2 Identity & access — **implemented**
- As a user, I can register an account with a role, and log in to receive an access
  token + refresh token.
- As a user, my session survives short-lived access token expiry via silent refresh
  (rotated refresh token, httpOnly cookie).
- As a user, I can log out, which revokes my refresh token.
- As a locked-out user (5 failed logins), I am blocked from logging in for 15 minutes.
- As a Hospital Manager, I can invite staff to my hospital and assign them a role
  (pharmacist/viewer) and, for pharmacists, a branch.

### 6.3 Inventory management
- As a pharmacist, I can view and update my branch's medicine stock (quantity in/out,
  batch, expiry).
- As any hospital staff member, I can see which of my hospital's medicines are expiring
  soon (< 30 days) or already below reorder level.
- The system automatically computes `quantityAvailable = quantityInStock - quantityReserved`
  and flags status (`active` / `expiring_soon` / `expired`).

### 6.4 Medicine exchange (core flow)
- As a pharmacist/manager, I can search for hospitals that need (or have) a specific
  medicine, filtered to items with ≥15 days left before expiry (medicines with less are
  blocked from exchange and flagged for disposal instead).
- As a requester, I can create an exchange request to another hospital specifying
  medicine, batch, quantity, and a required-by date. This reserves the requested quantity
  against my hospital's stock.
- As a receiving Hospital Manager, I can approve, partially approve, or reject an
  incoming request, with a reason on rejection.
- As the sender, I can mark a request as shipped/in-transit.
- As the receiver, I can confirm receipt (batch/quantity/expiry verified), which
  completes the exchange, moves stock from sender to receiver inventory, and releases
  the reservation.
- As either party, I receive a real-time notification at every step (created, approved,
  rejected, shipped, completed).

### 6.5 Monitoring & compliance
- As a hospital user, I receive expiry alerts and low-stock alerts automatically
  (scheduled checks).
- As a System Admin or Hospital Manager, I can view an audit trail of who did what,
  when, from where, for every mutating action in my scope.

## 7. Role permissions summary

See the full matrix in `Docs/` and the original walkthrough; the short version:

- **System Admin**: full access, all hospitals, can override/cancel exchanges, manages
  roles/medicine master data, cannot itself create exchange requests (not tied to a
  hospital).
- **Hospital Manager**: full access within their own hospital only (staff, branches,
  inventory, exchanges); cannot see other hospitals' internals.
- **Pharmacist**: branch-level inventory + exchange creation; cannot approve exchanges
  or manage users.
- **Viewer**: read-only within their own hospital; cannot mutate anything.

Hospital data isolation is enforced server-side on every request (see
[ARCHITECTURE.md](ARCHITECTURE.md) → Security).

## 8. Non-functional requirements

- **Performance**: API p95 < 200ms, DB query p95 < 50–100ms, WebSocket latency < 100ms
  (targets; not yet load-tested).
- **Security**: bcrypt password hashing (12 rounds), JWT access (15m) + rotated refresh
  (7d) tokens, account lockout after 5 failed logins, hospital-scoped authorization on
  every request, input validation at the API boundary (Zod).
- **Auditability**: every create/update/approve/reject action on a domain entity should
  produce an immutable audit log entry with actor, before/after diff, IP, and timestamp
  (audit log model not yet built — see [PHASES.md](PHASES.md)).
- **Availability**: target 99.9% uptime once deployed (aspirational; no production
  deployment yet).
- **Data isolation**: a hospital must never be able to read another hospital's inventory,
  staff, or exchange data it isn't a party to.

## 9. Success metrics (once live)

- % reduction in expired-medicine write-offs per participating hospital.
- Total value of medicine successfully exchanged vs. would-be waste/purchase cost.
- Median time from exchange request creation to completion.
- Number of active verified hospitals and monthly active exchanges.

## 10. Open questions / future scope

- Do exchanges ever need a monetary settlement path, or are they always goodwill-based?
- Should Viewer role support export (PDF/Excel) of reports, or strictly on-screen only?
- Multi-country support (address/tax formats) — deferred until an actual need arises.

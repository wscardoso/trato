# 04 — Test Report & Suite (Booking Edge-Case Audit)

**Product:** Trato — multi-tenant Booking SaaS (Barber / Beauty)  
**Workspace:** `agente barbearia`  
**Stack under test:** Next.js 15 App Router · Prisma/PostgreSQL · Redis locks (ioredis, in-memory fallback) · Zod · Luxon · WhatsApp via `NotificationLog` (no BullMQ)  
**Audit date:** 2026-09-04  
**Runner:** Vitest 3.2.4 (`npm test`)

---

## 1. Executive Summary

| Area | Verdict | Notes |
|---|---|---|
| Concurrency (same staff + slot) | **PASS** (demo/in-memory locks) | 1 success / 4 conflicts (`SLOT_LOCKED` or `SLOT_UNAVAILABLE`). Production also has GiST exclusion + Redis `SET NX`. |
| Timezone / DST / closing edge | **PASS** | 90‑min service 30‑min before close rejected; multi-TZ labels differ; US Eastern spring/fall handled via Luxon. |
| Validation / XSS / SQLi | **PASS** after fix | Zod UUID/datetime gates injection vectors; HTML/script sanitization added on name/notes. |
| Tenant isolation | **PASS** after fix | Public slug lookup fail-closed; foreign service/staff rejected. **Idempotency key was cross-tenant leaky** — fixed. |
| WhatsApp downtime | **PASS** after fix | Booking succeeds when provider returns 500; delivery status now `retry` (queue signal). No BullMQ in repo. |
| Live Postgres HTTP race | **SKIPPED** | Opt-in `RUN_DB_TESTS=1` + running app; local DB race not executed in this environment. |

**Executed:** 17 passed · 1 skipped · 0 failed.

**Critical finding fixed:** `createBookingAtomic` returned another tenant’s booking when an `Idempotency-Key` collided across tenants (IDOR / data leak).

---

## 2. Discovered Architecture (relevant to tests)

### Public APIs (real)

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/tenants/[slug]` | Public tenant catalog |
| `GET` | `/api/slots?slug&serviceId&staffId&date` | Slot availability |
| `POST` | `/api/bookings` | Create booking (`Idempotency-Key` header) |

Primary implementation path: `src/app/api/bookings/route.ts` → `createBookingAtomic` in `src/lib/booking-service.ts`.  
Alternate / parallel module (not wired to route): `src/lib/booking/create-booking.ts`.

### Concurrency controls present

1. Redis / memory lock: `t:{tenantId}:lock:staff:{staffId}:{startsAtIso}` (`src/lib/redis-lock.ts`)
2. Transaction overlap query on `blockStartsAt` / `blockEndsAt`
3. Postgres GiST exclusion (`prisma/migrations/0_exclusion_constraint/migration.sql`)

### Notifications

- Not BullMQ. Persistence queue = `notification_logs` with `status` ∈ `queued | sent | failed | retry`.
- Enqueue is fire-and-forget after booking commit (`src/lib/whatsapp.ts`).

### Demo mode

`DEMO_MODE=true` (or missing DB usage path) uses `src/lib/demo-store.ts`. Suites default to demo so they run without Postgres/Redis.

---

## 3. Test Files (canonical suite)

| File | Covers |
|---|---|
| `tests/concurrency.booking.test.ts` | 5 concurrent bookers, same staff+slot |
| `tests/timezone.slots.test.ts` | Closing edge, SP timezone, US DST |
| `tests/security.validation.test.ts` | XSS, SQLi strings, tenant isolation |
| `tests/webhook.resilience.test.ts` | WhatsApp 500 / network → booking OK + `retry` |
| `tests/db.concurrency.integration.test.ts` | Live HTTP race (opt-in) |
| `tests/helpers.ts` / `tests/setup.ts` | Fixtures + env |

Config: `vitest.config.ts` · script: `"test": "vitest run"`.

### 3.1 Concurrency suite (embedded reference)

```typescript
// tests/concurrency.booking.test.ts — assertion core
const results = await Promise.all(
  payloads.map((p) => createBookingAtomic(p)),
);
const successes = results.filter((r) => r.ok);
const failures = results.filter((r) => !r.ok);
expect(successes).toHaveLength(1);
expect(failures).toHaveLength(4);
// failures: SLOT_UNAVAILABLE | SLOT_LOCKED, status 409
```

**Production validity requirements**

- Exclusion constraint migrated (`bookings_no_overlap`)
- Prefer `REDIS_URL` in multi-instance deploys (memory locks are process-local)
- Run `tests/db.concurrency.integration.test.ts` against a real Next server

### 3.2 Timezone suite highlights

- **Closing:** duration 90, window ends 18:00 → starts at 17:00/17:30 absent; 16:30 present.
- **America/Sao_Paulo:** 09:00 local → `12:00Z` (UTC−3, no DST).
- **America/New_York:** spring-forward / fall-back produce valid distinct UTC instants.

### 3.3 Security suite highlights

- XSS stripped via `sanitizePlainText` + Zod transforms.
- SQL-looking strings accepted as **opaque text** only; `serviceId` must be UUID (injection as ID rejected).
- Wrong slug → `null` tenant; foreign service UUID → `SERVICE_NOT_FOUND`; foreign staff → `STAFF_NOT_FOUND`.

### 3.4 Webhook resilience

- Booking path does not await provider success.
- Provider HTTP 500 / `ECONNREFUSED` → delivery `status: "retry"` (worker-pickable). **Gap:** no dedicated retry worker process yet.

---

## 4. Discovered Vulnerabilities

| ID | Severity | Finding | Status |
|---|---|---|---|
| V-01 | **High** | Idempotency replay without `tenantId` check in `createBookingAtomic` could return Tenant B booking details to Tenant A request sharing the same key. | **Fixed** |
| V-02 | **Medium** | Customer `name` / `notes` accepted raw HTML/`<script>` into DB and WhatsApp templates (React escapes UI; WhatsApp/logs do not). | **Fixed** (sanitize) |
| V-03 | **Medium** | Demo booking accepted arbitrary `staffId` UUID and still computed slots (isolation hole in demo path). | **Fixed** |
| V-04 | **Low** | WhatsApp failures previously stored as terminal `failed` with no retry signal; no BullMQ/Redis job queue exists. | **Partially fixed** (`retry` status); worker still TODO |
| V-05 | **Info** | Parallel module `src/lib/booking/create-booking.ts` already had tenant-scoped idempotency; route used the weaker path. | Documented |
| V-06 | **Info** | No Postgres RLS policies in live schema despite architecture doc — app-layer `tenantId` filters only. | Residual risk |

---

## 5. Fix Implementations

| Change | Path |
|---|---|
| Resolve tenant **before** idempotency; only replay if `existing.tenantId === tenant.id`; else `IDEMPOTENCY_CONFLICT` | `src/lib/booking-service.ts` |
| `sanitizePlainText` + Zod preprocess/transform on name/notes | `src/lib/validations.ts` |
| Demo staff allow-list; async Redis/memory lock around demo create; overlap re-check; `resetDemoBookings()` for tests | `src/lib/demo-store.ts` |
| Provider HTTP/network errors → `status: "retry"`; `deliverWhatsAppForTest` export | `src/lib/whatsapp.ts` |
| Vitest + suite + npm scripts | `vitest.config.ts`, `tests/**`, `package.json` |

---

## 6. Final Deployment Checklist

- [ ] `prisma migrate deploy` includes `0_exclusion_constraint` (GiST + `btree_gist`)
- [ ] `DATABASE_URL` points at production Postgres; `DEMO_MODE` **not** enabled
- [ ] `REDIS_URL` set for multi-instance locking (do not rely on in-memory locks)
- [ ] WhatsApp env: `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`, per-tenant `waInstanceId` (instance token)
- [ ] Deploy or schedule a worker that re-sends `notification_logs` where `status = 'retry'` (or `queued` past `scheduledFor`)
- [ ] Confirm no admin/list booking API exposes cross-tenant IDs without auth (public surface today is slug-scoped only)
- [ ] Run `npm test` in CI
- [ ] Run `RUN_DB_TESTS=1` HTTP concurrency test against staging once
- [ ] Consider Postgres RLS on `tenant_id` as defense-in-depth (documented, not implemented)
- [ ] Align or delete unused `src/lib/booking/create-booking.ts` to avoid dual-path drift

---

## 7. How to Run the Suites

### Default (demo mode — no Redis/Postgres required for core suites)

```bash
npm test
# or
npx vitest run
```

### Watch mode

```bash
npm run test:watch
```

### Live DB + HTTP concurrency (optional)

```bash
# Terminal 1 — app with real DB, DEMO_MODE=false, migrations applied, seed loaded
npm run dev

# Terminal 2
set RUN_DB_TESTS=1
set TEST_BASE_URL=http://127.0.0.1:3000
set TEST_TENANT_SLUG=dom-carlos-barbearia
npm test
```

*(Unix: `export RUN_DB_TESTS=1` …)*

### Environment notes / blockers observed

| Dependency | This audit |
|---|---|
| Vitest | Installed; suites executed |
| Postgres | Present in `.env.example` / local URL; **HTTP DB race not run** (`RUN_DB_TESTS` unset) |
| Redis | Not required; memory lock used |
| WhatsApp | Mocked via `fetch` stub |
| BullMQ | **Not in project** — retry = `NotificationLog.status` |

---

## 8. Execution Results (captured)

```
✓ tests/security.validation.test.ts (7)
✓ tests/webhook.resilience.test.ts (3)
✓ tests/timezone.slots.test.ts (5)
✓ tests/concurrency.booking.test.ts (2)
↓ tests/db.concurrency.integration.test.ts (1 skipped)

Test Files  4 passed | 1 skipped
Tests       17 passed | 1 skipped
```

---

## 9. Residual Gaps

1. No automated E2E (Playwright) against the `/agendar/[slug]` UI.
2. No retry worker implementation for `status=retry` notifications.
3. Exclusion-constraint race under true multi-process load not proven in this run.
4. Architecture mentions RLS; schema does not enforce it yet.

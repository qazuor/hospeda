# E2E test infrastructure — design reference

> **Audience**: Future maintainers (and future agents) extending the billing e2e suite. Read this **before** adding a new file under `apps/api/test/e2e/`.
> **Scope**: Workstream A (CI-friendly e2e flows with a stubbed MP adapter) and the supporting helpers / setup. The sandbox path (Workstream B, real MP) is summarized at the end and detailed in [`staging-smoke-checklist.md`](./staging-smoke-checklist.md).
> **Status**: Reflects code as of SPEC-143 part-4 (commit `df2eb9445`, 2026-05-20). Update on substantive change.

---

## 1. Why a separate e2e suite

The default `pnpm test` runs unit/integration tests with mocked DBs and stubbed services — fast, isolated, no infrastructure. That suite is the right home for service-level branching, schema validation, route-factory wiring, etc.

The **e2e suite** exists to validate flows the unit layer cannot reach:

- A full request → middleware → service → DB write → response, hitting a real Postgres.
- Webhook ingress: HMAC signature verification + idempotency table writes.
- Cron handlers invoked directly (`<cron>.handler(...)`) but against real billing rows.
- Multi-step flows where ordering across rows (subscription, invoice, entitlement, limit) matters.

The cost is real: each run boots a Hono app, opens a Postgres pool, and runs sequentially (`singleFork: true`) to avoid cross-test write collisions. That cost is paid intentionally — the flows it catches would otherwise drift between unit mocks and production reality.

The boundary between unit and e2e is **the DB**: if the test asserts a row was written, mutated, or read by another row, it belongs in e2e. If it asserts a handler returned the right shape from a stubbed service, it belongs in unit.

---

## 2. Directory layout

```
apps/api/test/e2e/
├── setup/
│   ├── env-setup.ts         # Loads apps/api/.env.test FIRST, validates with ApiEnvBaseSchema
│   ├── test-database.ts     # TestDatabaseManager (pool, withRollback, clean)
│   ├── cleanup.ts           # CleanupTracker + cleanupAllTestData
│   └── seed-helpers.ts      # Baseline user/destination/plan/price seeders (idempotent)
├── helpers/
│   ├── api-client.ts        # E2EApiClient wrapper for authenticated requests
│   ├── billing-factories.ts # RO-RO factories for billing tables (customer, sub, addon, ...)
│   ├── billing-fixtures.ts  # Barrel re-exporting the three fixture modules
│   ├── webhook-events.ts    # MP IPN payload builders (what the webhook endpoint receives)
│   ├── mp-responses.ts      # QZPayProvider* response fixtures (what the stub returns)
│   ├── signature-helpers.ts # HMAC signing for x-signature header
│   ├── mp-stub.ts           # In-memory replacement for QZPayMercadoPagoAdapter
│   └── performance-utils.ts # Latency assertion helpers
├── flows/
│   └── billing/             # One file per billing flow (26 files as of part-4)
└── sandbox/                 # Workstream B — separate config, real MP sandbox
    ├── vitest.config.sandbox.ts
    ├── sandbox-config.ts
    └── mercadopago-sandbox.test.ts
```

Two structural rules:

1. **Setup is auto-applied by the vitest config** (`setupFiles: [env-setup, test-database]`). A test file never imports `test-database.ts` directly — it imports `testDb` from there.
2. **Helpers are explicit dependencies.** A flow test imports the factories, fixtures, and stub it needs. No barrel re-exports across helpers/ and setup/.

---

## 3. Vitest configuration

Two configs:

| Config | Command | When | Notes |
|---|---|---|---|
| `apps/api/vitest.config.ts` | `pnpm test` | Default suite (unit + integration) | Fast. No DB. |
| `apps/api/vitest.config.e2e.ts` | `pnpm test:e2e` | Workstream A flows + integration suites that want real DB | Loads `.env.test`, singleFork. |
| `apps/api/test/e2e/sandbox/vitest.config.sandbox.ts` | `pnpm test:sandbox` | Workstream B sandbox tests | Real MP sandbox, network retries. |

Key choices in `vitest.config.e2e.ts`:

- **`pool: 'forks'` + `singleFork: true`** — every e2e test runs in the same forked process and they run sequentially. The DB has no per-test schema isolation; sequential execution is the cheapest correctness lever. Parallel runs would require either per-test schemas (high setup cost) or per-test transaction rollback for every flow (incompatible with flows that span webhook delivery + cron + entitlement reload).
- **`setupFiles` order is load-bearing**: `env-setup.ts` MUST run before `test-database.ts`, because the latter reads `HOSPEDA_DATABASE_URL` at module load.
- **`testTimeout: 30000`, `hookTimeout: 30000`** — the slowest realistic billing flow (subscription activation + entitlement load) sits around 4–8 seconds; the 30s cap absorbs CI jitter without hiding a hang.
- **Alias block** maps `@repo/*` to source paths. This is intentional: pnpm hoisting does not always surface every transitive `@better-auth/core`, and the source-resolution path matches how the dev server boots. **If you add a new `@repo/*` package, add it here too** or the e2e suite will resolve a stale `dist/` build.
- **`@better-auth/core` alias** points at the canonical pnpm store path. This is a workaround for a pnpm peer-dep quirk — if you bump better-auth and the e2e suite starts complaining about missing core exports, regenerate that path.

The sandbox config tunes for network reality: `testTimeout: 60000`, `retry: 2`, `concurrent: false`. It does NOT share `setupFiles` with the main e2e config — it uses `test/setup.ts` (the unit suite's setup) because sandbox tests run against a fresh DB connection, not the shared `testDb`.

---

## 4. Environment loading

`apps/api/.env.test` is the single source of truth for e2e env. It defines:

- `HOSPEDA_DATABASE_URL` — must point at the **test** Postgres (port 5436 in local dev).
- `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` — `test-webhook-secret-hospeda-spec-143` (matches `signature-helpers.ts`).
- `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` — only required for sandbox tests; absent for Workstream A.
- Auth secrets, app URLs, etc. — see the file for the full list.

`env-setup.ts` does three things, in order:

1. `dotenv.config({ path: apps/api/.env.test })`.
2. `process.env.NODE_ENV = 'test'`.
3. `validateApiEnv()` — runs `ApiEnvBaseSchema` from `src/utils/env.ts`. **This means missing required vars fail the test boot, not a test mid-run.**

There is NO fallback / aliasing. SPEC-035 made `HOSPEDA_*` names canonical; the e2e setup honors that. If you're tempted to read an unprefixed var, register a `HOSPEDA_*` one in `packages/config` first.

---

## 5. The test database

### Connection lifecycle

`TestDatabaseManager` (singleton `testDb` in `setup/test-database.ts`):

- `setup()` — opens a `pg.Pool`, smoke-tests it with a single `connect/release`, hands the pool to `initializeDb()` so `getDb()` returns the shared client. Auto-invoked by the vitest setup file.
- `teardown()` — drains active transactions, closes the pool. Auto-invoked on suite end.
- `clean()` — `TRUNCATE TABLE ... CASCADE` for every table in the public schema (excluding `drizzle_migrations`). Wrapped in `session_replication_role='replica'` to defer FK checks, then re-enabled. **Only callable when `NODE_ENV === 'test'`** — the assertion is the last line of defense if someone reuses the manager outside a test env.

### Isolation strategies

Three patterns are in use across the suite. Pick the one that matches the flow.

#### A. `withRollback(fn)` — pure logic flows

```ts
await testDb.withRollback(async (tx) => {
    const { planId } = await createTestPlan({}, tx);
    const { customerId } = await createTestBillingCustomer({ externalId: '...' }, tx);
    // assertions against tx-scoped state
});
```

The sentinel-error pattern forces Drizzle to ROLLBACK the transaction on callback completion regardless of success or failure. Writes do NOT persist; subsequent tests see a clean DB.

This is the **right default** for tests that touch only billing tables and don't cross the HTTP boundary. Cheap, clean, no cleanup needed.

#### B. `clean()` between tests — flows that span HTTP requests

The Hono app uses its own DB connection (initialized through the same singleton, but the writes happen inside the request handler's connection, not the test's transaction). A transaction held by the test cannot see — or rollback — writes the request handler made. For those flows:

```ts
beforeEach(async () => {
    await testDb.clean();
    // re-seed baselines the flow needs
    await seedBillingTestPlans();
});
```

Use this for flows that POST to the API, wait for a webhook, or invoke a cron — anywhere the write happens **outside** your test's transaction.

#### C. `cleanupAllTestData()` once at end — workflow-level integration tests

For tests that need to assert against state across multiple HTTP requests where intermediate truncation would break the flow, accept that the suite sequence holds the DB and call `cleanupAllTestData()` in `afterAll`. Use sparingly — it's slow and brittle when tests are added in front.

### The deprecated `beginTransaction` / `rollbackTransaction` pair

`TestDatabaseManager.beginTransaction()` and `rollbackTransaction()` are marked `@deprecated` and intentionally preserved. They are structurally broken — Drizzle commits the transaction implicitly when the callback returns, so the client returned from `beginTransaction` points at an already-closed tx, and `rollbackTransaction` is a no-op.

Six pre-SPEC-143 test files still call them. They work in a degenerate way (the DB sees the writes as committed) — fix is part of a future cleanup task, not this spec. Do NOT use them in new code; pick A / B / C above.

---

## 6. Seeds

`setup/seed-helpers.ts` is the canonical seeder for *baseline* test rows: users, destinations, and the two reference billing plans.

```ts
const { cheap, expensive } = await seedBillingTestPlans();
// cheap.planId, cheap.monthlyPriceId, cheap.annualPriceId
// expensive.planId, expensive.monthlyPriceId, expensive.annualPriceId
```

Convention:

- **Idempotent.** Lookup by stable `name`. If the plan exists, its prices are reused unmodified. If the plan exists but a required price is missing, throws — a corrupt state we want to fail loud, not silently re-seed.
- **Stable names distinct from production.** `Test Cheap Plan` and `Test Expensive Plan` — neither name appears in the production seed (`packages/seed/src/required/billingPlans.seed.ts`), so a test run against a dev DB never collides with real seeded data.
- **ARS only.** Hospeda bills exclusively in ARS. The constant `TEST_BILLING_CURRENCY = 'ARS'` is centralized so a test cannot silently fabricate a USD price.
- **Defaults mirror production seeder shape** — same JSONB metadata keys (`slug`, `category`, `isDefault`, `sortOrder`, `trialDays`, `hasTrial`), same trial-attachment rule (only set when positive). Drift here would mean tests pass against data the production migration step doesn't produce.

The price ladder is `cheap = 1,000 ARS/month, 10,000 ARS/year`, `expensive = 5,000 ARS/month, 50,000 ARS/year` — annual = 10× monthly. Annual never has a trial; monthly `expensive` has a 14-day trial. If you need a different shape, build it inline with `createTestPlan` + `createTestPrice` — do NOT mutate the baseline.

---

## 7. Factories — `billing-factories.ts`

RO-RO factories for the four billing tables the test suite writes to most often:

- `createTestBillingCustomer({ externalId, ... }, db?)`
- `createTestSubscription({ customerId, planId, ... }, db?)`
- `createTestAddon({ ... }, db?)`
- `createTestSubscriptionAddon({ ... }, db?)`
- `createTestPromoCode({ ... }, db?)`

Rules baked into every factory:

1. **Inputs are explicit.** No factory auto-creates its dependencies. If a test wants a subscription, it must first create a customer and pass `customerId`. Surface-debuggable; you can trace what wrote what.
2. **Optional `db` parameter defaults to `getDb()`.** Pass the `tx` client from `withRollback` to scope writes inside the rolled-back transaction.
3. **Returns the new row's `id` plus the fields tests typically assert on.** No re-querying needed for the common case.
4. **`as typeof <table>.$inferInsert` cast** at the insert site. The qzpay-drizzle tables are imported from a versioned external package; the cast lets the factory survive point-version churn in column names while still surfacing required-field violations at test time.

### Naming gotchas worth remembering

- `billing_customers` has `segment`, NOT `category`. The factory's `segment` field enforces the column name.
- `billing_subscription_addons` does NOT have `livemode` or `deleted_at`. Do not invent columns.
- `billing_subscriptions.plan_id` is `varchar`, even though `billing_plans.id` is UUID. The factory passes the UUID string — qzpay accepts both UUIDs and slugs.
- `createTestBillingCustomer` returns `{ customerId, ... }`, NOT `{ id, ... }`. Destructure accordingly.
- `createTestAddon` requires `billing_interval` (NOT NULL in the table); the factory accepts it as a typed field. Do NOT bypass this with raw SQL — the typing exists for a reason.

### Provider-side customer ids

```ts
await createTestBillingCustomer({
    externalId: userId,
    providerCustomerIds: { mercadopago: 'mp_cust_xxx' }
});
```

The factory translates the map shape into the dedicated `mp_customer_id` / `stripe_customer_id` columns. The map shape is what qzpay-core hands back when it reads the row.

Required for any flow that calls `billing.subscriptions.create` (the monthly preapproval path reads `providerCustomerIds.mercadopago` and throws `QZPayValidationError` if missing). Annual one-time `checkout.create({ mode: 'payment' })` does not read it — annual tests can leave it unset.

---

## 8. Fixtures

`billing-fixtures.ts` is a barrel:

```ts
import {
    webhookEventFixtures,    // build MP IPN payloads
    providerResponseFixtures, // build QZPayProvider* shapes for the stub
    signWebhookPayload,       // produce valid x-signature header
    invalidSignatureHeaders   // produce intentionally-broken headers
} from '../../helpers/billing-fixtures';
```

### `webhook-events.ts` — what the endpoint receives

Builders for the IPN body MP POSTs to `/api/v1/webhooks/mercadopago`:

```ts
const body = webhookEventFixtures.payment({ paymentId: 'pay_test_123' });
// → { id, type: 'payment', action: 'payment.updated', data: { id: 'pay_test_123' }, ... }
```

The router dispatches by combining `type` and `action`. Every handler reads `data.id` and fetches the full object from MP via the adapter — that fetch is the call `mp-stub` intercepts.

Coverage: payment, subscription_preapproval (various actions), subscription_authorized_payment, chargebacks. Add new fixtures here when you add a new event type to the router; do NOT inline fixture shapes inside flow tests.

### `mp-responses.ts` — what the stub returns

`providerResponseFixtures` returns **QZPayProvider\*** shapes, NOT raw MP API responses. Reason: the real `QZPayMercadoPagoAdapter` receives raw MP payloads internally and transforms them into `QZPayProvider*` shapes before returning to qzpay-core. The stub sits ABOVE that transformation — its return values are what qzpay-core sees.

```ts
mpStub.config.setSuccess(
    'checkout.create',
    providerResponseFixtures.checkout({ id: 'chk_test_123' })
);
```

**Status enum drift gotcha**: the stub returns post-`mapStatus` shapes. That means `'canceled'` (US spelling, qzpay convention), NOT `'cancelled'` (UK spelling, hospeda DB convention). If you see a test fail because the assertion expected `'cancelled'` but the read returned `'canceled'`, the test is asserting too close to the stub's edge — assert against the DB read shape, not the stub's response shape.

### `signature-helpers.ts` — HMAC for webhooks

```ts
const headers = signWebhookPayload({ body: rawJson });
// → { 'x-signature': 'ts=...,v1=...', 'x-request-id': '...' }
```

Algorithm mirrors `apps/api/src/middlewares/webhook-signature.ts` exactly:

- Format: `ts=<unix_seconds>,v1=<hmac-sha256-hex>`.
- Signed payload: `id:<data.id>;request-id:<ts>;ts:<ts>;`.
- HMAC key: `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` from `.env.test`.

Use `invalidSignatureHeaders()` to exercise the rejection branch (T-143-16 coverage).

---

## 9. The API client wrapper

`E2EApiClient` (`helpers/api-client.ts`) is a thin wrapper over `app.request(...)`:

```ts
const actor = createMockUserActor({ userId: '...', role: 'USER', permissions: [...] });
const client = new E2EApiClient(app, actor);
const res = await client.post('/api/v1/protected/billing/subscriptions/start-paid', body);
```

It calls `createAuthenticatedRequest(actor)` from `apps/api/test/helpers/auth.js` to attach the bearer header `mockAuthMiddleware` expects. That middleware short-circuits Better Auth in tests; the actor is decoded directly from the header.

For unauthenticated public-tier requests, call `app.request(...)` directly with no headers — do not invent an "anonymous actor".

**Gotcha sealed in SPEC-143**: `createMockAdminActor` does NOT include `ACCESS_API_ADMIN` by default. Pass it explicitly in the `permissions` array when the route is an admin-tier endpoint. The default actor shape exists for read-only smoke tests, not for write/admin flows.

---

## 10. Test patterns sealed by SPEC-143

These are patterns that recur across the 26 billing flow files. They are not optional style; they exist because each one prevents a class of bug we hit during the spec.

### A. `vi.hoisted` + `vi.mock` for the MP stub

```ts
const stubRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error('mp-stub adapter not initialized — wire stubRef before the first request');
            }
            return stubRef.current;
        }
    };
});

// in beforeAll:
const mp = createMpStubAdapter();
stubRef.current = mp.adapter;
```

Why:

- `vi.mock` is hoisted to the top of the file by vitest's transform. A naive `const mp = createMpStubAdapter(); vi.mock(..., () => mp.adapter)` runs the factory **after** the mock factory needs it.
- `vi.hoisted` is the supported escape hatch — the ref object is created at hoist time and shared with the mock factory closure.
- The factory throws when called before initialization, so a misconfigured suite fails loud instead of routing requests to `undefined`.
- `importOriginal` preserves the rest of `@repo/billing`'s exports — without it, anything else imported from the package becomes `undefined`.

### B. `vi.mock('@repo/service-core', importOriginal)` for partial service stubs

Same shape, but for the cron handler tests that need a stubbed HTTP boundary while keeping real services everywhere else:

```ts
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        DolarApiClient: stubbedDolarApi,
        ExchangeRateApiClient: stubbedExchangeRateApi
    };
});
```

The fetcher and the model remain real — the test verifies what gets written to the DB, not what the third-party APIs returned.

### C. Cron handlers invoked directly

Crons under `apps/api/src/cron/*` expose a `handler(args)` function that takes `{ logger, startedAt, dryRun }`. Invoke it directly in tests:

```ts
const result = await exchangeRateRefreshCron.handler({
    logger: testLogger,
    startedAt: new Date(),
    dryRun: false
});
```

Do NOT spin up a scheduler. Do NOT hit an HTTP endpoint that triggers the cron. The handler is the unit of work; the scheduler is configuration.

### D. Multi-`describe` with shared parent + nested `beforeAll`/`afterAll`

When a flow has multiple sub-scenarios that share expensive setup (a seeded customer + subscription), wrap them in an outer `describe` with the shared setup, then put each scenario in a nested `describe`:

```ts
describe('Monthly checkout flow', () => {
    let setup: SharedSetup;
    beforeAll(async () => { setup = await buildSharedSetup(); });
    afterAll(async () => { await teardownSharedSetup(setup); });

    describe('happy path', () => { /* ... */ });
    describe('error paths', () => { /* ... */ });
    describe('webhook activation', () => { /* ... */ });
});
```

This is faster than re-seeding per test and clearer than a single 800-line `it` block. The outer `describe` is the unit of isolation; nested `describe`s share its setup.

### E. `vi.spyOn(Date, 'now')` for TTL boundary tests

Entitlement cache TTL, promo-code expiry, addon expiration — all read the clock. Use `vi.spyOn(Date, 'now').mockReturnValue(...)` to pin time at the boundary; restore in `afterEach`.

### F. Validator schemas — empty body returns 400 unless `.partial()`

`createOpenApiRoute` rejects an empty POST body when the schema has required fields. If a test wants to exercise the "default-everything" branch, the route must use `.partial()` or `.optional()` on its body schema. Don't fight the validator by sending a placeholder body — fix the schema.

### G. `splitAstroSrc(frontmatter, body)` for web-side source reading

Vitest cannot render `.astro` files (no DOM, no Astro runtime in Node). Web-side tests open the source file and assert against its text. For "no sensitive data in rendered output" assertions, use `splitAstroSrc()` to scope the regex to the body only — JSDoc in the frontmatter is legitimate documentation and would false-positive a body-scoped check.

See `apps/web/CLAUDE.md` for the full pattern.

---

## 11. Workstream A vs Workstream B

**Workstream A** (this document): CI-friendly e2e flows using `mp-stub`. No network. Run on every PR via `pnpm test:e2e`. 26 billing flow files + integration suites. Owns the "does our code do the right thing in isolation" question.

**Workstream B**: Manual staging smoke against the real MP sandbox. Lives in `apps/api/test/e2e/sandbox/` + the checklist at [`staging-smoke-checklist.md`](./staging-smoke-checklist.md). Owns the "does our stub agree with real MP" question.

The distinction matters because the stub is a model of MP, not MP itself. CI gives confidence in our logic; staging smoke gives confidence in the model. Both are required for billing-touching PRs (see the CLAUDE.md rule shipped in T-143-54).

The sandbox config uses `applyTestControl` (from `packages/billing/src/adapters/qzpay-test-control.ts`) — a wrapper that injects failures into specific operations of the REAL adapter, used to exercise error paths against a real MP response baseline. Do not confuse it with `mp-stub`: `qzpay-test-control` needs real sandbox credentials to provide success-path responses; `mp-stub` is the entire adapter.

---

## 12. Running the suite

```bash
# Default unit + integration (no DB)
cd apps/api && pnpm test

# E2E with real Postgres (uses .env.test, port 5436)
cd apps/api && pnpm test:e2e

# Single e2e file
cd apps/api && pnpm test:e2e test/e2e/flows/billing/monthly-checkout.test.ts

# Sandbox tests against real MP (needs HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN sandbox token)
cd apps/api && pnpm test:sandbox
```

If the DB is dropped between sessions:

```bash
HOSPEDA_DATABASE_URL='postgresql://hospeda_user:hospeda_pass@localhost:5436/hospeda_test' \
  (cd packages/db && pnpm db:push)
packages/db/scripts/apply-postgres-extras.sh
```

The `apply-postgres-extras.sh` step is mandatory — it installs triggers, materialized views, and JSONB CHECK constraints that `drizzle-kit push` does not see. Skipping it produces a schema that passes `pnpm test:e2e` but breaks anything that depends on `search_index` or the addon-purchase constraints. See [ADR-017](../../../../docs/decisions/ADR-017-postgres-specific-features.md).

---

## 13. When to add a new file

| Want to test | Goes in | Setup pattern |
|---|---|---|
| Service-level branching (success/error returns) | `apps/api/test/services/` (unit) | mocked DB |
| Route factory wiring / schema validation | `apps/api/test/route-factory/` (unit) | mocked services |
| One HTTP request → one DB row written | `apps/api/test/integration/<entity>/` | real DB via `testDb.clean()` |
| Multi-step billing flow with webhooks + crons + entitlement reload | `apps/api/test/e2e/flows/billing/` | `mp-stub` + `testDb.clean()` per `beforeEach` |
| Cron job invoked directly with real DB writes | `apps/api/test/e2e/flows/billing/` (despite name) | `vi.mock('@repo/service-core', importOriginal)` for HTTP boundary, `<cron>.handler(...)` for invocation |
| "Does real MP agree with our stub" | `apps/api/test/e2e/sandbox/` | sandbox config, real credentials |

If you're unsure: start in `integration/`, promote to `e2e/flows/` when the flow needs more than one request to express.

---

## 14. Cross-references

- [`mp-stub-architecture.md`](./mp-stub-architecture.md) — the stub's contract, response modes, and wiring pattern in depth.
- [`staging-smoke-checklist.md`](./staging-smoke-checklist.md) — Workstream B execution checklist (Phase 1, 2, 3).
- [`prod-smoke-checklist.md`](./prod-smoke-checklist.md) — production smoke + rollback procedures for billing-CORE PRs.
- [`mp-test-cards-reference.md`](./mp-test-cards-reference.md) — MP sandbox card numbers and outcome codes.
- Root [`CLAUDE.md`](../../../../CLAUDE.md) — "Billing testing — manual smoke checklist required (SPEC-143)" section codifies the merge-gate rule.
- [ADR-017](../../../../docs/decisions/ADR-017-postgres-specific-features.md) — why `apply-postgres-extras.sh` exists.
- SPEC-143 spec.md — the originating spec, full task list, decision provenance.

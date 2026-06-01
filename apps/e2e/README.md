# `hospeda-e2e` — End-to-End Test Suite (SPEC-092)

This package contains the cross-app E2E test suite for the Hospeda platform. Tests run against **real builds** of `apps/api`, `apps/admin`, and `apps/web` connected to a dedicated Postgres (port 5433), Redis (port 6380), and Mailpit (ports 1025/8025) — see [`docker-compose.e2e.yml`](./docker-compose.e2e.yml).

> **Philosophy.** Every test exercises the real system as close to production as possible. Mocks exist only where real behaviour is impossible to reproduce in CI (e.g. inbound MercadoPago webhook callbacks without ngrok, deterministic QZPay failures via the `qzpay-test-control` flag).

## Quick start (local)

```bash
# 1. Bring up the dependencies (Postgres :5433, Redis :6380, Mailpit)
pnpm --filter hospeda-e2e e2e:up

# 2. Install Playwright browsers (one-time)
pnpm --filter hospeda-e2e e2e:install

# 3. Apply migrations + seed the E2E DB
HOSPEDA_E2E_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@localhost:5433/hospeda_e2e \
  pnpm --filter hospeda-e2e e2e:seed

# 4. Build the apps the suite drives
pnpm exec turbo run build --filter=hospeda-api --filter=hospeda-admin --filter=hospeda-web

# 5. Run the suite
pnpm --filter hospeda-e2e e2e:test          # all tests
pnpm --filter hospeda-e2e e2e:test:p0       # blocker tier only (~5-6 min)
pnpm --filter hospeda-e2e e2e:test:p1       # high priority
pnpm --filter hospeda-e2e e2e:test:resilience

# 6. Open the HTML report after a failed run
pnpm --filter hospeda-e2e e2e:report

# 7. Tear everything down
pnpm --filter hospeda-e2e e2e:down
```

### Run a single test

```bash
pnpm --filter hospeda-e2e exec playwright test tests/host/host-01-onboarding-handoff.spec.ts
```

Use `--debug` to step through interactively, `--headed` to watch the browser, `--trace=on` to force trace capture even on success.

## Folder layout

```
apps/e2e/
├── playwright.config.ts          Workers / reporters / projects
├── docker-compose.e2e.yml        PG :5433, Redis :6380, Mailpit
├── tests/
│   ├── host/                     HOST-01..07: onboarding, billing, edge cases
│   ├── accommodation/            ACC-01..04: publish/edit/unpublish/delete
│   ├── guest/                    GUEST-01..03: discovery, i18n, favorites
│   ├── security/                 SEC-01..03: isolation + paywall
│   ├── messaging/                MSG-01: conversation + notifications
│   ├── admin/                    ADM-01..04: moderation, metrics, users, plans
│   ├── spec-096/                 E2E-1..10: cross-app web/admin journeys
│   └── resilience/               RES-01..06: failures, idempotency, concurrency
├── fixtures/
│   ├── api-helpers.ts            Real API calls: signup, onboarding, accommodations
│   ├── db-helpers.ts             Direct SQL helpers (force trial expired, demote, etc.)
│   ├── mailpit-client.ts         Wait for / read / clear emails via Mailpit API
│   ├── mp-webhook-helper.ts      Sign + post simulated MP webhooks
│   ├── cloudinary-client.ts      Verify asset existence/absence in Cloudinary
│   ├── qzpay-test-control.ts     HTTP client for the QZPay test-only adapter flag
│   └── revalidation-spy.ts       Assert which paths the system scheduled for revalidation
├── seeds/
│   └── e2e-seed.ts               CLI: reset + seed E2E DB via @repo/seed
├── support/
│   ├── build-and-preview.ts      Spawn api/admin/web in preview mode + health-poll
│   └── test-cleanup.ts           cleanupTestUsers + truncateAllForE2E (trigger bypass)
└── README.md                     This file
```

## Test authoring contract

Every new test in `tests/` MUST follow these 7 rules. CI rejects PRs that break them.

1. **Be independent.** Create your own data via `fixtures/api-helpers.ts`. Never rely on side-effects of another test or on a specific seed row beyond the suite-level seed (`seeds/e2e-seed.ts`).
2. **Use fixtures, not raw setup.** Never call `pg.Pool` or `fetch` directly to create entities. The fixtures wrap setup so tests stay focused on behaviour, not plumbing.
3. **Have explicit timeouts.** Every `waitFor`, `expect.toPass`, `mailpitClient.waitForEmail`, etc. must specify a `timeoutMs`. No infinite waits.
4. **Tag correctly.** Every test MUST have at least `@p0` or `@p1` plus an actor tag (`@host`, `@guest`, `@admin`) and one or more feature tags (`@billing`, `@cloudinary`, `@i18n`, `@security`, `@messaging`, `@cache`, `@resilience`, etc.). See `spec.md` § Tag Vocabulary.
5. **Document preconditions.** The first paragraph of the docblock lists every required seed row, env var, or external account.
6. **Run locally.** A developer must be able to run a single test in isolation with `pnpm e2e:test path/to/test.spec.ts` after `e2e:up` + `e2e:seed`. If the test depends on a feature that isn't toggled by `e2e:up`, document the extra setup in the docblock.
7. **Never skip silently.** Use `test.fixme(condition, reason)` with an explicit reason and a follow-up issue link. Never use bare `test.skip()`.

### Cleanup

Every test MUST clean up its created data in an `afterEach` (or scoped fixture):

```ts
import { cleanupTestUsers } from '../../support/test-cleanup.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';

let userIds: string[] = [];

test.afterEach(async () => {
    if (userIds.length > 0) {
        await cleanupTestUsers(getDbPool(), userIds);
        userIds = [];
    }
});
```

Cleanup uses `SET LOCAL session_replication_role='replica'` to bypass the pre-existing `delete_entity_bookmarks` trigger bug from migration 0014 (see SPEC-061). This is safe because tests own their data end-to-end.

## Fixture catalog

| Fixture | Purpose | Notes |
|---|---|---|
| `api-helpers.ts` | Programmatic creation of users, accommodations, subscriptions, conversations | Hits real `/api` endpoints. Returns IDs + session cookies. |
| `db-helpers.ts` | Force fixture states the API can't expose (expired trial, past period_end) | Direct SQL via `pg.Pool`. Use sparingly. |
| `mailpit-client.ts` | Wait for verification / reset / notification emails | Polls `http://localhost:8025/api/v1/messages`. |
| `mp-webhook-helper.ts` | Simulated MP webhook POSTs (HMAC-signed) | Used by HOST-02/04/05, RES-04. Real MP sandbox checkout in HOST-02 nightly. |
| `cloudinary-client.ts` | `assetExists` / `getFolderContents` / `deleteFolder` | Used by ACC-01/04 (real Cloudinary uploads under `hospeda/e2e/{run-id}/`). |
| `qzpay-test-control.ts` | Inject deterministic QZPay failures (`failNext`, `delayNext`) | Requires `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true` on the API. Used by HOST-07c/d, RES-01/04. |
| `revalidation-spy.ts` | Assert which paths the RevalidationService scheduled | Reads from `revalidation_log`. Used by ACC-02 and E2E-10. |

## Modes

`playwright.config.ts` reads `E2E_MODE` to tune workers / retries:

| `E2E_MODE` | Workers | Retries | Use case |
|---|---|---|---|
| (unset) | 1 | 0 | Local dev — fast feedback |
| `pr` | 4 | 1 | PR CI — `e2e-pr.yml` |
| `nightly` | 2 | 2 | Nightly CI — `e2e-nightly.yml` (rate-limited externals) |

## Concrete fixture usage

The patterns below were extracted from the 34 specs authored under SPEC-092. Copy these into new tests rather than reinventing.

### Setup paid host with active subscription

```ts
const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
userId = host.id;                    // for cleanup
await forceVerifyEmail(host.id);

const planRows = await execSQL<{ id: string }>(
    `SELECT id FROM billing_plans WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
);
const planId = planRows[0]?.id;
if (!planId) {
    test.fixme(true, 'No billing plan in seed — <TEST-ID> cannot run');
    return;
}
await createSubscription({ userId: host.id, planId, status: 'active' });

const accommodation = await createAccommodation({
    ownerId: host.id,
    lifecycleState: 'ACTIVE',
    slugPrefix: '<test-id>'
});
```

### Cross-origin session cookie (admin/web from API session)

```ts
await page.context().addCookies(
    user.sessionCookie.split('; ').map((c) => {
        const [name, ...rest] = c.split('=');
        return {
            name: (name ?? '').trim(),
            value: rest.join('='),
            url: ADMIN_URL
        };
    })
);
```

### Conditional skip when an external is not configured

```ts
const qzpayControl = createQZPayTestControl(API_URL);
try {
    await qzpayControl.snapshot();          // any method — first 404 reveals the gate
} catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    test.fixme(
        /qzpay-test-control endpoint not mounted/.test(msg),
        'qzpay-test-control disabled — set HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true on API'
    );
    return;
}
await qzpayControl.reset();                 // clear queues + recorded calls between tests
```

### Revalidation assertion (audit-log driven)

```ts
const since = captureRevalidationCheckpoint();   // BEFORE the action
await page.request.patch(`${API_URL}/api/v1/protected/accommodations/${id}`, { /* ... */ });
await assertRevalidationTriggered({
    since,
    entityType: 'accommodation',
    entityId: id,
    timeoutMs: 5_000
});
```

### Cloudinary leg with graceful skip

```ts
function isCloudinaryConfigured(): boolean {
    try { getCloudinaryEnv(); return true; } catch { return false; }
}

if (!isCloudinaryConfigured()) {
    test.info().annotations.push({
        type: 'note',
        description: 'Cloudinary credentials missing — skipping <leg name>'
    });
    return;
}
const folderRoot = buildE2eFolderRoot();
const resources = await getFolderContents(folderRoot);
```

### Type-cast row helper for `execSQL`

`execSQL<T>` uses `T extends Record<string, unknown>`. When projecting custom columns, use a `type` alias intersected with `Record<string, unknown>` — `interface` does not satisfy the constraint.

```ts
type AddonPurchaseRow = {
    id: string;
    status: string;
    customer_id: string;
} & Record<string, unknown>;

const rows = await execSQL<AddonPurchaseRow>(`SELECT id, status, customer_id FROM ...`);
```

## Common pitfalls (discovered during authoring)

1. **`interface` rejected by `execSQL<T>`.** Use `type X = { ... } & Record<string, unknown>` instead. TS 5 does not auto-widen interfaces to satisfy the index-signature constraint.
2. **Snake-case columns vs camelCase fields.** DB columns are snake_case (`first_name`, `lifecycle_state`); request bodies / API responses are camelCase (`firstName`, `lifecycleState`). Don't mix them in `execSQL` projections.
3. **`createSubscription` requires a real plan id.** The fixture inserts a `billing_subscriptions` row; the FK to `billing_plans.id` is enforced at the DB level. Always pull the plan id from a `SELECT id FROM billing_plans WHERE is_active = true` first; do NOT pass a hard-coded UUID.
4. **`drizzle-kit push` is not enough.** Triggers, materialized views, and JSONB CHECK constraints on `billing_addon_purchases` are invisible to Drizzle. After any push, run `packages/db/scripts/apply-postgres-extras.sh`. The E2E seed step does this automatically; manual runs must too.
5. **Cancellation has TWO bits to flip.** `status='cancelled'` AND `current_period_end` (preserved during grace, forced past for expired). HOST-04 / E2E-8 both exercise this; copy that pattern rather than rolling your own.
6. **`test.fixme(condition, reason)` accepts a runtime check.** Use it for env-gated test legs (no MP secret, no Cloudinary creds, no qzpay-test-control mount) — the test reports `fixme` in the HTML report rather than `skip`, which is a contract requirement (rule #7).
7. **Webhook endpoint dispatch by URL segment.** `payment.*` events go to `/api/v1/webhooks/mercadopago/payment`; everything else to `/notifications`. The `mp-webhook-helper.ts` routes correctly — don't override `routeForEvent`.
8. **Soft delete may keep the row visible to admin.** The protected DELETE on accommodations sets `deleted_at`; the public surface returns `404`/`null` but the admin surface may still expose the row (with the deleted flag). When asserting "gone", target the public endpoint, not the admin one.
9. **Rate limits hit during burst tests.** `createSimpleRoute({customRateLimit: ...})` is enforced before middleware-level pool exhaustion. RES-02's 100-concurrent-burst may saturate the rate limit window before the pool. Both 429 and 503 are accepted — explicitly avoid asserting "exactly 503".
10. **Cookie cross-origin parsing.** `signupUser` returns `sessionCookie` as a single semicolon-joined header. When attaching to `page.context()`, split on `;` and trim whitespace before passing to `addCookies({name, value, url})`.

## Performance guidelines

- **Sub-test setup target**: < 2s. Hit a billing plan once (cached via SELECT, not via createPlan); reuse across tests in a describe block where safe.
- **`waitFor*` ceilings**: 5s for revalidation log, 10s for Mailpit emails, 8s for QZPay-test-control state. Anything longer is almost certainly a bug, not a slow CI runner.
- **Avoid `page.goto` when API verification suffices**. Cookie-attach + `page.request.get/post` is 5-10× faster than full page navigation. Use UI navigation only when asserting visible DOM state (HOST-01, ACC-01).
- **Keep cleanup focused**. `cleanupTestUsers` cascades to subscriptions, accommodations, conversations, addon purchases. Don't manually delete those tables — let the support helper do it.
- **Parallel tests**. Each test owns its own user; the suite is safe at 4 workers. Tests that touch shared rows (counters, system-wide rate limits) use `test.describe.serial(...)` or run on the burn-in track only.

## Debugging a failure

1. **HTML report**: `pnpm e2e:report` opens the latest run's report. Click the failed test → see steps, console, network.
2. **Trace**: capture is on for first retry only. Open `apps/e2e/test-results/<test>/trace.zip` with `pnpm exec playwright show-trace <path>`.
3. **Video**: `apps/e2e/test-results/<test>/video.webm`. Watch the failure live.
4. **Console + network**: in the trace viewer, switch to the Console / Network tabs.
5. **Re-run a single test in headed mode**:

    ```bash
    pnpm exec playwright test path/to/test.spec.ts --headed --debug --trace=on
    ```

6. **DB state at failure**: tests print user IDs to the test output. Connect to `localhost:5433` and inspect.

### Failure-pattern cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `403` from PATCH protected/accommodations | Subscription not active OR ownership check on a different actor | Confirm `createSubscription({status:'active'})` ran AND the cookie matches `ownerId` |
| `409` / unique constraint on `idx_addon_purchases_active_unique` | Duplicate active addon row | Reset state in `afterEach`, or use a different `addon_slug` per test |
| `500` from `/admin/billing/...` for super_admin | Permission check missing the right `PermissionEnum` | Confirm `createUser({role:'SUPER_ADMIN'})` was used; `setUserRole` flips role atomically |
| Mailpit timeout | SMTP transport not wired OR the email subject regex doesn't match locale | Check Mailpit web UI at :8025 for the actual subject line |
| `qzpay-test-control endpoint not mounted` | Env gate missing on the API process | Restart API with `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true` |
| Webhook returns 401 | HMAC signature mismatch | Confirm `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is set in BOTH the API process and this test process |
| `lifecycle_state` returns `'DRAFT'` after PATCH `lifecycleState:'ACTIVE'` | Subscription gate blocked publish — paywall returned 402/403 | Inspect the response status; look for HOST-07b / HOST-04 expected behavior |

## CI scripts (`scripts/ci/`)

These run as part of `e2e-nightly.yml` (and some on every PR). They live outside `apps/e2e/` because they validate static artifacts and don't drive a browser.

### `check-unsafe-ilike.sh` — SPEC-092 T-089

Detects raw `ilike()` calls or imports outside the allowlist (`drizzle-helpers.ts`).

- **Where it runs**: pre-commit hook (only when `*.ts`/`*.tsx` files are staged), main CI (`ci.yml`), nightly.
- **How to fix a failure**: replace `ilike()` with `safeIlike()` from `@repo/db`. The latter auto-escapes `%`, `_`, and `\` to prevent LIKE wildcard injection.
- **Exception**: add `// check-unsafe-ilike: ignore` on the line if there's a documented justification.

### `seo-validator.ts` — SPEC-092 T-091/T-092

Crawls public web pages and asserts:

- `<title>` present, 10-70 chars
- `<meta name="description">` present, 50-200 chars
- `<link rel="canonical">` present
- OpenGraph block (`og:title`, `og:description`, `og:image`, `og:url`)
- Twitter card metadata
- At least one JSON-LD block, valid JSON, with expected `@type` per page

Targets are configured in `scripts/ci/seo-targets.json` (optional) or use the embedded defaults: `/`, `/alojamientos/`, `/destinos/`, `/eventos/`, `/publicaciones/`.

- **Env**: `HOSPEDA_SEO_VALIDATOR_BASE_URL` (default `http://localhost:4321`)
- **How to fix a failure**: open the failing URL in the browser, run View Source, look for the missing tag. Most regressions are missing `og:image` after a layout refactor.

### `sitemap-validator.ts` — SPEC-092 T-093

Validates `sitemap.xml` and `robots.txt`:

- `sitemap.xml` is reachable, parses as XML, has at least one `<loc>`
- `robots.txt` is reachable, has `User-agent` + `Sitemap` directives
- The `Sitemap:` URL in `robots.txt` matches the actual sitemap URL
- Spot-checks that the first N URLs (default 50) respond with 2xx/3xx

- **Env**:
  - `HOSPEDA_SITEMAP_VALIDATOR_BASE_URL` (default `http://localhost:4321`)
  - `HOSPEDA_SITEMAP_VALIDATOR_MAX_URL_CHECK` (default 50)
- **How to fix a failure**: regenerate `sitemap.xml` via the Astro integration; verify `robots.txt` template includes `Sitemap: ${SITE_URL}/sitemap.xml`.

## Known limitations

- **MP webhook in CI is simulated, not real-inbound.** PR + nightly both POST a signed payload to the webhook endpoint after the checkout completes. The "MP sandbox really sends the webhook over the public internet" path is validated **manually in staging** before each release (documented in `docs/deployment/checklist-pre-release-manual.es.md`).
- **Cloudinary uploads are real.** Each run uses `hospeda/e2e/{run-id}/`. The `cloudinary-e2e-cleanup.job.ts` cron sweeps folders weekly as a safety net.
- **Trigger bypass during cleanup.** `delete_entity_bookmarks` (manual migration 0014) has a known enum-vs-text bug. `cleanupTestUsers` skips triggers for the duration of the cleanup transaction.

## Adding a new test

1. Pick the right folder under `tests/` (`host/`, `accommodation/`, etc.).
2. Copy an existing test from the same folder as a starting point.
3. Use only fixtures — no inline `pg.Pool` or `fetch` calls.
4. Add tags. Run with `--grep` to confirm filtering works.
5. Run locally three times. If it's flaky, fix the timing before pushing.
6. Add a docblock with: actors, preconditions, what the test validates, cleanup notes.

## Related

- `.qtm/specs/SPEC-092-e2e-test-suite/spec.md` — full spec
- `.qtm/tasks/SPEC-092-e2e-test-suite/TODOs.md` — task tracker
- `.github/workflows/e2e-pr.yml` — PR CI
- `.github/workflows/e2e-nightly.yml` — nightly CI
- `docs/deployment/first-time-setup.md` § 1.5.b/1.7.b/1.7.c — Cloudinary E2E folder, MP test accounts, ngrok manual staging path
- `docs/deployment/checklist-pre-release-manual.es.md` — owner-manual pre-release checklist (Spanish)

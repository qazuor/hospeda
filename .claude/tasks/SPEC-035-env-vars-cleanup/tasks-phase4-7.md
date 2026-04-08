# SPEC-035: Task Plan — Phases 4–7 (Gaps)

> Generated: 2026-03-07
> Covers: Phase 4 (Code Consistency), Phase 5 (Test Coverage), Phase 6 (Documentation Fixes), Phase 7 (Cleanup & Tooling)
> Task IDs: T-050 through T-075
> Prerequisite tasks from existing plan: T-006 (API schema), T-017 (test renames), T-029 (web schema), T-031 (admin schema)

---

## Parallel Tracks & Critical Path

```
Track A (API raw reads):   T-050 → T-051 → T-052
Track B (Admin/Web raw):   T-053 → T-054
Track C (Test fixes):      T-055 → T-056 → T-057 → T-058 → T-059 → T-060
Track D (Docs):            T-061 → T-062 → T-063 → T-064 → T-065
Track E (Tooling):         T-066 → T-067 → T-068 → T-069

Merge point:               T-070 (final state audit — GAP-000)
```

**Critical path:** T-050 → T-051 → T-052 → T-059 → T-060 → T-070

---

## Phase 4: Code Consistency

_Replace direct env reads with validated helpers across the codebase._
_Dependencies: T-006 (API schema complete), T-029 (web schema), T-031 (admin schema)._

---

### T-050 — Replace raw `process.env.NODE_ENV` reads in API routes and utilities

**Phase:** core
**Complexity:** 3
**blockedBy:** `T-006`
**blocks:** `T-052`
**Tags:** api, consistency

**Description:**

Replace 14 raw `process.env.NODE_ENV` reads in `apps/api/src/` with `env.NODE_ENV` from the validated env object. Covers files not addressed by T-009 through T-014:

- `apps/api/src/lib/sentry.ts`: `process.env.NODE_ENV` reads (any remaining after T-012)
- `apps/api/src/utils/create-app.ts`: `process.env.NODE_ENV` (any remaining after T-011)
- `apps/api/src/utils/configure-open-api.ts`: raw `process.env.NODE_ENV`
- `apps/api/src/middlewares/rate-limit.ts`: raw `process.env.NODE_ENV` (any remaining after T-009)
- `apps/api/src/routes/health/*.ts`: raw `process.env.NODE_ENV`
- `apps/api/src/routes/index.ts`: raw `process.env.NODE_ENV`

Acceptance criteria:
- Zero raw `process.env.NODE_ENV` reads remain in `apps/api/src/`
- TypeScript compiles cleanly (`pnpm --filter api typecheck`)
- Existing API tests still pass

```json
{
  "id": "T-050",
  "title": "Replace raw process.env.NODE_ENV reads in API routes and utilities (GAP-004 Part A)",
  "description": "Replace 14 raw process.env.NODE_ENV reads in apps/api/src/ with env.NODE_ENV.\n\nFiles: apps/api/src/utils/configure-open-api.ts, apps/api/src/routes/health/*.ts, apps/api/src/routes/index.ts, plus verification of lib/sentry.ts, utils/create-app.ts, middlewares/rate-limit.ts (remaining reads after T-009/T-012).\n\nAcceptance: Zero raw process.env.NODE_ENV remain in apps/api/src/. pnpm typecheck passes.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-006"],
  "blocks": ["T-052"],
  "subtasks": [
    { "title": "Grep apps/api/src/ for process.env.NODE_ENV and list all locations", "completed": false },
    { "title": "Replace each raw read with env.NODE_ENV (import env from utils/env.ts if needed)", "completed": false },
    { "title": "Run pnpm --filter api typecheck to verify no type errors", "completed": false },
    { "title": "Run pnpm --filter api test to verify no regressions", "completed": false }
  ],
  "tags": ["api", "consistency"],
  "phase": "core",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-051 — Add VERCEL, CI, VERCEL_GIT_COMMIT_SHA to ApiEnvSchema and replace raw reads (GAP-004 Part B)

**Phase:** core
**Complexity:** 3
**blockedBy:** `T-006`
**blocks:** `T-052`
**Tags:** api, schema, consistency

**Description:**

Add three platform/system vars to `apps/api/src/utils/env.ts` ApiEnvSchema:
- `VERCEL`: `z.string().optional()` (Vercel sets this to "1" when deployed)
- `CI`: `z.string().optional()` (CI environments set this)
- `VERCEL_GIT_COMMIT_SHA`: `z.string().optional()` (commit SHA injected by Vercel)

Then replace raw reads of these in:
- `apps/api/src/lib/sentry.ts`: `process.env.VERCEL_GIT_COMMIT_SHA` → `env.VERCEL_GIT_COMMIT_SHA`
- `apps/api/src/utils/create-app.ts`: `process.env.VERCEL` → `env.VERCEL`
- `apps/api/src/utils/user-cache.ts`: `process.env.VERCEL` → `env.VERCEL`
- `apps/api/src/utils/env-config-helpers.ts`: `process.env.CI` → `env.CI`
- `apps/api/src/middlewares/auth.ts`: `process.env.CI` → `env.CI` (remaining after T-009)
- `apps/api/src/middlewares/actor.ts`: `process.env.CI` → `env.CI` (remaining after T-009)

Acceptance criteria:
- All three vars are in ApiEnvSchema with `.optional()` or `.default()`
- No raw `process.env.VERCEL`, `process.env.CI`, `process.env.VERCEL_GIT_COMMIT_SHA` in `apps/api/src/`
- Registry updated if these vars are not already in `packages/config/src/env-registry.ts`

```json
{
  "id": "T-051",
  "title": "Add VERCEL/CI/VERCEL_GIT_COMMIT_SHA to ApiEnvSchema and replace raw reads (GAP-004 Part B)",
  "description": "Add VERCEL (optional string), CI (optional string), VERCEL_GIT_COMMIT_SHA (optional string) to ApiEnvSchema in apps/api/src/utils/env.ts. Replace raw process.env reads of these vars in lib/sentry.ts, utils/create-app.ts, utils/user-cache.ts, utils/env-config-helpers.ts, middlewares/auth.ts, middlewares/actor.ts.\n\nAlso verify these 3 vars exist in packages/config/src/env-registry.ts (they should be in the System category). Add if missing.\n\nFiles: apps/api/src/utils/env.ts (modify), 6 files above (modify), packages/config/src/env-registry.ts (possibly modify).\n\nAcceptance: No raw process.env.VERCEL/CI/VERCEL_GIT_COMMIT_SHA in apps/api/src/. pnpm typecheck passes.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-006"],
  "blocks": ["T-052"],
  "subtasks": [
    { "title": "Add VERCEL, CI, VERCEL_GIT_COMMIT_SHA to ApiEnvSchema", "completed": false },
    { "title": "Replace raw reads in 6 files listed above", "completed": false },
    { "title": "Verify vars exist in env-registry.ts (add if missing)", "completed": false },
    { "title": "Run pnpm --filter api typecheck", "completed": false }
  ],
  "tags": ["api", "schema", "consistency"],
  "phase": "core",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-052 — Replace raw import.meta.env reads in Admin app with env helper calls (GAP-013)

**Phase:** integration
**Complexity:** 3
**blockedBy:** `T-051`, `T-031`
**blocks:** `T-069`
**Tags:** admin, consistency

**Description:**

Replace 17 direct `import.meta.env.VITE_*` reads in `apps/admin/src/` with helper function calls from the admin env module. The admin app already has a validated env schema (T-031 complete). Add helper functions (`getApiUrl()`, `getSentryDsn()`, `isDevelopment()`, etc.) to the admin env module if they don't already exist.

Files to update:
- `apps/admin/src/routes/__root.tsx`
- `apps/admin/src/routes/auth/change-password.tsx`
- `apps/admin/src/routes/_authed/me/change-password.tsx`
- `apps/admin/src/lib/auth-client.ts`
- `apps/admin/src/lib/sentry/sentry.config.ts`
- `apps/admin/src/utils/logger.ts`
- `apps/admin/src/components/entity-pages/EntityCreateContent.tsx`
- `apps/admin/src/components/entity-pages/EntityEditContent.tsx`

Also fix GAP-036: Replace `process.env.NODE_ENV` with `isDevelopment()` in 7 admin components that read node env directly.

Acceptance criteria:
- No bare `import.meta.env.VITE_*` reads scattered in component/route files
- All reads go through typed helper functions exported from the admin env module
- `pnpm --filter admin typecheck` passes

```json
{
  "id": "T-052",
  "title": "Replace raw import.meta.env reads in Admin app with env helper calls (GAP-013 + GAP-036)",
  "description": "Replace 17 direct import.meta.env.VITE_* reads with helper calls (getApiUrl(), getSentryDsn(), isDevelopment(), etc.) in 8 admin files. Also replace process.env.NODE_ENV in 7 admin components with isDevelopment().\n\nFiles: apps/admin/src/routes/__root.tsx, routes/auth/change-password.tsx, routes/_authed/me/change-password.tsx, lib/auth-client.ts, lib/sentry/sentry.config.ts, utils/logger.ts, components/entity-pages/EntityCreateContent.tsx, EntityEditContent.tsx, and 7 additional components with process.env.NODE_ENV.\n\nFirst check if getApiUrl() etc. already exist in the admin env module. If not, add them following the helper pattern in apps/web/src/lib/env.ts.\n\nAcceptance: No scattered bare VITE_* reads or process.env.NODE_ENV in admin src/. pnpm --filter admin typecheck passes.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-031", "T-051"],
  "blocks": ["T-069"],
  "subtasks": [
    { "title": "Audit admin src/ for bare VITE_* reads and process.env.NODE_ENV usage", "completed": false },
    { "title": "Add missing helper functions to admin env module if needed", "completed": false },
    { "title": "Replace reads in 8 files (import.meta.env)", "completed": false },
    { "title": "Replace process.env.NODE_ENV in 7 admin components with isDevelopment()", "completed": false },
    { "title": "Run pnpm --filter admin typecheck", "completed": false }
  ],
  "tags": ["admin", "consistency"],
  "phase": "integration",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-053 — Replace raw PUBLIC_* reads in Web app files with env helper calls (GAP-014 + GAP-030)

**Phase:** integration
**Complexity:** 3
**blockedBy:** `T-029`, `T-030`
**blocks:** `T-069`
**Tags:** web, consistency

**Description:**

Replace 7 direct `import.meta.env.PUBLIC_*` / `import.meta.env.HOSPEDA_*` reads in `apps/web/src/` with helper calls from `apps/web/src/lib/env.ts`. The web app already has a validated env (T-029 complete) and env.ts helpers (T-030).

Files to update:
- `apps/web/src/lib/auth-client.ts`: raw `PUBLIC_API_URL` → `getApiUrl()`
- `apps/web/src/layouts/BaseLayout.astro`: raw `PUBLIC_SITE_URL` → `getSiteUrl()`
- `apps/web/src/pages/[lang]/feedback.astro`: raw `PUBLIC_API_URL` → `getApiUrl()`
- `apps/web/src/pages/[lang]/auth/signin.astro`: raw reads → helpers
- `apps/web/src/pages/[lang]/auth/signup.astro`: raw reads → helpers
- `apps/web/src/pages/[lang]/alojamientos/[slug].astro`: raw reads → helpers
- `apps/web/src/sentry.client.config.ts`: raw `PUBLIC_SENTRY_DSN` → helper

Also fix GAP-030: `signin.astro:40` and `signup.astro:38` read `import.meta.env.HOSPEDA_SITE_URL` directly. Replace with `getSiteUrl()` from env.ts.

Also fix GAP-005 if not already done: verify `validateWebEnv()` is called in `astro.config.mjs` at startup (import at top level).

Acceptance criteria:
- No bare `import.meta.env.PUBLIC_*` or `import.meta.env.HOSPEDA_*` reads in web `src/` (except in env.ts itself)
- `pnpm --filter web typecheck` passes

```json
{
  "id": "T-053",
  "title": "Replace raw PUBLIC_* reads in Web app files with env helper calls (GAP-014 + GAP-030 + GAP-005)",
  "description": "Replace 7 direct import.meta.env reads across web app files with typed helper calls from apps/web/src/lib/env.ts.\n\nFiles: lib/auth-client.ts, layouts/BaseLayout.astro, pages/[lang]/feedback.astro, pages/[lang]/auth/signin.astro, signup.astro, pages/[lang]/alojamientos/[slug].astro, sentry.client.config.ts.\n\nAlso fix signin.astro:40 and signup.astro:38 where HOSPEDA_SITE_URL is read directly (use getSiteUrl()).\n\nAlso verify validateWebEnv() is called at startup in astro.config.mjs (import statement at top, not just defined in env.ts).\n\nAcceptance: Zero bare import.meta.env.PUBLIC_* or HOSPEDA_* reads in web src/ except inside env.ts. pnpm --filter web typecheck passes.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-029", "T-030"],
  "blocks": ["T-069"],
  "subtasks": [
    { "title": "Grep web src/ for bare import.meta.env reads (excluding src/env.ts and lib/env.ts)", "completed": false },
    { "title": "Replace reads in 7 files with helper calls", "completed": false },
    { "title": "Fix signin.astro:40 and signup.astro:38 HOSPEDA_SITE_URL reads", "completed": false },
    { "title": "Verify validateWebEnv() import in astro.config.mjs", "completed": false },
    { "title": "Run pnpm --filter web typecheck", "completed": false }
  ],
  "tags": ["web", "consistency"],
  "phase": "integration",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

## Phase 5: Test Coverage

_Add missing tests for env validation schemas and fix existing test errors._
_Dependencies: T-006, T-017, T-029, T-031 (schemas must exist before testing them)._

---

### T-054 — Fix obsolete env var names in existing API test files (GAP-041 + GAP-007)

**Phase:** testing
**Complexity:** 3
**blockedBy:** `T-017`
**blocks:** `T-059`
**Tags:** api, testing, rename

**Description:**

Fix two distinct categories of broken test env var names:

**GAP-041** — `apps/api/test/utils/env.test.ts`:
- Line 166: `CRON_SECRET` → `HOSPEDA_CRON_SECRET`
- Line 319: `CRON_SECRET` → `HOSPEDA_CRON_SECRET`
- Line 335: `CRON_SECRET` → `HOSPEDA_CRON_SECRET`

**GAP-007** — Across 13+ test files in `apps/api/test/`, `packages/billing/test/`, `packages/db/test/`, `scripts/`:
- `CRON_AUTH_DISABLED` → remove (feature deleted)
- `MERCADO_PAGO_ACCESS_TOKEN` → `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET` → `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`
- `DATABASE_URL` → `HOSPEDA_DATABASE_URL`
- `PORT` → `API_PORT`
- `ADMIN_NOTIFICATION_EMAILS` → `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`

Acceptance criteria:
- `pnpm --filter api test` passes with no env-var-related failures
- No references to `CRON_AUTH_DISABLED` remain anywhere in test files
- No unprefixed `MERCADO_PAGO_*`, `DATABASE_URL`, or `ADMIN_NOTIFICATION_EMAILS` in test `vi.stubEnv()` calls

```json
{
  "id": "T-054",
  "title": "Fix obsolete env var names in existing API and package test files (GAP-041 + GAP-007)",
  "description": "Two gap fixes for incorrect env var names in test files.\n\nGAP-041: In apps/api/test/utils/env.test.ts, rename CRON_SECRET → HOSPEDA_CRON_SECRET at lines 166, 319, 335.\n\nGAP-007: Across 13+ test files in apps/api/test/, packages/billing/test/, packages/db/test/, scripts/: remove CRON_AUTH_DISABLED references; rename MERCADO_PAGO_* → HOSPEDA_MERCADO_PAGO_*, DATABASE_URL → HOSPEDA_DATABASE_URL, PORT → API_PORT, ADMIN_NOTIFICATION_EMAILS → HOSPEDA_ADMIN_NOTIFICATION_EMAILS in vi.stubEnv() and process.env assignments.\n\nAcceptance: pnpm test runs cleanly across all affected packages. No unprefixed old names remain in test files.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-017"],
  "blocks": ["T-059"],
  "subtasks": [
    { "title": "Fix CRON_SECRET in env.test.ts (3 locations)", "completed": false },
    { "title": "Grep all test files for CRON_AUTH_DISABLED and remove references", "completed": false },
    { "title": "Rename MERCADO_PAGO_* in billing test files", "completed": false },
    { "title": "Rename DATABASE_URL, PORT, ADMIN_NOTIFICATION_EMAILS in api/db test files", "completed": false },
    { "title": "Run pnpm test across affected packages", "completed": false }
  ],
  "tags": ["api", "billing", "db", "testing", "rename"],
  "phase": "testing",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-055 — Write Admin env schema tests (GAP-024)

**Phase:** testing
**Complexity:** 3
**blockedBy:** `T-031`
**blocks:** `T-059`
**Tags:** admin, testing

**Description:**

Create `apps/admin/test/env.test.ts` (currently zero tests for admin env).

Test coverage required:
- `validateAdminEnv()`: passes with valid vars, throws on missing required vars
- `getApiUrl()`: returns correct URL from VITE_API_URL
- `getBetterAuthUrl()`: returns correct URL from VITE_BETTER_AUTH_URL
- `getAdminConfig()`: returns combined config object
- `getFeatureFlags()`: correct defaults and overrides
- `getPaginationConfig()`: correct defaults (pageSize, maxPageSize)
- `isDevelopment()`: true when NODE_ENV=development
- `isProduction()`: true when NODE_ENV=production
- `isTest()`: true when NODE_ENV=test
- `getSentryDsn()`: returns optional DSN or undefined

Use `vi.stubEnv()` to set required VITE_* vars before each test. Reset with `vi.unstubAllEnvs()` in afterEach.

Acceptance criteria:
- `pnpm --filter admin test` passes
- Coverage for admin env module exceeds 80%

```json
{
  "id": "T-055",
  "title": "Write Admin env schema tests (GAP-024)",
  "description": "Create apps/admin/test/env.test.ts. Currently zero tests exist for the admin env module.\n\nTest all exported functions: validateAdminEnv(), getApiUrl(), getBetterAuthUrl(), getAdminConfig(), getFeatureFlags(), getPaginationConfig(), isDevelopment(), isProduction(), isTest(), getSentryDsn().\n\nUse vi.stubEnv() with VITE_* vars. Cover happy path, missing required var (throws), optional vars (returns undefined).\n\nFile: apps/admin/test/env.test.ts (create).\n\nAcceptance: pnpm --filter admin test passes. Admin env module coverage > 80%.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-031"],
  "blocks": ["T-059"],
  "subtasks": [
    { "title": "Create apps/admin/test/env.test.ts", "completed": false },
    { "title": "Write tests for validateAdminEnv() success and failure cases", "completed": false },
    { "title": "Write tests for all getter helpers (getApiUrl, getBetterAuthUrl, etc.)", "completed": false },
    { "title": "Write tests for isDevelopment/isProduction/isTest", "completed": false },
    { "title": "Run pnpm --filter admin test and check coverage", "completed": false }
  ],
  "tags": ["admin", "testing"],
  "phase": "testing",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-056 — Improve Web env test coverage (GAP-040)

**Phase:** testing
**Complexity:** 3
**blockedBy:** `T-029`, `T-030`
**blocks:** `T-059`
**Tags:** web, testing

**Description:**

Expand `apps/web/test/env.test.ts` from trivial coverage (~25/100) to meaningful coverage.

Add tests that:
- Stub required env vars and verify `validateWebEnv()` returns without throwing
- Verify validation error cases: missing `PUBLIC_API_URL` throws, missing `HOSPEDA_DATABASE_URL` throws
- Verify fallback behavior for optional vars (PUBLIC_SENTRY_DSN missing → undefined, not error)
- Verify each helper: `getApiUrl()`, `getSiteUrl()`, `getBetterAuthUrl()`, `getSentryDsn()`
- Verify client-side schema rejects server-only vars (security boundary test)

Use `vi.stubEnv()` and `vi.unstubAllEnvs()` pattern consistently.

Acceptance criteria:
- `pnpm --filter web test` passes
- Web env module coverage exceeds 70%

```json
{
  "id": "T-056",
  "title": "Improve Web env test coverage (GAP-040)",
  "description": "Expand apps/web/test/env.test.ts. Current coverage is ~25/100 (trivial stubs only).\n\nAdd: validateWebEnv() happy path and error cases (missing required vars), helper functions (getApiUrl, getSiteUrl, getBetterAuthUrl, getSentryDsn), optional var fallbacks, client-side schema security boundary.\n\nFile: apps/web/test/env.test.ts (modify).\n\nAcceptance: pnpm --filter web test passes. Web env module coverage > 70%.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-029", "T-030"],
  "blocks": ["T-059"],
  "subtasks": [
    { "title": "Add happy path test for validateWebEnv() with all required vars stubbed", "completed": false },
    { "title": "Add failure cases: missing PUBLIC_API_URL, missing HOSPEDA_DATABASE_URL", "completed": false },
    { "title": "Add tests for each helper function (getApiUrl, getSiteUrl, etc.)", "completed": false },
    { "title": "Add optional var fallback tests", "completed": false },
    { "title": "Run pnpm --filter web test with coverage and verify > 70%", "completed": false }
  ],
  "tags": ["web", "testing"],
  "phase": "testing",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-057 — Expand API env schema test coverage for ~80 uncovered vars (GAP-052)

**Phase:** testing
**Complexity:** 4
**blockedBy:** `T-006`, `T-054`
**blocks:** `T-059`
**Tags:** api, testing

**Description:**

Expand `apps/api/test/utils/env.test.ts` to cover the ~80 API schema vars that currently have zero test coverage.

Add test groups for:
- `HOSPEDA_CRON_*`: HOSPEDA_CRON_SECRET (required), HOSPEDA_CRON_ADAPTER (enum: node-cron|bull)
- `HOSPEDA_DB_POOL_*`: HOSPEDA_DB_POOL_MAX (number, default 10), HOSPEDA_DB_POOL_IDLE_TIMEOUT (number, default 30000)
- `HOSPEDA_MERCADO_PAGO_*`: HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN (required in prod), HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET
- `HOSPEDA_SENTRY_*`: HOSPEDA_SENTRY_DSN (url, optional), HOSPEDA_SENTRY_RELEASE (string, optional)
- `API_CORS_*`: API_CORS_ORIGIN (url), API_CORS_METHODS (string list)
- `API_RATE_LIMIT_*`: API_RATE_LIMIT_WINDOW_MS (number), API_RATE_LIMIT_MAX (number, positive)
- `API_METRICS_*`: API_METRICS_ENABLED (boolean), API_METRICS_PORT (number)

Failure tests (required vars missing, invalid URLs, out-of-range values):
- Missing HOSPEDA_DATABASE_URL → throws with readable message
- Invalid HOSPEDA_DATABASE_URL (not a url) → throws
- API_RATE_LIMIT_MAX < 1 → throws
- HOSPEDA_CRON_ADAPTER set to invalid value → throws

Acceptance criteria:
- `pnpm --filter api test` passes
- API env schema coverage exceeds 60% (from near-zero for these groups)

```json
{
  "id": "T-057",
  "title": "Expand API env schema test coverage for ~80 uncovered vars (GAP-052)",
  "description": "Expand apps/api/test/utils/env.test.ts. Currently ~80 vars have zero test coverage.\n\nAdd test groups: HOSPEDA_CRON_* (secret required, adapter enum), HOSPEDA_DB_POOL_* (numeric defaults), HOSPEDA_MERCADO_PAGO_* (prod required), HOSPEDA_SENTRY_* (optional URLs), API_CORS_* (origin url), API_RATE_LIMIT_* (numeric bounds), API_METRICS_* (boolean/number).\n\nAdd failure tests: missing required vars, invalid URLs, out-of-range numbers, invalid enum values.\n\nFile: apps/api/test/utils/env.test.ts (modify).\n\nAcceptance: pnpm --filter api test passes. Env schema coverage > 60%.",
  "status": "pending",
  "complexity": 4,
  "blockedBy": ["T-006", "T-054"],
  "blocks": ["T-059"],
  "subtasks": [
    { "title": "Add HOSPEDA_CRON_* test group", "completed": false },
    { "title": "Add HOSPEDA_DB_POOL_* test group", "completed": false },
    { "title": "Add HOSPEDA_MERCADO_PAGO_* test group", "completed": false },
    { "title": "Add HOSPEDA_SENTRY_* and API_CORS_* test groups", "completed": false },
    { "title": "Add API_RATE_LIMIT_* and API_METRICS_* test groups", "completed": false },
    { "title": "Add failure-case tests (missing required, invalid URLs, out-of-range)", "completed": false },
    { "title": "Run pnpm --filter api test with coverage", "completed": false }
  ],
  "tags": ["api", "testing"],
  "phase": "testing",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-058 — Create registry-schema cross-validation test (GAP-026)

**Phase:** testing
**Complexity:** 3
**blockedBy:** `T-006`, `T-054`
**blocks:** `T-059`
**Tags:** config, testing

**Description:**

Create `packages/config/src/__tests__/registry-schema-cross-validation.test.ts`.

This test verifies that every var in `ENV_REGISTRY` that is marked as used by `api`, `web`, or `admin` actually appears in the corresponding app's Zod schema (and vice versa). This would have caught gaps like GAP-015 (API_DEBUG_ERRORS vs HOSPEDA_API_DEBUG_ERRORS), GAP-038, and GAP-055.

Implementation approach:
1. Import `ENV_REGISTRY` from `@repo/config`
2. Import each app's schema vars list (export a `SCHEMA_KEYS` constant from each app's env.ts, or parse the Zod schema's shape)
3. For each registry entry with `apps: ['api']`, assert its `name` is in the API schema keys
4. Report mismatches as test failures with clear messages: `"Registry var HOSPEDA_FOO listed for api but not found in ApiEnvSchema"`

Note: This test lives in `packages/config` but needs to import from app schemas. Use dynamic import or a fixture approach to avoid circular dependencies.

Acceptance criteria:
- Test file created and passes
- Any genuine mismatches found during creation are documented as follow-up issues (not silently skipped)

```json
{
  "id": "T-058",
  "title": "Create registry-schema cross-validation test (GAP-026)",
  "description": "Create packages/config/src/__tests__/registry-schema-cross-validation.test.ts.\n\nThis test verifies that ENV_REGISTRY entries match the Zod schema vars in each app. For each registry entry with apps: ['api'], its name must appear in ApiEnvSchema. Same for web and admin schemas.\n\nExport SCHEMA_KEYS constant from each app env module (or use .shape approach on Zod objects). Import in test.\n\nReport mismatches with clear error messages. Document any genuine mismatches found during creation as separate follow-up tasks.\n\nFile: packages/config/src/__tests__/registry-schema-cross-validation.test.ts (create).\n\nAcceptance: Test passes. Future schema/registry drift will be caught immediately.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-006", "T-054"],
  "blocks": ["T-059"],
  "subtasks": [
    { "title": "Export SCHEMA_KEYS from apps/api/src/utils/env.ts, apps/web/src/env.ts, apps/admin env module", "completed": false },
    { "title": "Create the cross-validation test file", "completed": false },
    { "title": "Run test and document any real mismatches found", "completed": false }
  ],
  "tags": ["config", "testing"],
  "phase": "testing",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-059 — Add tests for env:pull/push/check script utilities (GAP-025)

**Phase:** testing
**Complexity:** 3
**blockedBy:** `T-054`, `T-055`, `T-056`, `T-057`, `T-058`
**blocks:** `T-070`
**Tags:** scripts, testing

**Description:**

Create basic tests for the env script utilities in `scripts/env/__tests__/`. The directory already exists (`.gitkeep`).

Test scope:
- `scripts/env/utils/registry.ts`: `getVarsForApp()` returns correct subset, `filterSecrets()` masks correctly
- `scripts/env/utils/formatters.ts`: `formatDiff()` masks secret values (security — GAP-047), `formatAuditReport()` produces correct sections
- `scripts/env/check.ts` audit logic: with a mock registry and mock env file, `printAudit()` reports OK/missing/extra correctly

Use `vi.mock()` for file system reads. Do NOT make real network calls.

Acceptance criteria:
- `pnpm --filter scripts test` or equivalent passes (or `vitest run scripts/env/__tests__/` if run from root)
- `formatDiff()` test explicitly verifies secret values are masked (`***`) not exposed

```json
{
  "id": "T-059",
  "title": "Add tests for env script utilities (GAP-025)",
  "description": "Create tests in scripts/env/__tests__/. Directory exists with .gitkeep.\n\nTest: registry.ts (getVarsForApp, filterSecrets), formatters.ts (formatDiff masks secrets per GAP-047, formatAuditReport structure), check.ts audit logic (printAudit with mock data shows OK/missing/extra).\n\nUse vi.mock() for fs reads. No real network calls.\n\nFiles: scripts/env/__tests__/registry.test.ts, scripts/env/__tests__/formatters.test.ts, scripts/env/__tests__/check.test.ts.\n\nAcceptance: All 3 test files pass. formatDiff test explicitly asserts secret masking.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": ["T-054", "T-055", "T-056", "T-057", "T-058"],
  "blocks": ["T-070"],
  "subtasks": [
    { "title": "Create scripts/env/__tests__/registry.test.ts", "completed": false },
    { "title": "Create scripts/env/__tests__/formatters.test.ts with secret masking assertion", "completed": false },
    { "title": "Create scripts/env/__tests__/check.test.ts with mock audit data", "completed": false },
    { "title": "Run tests and verify all pass", "completed": false }
  ],
  "tags": ["scripts", "testing"],
  "phase": "testing",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

## Phase 6: Documentation Fixes

_Fix wrong variable names across documentation files._
_No code dependencies — these are all documentation changes._

---

### T-060 — Delete obsolete duplicate env docs and fix docs/deployment/environments.md (GAP-006 Sub1 + Sub2 + Sub3)

**Phase:** docs
**Complexity:** 3
**blockedBy:** none
**blocks:** `T-070`
**Tags:** docs

**Description:**

Three documentation tasks that can be done together:

**Sub1 (GAP-006 Sub1):** Delete `docs/environment-variables.md` — this is a legacy duplicate of `docs/guides/environment-variables.md`. The canonical doc exists; this older file causes confusion.

**Sub2 (GAP-006 Sub2 / GAP-053):** Delete `apps/api/docs/ENVIRONMENT_VARIABLES.md` — all variable names in this file are wrong (old unprefixed names). The canonical doc is `docs/guides/environment-variables.md`. Deleting is safer than fixing 100+ wrong names.

**Sub3 (GAP-006 Sub3 / GAP-054 / GAP-042):** Rewrite `docs/deployment/environments.md`:
- Replace invented `HOSPEDA_API_*` pattern with real `API_*` names (e.g., `API_CORS_ORIGIN`, `API_RATE_LIMIT_MAX`)
- Fix `NODE_ENV=production` for staging (should be `NODE_ENV=production` with `SENTRY_ENVIRONMENT=staging`)
- Apply ~50+ corrections throughout the file

Acceptance criteria:
- `docs/environment-variables.md` is deleted (git rm)
- `apps/api/docs/ENVIRONMENT_VARIABLES.md` is deleted (git rm)
- `docs/deployment/environments.md` has all correct var names, no `HOSPEDA_API_*` pattern

```json
{
  "id": "T-060",
  "title": "Delete obsolete env docs and rewrite deployment environments doc (GAP-006 Sub1+Sub2+Sub3)",
  "description": "Three documentation cleanup tasks:\n\n1. DELETE docs/environment-variables.md (legacy duplicate of docs/guides/environment-variables.md)\n2. DELETE apps/api/docs/ENVIRONMENT_VARIABLES.md (all names wrong, canonical doc exists)\n3. REWRITE docs/deployment/environments.md: replace invented HOSPEDA_API_* pattern with real API_* names, fix staging NODE_ENV comment, ~50+ corrections.\n\nFiles to delete: docs/environment-variables.md, apps/api/docs/ENVIRONMENT_VARIABLES.md\nFile to rewrite: docs/deployment/environments.md\n\nAcceptance: Two files deleted. environments.md has zero HOSPEDA_API_* patterns.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": [],
  "blocks": ["T-070"],
  "subtasks": [
    { "title": "git rm docs/environment-variables.md", "completed": false },
    { "title": "git rm apps/api/docs/ENVIRONMENT_VARIABLES.md", "completed": false },
    { "title": "Audit docs/deployment/environments.md for wrong var names", "completed": false },
    { "title": "Fix all HOSPEDA_API_* → API_* and other wrong names in environments.md", "completed": false }
  ],
  "tags": ["docs"],
  "phase": "docs",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-061 — Fix moderate doc files with 3-10 wrong var names each (GAP-006 Sub4)

**Phase:** docs
**Complexity:** 3
**blockedBy:** none
**blocks:** `T-070`
**Tags:** docs

**Description:**

Fix wrong env var names in 8 moderate documentation files (each has 3-10 wrong names):

- `apps/api/docs/setup.md`
- `apps/api/README.md`
- `apps/api/docs/development/deployment.md`
- `apps/api/docs/middleware.md`
- `apps/api/docs/architecture.md`
- `apps/api/docs/webhooks/payment-notifications.md`
- `apps/api/docs/billing-api-endpoints.md`
- `apps/api/docs/ACCEPTED_RISKS.md`

Common corrections needed:
- `RESEND_API_KEY` → `HOSPEDA_RESEND_API_KEY`
- `WEB_URL` → `HOSPEDA_SITE_URL`
- `CRON_SECRET` → `HOSPEDA_CRON_SECRET`
- `DISABLE_AUTH` → `HOSPEDA_DISABLE_AUTH`
- `SENTRY_DSN` → `HOSPEDA_SENTRY_DSN`
- `MERCADO_PAGO_ACCESS_TOKEN` → `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`

Acceptance criteria:
- All 8 files have correct var names
- No unprefixed legacy names remain in these files

```json
{
  "id": "T-061",
  "title": "Fix moderate API doc files with wrong var names (GAP-006 Sub4)",
  "description": "Fix wrong env var names in 8 moderate files (3-10 wrong names each):\n- apps/api/docs/setup.md\n- apps/api/README.md\n- apps/api/docs/development/deployment.md\n- apps/api/docs/middleware.md\n- apps/api/docs/architecture.md\n- apps/api/docs/webhooks/payment-notifications.md\n- apps/api/docs/billing-api-endpoints.md\n- apps/api/docs/ACCEPTED_RISKS.md\n\nCommon fixes: RESEND_API_KEY→HOSPEDA_RESEND_API_KEY, WEB_URL→HOSPEDA_SITE_URL, CRON_SECRET→HOSPEDA_CRON_SECRET, DISABLE_AUTH→HOSPEDA_DISABLE_AUTH, SENTRY_DSN→HOSPEDA_SENTRY_DSN, MERCADO_PAGO_ACCESS_TOKEN→HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN.\n\nAcceptance: All 8 files corrected. No unprefixed legacy names remain.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": [],
  "blocks": ["T-070"],
  "subtasks": [
    { "title": "Audit each file for wrong var names", "completed": false },
    { "title": "Apply corrections to setup.md and README.md", "completed": false },
    { "title": "Apply corrections to deployment.md, middleware.md, architecture.md", "completed": false },
    { "title": "Apply corrections to payment-notifications.md, billing-api-endpoints.md, ACCEPTED_RISKS.md", "completed": false }
  ],
  "tags": ["docs"],
  "phase": "docs",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-062 — Fix minor doc files with 1-4 wrong var names each (GAP-006 Sub5)

**Phase:** docs
**Complexity:** 3
**blockedBy:** none
**blocks:** `T-070`
**Tags:** docs

**Description:**

Fix wrong env var names in 14 minor documentation files (each has 1-4 wrong names):

- `docs/deployment-checklist.md`
- `docs/testing/billing-manual-testing.md`
- `docs/billing/dispute-handling-v1.md`
- `docs/runbooks/sentry-setup.md`
- `docs/runbooks/monitoring.md`
- `docs/runbooks/production-bugs.md`
- `docs/resources/faq.md`
- `docs/resources/troubleshooting.md`
- `packages/notifications/README.md`
- `packages/notifications/docs/README.md`
- `packages/notifications/docs/quick-start.md`
- `packages/config/README.md`
- `packages/config/docs/api/config-reference.md`

Also fix GAP-058: broken links to `docs/monitoring/` path — update these to point to the correct path `docs/runbooks/sentry-setup.md`.

Also fix GAP-010: Remove `CRON_AUTH_DISABLED` references from:
- `apps/api/docs/cron-system.md` (35+ refs — the feature was deleted)
- `docs/deployment/billing-checklist.md`

Acceptance criteria:
- All 14 minor files corrected
- CRON_AUTH_DISABLED references removed from 2 files
- Broken `docs/monitoring/` links fixed

```json
{
  "id": "T-062",
  "title": "Fix minor doc files with wrong var names (GAP-006 Sub5 + GAP-058 + GAP-010)",
  "description": "Fix wrong env var names in 14 minor files (1-4 wrong names each). Also fix broken links to docs/monitoring/ (→ docs/runbooks/sentry-setup.md). Also remove CRON_AUTH_DISABLED references from cron-system.md (35+ refs) and billing-checklist.md.\n\nFiles: docs/deployment-checklist.md, docs/testing/billing-manual-testing.md, docs/billing/dispute-handling-v1.md, docs/runbooks/sentry-setup.md, monitoring.md, production-bugs.md, docs/resources/faq.md, troubleshooting.md, packages/notifications/README.md, notifications/docs/README.md, quick-start.md, packages/config/README.md, config/docs/api/config-reference.md.\n\nAlso: apps/api/docs/cron-system.md (remove CRON_AUTH_DISABLED), docs/deployment/billing-checklist.md (remove CRON_AUTH_DISABLED).\n\nAcceptance: All files corrected. No CRON_AUTH_DISABLED anywhere. No broken docs/monitoring/ links.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": [],
  "blocks": ["T-070"],
  "subtasks": [
    { "title": "Fix docs/deployment-checklist.md, billing-manual-testing.md, dispute-handling-v1.md", "completed": false },
    { "title": "Fix docs/runbooks/ files (sentry-setup, monitoring, production-bugs)", "completed": false },
    { "title": "Fix docs/resources/ files (faq, troubleshooting)", "completed": false },
    { "title": "Fix packages/notifications/ and packages/config/ doc files", "completed": false },
    { "title": "Remove CRON_AUTH_DISABLED from cron-system.md and billing-checklist.md", "completed": false },
    { "title": "Fix broken docs/monitoring/ links to docs/runbooks/sentry-setup.md", "completed": false }
  ],
  "tags": ["docs"],
  "phase": "docs",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-063 — Fix wrong var names in security and performance docs (GAP-059)

**Phase:** docs
**Complexity:** 2
**blockedBy:** none
**blocks:** `T-070`
**Tags:** docs, security

**Description:**

Fix wrong env var names in security and performance documentation:
- `docs/security/owasp-top-10.md`
- `docs/security/api-protection.md`
- `docs/security/billing-audit-2026-02.md`
- `docs/performance/monitoring.md`

These files are particularly important because they are used for security reviews. Wrong var names in security docs can cause confusion during audits.

Acceptance criteria:
- All 4 files have correct var names
- No unprefixed legacy names in security docs

```json
{
  "id": "T-063",
  "title": "Fix wrong var names in security and performance docs (GAP-059)",
  "description": "Fix wrong env var names in 4 security/performance docs:\n- docs/security/owasp-top-10.md\n- docs/security/api-protection.md\n- docs/security/billing-audit-2026-02.md\n- docs/performance/monitoring.md\n\nThese files are used in security reviews — wrong var names are especially harmful here.\n\nAcceptance: All 4 files have correct var names. No unprefixed legacy names.",
  "status": "pending",
  "complexity": 2,
  "blockedBy": [],
  "blocks": ["T-070"],
  "subtasks": [
    { "title": "Audit all 4 files for wrong var names", "completed": false },
    { "title": "Fix owasp-top-10.md and api-protection.md", "completed": false },
    { "title": "Fix billing-audit-2026-02.md and performance/monitoring.md", "completed": false }
  ],
  "tags": ["docs", "security"],
  "phase": "docs",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-064 — Fix JSDoc references to old var names in packages (GAP-017)

**Phase:** docs
**Complexity:** 2
**blockedBy:** none
**blocks:** `T-070`
**Tags:** docs, db, seed

**Description:**

Update JSDoc comments in package source files that reference old/wrong env var names. These are in non-test source files so they affect IDE tooltips and documentation generators.

Files:
- `packages/db/src/client.ts`: JSDoc references to `DATABASE_URL` → `HOSPEDA_DATABASE_URL`
- `packages/db/src/billing/drizzle-adapter.ts`: JSDoc with old billing var names
- `packages/seed/src/utils/superAdminLoader.ts`: JSDoc with `SEED_SUPER_ADMIN_PASSWORD` → `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`

Acceptance criteria:
- All JSDoc `@param`, `@example`, and `@description` blocks in these 3 files reference correct var names
- `pnpm --filter @repo/db typecheck` and `pnpm --filter @repo/seed typecheck` pass

```json
{
  "id": "T-064",
  "title": "Fix JSDoc references to old var names in packages (GAP-017)",
  "description": "Update JSDoc comments in 3 package source files that reference outdated env var names:\n- packages/db/src/client.ts: DATABASE_URL → HOSPEDA_DATABASE_URL in JSDoc\n- packages/db/src/billing/drizzle-adapter.ts: old billing var names in JSDoc\n- packages/seed/src/utils/superAdminLoader.ts: SEED_SUPER_ADMIN_PASSWORD → HOSPEDA_SEED_SUPER_ADMIN_PASSWORD in JSDoc\n\nAcceptance: All JSDoc blocks reference correct var names. Typecheck passes for @repo/db and @repo/seed.",
  "status": "pending",
  "complexity": 2,
  "blockedBy": [],
  "blocks": ["T-070"],
  "subtasks": [
    { "title": "Fix JSDoc in packages/db/src/client.ts", "completed": false },
    { "title": "Fix JSDoc in packages/db/src/billing/drizzle-adapter.ts", "completed": false },
    { "title": "Fix JSDoc in packages/seed/src/utils/superAdminLoader.ts", "completed": false }
  ],
  "tags": ["docs", "db", "seed"],
  "phase": "docs",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

## Phase 7: Cleanup & Tooling

_Dead code removal, ghost vars, config package cleanup, and state tracking._

---

### T-065 — Implement printAudit output logic in scripts/env/check.ts (GAP-051)

**Phase:** cleanup
**Complexity:** 3
**blockedBy:** none
**blocks:** `T-059`, `T-069`
**Tags:** scripts, tooling

**Description:**

Fix the `printAudit()` function in `scripts/env/check.ts`. The function currently has empty `for-of` loops (the audit logic was scaffolded but not implemented).

Implement actual reporting:
- **OK vars** (present in env file and schema): show only in verbose mode (`--verbose` flag). Format: `[OK] HOSPEDA_DATABASE_URL`
- **Missing vars** (in schema but not in env file): always shown. Format: `[MISSING] HOSPEDA_BETTER_AUTH_SECRET (required)`
- **Extra vars** (in env file but not in schema): always shown. Format: `[EXTRA] SOME_UNKNOWN_VAR (not in registry)`
- Use color formatting: green for OK, red for missing, yellow for extra
- Exit code: 0 if no missing/extra, 1 if any missing required, 2 if only extras

Acceptance criteria:
- `pnpm env:check` produces real output (not blank)
- Missing vars printed in red
- Extra vars printed in yellow
- `--verbose` flag shows OK vars
- Non-zero exit code when there are issues

```json
{
  "id": "T-065",
  "title": "Implement printAudit output logic in scripts/env/check.ts (GAP-051)",
  "description": "The printAudit() function in scripts/env/check.ts has empty for-of loops (scaffolded but not implemented). Implement:\n- OK vars: show in verbose mode only, green color\n- Missing vars: always shown, red color, format: [MISSING] VAR_NAME (required)\n- Extra vars: always shown, yellow color, format: [EXTRA] VAR_NAME (not in registry)\n- Exit codes: 0 = clean, 1 = missing required vars, 2 = only extras\n- Support --verbose flag\n\nFile: scripts/env/check.ts (modify).\n\nAcceptance: pnpm env:check produces real output. Exit codes are correct.",
  "status": "pending",
  "complexity": 3,
  "blockedBy": [],
  "blocks": ["T-059", "T-069"],
  "subtasks": [
    { "title": "Identify the empty for-of loops in printAudit()", "completed": false },
    { "title": "Implement OK var reporting (verbose mode)", "completed": false },
    { "title": "Implement missing var reporting (always)", "completed": false },
    { "title": "Implement extra var reporting (always)", "completed": false },
    { "title": "Add --verbose flag handling and exit codes", "completed": false },
    { "title": "Run pnpm env:check manually to verify output", "completed": false }
  ],
  "tags": ["scripts", "tooling"],
  "phase": "cleanup",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-066 — Fix turbo.json globalEnv: add missing VITE_*/PUBLIC_* vars, remove runtime secrets (GAP-003)

**Phase:** cleanup
**Complexity:** 2
**blockedBy:** `T-016`
**blocks:** `T-069`
**Tags:** build, turbo

**Description:**

Update `turbo.json` `globalEnv` array (extending T-016 which renamed vars):

**Add** (~12 missing build-affecting vars):
- All `VITE_*` vars from admin app (e.g., `VITE_API_URL`, `VITE_APP_NAME`, `VITE_BETTER_AUTH_URL`, etc.)
- All `PUBLIC_*` vars from web app (e.g., `PUBLIC_API_URL`, `PUBLIC_SITE_URL`, `PUBLIC_SENTRY_DSN`)
- `VERCEL_GIT_COMMIT_SHA` (affects Sentry release in build)
- `SENTRY_ENVIRONMENT` (affects build output)

**Remove** (runtime secrets that don't affect build output and should NOT be in globalEnv):
- `HOSPEDA_DATABASE_URL` (runtime only — changing it doesn't change compiled output)
- `HOSPEDA_BETTER_AUTH_SECRET` (runtime only)
- `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` (runtime only)
- `HOSPEDA_RESEND_API_KEY` (runtime only)

Rationale: `globalEnv` is for vars that affect the *compiled output*. Runtime secrets don't affect the build artifact; they only affect runtime behavior.

Acceptance criteria:
- All `VITE_*` and `PUBLIC_*` vars are in `globalEnv`
- Runtime-only secrets are removed from `globalEnv`
- `pnpm build` still works

```json
{
  "id": "T-066",
  "title": "Fix turbo.json globalEnv: add VITE_*/PUBLIC_* vars, remove runtime secrets (GAP-003)",
  "description": "Extend T-016 work on turbo.json globalEnv.\n\nADD: all VITE_* vars (admin), all PUBLIC_* vars (web), VERCEL_GIT_COMMIT_SHA, SENTRY_ENVIRONMENT.\n\nREMOVE: HOSPEDA_DATABASE_URL, HOSPEDA_BETTER_AUTH_SECRET, HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN, HOSPEDA_RESEND_API_KEY (runtime-only — don't affect compiled output, including in globalEnv causes unnecessary cache busting).\n\nFile: turbo.json (modify).\n\nAcceptance: All build-affecting vars in globalEnv. No runtime-only secrets. pnpm build still works.",
  "status": "pending",
  "complexity": 2,
  "blockedBy": ["T-016"],
  "blocks": ["T-069"],
  "subtasks": [
    { "title": "List all VITE_* vars from admin env schema", "completed": false },
    { "title": "List all PUBLIC_* vars from web env schema", "completed": false },
    { "title": "Add all to turbo.json globalEnv", "completed": false },
    { "title": "Remove runtime-only secrets from globalEnv", "completed": false },
    { "title": "Run pnpm build to verify no cache issues", "completed": false }
  ],
  "tags": ["build", "turbo"],
  "phase": "cleanup",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-067 — Clean up packages/email/.gitignore vestigial env patterns (GAP-020)

**Phase:** cleanup
**Complexity:** 1
**blockedBy:** none
**blocks:** `T-069`
**Tags:** cleanup, config

**Description:**

Remove vestigial env var patterns from `packages/email/.gitignore`. This file contains patterns referencing env files that were part of an old package structure (before consolidation). The patterns are stale and potentially confusing.

Review `packages/email/.gitignore` and:
1. Remove any `.env*` patterns that are now handled by root `.gitignore` or the per-app `.gitignore` files
2. Keep only patterns that are specific to the `@repo/email` package itself (build artifacts, etc.)

Acceptance criteria:
- `packages/email/.gitignore` has no stale env patterns
- Root `.gitignore` still covers `.env*` correctly

```json
{
  "id": "T-067",
  "title": "Clean up packages/email/.gitignore vestigial env patterns (GAP-020)",
  "description": "Remove vestigial .env* patterns from packages/email/.gitignore. These patterns reference an old package structure and are now handled by root .gitignore or per-app .gitignore files.\n\nReview packages/email/.gitignore. Remove any stale env patterns. Keep only @repo/email-specific patterns (build artifacts, node_modules if any).\n\nFile: packages/email/.gitignore (modify).\n\nAcceptance: No stale env patterns. Root .gitignore still covers .env* files correctly.",
  "status": "pending",
  "complexity": 1,
  "blockedBy": [],
  "blocks": ["T-069"],
  "subtasks": [
    { "title": "Read packages/email/.gitignore and identify stale env patterns", "completed": false },
    { "title": "Remove stale patterns, keeping package-specific ones", "completed": false }
  ],
  "tags": ["cleanup", "config"],
  "phase": "cleanup",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-068 — Rename root .env files to .env.local convention (GAP-001)

**Phase:** cleanup
**Complexity:** 2
**blockedBy:** `T-033`
**blocks:** `T-069`
**Tags:** cleanup, env-files

**Description:**

Rename environment files to follow the `.env.local` convention (blocked by T-033 which handles deletion of the root env files that move to per-app directories):

- Root `.env` → `.env.local` (if it still exists after T-033 cleanup)
- Root `.env.example` → keep as-is (example files do not need the `.local` suffix)
- `apps/admin/.env` → `apps/admin/.env.local` (if it still exists after T-033)
- `docker/.env` → `docker/.env.local` (if it exists)

Update `.gitignore` files to ensure `.env.local` is ignored (not `.env`) if patterns changed.

Note: T-033 may have already handled deletion. This task verifies the naming convention is correct for any remaining files and updates gitignore patterns accordingly.

Acceptance criteria:
- No bare `.env` files committed to git (only `.env.example` files)
- `.gitignore` patterns cover `.env.local` not just `.env`
- Developer workflow is documented: "copy `.env.example` to `.env.local`"

```json
{
  "id": "T-068",
  "title": "Rename root .env files to .env.local convention (GAP-001)",
  "description": "After T-033 deletes the root env files that should move to per-app directories, verify and fix the naming convention:\n- Any remaining .env file → .env.local\n- .gitignore patterns must cover .env.local\n- Update developer docs if needed: 'copy .env.example to .env.local'\n\nFiles: root .gitignore (verify/fix), any remaining .env files, docs/guides/environment-variables.md (update setup instructions).\n\nAcceptance: No bare .env files in git. .gitignore covers .env.local. Dev setup instructions say .env.local.",
  "status": "pending",
  "complexity": 2,
  "blockedBy": ["T-033"],
  "blocks": ["T-069"],
  "subtasks": [
    { "title": "List all remaining .env files (not .env.example, not .env.test)", "completed": false },
    { "title": "Rename each to .env.local", "completed": false },
    { "title": "Update .gitignore patterns to match .env.local", "completed": false },
    { "title": "Update setup docs to say 'copy to .env.local'", "completed": false }
  ],
  "tags": ["cleanup", "env-files"],
  "phase": "cleanup",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-069 — Final integration verification: typecheck, lint, test, env:check (GAP-000 pre-check)

**Phase:** cleanup
**Complexity:** 2
**blockedBy:** `T-052`, `T-053`, `T-059`, `T-065`, `T-066`, `T-067`, `T-068`
**blocks:** `T-070`
**Tags:** cleanup, verification

**Description:**

Run the full quality gate across the entire monorepo after all Phase 4-7 work is complete. This is the pre-final-verification step.

Steps:
1. `pnpm typecheck` — must pass with zero errors
2. `pnpm lint` — must pass with zero Biome errors
3. `pnpm test` — must pass with zero test failures
4. `pnpm env:check` — must report zero missing required vars (may report extras if any orphan vars remain)

Fix any remaining issues found. Document any deliberate exceptions (e.g., GAP-009 `LOG_*` prefix exception).

Acceptance criteria:
- All four commands pass
- Any exception is documented with a justification comment in the relevant file

```json
{
  "id": "T-069",
  "title": "Run full quality gate after Phase 4-7 changes (GAP-000 pre-check)",
  "description": "Run pnpm typecheck, pnpm lint, pnpm test, and pnpm env:check after all Phase 4-7 work. Fix any remaining issues. Document deliberate exceptions.\n\nAcceptance: All 4 commands pass. Exceptions documented.",
  "status": "pending",
  "complexity": 2,
  "blockedBy": ["T-052", "T-053", "T-059", "T-065", "T-066", "T-067", "T-068"],
  "blocks": ["T-070"],
  "subtasks": [
    { "title": "Run pnpm typecheck and fix errors", "completed": false },
    { "title": "Run pnpm lint and fix errors", "completed": false },
    { "title": "Run pnpm test and fix failures", "completed": false },
    { "title": "Run pnpm env:check and review output", "completed": false },
    { "title": "Document any deliberate exceptions", "completed": false }
  ],
  "tags": ["cleanup", "verification"],
  "phase": "cleanup",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

### T-070 — Re-audit SPEC-035 state.json and set correct completion status (GAP-000)

**Phase:** cleanup
**Complexity:** 2
**blockedBy:** `T-069`, `T-060`, `T-061`, `T-062`, `T-063`, `T-064`
**blocks:** none
**Tags:** cleanup, state

**Description:**

Re-audit all 49 original SPEC-035 tasks in `state.json` and set their correct completion status. Many tasks were marked `completed` prematurely (with all subtasks marked `completed: true`) but the actual code changes were not made.

Process:
1. For each task T-001 through T-049: check whether the code changes described actually exist in the codebase
2. If code exists → keep `completed`
3. If code does not exist → set `pending` (or `in_progress` if partially done)
4. Update `TODOs.md` progress count
5. Also add T-050 through T-070 to `state.json` with correct status

Also update the spec's `status` field in `metadata.json` from `draft` to `in-progress`.

Acceptance criteria:
- `state.json` accurately reflects actual implementation state
- No task is `completed` unless the code/docs change actually exists
- `TODOs.md` progress percentage is accurate
- `metadata.json` status is `in-progress`

```json
{
  "id": "T-070",
  "title": "Re-audit SPEC-035 state.json and set correct completion status (GAP-000)",
  "description": "Re-audit all 49 original tasks in .claude/tasks/SPEC-035-env-vars-cleanup/state.json and verify actual implementation state. Many tasks have all subtasks marked completed: true but the actual code may not exist.\n\nFor each task: check if the described code changes exist. Set status accordingly (completed/pending/in_progress).\n\nAlso add T-050 through T-070 to state.json.\n\nUpdate TODOs.md progress count and percentage.\n\nUpdate .claude/specs/SPEC-035-env-vars-cleanup/metadata.json status from 'draft' to 'in-progress'.\n\nFiles: .claude/tasks/SPEC-035-env-vars-cleanup/state.json (modify), TODOs.md (modify), metadata.json (modify).\n\nAcceptance: state.json accurately reflects reality. Progress count is correct.",
  "status": "pending",
  "complexity": 2,
  "blockedBy": ["T-069"],
  "blocks": [],
  "subtasks": [
    { "title": "Verify T-001 to T-023 (registry, DI, rename tasks)", "completed": false },
    { "title": "Verify T-024 to T-049 (integration, scripts, docs, cleanup tasks)", "completed": false },
    { "title": "Set correct status for each task", "completed": false },
    { "title": "Add T-050 to T-070 entries to state.json", "completed": false },
    { "title": "Update TODOs.md progress count", "completed": false },
    { "title": "Update metadata.json status to in-progress", "completed": false }
  ],
  "tags": ["cleanup", "state"],
  "phase": "cleanup",
  "qualityGate": { "lint": null, "typecheck": null, "tests": null },
  "timestamps": { "created": "2026-03-07T00:00:00.000Z", "started": null, "completed": null }
}
```

---

## Summary Table

| ID | Title | Phase | Complexity | blockedBy | blocks |
|----|-------|-------|------------|-----------|--------|
| T-050 | Replace raw NODE_ENV reads in API routes/utils (GAP-004A) | core | 3 | T-006 | T-052 |
| T-051 | Add VERCEL/CI/VERCEL_GIT_COMMIT_SHA to ApiEnvSchema (GAP-004B) | core | 3 | T-006 | T-052 |
| T-052 | Replace raw VITE_* reads in Admin with helpers (GAP-013 + GAP-036) | integration | 3 | T-031, T-051 | T-069 |
| T-053 | Replace raw PUBLIC_* reads in Web with helpers (GAP-014 + GAP-030 + GAP-005) | integration | 3 | T-029, T-030 | T-069 |
| T-054 | Fix obsolete env var names in existing test files (GAP-041 + GAP-007) | testing | 3 | T-017 | T-059 |
| T-055 | Write Admin env schema tests (GAP-024) | testing | 3 | T-031 | T-059 |
| T-056 | Improve Web env test coverage (GAP-040) | testing | 3 | T-029, T-030 | T-059 |
| T-057 | Expand API env schema tests for ~80 uncovered vars (GAP-052) | testing | 4 | T-006, T-054 | T-059 |
| T-058 | Create registry-schema cross-validation test (GAP-026) | testing | 3 | T-006, T-054 | T-059 |
| T-059 | Add tests for env script utilities (GAP-025) | testing | 3 | T-054..T-058 | T-070 |
| T-060 | Delete obsolete docs + fix environments.md (GAP-006 Sub1+2+3) | docs | 3 | — | T-070 |
| T-061 | Fix moderate API doc files (GAP-006 Sub4) | docs | 3 | — | T-070 |
| T-062 | Fix minor doc files + CRON_AUTH_DISABLED + broken links (GAP-006 Sub5 + GAP-010 + GAP-058) | docs | 3 | — | T-070 |
| T-063 | Fix security/performance doc wrong var names (GAP-059) | docs | 2 | — | T-070 |
| T-064 | Fix JSDoc references in packages (GAP-017) | docs | 2 | — | T-070 |
| T-065 | Implement printAudit output in check.ts (GAP-051) | cleanup | 3 | — | T-059, T-069 |
| T-066 | Fix turbo.json globalEnv: add VITE_*/PUBLIC_*, remove secrets (GAP-003) | cleanup | 2 | T-016 | T-069 |
| T-067 | Clean up packages/email/.gitignore (GAP-020) | cleanup | 1 | — | T-069 |
| T-068 | Rename root .env files to .env.local (GAP-001) | cleanup | 2 | T-033 | T-069 |
| T-069 | Final quality gate: typecheck + lint + test + env:check | cleanup | 2 | T-052..T-068 | T-070 |
| T-070 | Re-audit state.json and set correct status (GAP-000) | cleanup | 2 | T-069, T-060..T-064 | — |

**Total tasks:** 21 (T-050 through T-070)
**Total complexity:** 56 points
**Estimated phases:** 4 (core, integration, testing, docs/cleanup run in parallel)
**Critical path:** T-006 → T-050 → T-051 → T-052 → T-069 → T-070

---

## Parallel Execution Map

```
After T-006 (API schema) completes:
  T-050 (API NODE_ENV raw reads)
  T-051 (API VERCEL/CI schema + reads)

After T-031 (admin schema) and T-051 complete:
  T-052 (admin helpers)

After T-029 + T-030 (web schema + env.ts) complete:
  T-053 (web helpers)

After T-017 (test renames) completes:
  T-054 (test name fixes)
  T-055 (admin tests) — parallel with T-054

After T-054 completes:
  T-057 (API env schema tests)
  T-058 (registry cross-validation)

All of T-054..T-058 must complete before:
  T-059 (script utility tests)

Documentation tasks (T-060, T-061, T-062, T-063, T-064) have NO blockers —
can start immediately and run in parallel.

Cleanup tasks:
  T-065 (printAudit) — no blockers, can start now
  T-066 (turbo.json) — blocked by T-016
  T-067 (email .gitignore) — no blockers
  T-068 (rename .env files) — blocked by T-033

T-069 (full QA gate) — blocked by all Phase 4 + cleanup tasks
T-070 (state audit) — blocked by T-069 and all docs tasks
```

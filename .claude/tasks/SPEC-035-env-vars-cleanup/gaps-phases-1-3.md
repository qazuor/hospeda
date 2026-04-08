# SPEC-035 Gaps: Task Plan - Phases 1-3

> **Generated:** 2026-03-07
> **Part:** 1 of 2 (this file covers Phases 1-3)
> **Gaps covered:** GAP-016, GAP-027, GAP-047, GAP-048, GAP-032, GAP-050, GAP-049, GAP-057, GAP-011, GAP-012, GAP-033, GAP-022, GAP-002, GAP-008+GAP-019+GAP-055, GAP-015, GAP-038, GAP-039, GAP-035, GAP-037, GAP-056, GAP-018, GAP-046, GAP-043

---

## Dependency Graph Overview

```
PHASE 1 (Security - no blockers, all parallel)
  T-001  T-002  T-003  T-004  T-005  T-006  T-007
                                        |
PHASE 2 (Runtime Bugs - mostly independent)          PHASE 3 (Schema/Registry)
  T-008  T-009  T-010  T-011  T-012          T-013 (T-001..T-007 can run in parallel)
                                              T-014  T-015  T-016  T-017
                                              T-018  T-019  T-020  T-021
```

**Critical path:** T-013 (billing vars, Phase 3) depends on nothing but is highest complexity.
All Phase 1 tasks are independent and parallelizable.

---

## PHASE 1: Security Fixes (Priority: CRITICAL)

> Layer: Service/Config
> No blockers. All tasks can execute in parallel.

---

### T-001 - fix(seed): mask DATABASE_URL before logging

**Gap:** GAP-016
**Complexity:** 1
**Estimated lines changed:** ~5
**Phase:** core
**Tags:** security, seed, logging

**Description:**

`packages/seed/src/utils/db.ts:26` logs the full `HOSPEDA_DATABASE_URL` value including `user:password@host` credentials.

Fix: replace the raw value log with a masked version that shows only the host/port, hiding `user:password@`.

**Files to modify:**
- `packages/seed/src/utils/db.ts` - replace line 26 raw log with masked version

**Implementation:**
```typescript
// Before (line 26):
dbLogger.log(process.env.HOSPEDA_DATABASE_URL, '🔍 HOSPEDA_DATABASE_URL value');

// After:
const rawUrl = process.env.HOSPEDA_DATABASE_URL ?? '';
const maskedUrl = rawUrl.replace(/\/\/[^@]+@/, '//<credentials>@');
dbLogger.log(maskedUrl, '🔍 HOSPEDA_DATABASE_URL host');
```

**Acceptance criteria:**
- [ ] Line 25 (boolean presence check) remains unchanged
- [ ] Line 26 logs only `protocol://<credentials>@host:port/db` format
- [ ] No credentials appear in log output
- [ ] Unit test: assert masked output does not contain the password substring

**Dependencies:** none
**Blocks:** nothing

---

### T-002 - fix(seed): remove plaintext password from logger output

**Gap:** GAP-027
**Complexity:** 1
**Estimated lines changed:** ~3
**Phase:** core
**Tags:** security, seed, logging

**Description:**

`packages/seed/src/utils/superAdminLoader.ts:59` logs the generated super admin password in plaintext via `logger.info()`. This writes to structured logs that may be shipped to observability services.

Fix: replace `logger.info` with `console.log` (stdout only, not forwarded to log aggregators) and add a clear advisory comment. The password line should go to stdout-only at seed time, never to a persistent log stream.

**Files to modify:**
- `packages/seed/src/utils/superAdminLoader.ts` - line 59, change `logger.info` to `console.log`

**Acceptance criteria:**
- [ ] Password is emitted via `console.log` (not `logger.info`)
- [ ] JSDoc at line 14 updated: `SEED_SUPER_ADMIN_PASSWORD` -> `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` (pairs with GAP-002, T-012)
- [ ] Surrounding warning message remains intact
- [ ] Unit test: assert `logger.info` is not called with password value

**Dependencies:** none
**Blocks:** nothing

---

### T-003 - fix(scripts/env): mask secrets in formatDiff for all diff cases

**Gap:** GAP-047
**Complexity:** 2
**Estimated lines changed:** ~25
**Phase:** core
**Tags:** security, scripts, env

**Description:**

`scripts/env/utils/formatters.ts:111-126` - the `formatDiff()` function exposes secret values unmasked in 3 of 4 cases:
- `isNew` case (line 113): calls `displayValue(remote)` - no masking
- `isMissing` case (line 116): calls `displayValue(local)` - no masking
- `isSame` case (lines 124-125): calls `displayValue(local)` and `displayValue(remote)` - no masking
- `isChanged` case (lines 120-121): already calls `maskValue()` correctly

Fix: add a `secret: boolean` parameter to `FormatDiffParams` (optional, defaults to `false`). When `secret` is true, use `maskValue()` for all value displays. When false, use `displayValue()` as currently.

**Files to modify:**
- `scripts/env/utils/formatters.ts` - `FormatDiffParams` interface + `formatDiff()` function body

**Acceptance criteria:**
- [ ] `FormatDiffParams` has `readonly secret?: boolean` field
- [ ] All 4 diff cases use `maskValue()` when `secret === true`
- [ ] Non-secret vars continue to use `displayValue()` unchanged
- [ ] Callers of `formatDiff()` that pass registry entries must forward `secret` flag from registry metadata
- [ ] Unit tests cover all 4 diff cases with `secret: true` asserting no raw value in output

**Dependencies:** none
**Blocks:** nothing

---

### T-004 - fix(config): make HOSPEDA_BETTER_AUTH_SECRET required in shared schema

**Gap:** GAP-048
**Complexity:** 1
**Estimated lines changed:** ~3
**Phase:** core
**Tags:** security, config, schema

**Description:**

`packages/config/src/env.ts:299` - `HOSPEDA_BETTER_AUTH_SECRET` is declared as `.optional()` in the shared `commonEnvSchemas.auth` object. This contradicts the API's own schema where it is required. A missing auth secret in any deployed environment is a critical security gap.

Fix: remove `.optional()` from `HOSPEDA_BETTER_AUTH_SECRET` in `commonEnvSchemas.auth`. The minimum length validation (`.min(1, ...)`) already present is sufficient, the `.optional()` wrapping negates it.

**Files to modify:**
- `packages/config/src/env.ts` - line ~299, remove `.optional()` from `HOSPEDA_BETTER_AUTH_SECRET`

**Acceptance criteria:**
- [ ] `HOSPEDA_BETTER_AUTH_SECRET` is `.string().min(1, ...)` with no `.optional()` wrapper
- [ ] Existing API env schema still passes validation (it also requires this var)
- [ ] Test: `commonEnvSchemas.auth.parse({})` throws ZodError mentioning `HOSPEDA_BETTER_AUTH_SECRET`
- [ ] Test: `commonEnvSchemas.auth.parse({ HOSPEDA_BETTER_AUTH_URL: '...', HOSPEDA_BETTER_AUTH_SECRET: 'x' })` passes

**Dependencies:** none
**Blocks:** nothing

---

### T-005 - fix(api): throw on missing URLs in MercadoPago back_urls

**Gap:** GAP-032
**Complexity:** 2
**Estimated lines changed:** ~15
**Phase:** core
**Tags:** security, api, billing

**Description:**

`apps/api/src/services/addon.checkout.ts:160-161` uses localhost fallbacks for MercadoPago `back_urls`:

```typescript
const webUrl = env.HOSPEDA_SITE_URL || 'http://localhost:4321';
const apiUrl = env.HOSPEDA_API_URL || 'http://localhost:3001';
```

In production, if either URL is missing the payment confirmation/failure redirects point to localhost, making the checkout loop unrecoverable.

Fix: remove the localhost fallbacks. If either URL is not configured, throw a configuration error before creating the MercadoPago preference. These vars are required in billing context.

**Files to modify:**
- `apps/api/src/services/addon.checkout.ts` - lines 160-161, add guard and throw

**Acceptance criteria:**
- [ ] If `env.HOSPEDA_SITE_URL` is falsy, function returns a `Result` error with code `PAYMENT_NOT_CONFIGURED` (or throws, depending on existing error handling pattern in this file)
- [ ] If `env.HOSPEDA_API_URL` is falsy, same behavior
- [ ] No localhost string remains in the production code path
- [ ] Unit test: mock env with missing SITE_URL, assert error is returned before preference creation

**Dependencies:** none
**Blocks:** nothing

---

### T-006 - fix(api): add production validation for CORS/CSRF origins

**Gap:** GAP-050
**Complexity:** 3
**Estimated lines changed:** ~20
**Phase:** core
**Tags:** security, api, cors

**Description:**

`apps/api/src/utils/env.ts:115` - `API_CORS_ORIGINS` defaults to `'http://localhost:3000,http://localhost:4321'`. There is no guard preventing these localhost defaults from being used in production.

Fix: add a `superRefine` validator to the `API_CORS_ORIGINS` field (or to a post-parse step) that, when `NODE_ENV === 'production'`, rejects any origin containing `localhost` or `127.0.0.1`. Apply the same check to `API_CSRF_ORIGINS` if that field exists in the schema.

**Files to modify:**
- `apps/api/src/utils/env.ts` - add `superRefine` on `API_CORS_ORIGINS` (and `API_CSRF_ORIGINS` if present)

**Acceptance criteria:**
- [ ] `z.parse({ NODE_ENV: 'production', API_CORS_ORIGINS: 'http://localhost:3000' })` throws ZodError
- [ ] `z.parse({ NODE_ENV: 'production', API_CORS_ORIGINS: 'https://hospeda.com.ar' })` passes
- [ ] `z.parse({ NODE_ENV: 'development', API_CORS_ORIGINS: 'http://localhost:3000' })` passes
- [ ] Unit tests cover all 3 cases above
- [ ] Error message explicitly states "localhost origins not allowed in production"

**Dependencies:** none
**Blocks:** nothing

---

### T-007 - fix(api/web/admin): remove localhost fallbacks for critical URLs

**Gap:** GAP-057 + GAP-049
**Complexity:** 3
**Estimated lines changed:** ~30
**Phase:** core
**Tags:** security, api, web, admin

**Description:**

Two related issues in the same fix sweep:

**GAP-057 - Localhost fallbacks that mask misconfiguration:**
- `apps/web/src/lib/middleware-helpers.ts:159` - `process.env.PUBLIC_API_URL || 'http://localhost:3001'` fallback
- `apps/admin/src/lib/api/client.ts:34` - `(url ?? 'http://localhost:3001')` fallback
- `apps/web/src/lib/env.ts:17,27` - localhost fallbacks in validated env module

**GAP-049 - OAuth clientSecret empty string fallback:**
- `apps/api/src/lib/auth.ts:260,266` - `env.HOSPEDA_GOOGLE_CLIENT_SECRET || ''` and `env.HOSPEDA_FACEBOOK_CLIENT_SECRET || ''`

For the URL fallbacks: if the URL is not set at startup/request time, the behavior should be to fail fast with a clear error rather than silently use localhost in non-development environments.

For OAuth secrets: add a guard - if `clientId` is present but `clientSecret` is falsy, throw a configuration error during `auth.ts` initialization. Empty string is not a valid OAuth secret.

**Files to modify:**
- `apps/web/src/lib/middleware-helpers.ts` - replace fallback with explicit check + error
- `apps/admin/src/lib/api/client.ts` - replace fallback with explicit check + error
- `apps/web/src/lib/env.ts` - remove localhost defaults, make URLs required
- `apps/api/src/lib/auth.ts` - add guard for OAuth clientSecret presence

**Acceptance criteria:**
- [ ] `middleware-helpers.ts`: throws or returns error when HOSPEDA_API_URL and PUBLIC_API_URL are both absent
- [ ] `client.ts`: throws when VITE_API_URL is absent (at module init time)
- [ ] `auth.ts`: if Google clientId present but clientSecret absent/empty, throws during initialization
- [ ] `auth.ts`: same for Facebook OAuth pair
- [ ] No `|| 'http://localhost'` or `?? 'http://localhost'` patterns remain in these files
- [ ] Unit tests for OAuth guard: clientId+no secret throws; neither present is OK; both present is OK

**Dependencies:** none
**Blocks:** nothing

---

## PHASE 2: Runtime Bug Fixes (Priority: HIGH)

> Layer: App config / Client code
> All tasks are independent unless noted.

---

### T-008 - fix(admin): use VITE_SITE_URL instead of PUBLIC_SITE_URL

**Gap:** GAP-011
**Complexity:** 1
**Estimated lines changed:** ~3
**Phase:** core
**Tags:** bug, admin, env-prefix

**Description:**

`apps/admin/src/routes/auth/forbidden.tsx:55` reads `import.meta.env.PUBLIC_SITE_URL`. The admin app uses Vite, which requires the `VITE_` prefix. `PUBLIC_*` is the Astro convention and is always `undefined` in Vite.

Result: the `siteUrl` variable always resolves to the hardcoded `'http://localhost:4321'` fallback, in all environments including production.

Fix: change `PUBLIC_SITE_URL` to `VITE_SITE_URL` and add `VITE_SITE_URL` to `AdminEnvSchema` if not already present.

**Files to modify:**
- `apps/admin/src/routes/auth/forbidden.tsx` - line 55: `PUBLIC_SITE_URL` -> `VITE_SITE_URL`
- `apps/admin/src/env.ts` - add `VITE_SITE_URL` to schema if missing

**Acceptance criteria:**
- [ ] `forbidden.tsx` reads `import.meta.env.VITE_SITE_URL`
- [ ] `AdminEnvSchema` includes `VITE_SITE_URL: z.string().url().optional()`
- [ ] The localhost fallback `'http://localhost:4321'` is acceptable only as a last-resort default, not when `VITE_SITE_URL` is set
- [ ] Unit test: assert `siteUrl` uses env value when `VITE_SITE_URL` is set

**Dependencies:** none
**Blocks:** nothing

---

### T-009 - fix(web): use PUBLIC_ENABLE_LOGGING instead of VITE_ENABLE_LOGGING

**Gap:** GAP-012
**Complexity:** 1
**Estimated lines changed:** ~2
**Phase:** core
**Tags:** bug, web, env-prefix

**Description:**

`apps/web/src/lib/logger.ts:52` reads `import.meta.env.VITE_ENABLE_LOGGING`. The web app uses Astro, which requires the `PUBLIC_` prefix. `VITE_*` variables are never defined in an Astro project.

Result: the logging toggle is always `undefined`, so it evaluates to `false` in the condition, meaning logging can only be enabled in `DEV` mode, never in production preview.

Fix: change `VITE_ENABLE_LOGGING` to `PUBLIC_ENABLE_LOGGING`.

**Files to modify:**
- `apps/web/src/lib/logger.ts` - line 52: `VITE_ENABLE_LOGGING` -> `PUBLIC_ENABLE_LOGGING`

**Acceptance criteria:**
- [ ] `logger.ts` reads `import.meta.env.PUBLIC_ENABLE_LOGGING`
- [ ] Behavior: `enabled = import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_LOGGING === 'true'`
- [ ] Unit test: assert logger is enabled when `PUBLIC_ENABLE_LOGGING === 'true'`

**Dependencies:** none
**Blocks:** nothing

---

### T-010 - fix(web/admin): inject VERCEL_GIT_COMMIT_SHA via build config for Sentry

**Gap:** GAP-033
**Complexity:** 3
**Estimated lines changed:** ~20
**Phase:** core
**Tags:** bug, web, admin, sentry, build

**Description:**

`apps/web/sentry.client.config.ts` and `apps/admin/src/lib/sentry/sentry.config.ts` read `VERCEL_GIT_COMMIT_SHA` for the Sentry release name. This is a server-side Vercel environment variable - it is never available in browser bundles via `import.meta.env` unless explicitly injected during build.

Fix: inject `VERCEL_GIT_COMMIT_SHA` as a build-time constant in both apps' build config files so it becomes available as `import.meta.env.VITE_SENTRY_RELEASE` (admin) and `import.meta.env.PUBLIC_SENTRY_RELEASE` (web) in client bundles.

**Files to modify:**
- `apps/admin/vite.config.ts` - add `define: { 'import.meta.env.VITE_SENTRY_RELEASE': ... }` using `process.env.VERCEL_GIT_COMMIT_SHA`
- `apps/web/astro.config.mjs` - add `vite.define` for `PUBLIC_SENTRY_RELEASE`
- `apps/admin/src/lib/sentry/sentry.config.ts` - read `VITE_SENTRY_RELEASE` instead of raw `VERCEL_GIT_COMMIT_SHA`
- `apps/web/sentry.client.config.ts` - read `PUBLIC_SENTRY_RELEASE` instead of raw `VERCEL_GIT_COMMIT_SHA`

**Acceptance criteria:**
- [ ] Admin Sentry config reads `import.meta.env.VITE_SENTRY_RELEASE`
- [ ] Web Sentry client config reads `import.meta.env.PUBLIC_SENTRY_RELEASE`
- [ ] Both build configs inject the value at build time from `process.env.VERCEL_GIT_COMMIT_SHA`
- [ ] Fallback to `'local'` or `undefined` when var is absent (CI/local builds)
- [ ] No direct `VERCEL_GIT_COMMIT_SHA` reads remain in client-side code

**Dependencies:** none
**Blocks:** nothing

---

### T-011 - fix(admin): remove dead process.env.VITE_API_URL branch in auth-session

**Gap:** GAP-022
**Complexity:** 1
**Estimated lines changed:** ~4
**Phase:** core
**Tags:** bug, admin, dead-code

**Description:**

`apps/admin/src/lib/auth-session.ts:60`:

```typescript
const apiUrl = process.env.HOSPEDA_API_URL || process.env.VITE_API_URL || 'http://localhost:3001';
```

`process.env.VITE_API_URL` is always `undefined` in server-side Node.js code. Vite replaces `import.meta.env.VITE_*` at build time but does not inject into `process.env`. This branch is dead code.

Fix: remove the dead `process.env.VITE_API_URL` fallback. Keep `process.env.HOSPEDA_API_URL` as the authoritative server-side read.

**Files to modify:**
- `apps/admin/src/lib/auth-session.ts` - line 60, remove `|| process.env.VITE_API_URL`

**Acceptance criteria:**
- [ ] `apiUrl = process.env.HOSPEDA_API_URL || 'http://localhost:3001'`
- [ ] No `process.env.VITE_API_URL` reference remains in this file
- [ ] Unit test: set only `HOSPEDA_API_URL`, verify it is used; unset it, verify fallback

**Dependencies:** none
**Blocks:** nothing

---

### T-012 - fix(seed): rename SEED_SUPER_ADMIN_PASSWORD to HOSPEDA_SEED_SUPER_ADMIN_PASSWORD

**Gap:** GAP-002
**Complexity:** 1
**Estimated lines changed:** ~8
**Phase:** core
**Tags:** bug, seed, naming

**Description:**

`packages/seed/src/utils/superAdminLoader.ts:53` reads `process.env.SEED_SUPER_ADMIN_PASSWORD`. The env-registry defines this variable as `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`. Operators who set the documented name get a silent random password instead.

Fix: rename all 3 references (line 14 JSDoc, line 53 read, line 57 error message) from `SEED_SUPER_ADMIN_PASSWORD` to `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`.

**Files to modify:**
- `packages/seed/src/utils/superAdminLoader.ts` - lines 14, 53, 57

**Acceptance criteria:**
- [ ] `process.env.HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` is read on line 53
- [ ] JSDoc on line 14 references `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`
- [ ] Warning message on line 57 mentions `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`
- [ ] Unit test: set `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD=test123`, assert it is used; unset, assert random password is generated

**Dependencies:** none
**Blocks:** nothing

---

## PHASE 3: Schema & Registry Alignment (Priority: HIGH)

> Layer: Config/Schema
> T-013 has no blockers and should start first (highest complexity).
> T-014 through T-021 are all independent.

---

### T-013 - fix(billing): rename MERCADO_PAGO_* vars and make DI mandatory

**Gaps:** GAP-008 + GAP-019 + GAP-055 (grouped)
**Complexity:** 4
**Estimated lines changed:** ~60
**Phase:** core
**Tags:** billing, security, naming, registry

**Description:**

Three related gaps that must be fixed together:

**A. Rename 6 env vars in billing adapter (GAP-008):**

`packages/billing/src/adapters/mercadopago.ts:135-140` reads 6 unprefixed vars. Rename to `HOSPEDA_` prefix in the adapter code. The error message on line 162 also references the old name.

| Old | New |
|-----|-----|
| `MERCADO_PAGO_ACCESS_TOKEN` | `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` |
| `MERCADO_PAGO_WEBHOOK_SECRET` | `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` |
| `MERCADO_PAGO_SANDBOX` | `HOSPEDA_MERCADO_PAGO_SANDBOX` |
| `MERCADO_PAGO_TIMEOUT` | `HOSPEDA_MERCADO_PAGO_TIMEOUT` |
| `MERCADO_PAGO_PLATFORM_ID` | `HOSPEDA_MERCADO_PAGO_PLATFORM_ID` |
| `MERCADO_PAGO_INTEGRATOR_ID` | `HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID` |

**B. Make config parameter required (GAP-019):**

`createMercadoPagoAdapter(config = {})` allows calling with no config and silently falls back to `process.env`. This must be changed: if the caller passes no config (or an empty config), the adapter must still read from `process.env` but using the renamed `HOSPEDA_*` keys. The `config = {}` default is acceptable as long as the fallback reads the correct `HOSPEDA_*` names.

The critical fix is that error messages must reference the `HOSPEDA_*` names so operators know what to set.

**C. Add 5 missing vars to env-registry (GAP-055):**

Only `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` is in the registry. Add the remaining 5:

```typescript
// Add to packages/config/src/env-registry.hospeda.ts (or new env-registry.billing.ts)
{
    name: 'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET',
    description: 'MercadoPago webhook signature secret for payload verification',
    type: 'string', required: false, secret: true,
    apps: ['api'], category: 'billing',
    exampleValue: 'whsec_xxxxxxxxxxxx'
},
// ... same pattern for SANDBOX, TIMEOUT, PLATFORM_ID, INTEGRATOR_ID
```

**Files to modify:**
- `packages/billing/src/adapters/mercadopago.ts` - rename 6 var reads + update error messages
- `packages/config/src/env-registry.hospeda.ts` (or billing registry file) - add 5 missing entries
- `packages/billing/test/adapters/mercadopago-adapter.test.ts` - update test env var names
- `packages/billing/test/adapters/mercadopago.test.ts` - update test env var names
- `apps/api/test/e2e/sandbox/sandbox-config.ts` - update `MERCADO_PAGO_ACCESS_TOKEN` -> `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`

**Acceptance criteria:**
- [ ] Adapter reads only `HOSPEDA_MERCADO_PAGO_*` names from env
- [ ] Error messages reference `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` etc.
- [ ] All 6 vars in env-registry with correct metadata
- [ ] Billing adapter tests updated and passing
- [ ] E2E sandbox config updated

**Dependencies:** none
**Blocks:** nothing

---

### T-014 - fix(config): remove phantom API_DEBUG_ERRORS from registry

**Gap:** GAP-015
**Complexity:** 1
**Estimated lines changed:** ~8
**Phase:** core
**Tags:** registry, cleanup

**Description:**

`packages/config/src/env-registry.api-config.ts` contains an entry for `API_DEBUG_ERRORS` (no `HOSPEDA_` prefix). The actual variable used everywhere in code and schema is `HOSPEDA_API_DEBUG_ERRORS`. The unprefixed entry is a phantom duplicate that generates wrong documentation.

Fix: remove the `API_DEBUG_ERRORS` entry from the api-config registry file.

**Files to modify:**
- `packages/config/src/env-registry.api-config.ts` - remove `API_DEBUG_ERRORS` entry block (~8 lines)

**Acceptance criteria:**
- [ ] Registry no longer contains an entry with `name: 'API_DEBUG_ERRORS'`
- [ ] `HOSPEDA_API_DEBUG_ERRORS` entry (if present) is unaffected
- [ ] Registry tests pass after removal (update count-based assertions if any)

**Dependencies:** none
**Blocks:** nothing

---

### T-015 - fix(config/web): make BETTER_AUTH_URL and SITE_URL required in schemas

**Gap:** GAP-038
**Complexity:** 2
**Estimated lines changed:** ~15
**Phase:** core
**Tags:** schema, config, web

**Description:**

`HOSPEDA_BETTER_AUTH_URL` and `HOSPEDA_SITE_URL` are marked `required: true` in the env-registry but are declared `.optional()` in Zod schemas. This inconsistency means startup validation silently skips them.

Affected locations:
- `packages/config/src/env.ts` - `commonEnvSchemas.urls` object: both `HOSPEDA_SITE_URL` and `HOSPEDA_BETTER_AUTH_URL` may have `.optional()` or be missing validation
- `apps/web/src/lib/env.ts` - web env module

Fix: remove `.optional()` from both vars in `commonEnvSchemas`. Add `superRefine` or make them required strings with `.min(1)`.

**Files to modify:**
- `packages/config/src/env.ts` - `commonEnvSchemas.urls` and `commonEnvSchemas.auth` sections
- `apps/web/src/lib/env.ts` - ensure same vars are required

**Acceptance criteria:**
- [ ] `commonEnvSchemas.urls.parse({})` throws for missing `HOSPEDA_SITE_URL`
- [ ] `commonEnvSchemas.auth.parse({})` throws for missing `HOSPEDA_BETTER_AUTH_URL`
- [ ] Existing passing tests in `packages/config/src/__tests__/` remain green
- [ ] Unit tests added for the new required behavior

**Dependencies:** none
**Blocks:** nothing

---

### T-016 - fix(config): align default value mismatches between schema and registry

**Gap:** GAP-039
**Complexity:** 2
**Estimated lines changed:** ~10
**Phase:** core
**Tags:** schema, registry, config

**Description:**

There are default value mismatches between Zod schemas and registry metadata. The most impactful:

- `VITE_DEFAULT_PAGE_SIZE`: schema default `25`, registry default `10`
- Other mismatches as identified in the registry (check `exampleValue`/`defaultValue` fields vs `.default()` in schema)

Fix: audit all variables where both schema and registry define a default, and align them. The **schema is authoritative** for runtime behavior; update registry `defaultValue` to match schema.

**Files to modify:**
- `packages/config/src/env-registry.client.ts` - align `VITE_DEFAULT_PAGE_SIZE` default to `25`
- Any other registry file with identified mismatches

**Implementation approach:**
1. For each var with `.default(X)` in schema, find matching registry entry
2. If `registry.defaultValue !== X`, update registry `defaultValue` to `X`
3. Never change the schema default to match registry

**Acceptance criteria:**
- [ ] `VITE_DEFAULT_PAGE_SIZE` registry `defaultValue` is `'25'` (string) matching schema `.default('25')`
- [ ] No other schema-vs-registry default mismatches remain
- [ ] A comment in the registry file notes "defaultValue must match schema .default()"

**Dependencies:** none
**Blocks:** nothing

---

### T-017 - fix(config): add LOG_* vars to env-registry

**Gap:** GAP-035
**Complexity:** 2
**Estimated lines changed:** ~50
**Phase:** core
**Tags:** registry, logging

**Description:**

`LOG_LEVEL`, `LOG_INCLUDE_TIMESTAMPS`, `LOG_INCLUDE_LEVEL`, `LOG_USE_COLORS`, and related `VITE_LOG_*` variants are used in code and schemas but are absent from the env-registry. The registry is the authoritative documentation source; missing vars create gaps in generated docs and env validation tooling.

Fix: add all `LOG_*` / `VITE_LOG_*` variables to the appropriate registry file. The `@repo/logger` package uses `LOG_*` prefix as an approved exception; document this clearly.

**Files to modify:**
- `packages/config/src/env-registry.api-config.ts` - already has `API_LOG_*` vars; verify complete
- `packages/config/src/env-registry.client.ts` - add `VITE_LOG_*` client variants
- `packages/config/src/env-registry.hospeda.ts` or new dedicated file - add base `LOG_*` vars

**Vars to add (at minimum):**
- `LOG_LEVEL` (apps: api, seed)
- `ENABLE_REQUEST_LOGGING` (apps: api)
- `LOG_INCLUDE_TIMESTAMPS` (apps: api, seed)
- `LOG_USE_COLORS` (apps: api, seed)
- `VITE_LOG_LEVEL` (apps: admin)
- `VITE_LOG_INCLUDE_TIMESTAMPS` (apps: admin)
- `VITE_LOG_INCLUDE_LEVEL` (apps: admin)
- `VITE_LOG_USE_COLORS` (apps: admin)

**Acceptance criteria:**
- [ ] All vars listed above are in the registry with correct `apps` array and `category: 'logging'`
- [ ] Registry test that asserts all `LOG_*` vars have `category: 'logging'` passes
- [ ] No duplicate entries with existing `API_LOG_*` vars

**Dependencies:** none
**Blocks:** nothing

---

### T-018 - fix(admin): add HOSPEDA_API_URL to AdminEnvSchema

**Gap:** GAP-037
**Complexity:** 1
**Estimated lines changed:** ~8
**Phase:** core
**Tags:** admin, schema

**Description:**

`apps/admin/src/lib/auth-session.ts` reads `process.env.HOSPEDA_API_URL` in server functions (SSR/server actions). However, `AdminEnvSchema` in `apps/admin/src/env.ts` does not declare `HOSPEDA_API_URL`. This means the variable has no startup validation for the admin app's server-side use.

Fix: add `HOSPEDA_API_URL` to `AdminEnvSchema` as an optional server-side variable. Note: `AdminEnvSchema` currently only validates `VITE_*` vars for client use. Create a separate server-side section or add a comment explaining the dual nature.

**Files to modify:**
- `apps/admin/src/env.ts` - add `HOSPEDA_API_URL: z.string().url().optional()` (server-side section)

**Acceptance criteria:**
- [ ] `AdminEnvSchema` includes `HOSPEDA_API_URL` or a server-side companion schema includes it
- [ ] If `HOSPEDA_API_URL` is set, it must be a valid URL (Zod url() validation)
- [ ] Existing admin env tests still pass

**Dependencies:** none
**Blocks:** nothing

---

### T-019 - fix(config): remove admin from HOSPEDA_BETTER_AUTH_URL apps array

**Gap:** GAP-056
**Complexity:** 1
**Estimated lines changed:** ~3
**Phase:** core
**Tags:** registry, admin

**Description:**

`packages/config/src/env-registry.hospeda.ts:129` - the `HOSPEDA_BETTER_AUTH_URL` entry lists `apps: ['api', 'web', 'admin']`. The admin app does not use `HOSPEDA_BETTER_AUTH_URL` (server env); it uses `VITE_BETTER_AUTH_URL` (client env injected by Vite). Listing `admin` is misleading and will cause incorrect generated `.env.example` files.

Fix: remove `'admin'` from the `apps` array for `HOSPEDA_BETTER_AUTH_URL`.

**Files to modify:**
- `packages/config/src/env-registry.hospeda.ts` - line ~129, `apps: ['api', 'web', 'admin']` -> `apps: ['api', 'web']`

**Acceptance criteria:**
- [ ] `HOSPEDA_BETTER_AUTH_URL` registry entry has `apps: ['api', 'web']`
- [ ] Registry tests that check app assignment pass

**Dependencies:** none
**Blocks:** nothing

---

### T-020 - fix(config): resolve SENTRY_ENVIRONMENT registry-schema mismatch

**Gap:** GAP-018
**Complexity:** 2
**Estimated lines changed:** ~15
**Phase:** core
**Tags:** registry, schema, sentry

**Description:**

`SENTRY_ENVIRONMENT` is defined in `packages/config/src/env-registry.docker-system.ts` but is not present in any Zod schema (not in API schema, not in web, not in admin). This means the variable is documented but never validated.

Two valid options. Option chosen: **add to API schema** since the API is the primary Sentry consumer. If the variable is intentionally deferred to SPEC-025 (staging environment), remove from registry instead.

Per the gaps doc, GAP-018 status is "DEFER TO SPEC-025". This task implements the deferral correctly: remove `SENTRY_ENVIRONMENT` from the registry (it does not exist in any schema and deferring it to SPEC-025 means it should not appear in generated docs until SPEC-025 implements it).

**Files to modify:**
- `packages/config/src/env-registry.docker-system.ts` - remove `SENTRY_ENVIRONMENT` entry OR add a `deferredTo: 'SPEC-025'` field and filter it from generated outputs

**Recommendation:** Add a `status: 'deferred'` or `deferredTo` field to `EnvVarDefinition` type and filter deferred vars from generated `.env.example` files. If that field doesn't exist, simply add a comment above the entry and remove it from active registry output.

**Acceptance criteria:**
- [ ] `SENTRY_ENVIRONMENT` does not appear in generated `.env.example` output
- [ ] Either removed from registry or marked with clear deferral comment/field
- [ ] Registry type definition updated if new field added
- [ ] No tests broken

**Dependencies:** none
**Blocks:** nothing

---

### T-021 - fix(admin): remove HOSPEDA_* fallback reads in vite.config.ts, clean dead exports

**Gaps:** GAP-046 + GAP-043
**Complexity:** 3
**Estimated lines changed:** ~40
**Phase:** core
**Tags:** admin, config, cleanup, registry

**Description:**

Two related cleanup items:

**A. GAP-046 - HOSPEDA_* vars in admin vite.config.ts not in registry:**

`apps/admin/vite.config.ts` reads `HOSPEDA_API_URL` (line 47) as a fallback for `VITE_API_URL`. There are 3 `HOSPEDA_*` vars read in this file that are not in the registry. Fix: add missing vars to registry AND, more importantly, simplify the vite.config.ts schema to only validate what Vite needs at build time. The `HOSPEDA_API_URL` fallback pattern is a workaround for monorepo; document it clearly.

Vars to add to registry if not present:
- `HOSPEDA_API_URL` with `apps: ['api', 'web', 'admin-build']` or `apps: ['api', 'web']` with a note about admin build-time use
- Any other `HOSPEDA_*` vars read in `vite.config.ts`

**B. GAP-043 - Dead exports in packages/config:**

`packages/config/src/index.ts` exports symbols that are either unused or have been superseded. Audit and remove dead exports. Clean up phantom dependencies in `package.json` that are imported but not used.

**Files to modify:**
- `apps/admin/vite.config.ts` - document the HOSPEDA_* fallback pattern, ensure no unregistered vars
- `packages/config/src/env-registry.hospeda.ts` - add any missing vars used by admin build
- `packages/config/src/index.ts` - remove dead exports
- `packages/config/package.json` - remove phantom/unused dependencies

**Acceptance criteria:**
- [ ] All `HOSPEDA_*` vars read in `apps/admin/vite.config.ts` are present in env-registry
- [ ] `packages/config/src/index.ts` has no exports that reference non-existent files or unused symbols
- [ ] `pnpm typecheck` passes for packages/config after cleanup
- [ ] Registry now shows `HOSPEDA_API_URL` with correct `apps` array (should include api + web at minimum)

**Dependencies:** none
**Blocks:** nothing

---

## Summary Table

| ID | Gap(s) | Phase | Complexity | Files | Tags |
|----|--------|-------|------------|-------|------|
| T-001 | GAP-016 | Phase 1 | 1 | `seed/utils/db.ts` | security |
| T-002 | GAP-027 | Phase 1 | 1 | `seed/utils/superAdminLoader.ts` | security |
| T-003 | GAP-047 | Phase 1 | 2 | `scripts/env/utils/formatters.ts` | security |
| T-004 | GAP-048 | Phase 1 | 1 | `packages/config/src/env.ts` | security |
| T-005 | GAP-032 | Phase 1 | 2 | `api/services/addon.checkout.ts` | security |
| T-006 | GAP-050 | Phase 1 | 3 | `api/utils/env.ts` | security |
| T-007 | GAP-057+GAP-049 | Phase 1 | 3 | `web/middleware-helpers.ts`, `admin/api/client.ts`, `api/lib/auth.ts` | security |
| T-008 | GAP-011 | Phase 2 | 1 | `admin/routes/auth/forbidden.tsx`, `admin/env.ts` | bug |
| T-009 | GAP-012 | Phase 2 | 1 | `web/lib/logger.ts` | bug |
| T-010 | GAP-033 | Phase 2 | 3 | `admin/vite.config.ts`, `web/astro.config.mjs`, sentry configs | bug |
| T-011 | GAP-022 | Phase 2 | 1 | `admin/lib/auth-session.ts` | bug |
| T-012 | GAP-002 | Phase 2 | 1 | `seed/utils/superAdminLoader.ts` | bug, naming |
| T-013 | GAP-008+GAP-019+GAP-055 | Phase 3 | 4 | `billing/adapters/mercadopago.ts`, billing tests, registry | billing |
| T-014 | GAP-015 | Phase 3 | 1 | `config/env-registry.api-config.ts` | registry |
| T-015 | GAP-038 | Phase 3 | 2 | `config/env.ts`, `web/lib/env.ts` | schema |
| T-016 | GAP-039 | Phase 3 | 2 | `config/env-registry.client.ts` + others | registry |
| T-017 | GAP-035 | Phase 3 | 2 | registry files | registry, logging |
| T-018 | GAP-037 | Phase 3 | 1 | `admin/src/env.ts` | admin, schema |
| T-019 | GAP-056 | Phase 3 | 1 | `config/env-registry.hospeda.ts` | registry |
| T-020 | GAP-018 | Phase 3 | 2 | `config/env-registry.docker-system.ts` | registry |
| T-021 | GAP-046+GAP-043 | Phase 3 | 3 | `admin/vite.config.ts`, `config/index.ts`, `config/package.json` | admin, cleanup |

**Total tasks:** 21
**Total complexity points:** 37
**Parallel tracks available:** All 21 tasks can execute independently.
**Critical path:** T-013 (complexity 4) - start first.

---

## Parallel Track Diagram

```
Track A - Seed Security:          T-001 ─── T-002 ─── T-012 (seq: all touch superAdminLoader)
Track B - Scripts/Config:         T-003 ─── T-004
Track C - API Security:           T-005 ─── T-006 ─── T-007
Track D - Admin/Web Bugs:         T-008 ─── T-009 ─── T-010 ─── T-011
Track E - Billing (start first):  T-013
Track F - Registry cleanup:       T-014 ─── T-015 ─── T-016 ─── T-017 ─── T-018 ─── T-019 ─── T-020 ─── T-021

All tracks merge at: quality gate (pnpm typecheck && pnpm lint && pnpm test)
```

Note: T-001, T-002, and T-012 touch the same file (`superAdminLoader.ts`) so they should be implemented sequentially to avoid conflicts. All other tracks are fully parallel.

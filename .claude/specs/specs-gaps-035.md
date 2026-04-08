# SPEC-035: Gaps Analysis Report (v4 - Deep Audit)

> **Date:** 2026-03-07 (v4 update)
> **Audited by:** 6 specialized agents (3x Tech Lead, 2x Node/TS Engineer, 1x QA Engineer)
> **Audit pass v1:** 20 gaps found
> **Audit pass v2:** 10 new gaps (GAP-021 to GAP-030), total 30
> **Audit pass v3:** 15 new gaps (GAP-031 to GAP-045), total 45
> **Audit pass v4:** 14 new gaps (GAP-046 to GAP-059), multiple v3 gaps expanded, total 59
> **Methodology:** Exhaustive codebase scan by 6 parallel agents covering: every `process.env` read (67+ locations), every `import.meta.env` read (50+ locations), full registry-schema cross-reference (163 vars), test coverage analysis (6 test files), security audit (6 findings), documentation audit (25+ files with issues). Total ~155+ wrong variable name instances in docs alone.

---

## Executive Summary

SPEC-035 has ~55-60% of its scope genuinely implemented (downgraded from v3's 60-65% estimate). The remaining ~40-45% consists of real gaps: some missed by the spec entirely, some partially done, some incorrectly marked as complete. This report catalogs **59 gaps** total (45 from v3 + 14 new in v4).

**Key v4 findings:**
- **1 NEW security gap**: `formatDiff()` in env scripts exposes secret values unmasked for 3 of 4 diff cases (GAP-047)
- **1 NEW security gap**: `HOSPEDA_BETTER_AUTH_SECRET` is `.optional()` in shared config schema, contradicting required in API schema (GAP-048)
- **3 NEW registry gaps**: 3 `HOSPEDA_*` vars used in admin vite.config.ts not in registry; 5 MercadoPago vars missing entirely; registry misleadingly lists `admin` for `HOSPEDA_BETTER_AUTH_URL` (GAP-046, GAP-055, GAP-056)
- **2 NEW production safety gaps**: CORS/CSRF defaults to localhost without production validation; additional localhost fallbacks in web middleware and admin client (GAP-050, GAP-057)
- **1 NEW dead code gap**: `printAudit` function in `scripts/env/check.ts` has empty for-of loops.. script produces no output (GAP-051)
- **1 NEW test coverage gap**: ~80 API schema vars have zero test coverage, no required-missing failure tests exist (GAP-052)
- **4 NEW documentation gaps**: `ENVIRONMENT_VARIABLES.md` with 30+ wrong names, `environments.md` with invented `HOSPEDA_API_*` pattern, broken `docs/monitoring/` links, security docs with wrong names (GAP-053, GAP-054, GAP-058, GAP-059)
- **GAP-006 MASSIVELY expanded**: From 10+ files to 25+ files with ~155+ wrong variable name instances in documentation

---

## Section 1: State Tracking Inconsistency

### GAP-000: Task state is unreliable

*Found in: v1 | Status: CONFIRMED (v4)*

- `state.json`: All 49 tasks show `"status": "completed"`
- Reality: ~28-30 of 49 tasks are genuinely done, ~19-21 are not (worse than v3's estimate)
- v3 finding: T-024 to T-027 (.env.example files) were marked complete but the files don't exist
- v4 finding: Documentation tasks (T-045 to T-048) are partially complete at best given 155+ wrong names in docs

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | High | 1 | Fix immediately - reaudit each task and set correct status |

**Recommendation:** Before starting any new work, run a task-by-task audit to set accurate statuses.

---

## Section 2: Gaps Already Described in SPEC-035 (Not Yet Implemented)

### GAP-001: Root .env files still exist

*Found in: v1 | Confirmed by: v4 security agent (filesystem check) | Status: CONFIRMED (v4)*

**Spec reference:** US-02, Phase 4 Task 8-9, T-033

v4 security agent confirmed via filesystem check:
- `/.env` (root) - EXISTS but not tracked by git
- `apps/admin/.env` - EXISTS but not tracked by git
- `docker/.env` - EXISTS but not tracked by git

All correctly gitignored. These should be renamed to `.env.local` per spec.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 1 | Direct fix within SPEC-035 |

---

### GAP-002: `SEED_SUPER_ADMIN_PASSWORD` not renamed

*Found in: v1 | Confirmed by: v4 process.env agent | Status: CONFIRMED (v4)*

**Spec reference:** US-01 rename table, Phase 2 Task 3, T-015

`packages/seed/src/utils/superAdminLoader.ts:53` reads `process.env.SEED_SUPER_ADMIN_PASSWORD` instead of `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`. Registry defines it with `HOSPEDA_` prefix. Three locations: line 14 (JSDoc), line 53 (read), line 57 (error message).

**Impact:** If an operator configures `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` (the documented name), the code ignores it silently and generates a random password instead.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| High | Medium | 1 | Direct fix within SPEC-035 |

---

### GAP-003: `turbo.json` globalEnv incomplete AND contains runtime-only secrets

*Found in: v1 | Expanded in: v2, v3, v4 | Status: CONFIRMED + EXPANDED (v4)*

**Spec reference:** US-03, Phase 2 Task 4, T-016

#### Problem A: Missing build-affecting vars (v4 confirmed full list)

Current `globalEnv` has 9 vars. Missing vars that affect compiled bundle output:

| Variable | Why it affects build |
|----------|---------------------|
| `VITE_BETTER_AUTH_URL` | Vite embeds in admin bundle |
| `VITE_APP_NAME` | Embedded in admin bundle |
| `VITE_APP_VERSION` | Embedded in admin bundle |
| `VITE_APP_DESCRIPTION` | Embedded in admin bundle |
| `VITE_SENTRY_DSN` | Embedded in admin bundle |
| `VITE_SENTRY_RELEASE` | Embedded in admin bundle |
| `PUBLIC_SENTRY_DSN` | Astro embeds in web bundle |
| `PUBLIC_SENTRY_RELEASE` | Astro embeds in web bundle |
| `PUBLIC_VERSION` | Embedded in web bundle |
| `VITE_ENABLE_DEVTOOLS` | Activates/deactivates code in bundle |
| `VITE_ENABLE_QUERY_DEVTOOLS` | Activates/deactivates code in bundle |
| `HOSPEDA_COMMIT_SHA` | Used in health endpoint build output |

#### Problem B: Runtime-only secrets in globalEnv

| Variable | Why it should be REMOVED |
|----------|--------------------------|
| `HOSPEDA_DATABASE_URL` | Never embedded in any bundle. Rotating the DB URL unnecessarily invalidates entire Turbo build cache |
| `HOSPEDA_BETTER_AUTH_SECRET` | Runtime secret. Changing it should not invalidate build cache |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 2 | Direct fix within SPEC-035 |

---

### GAP-004: Raw `process.env` reads in API (bypassing validated env)

*Found in: v1 | Expanded in: v2, v3, v4 | Status: CONFIRMED + EXPANDED (v4)*

**Spec reference:** Phase 2, T-007 through T-014

The v4 audit found **26+ raw reads** post-validation. Full inventory:

#### Variables IN schema but read raw (14 reads):

| File:Line | Variable | Context |
|-----------|----------|---------|
| `lib/sentry.ts:38,48` | `NODE_ENV` | Sentry initialization |
| `lib/sentry.ts:53` | `HOSPEDA_SENTRY_PROJECT` | Sentry tunnel check |
| `lib/sentry.ts:127` | `NODE_ENV` | Sentry beforeBreadcrumb callback |
| `utils/create-app.ts:34,144` | `NODE_ENV` | Mock auth branching |
| `utils/create-app.ts:111` | `NODE_ENV` | Body size limit |
| `utils/configure-open-api.ts:43` | `NODE_ENV` | Error handler |
| `middlewares/rate-limit.ts:51` | `NODE_ENV` | Cleanup interval |
| `routes/health/health.ts:20` | `NODE_ENV` | Route handler |
| `routes/health/db-health.ts:58,82` | `NODE_ENV` | Route handler |
| `routes/index.ts:250` | `NODE_ENV` | Docs mounting |

#### Variables NOT in schema (7 reads):

| File:Line | Variable | Purpose |
|-----------|----------|---------|
| `lib/sentry.ts:39` | `VERCEL` | Platform detection |
| `utils/create-app.ts:111` | `VERCEL` | Body size limit (4.5MB vs 10MB) |
| `utils/user-cache.ts:8` | `VERCEL` | LRU cache vs serverless mode |
| `utils/env-config-helpers.ts:227` | `VERCEL` | DB pool config |
| `middlewares/auth.ts:29` | `CI` | Block mock auth in CI |
| `middlewares/actor.ts:47` | `CI` | Block mock actor in CI |
| `lib/sentry.ts:79` | `VERCEL_GIT_COMMIT_SHA` | Sentry release fallback |

#### env-config-helpers.ts systemic bypass (5+ reads)

`apps/api/src/utils/env-config-helpers.ts` lines 12-19 uses `_safe.get()` which reads `process.env[key]` directly for ALL config helpers. ~80+ API_* variables are read through this path.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 4 | Direct fix within SPEC-035 (higher complexity due to env-config-helpers refactor) |

**Solution:**
1. Add `VERCEL` (optional boolean), `CI` (optional boolean), and `VERCEL_GIT_COMMIT_SHA` (optional string) to `ApiEnvSchema`
2. Replace all post-init `process.env.NODE_ENV` reads with `env.NODE_ENV`
3. Accept env-config-helpers dual-mode pattern as documented exception (see GAP-034)

---

### GAP-005: `astro.config.mjs` startup validation not added

*Found in: v1 | Status: CONFIRMED (v4)*

**Spec reference:** US-03, Phase 4 Task 5, T-029

Validation happens in `apps/web/src/lib/env.ts` at module import time (late), not at `astro.config.mjs` (earliest possible).

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix within SPEC-035 |

---

### GAP-006: Legacy docs not consolidated + widespread wrong names in docs

*Found in: v1 | Expanded in: v3, v4 | Status: CONFIRMED + MASSIVELY EXPANDED (v4)*

**Spec reference:** US-07, Phase 7 Tasks 3-5, T-047

#### v4 audit: 25+ files with ~155+ wrong variable name instances

The v4 documentation agent performed an exhaustive scan. Here is the complete inventory:

**Files with 10+ wrong names (critical):**

| File | Wrong Names Count | Key Issues |
|------|-------------------|------------|
| `docs/environment-variables.md` | 20+ | Entire file is obsolete duplicate of `docs/guides/environment-variables.md`. Uses `DB_*`, `CRON_*`, `SENTRY_*`, `DISABLE_AUTH`, `ALLOW_MOCK_ACTOR` etc. |
| `apps/api/docs/cron-system.md` | 35+ | `CRON_SECRET` (20+ refs), `CRON_AUTH_DISABLED` (15+ refs, dead var) |
| `apps/api/docs/ENVIRONMENT_VARIABLES.md` | 30+ | Uses completely wrong naming pattern: `LOG_LEVEL` instead of `API_LOG_LEVEL`, `SECURITY_ENABLED` instead of `API_SECURITY_ENABLED`, etc. **(NEW in v4)** |
| `docs/deployment/environments.md` | 50+ | Uses INVENTED `HOSPEDA_API_*` naming pattern that doesn't exist in the real system (e.g., `HOSPEDA_API_LOG_LEVEL` instead of `API_LOG_LEVEL`) **(NEW in v4)** |
| `docs/deployment/billing-checklist.md` | 15+ | `MERCADO_PAGO_*` (6 vars), `RESEND_*` (4 vars), `CRON_*` (3 vars), `CRON_AUTH_DISABLED` (dead var) |
| `docs/runbooks/billing-incidents.md` | 12+ | `MERCADO_PAGO_*`, `CRON_SECRET`, `RESEND_*` |

**Files with 3-10 wrong names (moderate):**

| File | Wrong Names Count | Key Issues |
|------|-------------------|------------|
| `apps/api/docs/setup.md` | 8 | `DATABASE_URL` (5x), `CORS_ORIGIN`, `RATE_LIMIT_*`, `LOG_LEVEL` |
| `apps/api/README.md` | 2 | `DATABASE_URL`, `CORS_ORIGIN` |
| `apps/api/docs/development/deployment.md` | 2 | `SENTRY_DSN`, `SENTRY_ENVIRONMENT` |
| `apps/api/docs/development/middleware.md` | 2 | `CORS_ORIGIN` instead of `API_CORS_ORIGINS` **(NEW in v4)** |
| `apps/api/docs/architecture.md` | 1 | `CORS_ORIGIN` **(NEW in v4)** |
| `apps/api/docs/webhooks/payment-notifications.md` | 4 | `ADMIN_NOTIFICATION_EMAILS` **(NEW in v4)** |
| `apps/api/docs/billing-api-endpoints.md` | 2 | `CRON_SECRET` **(NEW in v4)** |
| `apps/api/docs/ACCEPTED_RISKS.md` | 2 | `SEED_SUPER_ADMIN_PASSWORD` **(NEW in v4)** |
| `docs/deployment-checklist.md` | 3 | `CRON_SECRET`, `SENTRY_DSN` |
| `docs/testing/billing-manual-testing.md` | 4 | `MERCADO_PAGO_*`, `SENTRY_DSN`, `CRON_SECRET` |
| `docs/billing/dispute-handling-v1.md` | 2 | `ADMIN_NOTIFICATION_EMAILS` |
| `docs/runbooks/sentry-setup.md` | 6 | `SENTRY_DSN`, `SENTRY_PROJECT`, `SENTRY_RELEASE` **(NEW in v4)** |
| `docs/runbooks/monitoring.md` | 1 | `DATABASE_URL` |
| `docs/runbooks/production-bugs.md` | 2 | `MERCADO_PAGO_*` |
| `docs/resources/faq.md` | 2 | `DATABASE_URL` |
| `docs/resources/troubleshooting.md` | 5 | `DATABASE_URL` |
| `docs/security/owasp-top-10.md` | 3 | `MERCADO_PAGO_*` **(NEW in v4)** |
| `docs/security/api-protection.md` | 4 | `TESTING_RATE_LIMIT`, `RATE_LIMIT_*` **(NEW in v4)** |
| `docs/security/billing-audit-2026-02.md` | 3 | `MERCADO_PAGO_WEBHOOK_SECRET` **(NEW in v4)** |
| `docs/performance/monitoring.md` | 1 | `RESEND_API_KEY` **(NEW in v4)** |
| `packages/notifications/README.md` | 4 | `RESEND_*`, `REDIS_URL` |
| `packages/notifications/docs/README.md` | 4 | `RESEND_*`, `REDIS_URL` |
| `packages/notifications/docs/quick-start.md` | 4 | `RESEND_*`, `REDIS_URL` |
| `packages/config/README.md` | 6 | `API_CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, `DB_POOL_*`, `LOG_*` **(NEW in v4)** |
| `packages/config/docs/api/config-reference.md` | 6 | `DATABASE_URL`, `DB_POOL_*` **(NEW in v4)** |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 4 | Direct fix within SPEC-035 (bulk find-and-replace, delete obsolete files) |

**v4 Recommendation:** The two most impactful fixes:
1. **DELETE** `docs/environment-variables.md` (obsolete duplicate)
2. **DELETE or REWRITE** `apps/api/docs/ENVIRONMENT_VARIABLES.md` (completely wrong naming)
3. **REWRITE** `docs/deployment/environments.md` (invented `HOSPEDA_API_*` pattern)

---

### GAP-007: Tests use unprefixed/obsolete variable names

*Found in: v1 | Expanded in: v2, v3, v4 | Status: CONFIRMED + EXPANDED (v4)*

**Spec reference:** Phase 2 Task 5, T-017

#### Complete inventory (v4):

| File | Line(s) | Wrong Variable | Correct Variable |
|------|---------|----------------|------------------|
| `apps/api/test/utils/env.test.ts` | 166, 319, 335 | `CRON_SECRET` | `HOSPEDA_CRON_SECRET` |
| `apps/api/test/cron/cron-routes.test.ts` | 340-366 | `CRON_AUTH_DISABLED` | Dead var - remove |
| `apps/api/test/integration/webhooks/webhook-persistence.test.ts` | 317-429 (6 places) | `CRON_AUTH_DISABLED` | Dead var - remove |
| `apps/api/test/services/addon.service.test.ts` | 203 | `API_URL` | `HOSPEDA_API_URL` |
| `apps/api/test/routes/webhooks/dispute-logic.test.ts` | 28, 79 | `ADMIN_NOTIFICATION_EMAILS` | `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` |
| `apps/api/test/integration/qzpay-ownership-integration.test.ts` | 26 | `PORT` | `API_PORT` |
| `apps/api/test/integration/billing-idor-prevention.test.ts` | 38 | `PORT` | `API_PORT` |
| `apps/api/test/setup.ts` | 20 | `PORT` | `API_PORT` |
| `apps/api/test/e2e/sandbox/sandbox-config.ts` | 59 | `MERCADO_PAGO_ACCESS_TOKEN` | `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` |
| `packages/billing/test/adapters/mercadopago-adapter.test.ts` | 130-565+ | `MERCADO_PAGO_*` (6 vars) | `HOSPEDA_MERCADO_PAGO_*` |
| `packages/billing/test/adapters/mercadopago.test.ts` | multiple | `MERCADO_PAGO_*` (6 vars) | `HOSPEDA_MERCADO_PAGO_*` |
| `packages/db/test/models/attraction.model.test.ts` | 21 | `DATABASE_URL` | `HOSPEDA_DATABASE_URL` |
| `scripts/setup-test-db.ts` | 24 | `TEST_DB_URL` | `HOSPEDA_DATABASE_URL` fallback |

#### E2E test vars not in registry

| File | Variable(s) | Issue |
|------|-------------|-------|
| `apps/api/test/e2e/setup/test-database.ts` | `TEST_DB_USER`, `TEST_DB_PASSWORD`, `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_NAME` | Not in registry |
| `apps/api/test/e2e/sandbox/sandbox-config.ts` | `HOSPEDA_TEST_DATABASE_URL` | Not in registry |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 3 | Direct fix within SPEC-035 |

---

### GAP-008: `@repo/billing` has 6 `MERCADO_PAGO_*` vars not covered

*Found in: v1 | Status: CONFIRMED (v4). See also GAP-055 for registry gap.*

`packages/billing/src/adapters/mercadopago.ts` lines 135-140 read 6 env vars via `getEnv()` with unprefixed names.

| Line | Current Name | Should Be |
|------|---|---|
| 135 | `MERCADO_PAGO_ACCESS_TOKEN` | `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` |
| 136 | `MERCADO_PAGO_WEBHOOK_SECRET` | `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` |
| 137 | `MERCADO_PAGO_SANDBOX` | `HOSPEDA_MERCADO_PAGO_SANDBOX` |
| 138 | `MERCADO_PAGO_TIMEOUT` | `HOSPEDA_MERCADO_PAGO_TIMEOUT` |
| 139 | `MERCADO_PAGO_PLATFORM_ID` | `HOSPEDA_MERCADO_PAGO_PLATFORM_ID` |
| 140 | `MERCADO_PAGO_INTEGRATOR_ID` | `HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID` |

**v4 note:** Only `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` is in the env-registry. The other 5 are completely missing (see GAP-055).

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **Critical** | **High** | 3 | Add to SPEC-035 (new tasks) |

---

### GAP-009: `@repo/logger` prefix conflict

*Found in: v1 | Status: RESOLVED (accepted as exception)*

`LOG_*` is accepted as an approved prefix exception for `@repo/logger`. No code changes needed. However, see GAP-035 for the fact that LOG_* vars are not in the registry.

---

### GAP-010: `CRON_AUTH_DISABLED` - undocumented dead variable

*Found in: v1 | Status: CONFIRMED (v4)*

Tests still set `CRON_AUTH_DISABLED` in 8+ places. Docs `apps/api/docs/cron-system.md` has 35+ references as if active. See GAP-006 for full doc inventory.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 2 | Clean up within SPEC-035 |

---

### GAP-011: Admin uses `PUBLIC_SITE_URL` (wrong prefix)

*Found in: v1 | Confirmed by: v4 import.meta.env agent | Status: CONFIRMED - BUG (v4)*

`apps/admin/src/routes/auth/forbidden.tsx:55` reads `import.meta.env.PUBLIC_SITE_URL`. The admin uses `VITE_*` prefix, not `PUBLIC_*`. Variable is **always `undefined`** at runtime. The hardcoded fallback `'http://localhost:4321'` is used in ALL environments including production.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 1 | Direct fix (bug, immediate) |

---

### GAP-012: Web app uses `VITE_ENABLE_LOGGING` (wrong prefix)

*Found in: v1 | Confirmed by: v4 import.meta.env agent | Status: CONFIRMED - BUG (v4)*

`apps/web/src/lib/logger.ts:52` reads `import.meta.env.VITE_ENABLE_LOGGING`. The web app uses `PUBLIC_*` prefix. Variable is **always `undefined`**. Logging toggle is broken in web.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 1 | Direct fix (bug) |

---

### GAP-013: Admin reads `VITE_API_URL` directly in multiple files

*Found in: v1 | Confirmed by: v4 import.meta.env agent (17 bypass instances total) | Status: CONFIRMED (v4)*

v4 import.meta.env agent cataloged 17 instances of bypassed validated env helpers across admin:
- `routes/__root.tsx:121,150,165` (3 occurrences of `VITE_API_URL`)
- `routes/auth/change-password.tsx:293`
- `routes/_authed/me/change-password.tsx:270`
- `lib/auth-client.ts:21`
- `lib/sentry/sentry.config.ts:44,47,48,63` (4 occurrences of `VITE_SENTRY_*`, `VITE_APP_VERSION`)
- `utils/logger.ts:53` (`VITE_ENABLE_LOGGING` module-level)
- `components/entity-pages/EntityCreateContent.tsx:369` (`VITE_DEBUG_LAZY_SECTIONS`)
- `components/entity-pages/EntityEditContent.tsx:183` (`VITE_DEBUG_LAZY_SECTIONS`)

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 2 | New SPEC or technical debt ticket |

---

### GAP-014: Web reads `PUBLIC_*` directly without validated env

*Found in: v1 | Confirmed by: v4 import.meta.env agent | Status: CONFIRMED (v4)*

v4 import.meta.env agent cataloged 7 bypass instances in web:
- `lib/auth-client.ts:16` - `PUBLIC_API_URL`
- `layouts/BaseLayout.astro:109` - `PUBLIC_API_URL` (with hardcoded fallback)
- `pages/[lang]/feedback.astro:21` - `PUBLIC_API_URL` (with hardcoded fallback)
- `pages/[lang]/auth/signin.astro:40` - `PUBLIC_SITE_URL` / `HOSPEDA_SITE_URL`
- `pages/[lang]/auth/signup.astro:38` - `PUBLIC_SITE_URL` / `HOSPEDA_SITE_URL`
- `pages/[lang]/alojamientos/[slug].astro:215` - `PUBLIC_SITE_URL`
- `sentry.client.config.ts:3,10` - `PUBLIC_SENTRY_DSN`, `PUBLIC_SENTRY_RELEASE`

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 2 | New SPEC or technical debt ticket |

---

### GAP-015: Registry vs Schema inconsistency for `API_DEBUG_ERRORS`

*Found in: v1 | Expanded in: v3, v4 | Status: CONFIRMED (v4)*

The registry contains `API_DEBUG_ERRORS` (no HOSPEDA prefix, in `env-registry.api-config.ts`). The API schema and code use `HOSPEDA_API_DEBUG_ERRORS`. The `API_DEBUG_ERRORS` entry is a phantom duplicate generating false documentation.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 1 | Direct fix within SPEC-035 (remove phantom entry) |

---

### GAP-016: `@repo/seed` logs DATABASE_URL with credentials

*Found in: v1 | Confirmed by: v4 security agent | Status: CONFIRMED - SECURITY (v4)*

`packages/seed/src/utils/db.ts:26`:
```typescript
dbLogger.log(process.env.HOSPEDA_DATABASE_URL, 'HOSPEDA_DATABASE_URL value');
```

Full connection string including `user:password@host` is logged.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 1 | Direct fix (security, immediate) |

---

### GAP-017: JSDoc/documentation references use old variable names

*Found in: v1 | Status: CONFIRMED (v4)*

- `packages/db/src/client.ts:65` - `TEST_DATABASE_URL`
- `packages/db/src/billing/drizzle-adapter.ts:60` - `DATABASE_URL`
- `packages/seed/src/utils/superAdminLoader.ts:14` - `SEED_SUPER_ADMIN_PASSWORD`

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix within SPEC-035 |

---

### GAP-018: `SENTRY_ENVIRONMENT` not integrated

*Found in: v1 | Status: CONFIRMED - DEFER TO SPEC-025*

Defined in env-registry but not in any schema and not used in code.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Defer to SPEC-025 |

---

### GAP-019: `@repo/billing` DI is partial

*Found in: v1 | Status: CONFIRMED - CRITICAL (v4)*

`createMercadoPagoAdapter()` has `config = {}` (entirely optional). If called without config, it silently reads credentials from `process.env` via `getEnv()`. Production credential read as fallback in a shared package.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 3 | Add to SPEC-035 (new tasks) - pairs with GAP-008 |

---

### GAP-020: `packages/email/.gitignore` has vestigial env patterns

*Found in: v1 | Status: PARTIALLY RESOLVED (harmless)*

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix (cleanup) |

---

## Section 3: Gaps Found in v2 Audit

### GAP-021: `VERCEL_GIT_COMMIT_SHA` read raw across all 3 apps

*Found in: v2 | Status: CONFIRMED (v4) - See also GAP-033 for client-side bug*

Read raw in: `apps/api/src/lib/sentry.ts:79`, `apps/web/sentry.server.config.ts:11`, `apps/web/sentry.client.config.ts:11`, `apps/admin/src/lib/sentry/sentry.config.ts:49`

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 2 | Accept as platform exception + fix client-side bug (GAP-033) |

---

### GAP-022: Admin `auth-session.ts` mixes `HOSPEDA_API_URL` with `VITE_API_URL` in server function

*Found in: v2 | Confirmed by: v4 process.env agent | Status: CONFIRMED (v4)*

`apps/admin/src/lib/auth-session.ts:60`:
```typescript
const apiUrl = process.env.HOSPEDA_API_URL || process.env.VITE_API_URL || 'http://localhost:3001';
```

`process.env.VITE_API_URL` is **always `undefined`** in server-side Node.js. Dead code branch.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 1 | Direct fix within SPEC-035 |

---

### GAP-023: `VERCEL_TOKEN` in scripts without prefix

*Found in: v2 | Status: RESOLVED (accepted as tooling exception)*

---

### GAP-024: Admin env schema has ZERO tests

*Found in: v2 | Confirmed by: v4 QA agent | Status: CONFIRMED (v4)*

`apps/admin/src/env.ts` defines `AdminEnvSchema` with `validateAdminEnv()`, `getApiUrl()`, `getBetterAuthUrl()`, `getAdminConfig()`, `getFeatureFlags()`, `getPaginationConfig()`, `isDevelopment()`, `isProduction()`, `isTest()`, `getSentryDsn()`. **None have tests.** Coverage: 0/100.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 3 | Add to SPEC-035 (new task) |

---

### GAP-025: `env:pull` and `env:push` scripts have no tests

*Found in: v2 | Status: CONFIRMED (v4)*

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 4 | New SPEC (testing debt) |

---

### GAP-026: No cross-validation test between registry and app schemas

*Found in: v2 | Confirmed by: v4 QA agent, v4 registry agent | Status: CONFIRMED (v4)*

No test validates that registry vars match schema vars. This would have caught GAP-015 (phantom duplicate), GAP-038/039 (mismatches), and GAP-055 (missing MP vars) automatically.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 3 | Add to SPEC-035 (new task) |

---

### GAP-027: Super admin password logged in plaintext

*Found in: v2 | Status: CONFIRMED (v4)*

`packages/seed/src/utils/superAdminLoader.ts:59`:
```typescript
logger.info(`Generated password: ${password}`);
```

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 1 | Direct fix (security) |

---

### GAP-028: `.env.example` files contain real development credentials

*Found in: v2 | Status: SUPERSEDED by GAP-031*

The `.env.example` files DO NOT EXIST at all.

---

### GAP-029: Logger module-level env reads are not DI-configurable

*Found in: v2 | Status: RESOLVED (accepted as design decision)*

---

### GAP-030: Astro pages access `HOSPEDA_*` vars via `import.meta.env` directly

*Found in: v2 | Confirmed by: v4 import.meta.env agent | Status: CONFIRMED (v4)*

`signin.astro:40` and `signup.astro:38` read `import.meta.env.HOSPEDA_SITE_URL` directly. Works in SSR but bypasses validated env module.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Low | 1 | Direct fix within SPEC-035 |

---

## Section 4: Gaps Found in v3 Audit

### GAP-031: `.env.example` files DO NOT EXIST

*Found in: v3 | Status: CONFIRMED (v4)*

Filesystem glob for `**/.env.example` returns NO results. T-024-T-027 incorrectly marked complete.

Expected files: `apps/api/.env.example`, `apps/web/.env.example`, `apps/admin/.env.example`, `docker/.env.example`

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **Critical** | **High** | 2 | Direct fix within SPEC-035 (generate from registry) |

---

### GAP-032: MercadoPago `back_urls` use localhost fallback in production

*Found in: v3 | Confirmed by: v4 security agent | Status: CONFIRMED (v4)*

`apps/api/src/services/addon.checkout.ts:160-161`:
```typescript
const webUrl = env.HOSPEDA_SITE_URL || 'http://localhost:4321';
const apiUrl = env.HOSPEDA_API_URL || 'http://localhost:3001';
```

`HOSPEDA_SITE_URL` is `.optional()` in the schema, so this localhost fallback WILL be used in production if the var is not set.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 1 | Direct fix (make vars required or throw if missing in billing context) |

---

### GAP-033: `VERCEL_GIT_COMMIT_SHA` always undefined in client bundles

*Found in: v3 | Confirmed by: v4 import.meta.env agent | Status: CONFIRMED (v4)*

| File | Line | Access | Problem |
|------|------|--------|---------|
| `apps/web/sentry.client.config.ts` | 11 | `import.meta.env.VERCEL_GIT_COMMIT_SHA` | No `PUBLIC_` prefix. **Always undefined.** |
| `apps/admin/src/lib/sentry/sentry.config.ts` | 49 | `import.meta.env.VERCEL_GIT_COMMIT_SHA` | No `VITE_` prefix. **Always undefined.** |

**Impact:** Sentry `release` field falls back to `'development'` in ALL environments for client-side errors.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | Medium | 2 | Direct fix within SPEC-035 |

---

### GAP-034: `env-config-helpers.ts` systemic bypass of validated env

*Found in: v3 | Status: CONFIRMED (v4) - Accept as documented exception*

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 4 | Accept as documented exception |

---

### GAP-035: `LOG_*` variables are ghost vars (not in registry, not in any schema)

*Found in: v3 | Status: CONFIRMED (v4)*

10 `LOG_*` variables in `packages/logger/src/environment.ts` plus `VITE_LOG_LEVEL` in config package. None in registry.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Low | 2 | Add to SPEC-035 (add LOG_* vars to registry for documentation) |

---

### GAP-036: Admin components read `process.env.NODE_ENV` instead of `isDevelopment()`

*Found in: v3 | Confirmed by: v4 process.env agent | Status: CONFIRMED (v4)*

7 admin component files bypass the validated `isDevelopment()` function. v4 process.env agent confirmed full list.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 2 | New SPEC or technical debt ticket |

---

### GAP-037: `HOSPEDA_API_URL` used in admin server functions but not in AdminEnvSchema

*Found in: v3 | Confirmed by: v4 process.env agent | Status: CONFIRMED (v4)*

Two admin server-side files read `process.env.HOSPEDA_API_URL`:
- `apps/admin/src/lib/auth-session.ts:60`
- `apps/admin/src/lib/auth-client.ts:23-24`

`HOSPEDA_API_URL` is NOT in `AdminEnvSchema`.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 2 | Direct fix within SPEC-035 |

---

### GAP-038: Registry/schema `required` mismatches

*Found in: v3 | Confirmed by: v4 registry agent | Status: CONFIRMED (v4)*

| Variable | Registry `required` | Schema status | Impact |
|----------|-------------------|---------------|--------|
| `HOSPEDA_BETTER_AUTH_URL` | `true` | `optional()` in ApiEnvSchema AND WebEnvSchema | Docs say required but apps start fine without it |
| `HOSPEDA_SITE_URL` | `true` | `optional()` in ApiEnvSchema AND WebEnvSchema | Causes GAP-032 payment URL issue |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 1 | Direct fix (make schema match registry, or vice versa) |

---

### GAP-039: Registry/schema default value mismatches

*Found in: v3 | Confirmed by: v4 registry agent | Status: CONFIRMED (v4)*

| Variable | Schema Default | Registry Default/Example | Discrepancy |
|----------|---------------|--------------------------|-------------|
| `VITE_DEFAULT_PAGE_SIZE` | `'25'` | `'10'` | Schema uses 25, registry documents 10 |
| `VITE_APP_DESCRIPTION` | `'Admin panel for Hospeda platform'` | `'Panel de administracion de Hospeda'` | English vs Spanish |
| `HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS` | `2000` | `'5000'` | 2.5x difference |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix within SPEC-035 |

---

### GAP-040: Web env test coverage is near-trivial

*Found in: v3 | Confirmed by: v4 QA agent (25/100 score) | Status: CONFIRMED (v4)*

Tests only verify return types (`typeof getApiUrl() === 'string'`). No tests that stub env vars and verify correct reading. No tests for validation error cases.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Low | 3 | New SPEC (testing debt) or add to SPEC-035 |

---

### GAP-041: API env.test.ts uses wrong names for production simulation

*Found in: v3 | Confirmed by: v4 QA agent | Status: CONFIRMED - FALSE POSITIVE TESTS (v4)*

v4 QA analysis confirms: `createValidTestEnv()` at lines 166, 319, 335 uses `CRON_SECRET` but schema validates `HOSPEDA_CRON_SECRET`. The `superRefine` reads `data.HOSPEDA_CRON_SECRET`, not `CRON_SECRET`. Production validation tests are **false positives**.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | Medium | 2 | Direct fix within SPEC-035 |

---

### GAP-042: `docs/deployment/environments.md` lists invalid `NODE_ENV` value

*Found in: v3 | Status: CONFIRMED (v4)*

Lists `staging` as valid `NODE_ENV`. Schema only accepts `development`, `production`, `test`.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix within SPEC-035 |

---

### GAP-043: `packages/config` defines `VITE_LOG_LEVEL` and `VITE_API_PORT/HOST` not in registry or admin schema

*Found in: v3 | Status: CONFIRMED (v4)*

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 2 | Direct fix within SPEC-035 |

---

### GAP-044: `API_VALIDATION_AUTH_ENABLED` used in tests but status unclear

*Found in: v3 | Confirmed by: v4 process.env agent: VARIABLE EXISTS in API schema | Status: RESOLVED (v4)*

v4 agent confirmed `API_VALIDATION_AUTH_ENABLED` IS defined in `ApiEnvSchema` (optional, default=true). The tests use the correct name. This gap is resolved.

---

### GAP-045: `.env.test` files status unclear

*Found in: v3 | Status: CONFIRMED - FILES DO NOT EXIST (v4)*

v4 security agent filesystem check found NO `.env.test` files. Not an issue.

---

## Section 5: NEW Gaps Found in v4 Audit

### GAP-046: 3 `HOSPEDA_*` vars used in admin `vite.config.ts` not in env-registry

*Found in: v4 (process.env agent)*

`apps/admin/vite.config.ts` lines 126-137 reads three `HOSPEDA_*` vars as build-time sources for the `define` plugin:

| Line | Variable | Maps To | In Registry |
|------|----------|---------|-------------|
| 126 | `HOSPEDA_DEBUG_ACTOR_ID` | `VITE_DEBUG_ACTOR_ID` | **NO** |
| 131 | `HOSPEDA_SUPPORTED_LOCALES` | `VITE_SUPPORTED_LOCALES` | **NO** |
| 136 | `HOSPEDA_DEFAULT_LOCALE` | `VITE_DEFAULT_LOCALE` | **NO** |

These are the server-side source vars that get injected as `VITE_*` at build time. The `VITE_*` versions exist in the registry, but the `HOSPEDA_*` sources do not. A developer configuring the environment would not know to set these.

**Impact:** If someone sets only `VITE_SUPPORTED_LOCALES=es,en,pt` in the deploy env, the `vite.config.ts` plugin reads `HOSPEDA_SUPPORTED_LOCALES` first (undefined), falls back to `VITE_SUPPORTED_LOCALES` (works). Low immediate risk, but confusing and undocumented.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Low | 2 | Add to SPEC-035 (add to registry or remove HOSPEDA_ fallback) |

**Solution options:**
1. **Option A:** Add `HOSPEDA_DEBUG_ACTOR_ID`, `HOSPEDA_SUPPORTED_LOCALES`, `HOSPEDA_DEFAULT_LOCALE` to env-registry with `apps: ['admin']`, `category: 'build'`
2. **Option B (Recommended):** Remove the `HOSPEDA_*` fallback reads from `vite.config.ts` since the `VITE_*` vars already have the correct values and the registry has them documented

---

### GAP-047: `formatDiff()` exposes secret values unmasked in env scripts

*Found in: v4 (security agent)*

`scripts/env/utils/formatters.ts` lines 111-126:

- **Line 113** (`isNew`): displays remote value via `displayValue(remote)` - **UNMASKED** (up to 60 chars)
- **Line 116** (`isMissing`): displays local value via `displayValue(local)` - **UNMASKED**
- **Lines 124-125** (`isSame`): displays both via `displayValue()` - **UNMASKED**
- **Line 120-121** (`isChanged`): correctly uses `maskValue()` - masked

Only 1 of 4 cases masks values. If `HOSPEDA_BETTER_AUTH_SECRET` is a "new" variable or "identical" in both environments, the full secret is printed to the terminal during `pnpm env:push`.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 1 | Direct fix (use `maskValue()` for ALL cases when variable is marked `secret: true` in registry) |

**Solution:** Modify `formatDiff()` to accept a `secret: boolean` parameter. When true, use `maskValue()` in ALL cases.

---

### GAP-048: `HOSPEDA_BETTER_AUTH_SECRET` `.optional()` in shared config schema

*Found in: v4 (security agent)*

`packages/config/src/env.ts:299`:
```typescript
HOSPEDA_BETTER_AUTH_SECRET: z.string().min(1, 'Better Auth secret is required').optional()
```

The `.min(1)` message says "required" but `.optional()` makes it... optional. The API schema correctly defines it as required (no `.optional()`). If anyone uses `commonEnvSchemas.auth` in a new app, the secret would silently be absent.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 1 | Direct fix within SPEC-035 (remove `.optional()` or rename schema to `authOptional`) |

---

### GAP-049: OAuth client secrets have `|| ''` fallback

*Found in: v4 (security agent)*

`apps/api/src/lib/auth.ts:260,266`:
```typescript
clientSecret: env.HOSPEDA_GOOGLE_CLIENT_SECRET || ''
clientSecret: env.HOSPEDA_FACEBOOK_CLIENT_SECRET || ''
```

When a `clientId` is configured but `clientSecret` is not, the OAuth provider is silently enabled with an empty secret. Better Auth may send OAuth requests with no secret, which will fail but won't indicate a configuration error clearly.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix (either remove fallback or add guard: if clientId present, require clientSecret) |

---

### GAP-050: CORS/CSRF defaults to localhost without production validation

*Found in: v4 (security agent)*

`apps/api/src/utils/env.ts:115`:
```typescript
API_CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4321'),
```

Similarly, `API_SECURITY_CSRF_ORIGINS` (line 184) defaults to localhost.

If not configured in production, the API accepts CORS only from `localhost`, causing the frontend on a real domain to fail. No `superRefine` validates that these don't contain `localhost` in production.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 2 | Direct fix (add production superRefine that warns/rejects localhost in CORS/CSRF origins) |

---

### GAP-051: `printAudit` in `scripts/env/check.ts` has dead code

*Found in: v4 (QA agent)*

`scripts/env/check.ts` lines 140-150:
```typescript
function printAudit(audit: AppEnvAudit, verbose: boolean): void {
    const hasProblems = audit.missing.length > 0 || audit.extra.length > 0;
    if (!hasProblems && !verbose) return;
    for (const _key of audit.ok) {
        if (verbose) {
        }
    }
    for (const _key of audit.missing) {
    }
    for (const _key of audit.extra) {
    }
}
```

All three `for...of` loops have **empty bodies**. The function produces NO output. The `pnpm env:check` command runs but prints nothing to stdout, making it useless for developers.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 2 | Direct fix within SPEC-035 (implement the actual output logic) |

---

### GAP-052: ~80 API schema vars have zero test coverage + no required-missing tests

*Found in: v4 (QA agent)*

v4 QA agent scored `apps/api/test/utils/env.test.ts` at **42/100**. Key gaps:

**Variables with ZERO test coverage (~80):**
- All `HOSPEDA_CRON_*` vars (cron secret only tested with wrong name)
- All `HOSPEDA_DISABLE_AUTH`, `HOSPEDA_ALLOW_MOCK_ACTOR`, `HOSPEDA_API_DEBUG_ERRORS`, testing flags
- All `HOSPEDA_SITE_URL`, `HOSPEDA_ADMIN_URL`, `HOSPEDA_BETTER_AUTH_URL`
- All `HOSPEDA_DB_POOL_*` vars
- All `HOSPEDA_MERCADO_PAGO_*`, `HOSPEDA_RESEND_*`, `HOSPEDA_LINEAR_*`, `HOSPEDA_EXCHANGE_RATE_*`
- All `HOSPEDA_SENTRY_*` vars
- All `API_CORS_*` (6 vars)
- All `API_LOG_*` beyond basic level (7 vars)
- All `API_RATE_LIMIT_AUTH_*`, `API_RATE_LIMIT_PUBLIC_*`, `API_RATE_LIMIT_ADMIN_*` (12 vars)
- All `API_METRICS_*` vars

**Missing test scenarios:**
- No test verifies `HOSPEDA_DATABASE_URL` absent => validation failure
- No test verifies `HOSPEDA_BETTER_AUTH_SECRET` absent => validation failure
- No test verifies `HOSPEDA_API_URL` absent => validation failure
- No test verifies `API_COMPRESSION_LEVEL` out of range (< 1 or > 9) fails
- No test for invalid URLs in URL-typed variables
- No test for `HOSPEDA_CRON_ADAPTER` with invalid enum value

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 4 | Add to SPEC-035 (new task) or separate testing debt SPEC |

---

### GAP-053: `apps/api/docs/ENVIRONMENT_VARIABLES.md` uses completely wrong naming

*Found in: v4 (docs agent)*

This file uses a naming pattern with NO prefix where `API_` is required:

| Lines | Wrong Pattern | Correct Pattern |
|-------|--------------|-----------------|
| 17-18 | `LOG_LEVEL`, `ENABLE_REQUEST_LOGGING` | `API_LOG_LEVEL`, `API_ENABLE_REQUEST_LOGGING` |
| 44-47 | `CACHE_ENABLED`, `CACHE_DEFAULT_TTL` | `API_CACHE_ENABLED`, `API_CACHE_DEFAULT_MAX_AGE` |
| 52-55 | `COMPRESSION_ENABLED`, `COMPRESSION_THRESHOLD` | `API_COMPRESSION_ENABLED`, `API_COMPRESSION_THRESHOLD` |
| 61-68 | `SECURITY_ENABLED`, `SECURITY_CSRF_ENABLED` | `API_SECURITY_ENABLED`, `API_SECURITY_CSRF_ENABLED` |
| 74-82 | `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS` | `API_RATE_LIMIT_ENABLED`, `API_RATE_LIMIT_WINDOW_MS` |
| 88-97 | `METRICS_ENABLED` | `API_METRICS_ENABLED` |
| 114 | `DATABASE_URL` | `HOSPEDA_DATABASE_URL` |

**Impact:** A developer following this doc would configure completely wrong variable names that the API would ignore.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | Medium | 2 | Direct fix: DELETE file (canonical doc is `docs/guides/environment-variables.md`) |

---

### GAP-054: `docs/deployment/environments.md` uses invented `HOSPEDA_API_*` naming

*Found in: v4 (docs agent)*

This file documents an invented naming pattern `HOSPEDA_API_*` (e.g., `HOSPEDA_API_LOG_LEVEL`, `HOSPEDA_API_CORS_ORIGINS`, `HOSPEDA_API_CACHE_TTL`, `HOSPEDA_API_RATE_LIMIT_MAX`). The real system uses `API_LOG_LEVEL`, `API_CORS_ORIGINS`, `API_CACHE_DEFAULT_MAX_AGE`, `API_RATE_LIMIT_MAX_REQUESTS`.

Lines 300-391, 650-755, 880-887 all use this invented pattern. ~50+ wrong names.

Also references `MERCADO_PAGO_PUBLIC_KEY` (line ~510) which doesn't exist in the system.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 3 | Direct fix within SPEC-035 (rewrite affected sections) |

---

### GAP-055: 5 MercadoPago vars missing from env-registry entirely

*Found in: v4 (docs agent, registry agent)*

Only `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` is in the env-registry. These 5 vars are used in code (`packages/billing/src/adapters/mercadopago.ts`) but completely missing from the registry:

| Variable | Used In | Purpose |
|----------|---------|---------|
| `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` | Webhook signature verification | **Security-critical** |
| `HOSPEDA_MERCADO_PAGO_SANDBOX` | Sandbox mode toggle | Billing config |
| `HOSPEDA_MERCADO_PAGO_TIMEOUT` | Request timeout | Billing config |
| `HOSPEDA_MERCADO_PAGO_PLATFORM_ID` | Platform identification | Optional |
| `HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID` | Integrator identification | Optional |

Also missing: `HOSPEDA_RESEND_REPLY_TO` (referenced in `docs/deployment/billing-checklist.md`).

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| **High** | **High** | 2 | Direct fix within SPEC-035 (add to registry + API schema) |

---

### GAP-056: Registry misleadingly lists `admin` as consumer of `HOSPEDA_BETTER_AUTH_URL`

*Found in: v4 (registry agent)*

`packages/config/src/env-registry.hospeda.ts` defines `HOSPEDA_BETTER_AUTH_URL` with `apps: ['api', 'web', 'admin']`. But the admin app uses `VITE_BETTER_AUTH_URL` (which IS in the registry). The admin never reads `HOSPEDA_BETTER_AUTH_URL`.

**Impact:** Documentation generated from the registry would tell admin deployers to set `HOSPEDA_BETTER_AUTH_URL`, which the admin app doesn't read.

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix within SPEC-035 (remove `admin` from apps array) |

---

### GAP-057: Additional localhost fallbacks in web middleware and admin API client

*Found in: v4 (security agent)*

Beyond GAP-032 (payment URLs), these localhost fallbacks exist:

| File:Line | Code | Risk |
|-----------|------|------|
| `apps/web/src/lib/middleware-helpers.ts:159-164` | `process.env.HOSPEDA_API_URL \|\| process.env.PUBLIC_API_URL \|\| 'http://localhost:3001'` | Auth middleware makes session validation requests to localhost in production if both vars missing |
| `apps/admin/src/lib/api/client.ts:34` | `(url ?? 'http://localhost:3001').replace(/\/$/, '')` | Admin API client falls back to localhost if `VITE_API_URL` build injection fails |
| `apps/web/src/lib/env.ts:17` | `_env.PUBLIC_API_URL ?? _env.HOSPEDA_API_URL ?? 'http://localhost:3001'` | Web env helper falls back to localhost |
| `apps/web/src/lib/env.ts:27` | `_env.PUBLIC_SITE_URL ?? _env.HOSPEDA_SITE_URL ?? 'http://localhost:4321'` | Same for site URL |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Medium | Medium | 2 | Direct fix (remove localhost fallbacks, let apps fail-fast if URLs not configured) |

---

### GAP-058: Broken doc links to `docs/monitoring/` directory

*Found in: v4 (docs agent)*

| File | Link | Problem |
|------|------|---------|
| `docs/environment-variables.md:354` | `docs/monitoring/sentry-setup-guide.md` | Directory `docs/monitoring/` does not exist |
| `packages/logger/README.md:363` | `../../docs/monitoring/sentry-setup-guide.md` | Same broken link |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 1 | Direct fix (update links to `docs/runbooks/sentry-setup.md`) |

---

### GAP-059: `docs/security/*` files contain wrong variable names

*Found in: v4 (docs agent)*

| File | Line(s) | Wrong Names |
|------|---------|-------------|
| `docs/security/owasp-top-10.md` | 389, 2229, 3422 | `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` |
| `docs/security/api-protection.md` | 268, 705, 1979-1980 | `TESTING_RATE_LIMIT`, `RATE_LIMIT_MAX_REQUESTS` |
| `docs/security/billing-audit-2026-02.md` | 592, 605, 1635 | `MERCADO_PAGO_WEBHOOK_SECRET` |
| `docs/performance/monitoring.md` | 1177 | `RESEND_API_KEY` |

| Severity | Priority | Complexity | Action |
|----------|----------|------------|--------|
| Low | Low | 2 | Direct fix within SPEC-035 (bulk search-and-replace) |

---

## Section 6: Summary Matrix

### By Severity

| Severity | Count | GAPs |
|----------|-------|------|
| **Critical** | 2 | GAP-008, GAP-031 |
| **High** | 12 | GAP-002, GAP-011, GAP-016, GAP-019, GAP-024, GAP-032, GAP-033, GAP-041, GAP-047, GAP-051, GAP-053, GAP-055 |
| **Medium** | 24 | GAP-000, GAP-001, GAP-003, GAP-004, GAP-006, GAP-007, GAP-010, GAP-012, GAP-015, GAP-022, GAP-025, GAP-026, GAP-027, GAP-030, GAP-035, GAP-037, GAP-038, GAP-040, GAP-046, GAP-048, GAP-050, GAP-052, GAP-054, GAP-057 |
| **Low** | 16 | GAP-005, GAP-013, GAP-014, GAP-017, GAP-018, GAP-020, GAP-034, GAP-036, GAP-039, GAP-042, GAP-043, GAP-049, GAP-056, GAP-058, GAP-059 |
| **Resolved** | 5 | GAP-009, GAP-023, GAP-028 (superseded), GAP-029, GAP-044, GAP-045 |

### By Action Required

| Action | GAPs |
|--------|------|
| **Direct fix within SPEC-035** | GAP-001, GAP-002, GAP-003, GAP-005, GAP-006, GAP-007, GAP-010, GAP-011, GAP-012, GAP-015, GAP-016, GAP-017, GAP-020, GAP-022, GAP-027, GAP-030, GAP-031, GAP-032, GAP-033, GAP-037, GAP-038, GAP-039, GAP-041, GAP-042, GAP-043, GAP-047, GAP-048, GAP-049, GAP-050, GAP-053, GAP-054, GAP-055, GAP-056, GAP-057, GAP-058, GAP-059 |
| **Add to SPEC-035 (new tasks)** | GAP-008, GAP-019, GAP-024, GAP-026, GAP-035, GAP-040, GAP-046, GAP-051, GAP-052 |
| **New SPEC needed** | GAP-025 (env tooling tests) |
| **Defer to another SPEC** | GAP-018 (SPEC-025) |
| **Technical debt ticket** | GAP-004 (env-config-helpers), GAP-013, GAP-014, GAP-034, GAP-036 |
| **Fix state tracking** | GAP-000 |
| **Resolved/Accepted** | GAP-009, GAP-023, GAP-028, GAP-029, GAP-044, GAP-045 |

### By Complexity (effort estimate)

| Complexity | Count | GAPs |
|------------|-------|------|
| 0 (no-op) | 5 | GAP-009, GAP-023, GAP-028, GAP-029, GAP-044, GAP-045 |
| 1 (trivial) | 20 | GAP-000, GAP-001, GAP-002, GAP-005, GAP-011, GAP-012, GAP-015, GAP-016, GAP-017, GAP-020, GAP-022, GAP-027, GAP-030, GAP-032, GAP-038, GAP-039, GAP-042, GAP-047, GAP-048, GAP-049, GAP-056, GAP-058 |
| 2 (simple) | 16 | GAP-003, GAP-010, GAP-013, GAP-014, GAP-031, GAP-033, GAP-035, GAP-036, GAP-037, GAP-041, GAP-043, GAP-046, GAP-050, GAP-053, GAP-055, GAP-057, GAP-059 |
| 3 (moderate) | 8 | GAP-007, GAP-008, GAP-019, GAP-024, GAP-026, GAP-040, GAP-054 |
| 4 (significant) | 4 | GAP-004, GAP-006, GAP-025, GAP-034, GAP-052 |

---

## Section 7: Confirmed Completed (v4 Verified)

These items from SPEC-035 are **genuinely complete** and remain verified:

| Task | What Was Done | Evidence |
|---|---|---|
| T-001: env-registry | 163 vars across 6 registry files, 32 passing tests | `packages/config/src/env-registry*.ts` |
| T-002: Non-HOSPEDA vars | API_, PUBLIC_, VITE_, Docker, System vars all defined | Multiple registry files |
| T-003: Export from index.ts | `ENV_REGISTRY` and types exported | `packages/config/src/index.ts` |
| T-004: Registry unit tests | 32 tests passing | `packages/config/src/__tests__/env-registry.test.ts` |
| T-006: API schema renames | All HOSPEDA_* vars in ApiEnvSchema | `apps/api/src/utils/env.ts` |
| T-018: @repo/db DI | Clean. No process.env in src/. `setDb()` exists | `packages/db/src/client.ts` |
| T-019: @repo/notifications DI | Clean. All config via DI | `packages/notifications/src/` |
| T-020: Notifications siteUrl | In deps interface | `notification.service.ts` |
| T-021: @repo/email DI | Clean. `createEmailClient({ apiKey })` | `packages/email/src/client.ts` |
| T-028: API loads from app dir | `resolve(__dirname, '../..')` | `apps/api/src/utils/env.ts` |
| T-029: Web env validation | serverEnvSchema + clientEnvSchema with refines | `apps/web/src/env.ts` |
| T-031: Admin env schema | VITE_* vars, eager validation | `apps/admin/src/env.ts` |
| T-034/T-035: Gitignore patterns | All correct | All .gitignore files |
| T-037-T-043: Env scripts | env:pull, env:push, env:check all exist (but check has dead code, see GAP-051) | `scripts/env/` |
| T-045: Centralized env docs | 18KB comprehensive doc | `docs/guides/environment-variables.md` |
| T-048: Remove backward compat | LEGACY_ENV_MAPPINGS removed | Commit `053a4ab9` |

**NOT complete (downgraded):**

| Task | Why Not Complete |
|---|---|
| T-024: apps/api/.env.example | File does NOT exist (GAP-031) |
| T-025: apps/web/.env.example | File does NOT exist (GAP-031) |
| T-026: apps/admin/.env.example | File does NOT exist (GAP-031) |
| T-027: docker/.env.example | File does NOT exist (GAP-031) |
| T-037-T-043 (partial) | env:check printAudit is dead code (GAP-051) |

---

## Section 8: Recommended Action Plan

### Phase 1 - Immediate (bugs + security + critical, complexity 1-2)

| # | GAP | What | Complexity |
|---|-----|------|------------|
| 1 | GAP-031 | **Create .env.example files** (generate from registry) | 2 |
| 2 | GAP-011 | Fix `PUBLIC_SITE_URL` in admin `forbidden.tsx` (runtime bug) | 1 |
| 3 | GAP-016 | Mask DATABASE_URL in seed `db.ts:26` (credential exposure) | 1 |
| 4 | GAP-032 | Remove localhost fallbacks from `addon.checkout.ts` payment URLs | 1 |
| 5 | GAP-047 | **Fix `formatDiff()` secret masking** (all cases) | 1 |
| 6 | GAP-002 | Rename `SEED_SUPER_ADMIN_PASSWORD` -> `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` | 1 |
| 7 | GAP-022 | Remove dead `VITE_API_URL` from admin `auth-session.ts` | 1 |
| 8 | GAP-012 | Fix `VITE_ENABLE_LOGGING` in web `logger.ts` | 1 |
| 9 | GAP-027 | Fix super admin password logging (mask or use stdout) | 1 |
| 10 | GAP-033 | Fix `VERCEL_GIT_COMMIT_SHA` in client bundles via vite.define | 2 |
| 11 | GAP-041 | Fix `CRON_SECRET` -> `HOSPEDA_CRON_SECRET` in env.test.ts | 1 |
| 12 | GAP-051 | **Implement `printAudit` output logic** in `check.ts` | 2 |
| 13 | GAP-053 | **Delete `apps/api/docs/ENVIRONMENT_VARIABLES.md`** (obsolete, all wrong names) | 1 |
| 14 | GAP-055 | **Add 5 MercadoPago vars to registry + API schema** | 2 |

### Phase 2 - Short-term (complete SPEC-035 scope, complexity 1-2)

| # | GAP | What | Complexity |
|---|-----|------|------------|
| 15 | GAP-000 | Fix task state tracking (reaudit all 49 tasks) | 1 |
| 16 | GAP-015 | Remove phantom `API_DEBUG_ERRORS` from registry | 1 |
| 17 | GAP-038 | Align registry/schema required fields (BETTER_AUTH_URL, SITE_URL) | 1 |
| 18 | GAP-039 | Align registry/schema default values | 1 |
| 19 | GAP-005 | Add validation import in `astro.config.mjs` | 1 |
| 20 | GAP-017 | Update JSDoc references to old var names | 1 |
| 21 | GAP-020 | Clean up email `.gitignore` | 1 |
| 22 | GAP-030 | Replace direct `HOSPEDA_*` reads in Astro pages with env.ts imports | 1 |
| 23 | GAP-037 | Add `HOSPEDA_API_URL` to AdminEnvSchema for server functions | 2 |
| 24 | GAP-042 | Fix `staging` in environments.md | 1 |
| 25 | GAP-048 | Fix `HOSPEDA_BETTER_AUTH_SECRET` `.optional()` in shared config | 1 |
| 26 | GAP-049 | Fix OAuth client secret `|| ''` fallback | 1 |
| 27 | GAP-050 | Add production validation for CORS/CSRF localhost origins | 2 |
| 28 | GAP-056 | Remove `admin` from HOSPEDA_BETTER_AUTH_URL apps array | 1 |
| 29 | GAP-057 | Remove localhost fallbacks in web middleware and admin client | 2 |
| 30 | GAP-058 | Fix broken doc links to `docs/monitoring/` | 1 |
| 31 | GAP-003 | Fix turbo.json globalEnv (add missing, remove runtime secrets) | 2 |
| 32 | GAP-010 | Clean up `CRON_AUTH_DISABLED` in tests and docs | 2 |

### Phase 3 - Medium-term (expanded scope, complexity 2-4)

| # | GAP | What | Complexity |
|---|-----|------|------------|
| 33 | GAP-008 + GAP-019 | Rename billing vars + enforce full DI (paired work) | 3 |
| 34 | GAP-007 | Fix all unprefixed vars in test files | 3 |
| 35 | GAP-006 | Fix wrong var names in 25+ doc files (~155+ instances) | 4 |
| 36 | GAP-024 | Write admin env schema tests | 3 |
| 37 | GAP-026 | Add cross-validation test registry<->schemas | 3 |
| 38 | GAP-035 | Add LOG_* vars to registry | 2 |
| 39 | GAP-043 | Add/remove VITE_LOG_LEVEL, VITE_API_PORT/HOST from registry/types | 2 |
| 40 | GAP-040 | Improve web env test coverage | 3 |
| 41 | GAP-046 | Add/remove HOSPEDA_* build source vars to/from registry | 2 |
| 42 | GAP-054 | Rewrite `environments.md` (fix invented HOSPEDA_API_* pattern) | 3 |
| 43 | GAP-059 | Fix wrong var names in security docs | 2 |
| 44 | GAP-052 | Expand API env test coverage (~80 vars + failure scenarios) | 4 |

### Phase 4 - Follow-up (separate specs/tickets)

| # | GAP | What | Complexity |
|---|-----|------|------------|
| 45 | GAP-013/014 | Centralize direct env reads in admin/web (tech debt) | 2 |
| 46 | GAP-025 | Test coverage for env:pull/push scripts | 4 |
| 47 | GAP-034 | Env-config-helpers refactor or document exception | 4 |
| 48 | GAP-036 | Admin components use `isDevelopment()` instead of `process.env.NODE_ENV` | 2 |
| 49 | GAP-018 | SENTRY_ENVIRONMENT integration (SPEC-025 scope) | 1 |
| 50 | GAP-004 | Refactor raw process.env reads in API (add VERCEL/CI to schema) | 4 |

### Resolved (no action needed)

- **GAP-009**: `LOG_*` prefix accepted (but see GAP-035 for registry documentation)
- **GAP-023**: `VERCEL_TOKEN` accepted as tooling exception
- **GAP-028**: Superseded by GAP-031 (.env.example files don't exist)
- **GAP-029**: Logger module-level reads accepted as design decision
- **GAP-044**: `API_VALIDATION_AUTH_ENABLED` IS in the schema (confirmed in v4)
- **GAP-045**: `.env.test` files do not exist (non-issue)

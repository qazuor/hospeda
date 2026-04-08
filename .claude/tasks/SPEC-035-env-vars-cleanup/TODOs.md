# SPEC-035: Environment Variables Cleanup, Validation & Documentation

## Progress: 27/49 tasks (55%)

**Average Complexity:** 2.5/4 (max)
**Status:** In progress - registry, DI, scripts, and env files done. Remaining: raw process.env cleanup, file deletions, docs consolidation, final verification.
**Gaps Report:** See `.claude/specs/specs-gaps-035.md` for 20 identified gaps with solutions.

---

### Setup Phase (5 tasks) - 4/5 DONE

- [x] **T-001** (complexity: 3) - Create env-registry.ts with EnvVarDefinition interface and all HOSPEDA_* shared vars
- [x] **T-002** (complexity: 3) - Add API_*, PUBLIC_*, VITE_*, Docker, and System vars to env-registry
- [x] **T-003** (complexity: 1) - Export env-registry from packages/config/src/index.ts
- [x] **T-004** (complexity: 2) - Write comprehensive unit tests for env-registry (32 tests passing)
- [ ] **T-005** (complexity: 3) - Audit codebase for process.env/import.meta.env usage and verify registry completeness
  - **GAP-008:** 5 MERCADO_PAGO_* vars in @repo/billing not in registry
  - **GAP-015:** API_DEBUG_ERRORS vs HOSPEDA_API_DEBUG_ERRORS inconsistency

### Core Phase (18 tasks) - 6/18 DONE

- [x] **T-006** (complexity: 4) - Update API Zod schema with renamed vars (108 vars in ApiEnvSchema)
- [ ] **T-007** (complexity: 3) - Update API services to use env.* with new var names
- [ ] **T-008** (complexity: 3) - Update API cron files to use env.* with new var names
  - Also: GAP-010 clean up CRON_AUTH_DISABLED references in docs
- [ ] **T-009** (complexity: 3) - Update API middlewares part 1: auth, actor, security, rate-limit
  - **GAP-004:** process.env.CI reads in auth.ts, actor.ts
- [ ] **T-010** (complexity: 3) - Update API middlewares part 2: response, billing, logger, metrics, response-validator
- [ ] **T-011** (complexity: 3) - Update API utils to use env.* with new var names
  - **GAP-004:** NODE_ENV raw reads in health routes, configure-open-api, routes/index
- [ ] **T-012** (complexity: 3) - Update API lib files and types to use env.* with new var names
  - **GAP-004:** HOSPEDA_SENTRY_PROJECT read raw in sentry.ts:53
- [ ] **T-013** (complexity: 2) - Update API webhook routes to use env.* with new var names
- [ ] **T-014** (complexity: 2) - Update API entry files (app.ts, index.ts) to use env.*
- [ ] **T-015** (complexity: 1) - Update packages/seed superAdminLoader.ts with renamed var
  - **GAP-002:** SEED_SUPER_ADMIN_PASSWORD not renamed yet
- [ ] **T-016** (complexity: 2) - Update turbo.json globalEnv with renamed vars
  - **GAP-003:** Missing ~7 vars that affect build output
- [ ] **T-017** (complexity: 4) - Update existing tests to use new env var names
  - **GAP-007:** API_URL, DATABASE_URL, CRON_AUTH_DISABLED, TEST_DB_URL unprefixed in tests
- [x] **T-018** (complexity: 3) - @repo/db DI (already clean, no process.env, setDb() exists)
- [x] **T-019** (complexity: 3) - @repo/notifications DI (already clean, apiKey/fromEmail/fromName/siteUrl all DI)
- [x] **T-020** (complexity: 2) - @repo/notifications siteUrl in deps (already in NotificationServiceDeps)
- [x] **T-021** (complexity: 2) - @repo/email DI (already clean, createEmailClient({ apiKey }) exists)
- [x] **T-022** (complexity: 3) - API notification-helper.ts passes config from validated env (done)
- [ ] **T-023** (complexity: 3) - Update all package tests for DI patterns

### Integration Phase (16 tasks) - 12/16 DONE

- [x] **T-024** (complexity: 3) - apps/api/.env.example exists with documentation
- [x] **T-025** (complexity: 3) - apps/web/.env.example and apps/admin/.env.example exist
- [x] **T-026** (complexity: 2) - Per-app .env.test files exist (api, web, admin)
- [x] **T-027** (complexity: 1) - docker/.env.example exists
- [x] **T-028** (complexity: 2) - API loads dotenv from app directory (not root)
- [x] **T-029** (complexity: 3) - Web env validation schemas exist (serverEnvSchema + clientEnvSchema + refines)
- [ ] **T-030** (complexity: 3) - Refactor apps/web/src/lib/env.ts to use validated env
  - **GAP-014:** Direct import.meta.env reads in auth-client, layouts, pages
  - **GAP-005:** validateWebEnv() not called in astro.config.ts
- [x] **T-031** (complexity: 3) - Admin env schema + eager validation (all 7 VITE_* vars added, eager call in __root.tsx)
- [ ] **T-032** (complexity: 2) - Update scripts/setup-test-db.ts for per-app .env.test path
- [ ] **T-033** (complexity: 2) - Delete root env files and obsolete env files
  - **GAP-001:** Root .env, .env.local still exist. apps/admin/.env exists.
- [x] **T-034** (complexity: 2) - Root .gitignore env patterns correct
- [x] **T-035** (complexity: 2) - Per-app .gitignore files + docker/.gitignore correct
- [ ] **T-036** (complexity: 1) - Verify git tracking (blocked by T-033)

### Vercel Scripts Phase - 5/5 DONE

- [x] **T-037** (complexity: 3) - scripts/env/utils/vercel-api.ts exists
- [x] **T-038** (complexity: 2) - scripts/env/utils/registry.ts and formatters.ts exist
- [x] **T-039** (complexity: 2) - scripts/env/utils/prompts.ts exists
- [x] **T-040** (complexity: 4) - scripts/env/pull.ts exists
- [x] **T-041** (complexity: 4) - scripts/env/push.ts exists
- [x] **T-042** (complexity: 4) - scripts/env/check.ts exists
- [x] **T-043** (complexity: 1) - @inquirer/prompts + npm scripts in root package.json exist

### Testing Phase (1 task) - 0/1 DONE

- [ ] **T-044** (complexity: 3) - Write unit tests for env:check script logic
  - scripts/env/__tests__/check.test.ts exists but needs verification

### Docs Phase (3 tasks) - 0/3 DONE

- [ ] **T-045** (complexity: 3) - docs/guides/environment-variables.md exists (18KB) but needs verification against registry
- [ ] **T-046** (complexity: 3) - Complete docs sections 6-10 (needs verification)
- [ ] **T-047** (complexity: 2) - Delete old docs + update CLAUDE.md references
  - **GAP-006:** docs/environment-variables.md (legacy) still exists

### Cleanup Phase (2 tasks) - 1/2 DONE

- [x] **T-048** (complexity: 2) - LEGACY_ENV_MAPPINGS already removed (commit 053a4ab9)
- [ ] **T-049** (complexity: 2) - Final verification - typecheck, lint, test, env:check

---

## New Tasks from Gaps Analysis

These gaps were NOT in the original spec and need new tasks:

- [ ] **GAP-008** - Add 5 missing MERCADO_PAGO_* vars to registry + rename in @repo/billing
- [ ] **GAP-010** - Clean up CRON_AUTH_DISABLED references in docs (feature was removed)
- [ ] **GAP-011** - Fix PUBLIC_SITE_URL in admin forbidden.tsx (RUNTIME BUG - wrong prefix)
- [ ] **GAP-012** - Fix VITE_ENABLE_LOGGING in web logger.ts (wrong prefix for web app)
- [ ] **GAP-016** - Mask DATABASE_URL in seed logs (security)
- [ ] **GAP-017** - Update JSDoc references with old var names
- [ ] **GAP-019** - Enforce full DI for @repo/billing MercadoPago adapter
- [ ] **GAP-020** - Clean up vestigial env patterns in packages/email/.gitignore

## Decided Exceptions

- **GAP-009:** `LOG_*` prefix accepted as exception for `@repo/logger` (industry convention)
- **GAP-018:** `SENTRY_ENVIRONMENT` deferred to SPEC-025

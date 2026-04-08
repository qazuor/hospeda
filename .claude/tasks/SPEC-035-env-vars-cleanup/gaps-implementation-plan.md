# SPEC-035 Gaps: Consolidated Implementation Plan

> **Date:** 2026-03-07
> **Total gaps:** 46 to implement (1 false positive, 6 previously resolved, 1 partial postpone)
> **Total tasks:** 42 (T-001 to T-021 + T-050 to T-070)
> **Total complexity points:** ~90
> **Estimated phases:** 7

---

## Decision Log

| Gap | Decision | Notes |
|-----|----------|-------|
| GAP-000 | HACER | Re-audit task state |
| GAP-001 | HACER | Rename .env to .env.local |
| GAP-002 | HACER | Rename SEED_SUPER_ADMIN_PASSWORD |
| GAP-003 | HACER | Fix turbo.json globalEnv |
| GAP-004 | HACER PARCIAL | Parts A+B yes, Part C (env-config-helpers) POSTPONED |
| GAP-005 | HACER | Add validation in astro.config.mjs |
| GAP-006 | HACER (5 subtasks) | Fix ~155+ wrong names in 25+ doc files |
| GAP-007 | HACER | Fix test file var names |
| GAP-008 | HACER | Rename billing MERCADO_PAGO_* vars (with GAP-019+055) |
| GAP-010 | HACER | Clean up CRON_AUTH_DISABLED refs |
| GAP-011 | HACER | Fix PUBLIC_SITE_URL in admin |
| GAP-012 | HACER | Fix VITE_ENABLE_LOGGING in web |
| GAP-013 | HACER | Centralize admin VITE_* reads |
| GAP-014 | HACER | Centralize web PUBLIC_* reads |
| GAP-015 | HACER | Remove phantom API_DEBUG_ERRORS |
| GAP-016 | HACER | Mask DATABASE_URL in seed logs |
| GAP-017 | HACER | Fix JSDoc old var names |
| GAP-018 | HACER | Resolve SENTRY_ENVIRONMENT (defer to SPEC-025) |
| GAP-019 | HACER | Fix billing DI (with GAP-008+055) |
| GAP-020 | HACER | Clean email .gitignore |
| GAP-021 | HACER | Accept VERCEL_GIT_COMMIT_SHA as exception, fix client |
| GAP-022 | HACER | Remove dead VITE_API_URL in auth-session |
| GAP-024 | HACER | Write admin env tests |
| GAP-025 | HACER | Write env script tests |
| GAP-026 | HACER | Write registry-schema cross-validation test |
| GAP-027 | HACER | Fix password plaintext logging |
| GAP-030 | HACER | Replace direct HOSPEDA_* reads in Astro pages |
| GAP-031 | DESCARTAR | FALSE POSITIVE - .env.example files exist |
| GAP-032 | HACER | Remove localhost fallback in MercadoPago |
| GAP-033 | HACER | Inject VERCEL_GIT_COMMIT_SHA in client bundles |
| GAP-035 | HACER | Add LOG_* vars to registry |
| GAP-036 | HACER | Replace process.env.NODE_ENV in admin components |
| GAP-037 | HACER | Add HOSPEDA_API_URL to AdminEnvSchema |
| GAP-038 | HACER | Align required fields registry vs schemas |
| GAP-039 | HACER | Align default values registry vs schemas |
| GAP-040 | HACER | Improve web env test coverage |
| GAP-041 | HACER | Fix false positive CRON_SECRET tests |
| GAP-042 | HACER | Fix staging NODE_ENV in docs |
| GAP-043 | HACER | Clean @repo/config dead exports + deps |
| GAP-046 | HACER | Remove HOSPEDA_* fallbacks in vite.config.ts |
| GAP-047 | HACER | Fix formatDiff() secret masking |
| GAP-048 | HACER | Remove .optional() from BETTER_AUTH_SECRET |
| GAP-049 | HACER | Fix OAuth clientSecret fallback |
| GAP-050 | HACER | Add production CORS/CSRF validation |
| GAP-051 | HACER | Implement printAudit output logic |
| GAP-052 | HACER | Expand API env test coverage |
| GAP-053 | HACER | DELETE wrong ENVIRONMENT_VARIABLES.md |
| GAP-054 | HACER | Rewrite environments.md |
| GAP-055 | HACER | Add 5 MercadoPago vars to registry (with GAP-008) |
| GAP-056 | HACER | Remove admin from BETTER_AUTH_URL apps |
| GAP-057 | HACER | Remove localhost fallbacks |
| GAP-058 | HACER | Fix broken doc links |
| GAP-059 | HACER | Fix security doc var names |

---

## Phase Overview

| Phase | Priority | Tasks | Complexity | Description |
|-------|----------|-------|------------|-------------|
| 1 | CRITICAL | T-001..T-007 | 13 | Security fixes |
| 2 | HIGH | T-008..T-012 | 7 | Runtime bug fixes |
| 3 | HIGH | T-013..T-021 | 18 | Schema & registry alignment |
| 4 | MEDIUM | T-050..T-054 | 13 | Code consistency |
| 5 | MEDIUM | T-055..T-060 | 18 | Test coverage |
| 6 | LOW | T-061..T-065 | 10 | Documentation fixes |
| 7 | LOW | T-066..T-070 | 11 | Cleanup & tooling |

---

## Phase 1: Security Fixes (CRITICAL)

All tasks parallel. No blockers.

| ID | Gap | Title | Cx | Files |
|----|-----|-------|----|-------|
| T-001 | GAP-016 | fix(seed): mask DATABASE_URL before logging | 1 | `packages/seed/src/utils/db.ts` |
| T-002 | GAP-027 | fix(seed): remove plaintext password from logger | 1 | `packages/seed/src/utils/superAdminLoader.ts` |
| T-003 | GAP-047 | fix(scripts): mask secrets in formatDiff for all cases | 2 | `scripts/env/utils/formatters.ts` |
| T-004 | GAP-048 | fix(config): make BETTER_AUTH_SECRET required in shared schema | 1 | `packages/config/src/env.ts` |
| T-005 | GAP-032 | fix(api): throw on missing URLs in MercadoPago back_urls | 2 | `apps/api/src/services/addon.checkout.ts` |
| T-006 | GAP-050 | fix(api): add production validation for CORS/CSRF origins | 3 | `apps/api/src/utils/env.ts` |
| T-007 | GAP-057+049 | fix(api/web/admin): remove localhost fallbacks + OAuth guard | 3 | `web/middleware-helpers.ts`, `admin/api/client.ts`, `web/env.ts`, `api/lib/auth.ts` |

**Note:** T-001, T-002 touch same area as T-012 (Phase 2). Apply sequentially on seed files.

---

## Phase 2: Runtime Bug Fixes (HIGH)

All tasks parallel (except seed file overlap with Phase 1).

| ID | Gap | Title | Cx | Files |
|----|-----|-------|----|-------|
| T-008 | GAP-011 | fix(admin): use VITE_SITE_URL instead of PUBLIC_SITE_URL | 1 | `admin/routes/auth/forbidden.tsx`, `admin/env.ts` |
| T-009 | GAP-012 | fix(web): use PUBLIC_ENABLE_LOGGING instead of VITE_ | 1 | `web/lib/logger.ts` |
| T-010 | GAP-033 | fix(web/admin): inject VERCEL_GIT_COMMIT_SHA via build config | 3 | `admin/vite.config.ts`, `web/astro.config.mjs`, sentry configs |
| T-011 | GAP-022 | fix(admin): remove dead VITE_API_URL branch in auth-session | 1 | `admin/lib/auth-session.ts` |
| T-012 | GAP-002 | fix(seed): rename SEED_SUPER_ADMIN_PASSWORD to HOSPEDA_ prefix | 1 | `seed/utils/superAdminLoader.ts` |

---

## Phase 3: Schema & Registry Alignment (HIGH)

All tasks parallel. T-013 is highest complexity.. start first.

| ID | Gap | Title | Cx | Files |
|----|-----|-------|----|-------|
| T-013 | GAP-008+019+055 | fix(billing): rename MERCADO_PAGO_* vars, enforce DI, add to registry | 4 | `billing/adapters/mercadopago.ts`, billing tests, registry |
| T-014 | GAP-015 | fix(config): remove phantom API_DEBUG_ERRORS from registry | 1 | `config/env-registry.api-config.ts` |
| T-015 | GAP-038 | fix(config): make BETTER_AUTH_URL and SITE_URL required in schemas | 2 | `config/env.ts`, `web/lib/env.ts` |
| T-016 | GAP-039 | fix(config): align default value mismatches schema vs registry | 2 | `config/env-registry.client.ts` + others |
| T-017 | GAP-035 | fix(config): add LOG_* vars to env-registry | 2 | registry files |
| T-018 | GAP-037 | fix(admin): add HOSPEDA_API_URL to AdminEnvSchema | 1 | `admin/src/env.ts` |
| T-019 | GAP-056 | fix(config): remove admin from BETTER_AUTH_URL apps array | 1 | `config/env-registry.hospeda.ts` |
| T-020 | GAP-018 | fix(config): defer SENTRY_ENVIRONMENT to SPEC-025 | 2 | `config/env-registry.docker-system.ts` |
| T-021 | GAP-046+043 | fix(admin/config): remove HOSPEDA_* fallbacks + clean dead exports | 3 | `admin/vite.config.ts`, `config/index.ts`, `config/package.json` |

---

## Phase 4: Code Consistency (MEDIUM)

Dependencies: Phase 1 T-006 (API schema), Phase 3 T-015/T-018 (schema changes).

| ID | Gap | Title | Cx | Blocked By |
|----|-----|-------|----|------------|
| T-050 | GAP-004A | fix(api): replace raw process.env.NODE_ENV with env.NODE_ENV | 3 | T-006 |
| T-051 | GAP-004B | fix(api): add VERCEL/CI/VERCEL_GIT_COMMIT_SHA to ApiEnvSchema | 2 | T-050 |
| T-052 | GAP-013+036 | fix(admin): centralize 17 raw VITE_* reads + 7 NODE_ENV reads | 3 | T-018 |
| T-053 | GAP-014+030+005 | fix(web): centralize 7 raw PUBLIC_* reads + astro.config validation | 3 | T-015 |
| T-054 | GAP-021 | docs(api): document VERCEL_GIT_COMMIT_SHA as platform exception | 2 | T-051 |

---

## Phase 5: Test Coverage (MEDIUM)

Dependencies: Phase 2-3 schema renames must land first so tests use correct names.

| ID | Gap | Title | Cx | Blocked By |
|----|-----|-------|----|------------|
| T-055 | GAP-041+007 | fix(test): rename obsolete env var names in 13+ test files | 3 | T-012, T-013 |
| T-056 | GAP-024 | test(admin): write env schema tests (0% -> 80%+) | 3 | T-018, T-052 |
| T-057 | GAP-040 | test(web): improve env test coverage (25/100 -> 70+) | 3 | T-053 |
| T-058 | GAP-052 | test(api): expand env schema tests for ~80 uncovered vars | 4 | T-050, T-051 |
| T-059 | GAP-026 | test(config): add registry-schema cross-validation test | 3 | T-013..T-021 |
| T-060 | GAP-025 | test(scripts): add env:pull/push/check utility tests | 2 | T-003 (formatDiff changes) |

---

## Phase 6: Documentation Fixes (LOW)

No code dependencies. Can start in parallel with Phase 4+.

| ID | Gap | Title | Cx | Blocked By |
|----|-----|-------|----|------------|
| T-061 | GAP-006 Sub1+2, GAP-053 | docs: DELETE obsolete env docs + rewrite environments.md | 3 | none |
| T-062 | GAP-006 Sub3, GAP-054, GAP-042 | docs: fix invented HOSPEDA_API_* pattern in environments.md | 3 | none |
| T-063 | GAP-006 Sub4 | docs: fix 8 moderate doc files (3-10 wrong names each) | 2 | none |
| T-064 | GAP-006 Sub5, GAP-010, GAP-058, GAP-059 | docs: fix 14 minor files + CRON_AUTH_DISABLED + broken links + security docs | 2 | none |
| T-065 | GAP-017 | docs: update JSDoc references to old var names | 1 | T-012 (seed rename) |

---

## Phase 7: Cleanup & Tooling (LOW)

| ID | Gap | Title | Cx | Blocked By |
|----|-----|-------|----|------------|
| T-066 | GAP-051 | fix(scripts): implement printAudit output logic in env:check | 3 | none |
| T-067 | GAP-003 | fix(turbo): add missing build vars, remove runtime secrets from globalEnv | 2 | T-010 (build config changes) |
| T-068 | GAP-020 | chore(email): clean vestigial .gitignore patterns | 1 | none |
| T-069 | GAP-001 | chore: rename .env files to .env.local | 1 | none |
| T-070 | GAP-000 | chore: re-audit all 49 SPEC-035 tasks and fix state.json | 4 | ALL previous tasks |

---

## Dependency Graph

```
PHASE 1 (all parallel)                    PHASE 6 (all parallel, no deps)
T-001 ──┐                                T-061 ── T-062 ── T-063 ── T-064
T-002 ──┤ (seed files, sequential)
T-003   │                                PHASE 7 (mostly parallel)
T-004   │                                T-066  T-068  T-069
T-005   │
T-006 ──┼──────────────────> T-050 (Phase 4)
T-007   │                      |
        │                    T-051
PHASE 2 │                      |
T-008   │                    T-052 ──> T-056 (Phase 5)
T-009   │
T-010 ──┼──────────────────────────────> T-067 (Phase 7)
T-011   │
T-012 ──┴──> T-055 (Phase 5), T-065 (Phase 6)

PHASE 3
T-013 ──────> T-055, T-059 (Phase 5)
T-014
T-015 ──────> T-053 (Phase 4) ──> T-057 (Phase 5)
T-016
T-017
T-018 ──────> T-052 (Phase 4) ──> T-056 (Phase 5)
T-019
T-020
T-021

ALL ────────> T-070 (final audit)
```

---

## Execution Strategy

### Parallel Tracks (for autonomous loop)

```
Track A (Seed):     T-001 > T-002 > T-012 > T-065
Track B (Security): T-003 > T-004 > T-005 > T-006 > T-050 > T-051 > T-054
Track C (Admin):    T-008 > T-011 > T-018 > T-052 > T-056
Track D (Web):      T-009 > T-015 > T-053 > T-057
Track E (Billing):  T-013 > T-055
Track F (Registry): T-014 > T-016 > T-017 > T-019 > T-020 > T-021 > T-059
Track G (Misc):     T-007 > T-010 > T-067
Track H (Scripts):  T-003 > T-060 > T-066
Track I (Docs):     T-061 > T-062 > T-063 > T-064
Track J (Cleanup):  T-068 > T-069
Track K (Tests):    T-058 (after T-050+T-051)

Final:              T-070 (after ALL)
```

### Quality Gates

Each phase completion requires:
1. `pnpm typecheck` passes
2. `pnpm lint` passes (biome)
3. `pnpm test` passes
4. No new regressions

### Commit Strategy

- One commit per task (atomic)
- Format: `type(scope): description [GAP-NNN]`
- Example: `fix(seed): mask DATABASE_URL before logging [GAP-016]`

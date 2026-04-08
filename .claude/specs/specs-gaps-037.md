# SPEC-037: Security Gaps Remediation - Post-Implementation Gap Analysis

> Generated: 2026-03-08 | Last updated: 2026-03-08 (Pass #7)
> Spec status: `completed` (32/32 tasks) - **but 52 gaps identified (32 from Pass #1-3, 15 from Pass #4, 1 from Pass #5, 4 from Pass #6, 2 from Pass #7)**
> Total audit passes: 7

---

## Methodology

### Pass #1 (2026-03-08)

Six specialized agents performed exhaustive file-by-file analysis with line-number references:

1. **Security Engineer #1 (Crypto & Auth)**: timingSafeEqual, Math.random, string literals, OAuth cross-validation, CSPRNG, system actor flag
2. **Security Engineer #2 (Info Leaks & PII)**: Health endpoints, logs, file.name, passwords, error stack traces, NODE_ENV exposure
3. **Security Engineer #3 (Permissions & Auth)**: SUPER_ADMIN bypasses, role checks, ownership, PermissionEnum, billing ownership
4. **Security Engineer #4 (Rate Limiting & Middleware)**: Trust proxy, signout, path classification, dead code, customRateLimit enforcement
5. **API Architect (Routes & Webhooks)**: Three-tier compliance, transactions, CSP, JSON-LD XSS, UUID validation, webhook safety
6. **DevOps/Quality Engineer (CI/CD & Quality)**: Workflow versions, console.*, Spanish comments, ACCEPTED_RISKS, documentation examples

**Result**: 20 gaps found (1 CRITICAL, 1 HIGH, 5 MEDIUM, 10 LOW, 3 INFO)

### Pass #2 (2026-03-08)

Same 6 specialized agents re-audited all areas with deeper analysis.

**Result**: 3 NEW gaps found, all 20 Pass #1 gaps re-verified

### Pass #3 (2026-03-08)

Same 6 specialized agents performed third exhaustive pass with expanded scope.

**Result**: 10 NEW gaps found, 22 of 23 Pass #1-2 gaps re-verified, 1 corrected (GAP-037-14 reclassified as non-issue)

### Pass #4 (2026-03-08)

Six specialized agents performed fourth exhaustive pass with fresh analysis of all files:

1. **Security Engineer #1 (Crypto & Auth)**: Re-verified CSRF, timingSafeEqual, Math.random, env validation. Expanded to mock auth, system actor schema exposure, trusted origins fallback. Found 3 NEW gaps.
2. **Security Engineer #2 (Info Leaks & PII)**: Re-verified all 6 existing info leak gaps. Expanded to billing-metrics.service, usage-tracking.service, notifications/retry.service, trial.service. Found 6 NEW gaps.
3. **Security Engineer #3 (Permissions & Auth)**: Re-verified all 5 existing permission gaps. Expanded to promo-codes and protected metrics permission granularity. Found 2 NEW gaps.
4. **Security Engineer #4 (Rate Limiting & Middleware)**: Re-verified customRateLimit (98 routes affected, up from ~40). Discovered auth rate limit tier is unreachable AND Better Auth /api/auth/* falls to general tier. Found 2 NEW gaps (compounding GAP-037-01).
5. **API Architect (Routes & Webhooks)**: Re-verified all 6 existing route/webhook gaps. Discovered open redirect in signin.astro and orphaned exchange-rate protected files. Reclassified GAP-037-07 and GAP-037-24. Found 2 NEW gaps.
6. **DevOps/Quality Engineer (CI/CD & Quality)**: Re-verified all 8 existing quality gaps. Found GAP-037-11 worse (58 instances, was 41), GAP-037-19 worse (12+ locations), GAP-037-32 worse (278 instances). Found 22+ `as any` violations. Found 2 NEW gaps.

**Result**: 15 NEW gaps found, all 28 open Pass #1-3 gaps re-verified (most unchanged, 3 worse), 2 reclassified as closeable (GAP-037-07, GAP-037-24)

### Pass #5 (2026-03-08)

Six specialized agents performed fifth exhaustive pass with full code verification against every spec task:

1. **Security Engineer #1 (Crypto & Auth)**: Re-verified T-003 (timingSafeEqual), T-004 (RoleEnum), T-005 (OAuth cross-validation, CSPRNG), T-002 (_isSystemActor), T-011 (system actor guard). All 5 tasks VERIFIED correctly implemented.
2. **Security Engineer #2 (Info Leaks & PII)**: Re-verified T-006 (health sanitization), T-007 (PII logging, masking, passwords), T-008 (file.name, billing errors). Found 1 NEW gap (PII in billing-customer-sync). Confirmed GAP-037-03 and GAP-037-04 still open.
3. **Security Engineer #3 (Permissions & Auth)**: Re-verified T-001 (new permissions), T-012 (SUPER_ADMIN bypass removal), T-013 (promo-codes), T-014 (bookmark ownership), T-015 (METRICS_RESET, billing ownership). T-014 partial: `listBookmarksByEntity()` lacks ownership filter (previously identified, re-confirmed).
4. **Security Engineer #4 (Rate Limiting & Middleware)**: Re-verified T-009, T-010, T-017. All declarations correct but confirmed GAP-037-01 still CRITICAL: `customRateLimit` appears in 99 route files but `rate-limit.ts` middleware has zero references to it.
5. **API Architect (Routes & Webhooks)**: Re-verified T-016 through T-025. All 9 items VERIFIED correctly implemented including transaction safety, tier separation, JSON-LD escaping, UUID validation, CSP headers.
6. **DevOps/Quality Engineer (CI/CD & Quality)**: Re-verified T-026 through T-032. 31/32 items verified. GAP-037-02 (CSRF field name mismatch) confirmed still open. Documentation examples partially cleaned.

**Result**: 1 NEW gap found (GAP-037-48), 29/32 spec tasks VERIFIED as correctly implemented, 3 tasks have residual issues from prior passes (GAP-037-01, GAP-037-02, GAP-037-03). All prior open gaps re-confirmed.

### Pass #6 (2026-03-08)

Six specialized agents performed sixth exhaustive pass with independent code-level verification. Each agent read actual source code and verified implementation line-by-line:

1. **Security Engineer #1 (Crypto & Auth)**: Full re-audit of 10 crypto/auth items. Verified 9/10 PASS. CSRF config (GAP-037-02) remains implicit (trustedOrigins configured but no explicit `csrfProtection` object). All prior Pass #1-5 findings confirmed. Found 1 NEW issue: CSRF relies entirely on Better Auth defaults without explicit configuration.
2. **Security Engineer #2 (Info Leaks & PII)**: Full re-audit of 9 info leak areas. Verified 7/9 PASS. Confirmed GAP-037-03 still open (`getApproachingLimits()` leaks error.message). Confirmed GAP-037-49 (billing-customer-sync PII) has nuance: email at line 103 is operationally needed for QZPay customer creation but should still be masked. Verified superAdminLoader (GAP-037-04) has `logger.warn()` alongside `console.warn()` (dual logging, should be stderr-only).
3. **Security Engineer #3 (Permissions & Auth)**: Full re-audit of 7 permission items. Verified 6/7 PASS. Found 1 NEW issue: promo-codes route has 7 instances of `throw new Error(result.error?.message)` for service errors (lines 64, 106, 137, 173, 203, 276, 294) that become HTTP 500 instead of appropriate 400/404. This is a subset of GAP-037-06 but worth noting as a separate verification.
4. **Security Engineer #4 (Rate Limiting & Middleware)**: Full re-audit of rate limiting. **CONFIRMED GAP-037-01 CRITICAL**: `rate-limit.ts` has ZERO references to `routeOptions` or `customRateLimit`. Searched entire file, grep returns empty. 34+ routes declare customRateLimit, middleware ignores 100%. Dead code in validation.ts correctly removed. Signout rate limit clearing correctly protected by `if (userId)`.
5. **API Architect (Routes & Webhooks)**: Full re-audit of 18 items across routes, webhooks, XSS, CI/CD, code quality. Verified 16/18 PASS. Found 2 NEW issues: (a) billing metrics documentation says "mounted under /protected/billing/metrics" but actually uses admin tier with `billingAdminGuardMiddleware()` (documentation mismatch, not security bug), (b) `docs/security/authentication.md` still has 4+ role-check examples (lines 1020, 1099, 1238, 1270) violating PermissionEnum mandate.
6. **Task State Auditor**: Cross-referenced all 32 tasks, 49 gaps, and acceptance criteria. Found 3 tasks marked completed with residual open gaps (T-009, T-007, T-008). Found 15 gaps with NO assigned task. Identified spec marked complete prematurely.

**Result**: 4 NEW findings (GAP-037-50 through GAP-037-53). All 46 prior open gaps re-confirmed. **CRITICAL GAP-037-01 independently verified for 6th time**. Audit is now convergent (diminishing new findings per pass).

---

## Executive Summary

| Severity | Pass #1 | Pass #2 New | Pass #3 New | Pass #4 New | Pass #5 New | Pass #6 New | Pass #7 New | Total |
|----------|---------|-------------|-------------|-------------|-------------|-------------|-------------|-------|
| **CRITICAL** | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| **HIGH** | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| **MEDIUM** | 5 | 1 | 3 | 6 | 1 | 1 | 0 | 17 |
| **LOW** | 10 | 2 | 6 | 6 | 0 | 2 | 2 | 28 |
| **INFO** | 3 | 0 | 1 | 3 | 0 | 1 | 0 | 8 |
| **Total** | 20 | 3 | 10 | 15 | 1 | 4 | 2 | 55 |
| **Closed/Reclassified** | - | - | -1 (GAP-037-14) | -2 (GAP-037-07, GAP-037-24) | 0 | 0 | -1 (GAP-037-35) | -4→**-6** |
| **Net Total** | - | - | - | - | - | - | - | **49** |

### Pass #7 Verification Summary (32 spec tasks)

| Category | Tasks | Verified OK | Open Gaps (cumulative) | New Issues (Pass #7) |
|----------|-------|-------------|--------------------------|---------------------|
| Crypto & Auth (T-002/003/004/005/011) | 5 | **5/5** | GAP-037-02 (CSRF field), GAP-037-09 (timing), GAP-037-36 (schema), GAP-037-37 (localhost), GAP-037-39 (mock), GAP-037-50 (CSRF implicit) | GAP-037-54 (cron secret min length) |
| Info Leaks (T-006/007/008) | 3 | **2/3** | GAP-037-03 (error leak), GAP-037-04 (password), GAP-037-49 (billing PII), GAP-037-42/43 (metrics/tracking errors) | None (all re-confirmed) |
| Rate Limiting (T-009/010/017) | 3 | **3/3 declarations** | **GAP-037-01 CRITICAL** (98 routes, customRateLimit dead), GAP-037-34 (auth tier unreachable) | None (7th independent confirmation) |
| Permissions (T-001/012/013/014/015) | 5 | **5/5** | GAP-037-40/41 (coarse permissions, acceptable) | None. GAP-037-38 reclassified |
| Routes & Webhooks (T-016 to T-025) | 10 | **10/10** | GAP-037-27 (CSP unsafe-inline) | GAP-037-35 **CLOSED** (open redirect mitigated) |
| CI/CD & Quality (T-026 to T-032) | 6 | **6/6** | GAP-037-11/53 (docs role-check), GAP-037-28/44 (console.*) | GAP-037-55 (merge of GAP-037-10) |
| **TOTAL** | **32** | **29/32 clean** | **3 tasks with residual gaps** | **2 new, 1 closed, 1 reclassified** |

---

## Gap Details

### GAP-037-01: `customRateLimit` is never enforced (CRITICAL)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4, #5, **#6 independently re-verified**)
- **Severity**: CRITICAL
- **Complexity**: 4
- **Spec Task**: T-009 (claimed contact form rate limit)
- **Files**:
  - `apps/api/src/middlewares/rate-limit.ts:238-454` (middleware)
  - `apps/api/src/utils/route-factory.ts:200` (config attachment)
  - **98 route files** declaring `customRateLimit` (Pass #4 refined count via grep)
- **Problem**: `rateLimitMiddleware` classifies requests into 4 global tiers (`auth`, `public`, `admin`, `general`) via `getEndpointType()`. It has **zero references** to `routeOptions` or `customRateLimit`. Route-level options are set AFTER rate limiting (create-app.ts: rate limit at line 102, routes load later).
- **Pass #4 compounding factors**:
  - The `auth` tier is unreachable (see GAP-037-34)
  - Better Auth `/api/auth/*` falls to `general` tier (see GAP-037-34)
  - Contact form declares 5 req/min but gets public tier (100+)
  - Feedback, newsletter, health PATCH.. all per-route limits decorative
- **Impact**: Every per-route rate limit declaration across 98 routes is dead configuration.
- **Proposed Solution**:
  1. Option A: Create per-route rate limit middleware wrapper that routes can use directly as middleware
  2. Option B: Move rate limiting to after route matching, read `routeOptions` from context
  3. Add unit tests verifying per-route limits take effect
- **Recommendation**: **Fix directly in SPEC-037 scope** (security-critical, was claimed as done)

---

### GAP-037-02: CSRF localhost production validation broken (HIGH)

- **Audit**: Pass #1 (confirmed Pass #2, #3, **#4 including test bug**)
- **Severity**: HIGH
- **Complexity**: 1
- **Spec Task**: T-005 (env validation)
- **File**: `apps/api/src/utils/env.ts:334`
- **Problem**: `data.API_CSRF_ORIGINS` references undefined field. Actual field is `API_SECURITY_CSRF_ORIGINS` (line 192). The `.split(',')` is never reached; `?? []` yields empty array; localhost check never executes.
- **Pass #4 note**: Test file `env.test.ts` also uses wrong field name `API_CSRF_ORIGINS`, compounding the issue. The test passes because the validation never runs.
- **Impact**: Operator can ship localhost CSRF origins to production without warning.
- **Proposed Solution**: Change `data.API_CSRF_ORIGINS` to `data.API_SECURITY_CSRF_ORIGINS` on line 334, and fix the test.
- **Recommendation**: **Fix directly** (one-line fix + test fix, security-critical)

---

### GAP-037-03: `getApproachingLimits()` leaks raw error messages (MEDIUM)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4, #5, **#6 independently re-verified: line 229 still returns error.message without debug guard**)
- **Severity**: MEDIUM
- **Complexity**: 1
- **Spec Task**: T-008 (generic billing-usage errors)
- **File**: `apps/api/src/services/billing-usage.service.ts:225-231`
- **Problem**: Returns `error.message` without `HOSPEDA_API_DEBUG_ERRORS` guard. The `getSystemUsage()` method 30 lines above has the correct pattern.
- **Impact**: DB table names, column names, connection details could leak in production.
- **Proposed Solution**: Apply same `HOSPEDA_API_DEBUG_ERRORS` guard.
- **Recommendation**: **Fix directly** (trivial, same pattern exists nearby)

---

### GAP-037-04: SuperAdminLoader leaks partial password to stdout (MEDIUM)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: MEDIUM
- **Complexity**: 2
- **Spec Task**: T-007 (password logging)
- **File**: `packages/seed/src/utils/superAdminLoader.ts:59-62,76-78`
- **Problem**: Line 60 leaks first 4 chars of password via `console.warn`. Line 77 logs full email unmasked.
- **Impact**: Password prefix and PII visible in CI/CD logs.
- **Proposed Solution**: Remove password characters entirely. Mask email.
- **Recommendation**: **Fix directly** (seed tooling, straightforward)

---

### GAP-037-05: Full unmasked mpPreapprovalId stored in DB (MEDIUM)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: MEDIUM
- **Complexity**: 2
- **Spec Task**: T-007 (billing data masking)
- **File**: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:306-309`
- **Problem**: Logs correctly use `maskId()`, but DB `metadata` stores raw ID.
- **Proposed Solution**: Document as accepted risk (needed for MP API reconciliation).
- **Recommendation**: **Document as accepted risk**

---

### GAP-037-06: `throw new Error()` in ~27 billing route handlers (MEDIUM)

- **Audit**: Pass #1 (confirmed Pass #2, #3, **#4 with +1 instance found**)
- **Severity**: MEDIUM
- **Complexity**: 3
- **Files** (Pass #4 count: **27 instances across 5 files**):
  - `apps/api/src/routes/billing/addons.ts` - 13 instances
  - `apps/api/src/routes/billing/promo-codes.ts` - 7 instances (service errors, NOT auth)
  - `apps/api/src/routes/billing/metrics.ts` - 3 instances
  - `apps/api/src/routes/billing/admin/metrics.ts` - 3 instances
  - `apps/api/src/routes/accommodation/public/getStats.ts` - 1 instance (NEW in Pass #4)
- **Problem**: `throw new Error()` becomes HTTP 500. Should be `HTTPException` with proper status.
- **Proposed Solution**: Replace all with `throw new HTTPException(statusCode, { message })`.
- **Recommendation**: **New SPEC** (27 instances, systematic change)

---

### GAP-037-07: ~~Billing routes in protected tier~~ **RECLASSIFIED: BY DESIGN** (Pass #4)

- **Audit**: Pass #1 (confirmed Pass #2, #3, **CORRECTED Pass #4**)
- **Severity**: ~~MEDIUM~~ **N/A - BY DESIGN**
- **Pass #4 correction**: Protected billing routes are user-facing operations (checkout, view own subscription, promo codes). Admin billing operations are correctly at `/admin/billing/`. The three-tier architecture explicitly allows protected-tier routes for "own resources". The `billingAdminGuardMiddleware()` provides additional access control. **This is architecturally correct.**
- **Status**: **CLOSED - By design**

---

### GAP-037-08: Signout IP extraction ignores trustProxy (LOW)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: LOW
- **Complexity**: 2
- **Spec Task**: T-009
- **File**: `apps/api/src/routes/auth/signout.ts:36-39`
- **Problem**: Always trusts `x-forwarded-for`/`x-real-ip` regardless of `trustProxy` config. Rate-limit uses `'untrusted-proxy'` key when trustProxy=false, so signout clears wrong bucket. Also doesn't check `cf-connecting-ip` which rate-limit does.
- **Proposed Solution**: Extract shared IP extraction utility.
- **Recommendation**: **Fix directly** (small, consistency)

---

### GAP-037-09: Timing side-channel on secret length (LOW)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: LOW
- **Complexity**: 2
- **File**: `apps/api/src/cron/middleware.ts:21`
- **Problem**: `if (a.length !== b.length) return false` leaks secret length via timing.
- **Proposed Solution**: Hash both with SHA-256 before comparing.
- **Recommendation**: **Defer** (negligible practical risk)

---

### GAP-037-10: Math.random() in shared utility package (LOW)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: LOW
- **Complexity**: 1
- **File**: `packages/utils/src/array.ts:22,33`
- **Problem**: `getRandomItem()` and `shuffleArray()` use `Math.random()` without JSDoc warning.
- **Proposed Solution**: Add `@warning Non-cryptographic` JSDoc.
- **Recommendation**: **Fix directly** (2 minutes)

---

### GAP-037-11: Documentation examples propagate role-check anti-pattern (LOW)

- **Audit**: Pass #1 (refined Pass #2, confirmed Pass #3, **Pass #4: 58 instances, up from 41**)
- **Severity**: LOW (but high propagation risk)
- **Complexity**: 3
- **Files** (Pass #4 count: **58 instances across 14+ .md files**):
  - `packages/service-core/docs/guides/permissions.md` - 16 instances
  - `packages/service-core/docs/quick-start.md` - 8 instances
  - `docs/security/billing-audit-2026-02.md` - 6 instances
  - `packages/service-core/docs/guides/creating-services.md` - 6 instances
  - `packages/service-core/docs/guides/lifecycle-hooks.md` - 4 instances
  - `packages/service-core/docs/api/BaseCrudService.md` - 3 instances
  - `packages/service-core/docs/api/errors.md` - 2 instances
  - `packages/service-core/docs/README.md` - 2 instances
  - Plus others
  - Note: `packages/service-core/CLAUDE.md` has 2 instances labeled "Wrong Patterns (NEVER use these)" which are acceptable
- **Problem**: T-030 only updated 5 example files. 56+ anti-patterns remain across documentation.
- **Proposed Solution**: Systematic find-replace across all documentation files.
- **Recommendation**: **Fix directly** (documentation-only, no code risk)

---

### GAP-037-12: `listBookmarksByEntity()` no ownership verification (LOW)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: LOW
- **Complexity**: 2
- **File**: `packages/service-core/src/services/userBookmark/userBookmark.service.ts:194-216`
- **Problem**: `_canList(actor)` only checks actor is not null. Any authenticated user can list all bookmarks for any entity. Contrast with `listBookmarksByUser()` which correctly checks `actor.id !== validated.userId && !this._hasViewAnyPermission(actor)`.
- **Proposed Solution**: Require `USER_BOOKMARK_VIEW_ANY` or filter by owner.
- **Recommendation**: **Document as accepted risk or fix** (product decision: social feature vs privacy)

---

### GAP-037-13: Memory leak in requestProviderEventIds Map (LOW)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: LOW
- **Complexity**: 1
- **File**: `apps/api/src/routes/webhooks/mercadopago/event-handler.ts:25,73,187,241,249`
- **Problem**: Success path never calls `delete()`. Only error handler cleans up. Module-level Map grows unbounded in long-running processes.
- **Pass #4 note**: Mitigated on Vercel (fresh process per invocation), but affects dev/container deployments.
- **Proposed Solution**: Add `delete()` on success path or use `finally`.
- **Recommendation**: **Fix directly** (one-line fix)

---

### GAP-037-14: ~~Dead code in exchange-rates barrel export~~ **RECLASSIFIED: NON-ISSUE** (Pass #3)

- **Status**: **CLOSED - False positive** (Pass #3)
- **Pass #4 update**: However, the barrel file IS actually orphaned now (see GAP-037-38). The export `exchangeRateRoutes` is NOT imported by `routes/index.ts` which imports directly from `./exchange-rates/admin/index.js` and `./exchange-rates/public/index.js`. The barrel file and protected routes it mounts are dead code.

---

### GAP-037-15: ~~JSDoc comment mismatch in exchange-rate protected route~~ **ABSORBED into GAP-037-38**

- **Audit**: Pass #1 (confirmed Pass #2, #3, **absorbed Pass #4**)
- **Status**: **ABSORBED** into GAP-037-38 (the entire protected exchange-rate directory is orphaned dead code)

---

### GAP-037-16: Error detail gating uses NODE_ENV instead of HOSPEDA_API_DEBUG_ERRORS (LOW)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: LOW
- **Complexity**: 2
- **Files**: `apps/api/src/utils/response-helpers.ts` (9 locations), `apps/api/src/utils/configure-open-api.ts:43`
- **Problem**: 10 locations use `NODE_ENV === 'development'` instead of `HOSPEDA_API_DEBUG_ERRORS`. Inconsistent with response middleware which correctly uses the debug flag.
- **Pass #4 note**: `configure-open-api.ts:42` also unconditionally exposes `err.message` (see GAP-037-47).
- **Proposed Solution**: Migrate all to `HOSPEDA_API_DEBUG_ERRORS`.
- **Recommendation**: **New SPEC** (systematic change, low urgency)

---

### GAP-037-17: Missing transaction in addon purchase confirmation (LOW)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: LOW
- **Complexity**: 3
- **File**: `apps/api/src/services/addon.checkout.ts:424-453`
- **Problem**: `confirmAddonPurchase()` executes insert purchase + apply entitlements without transaction. If step 2 fails, user paid but no entitlements. Code logs warning but no rollback.
- **Proposed Solution**: Wrap in `db.transaction()`.
- **Recommendation**: **Fix directly** (billing integrity)

---

### GAP-037-18: Dual ACCEPTED_RISKS.md files with inconsistent numbering (INFO)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: INFO
- **Complexity**: 2
- **Files**: `docs/security/ACCEPTED_RISKS.md` (SEC-001/002/003), `apps/api/docs/ACCEPTED_RISKS.md` (11 risks)
- **Problem**: Two files, overlapping content, different numbering schemes. Violates Single Source of Truth.
- **Proposed Solution**: Consolidate into single file.
- **Recommendation**: **Fix directly**

---

### GAP-037-19: Spanish comments in production code (INFO)

- **Audit**: Pass #1 (confirmed Pass #2, #3, **Pass #4: 12+ locations, up from 3**)
- **Severity**: INFO
- **Complexity**: 2
- **Files** (Pass #4 expanded list):
  - `packages/service-core/src/services/accommodation/accommodation.service.ts:245,263`
  - `apps/api/src/middlewares/validation.ts:3`
  - `packages/service-core/src/services/userBookmark/userBookmark.normalizers.ts:13,14,30,45,55` (4 JSDoc blocks)
  - `packages/db/src/schemas/tag/r_entity_tag.dbschema.ts:35,38,42,47` (4 lines)
  - `apps/admin/src/components/entity-form/utils/section-filter.utils.ts:120,122`
  - `apps/api/src/utils/limit-check.ts:184` (hardcoded Spanish string, should use i18n)
- **Problem**: Violates English-only code/comments policy.
- **Proposed Solution**: Translate to English. Move user-facing strings to i18n.
- **Recommendation**: **Fix directly** (trivial per file)

---

### GAP-037-20: Metrics middleware uses .includes() instead of .startsWith() (INFO)

- **Audit**: Pass #1 (confirmed Pass #2, #3, #4)
- **Severity**: INFO
- **Complexity**: 1
- **File**: `apps/api/src/middlewares/metrics.ts:325,386-397`
- **Problem**: `path.includes('user')`, `path.includes('admin')`, etc. produce false positives. Example: `/accommodation-admin` matches `path.includes('admin')`.
- **Proposed Solution**: Change to `startsWith()` patterns.
- **Recommendation**: **Fix directly** (consistency)

---

### GAP-037-21: SUPER_ADMIN bypass remains in actor middleware (MEDIUM)

- **Audit**: Pass #2 (confirmed Pass #3, #4)
- **Severity**: MEDIUM
- **Complexity**: 3
- **File**: `apps/api/src/middlewares/actor.ts:136-142`
- **Problem**: SUPER_ADMIN gets `Object.values(PermissionEnum)` without DB lookup. Cannot dynamically restrict permissions.
- **Pass #4 note**: JSDoc at line 57 acknowledges this by design. `authorization.ts` correctly uses only permission checks (no role bypass). The bypass is isolated to actor construction.
- **Proposed Solution**: Document as accepted behavior (performance optimization, by design).
- **Recommendation**: **Document as accepted risk**

---

### GAP-037-22: Exchange-rate GET config requires UPDATE permission (LOW)

- **Audit**: Pass #2 (confirmed Pass #3, #4)
- **Severity**: LOW
- **Complexity**: 1
- **File**: `apps/api/src/routes/exchange-rates/protected/get-config.ts:31`
- **Problem**: GET (read-only) route requires `EXCHANGE_RATE_CONFIG_UPDATE` (write permission).
- **Pass #4 note**: This file is part of the orphaned protected exchange-rate routes (GAP-037-38), making this gap moot if those files are deleted.
- **Proposed Solution**: Delete as part of GAP-037-38, or fix permission if keeping.
- **Recommendation**: **Fix as part of GAP-037-38**

---

### GAP-037-23: Commented-out dead code in feature normalizers (LOW)

- **Audit**: Pass #2 (confirmed Pass #3, #4)
- **Severity**: LOW
- **Complexity**: 1
- **File**: `packages/service-core/src/services/feature/feature.normalizers.ts:256-260`
- **Problem**: Commented-out code showing anti-pattern role check.
- **Proposed Solution**: Delete the commented-out block.
- **Recommendation**: **Fix directly** (1 minute)

---

### GAP-037-24: ~~XSS vector in admin RichTextViewField~~ **RECLASSIFIED: MITIGATED** (Pass #4)

- **Audit**: Pass #3 (**CORRECTED Pass #4**)
- **Severity**: ~~MEDIUM~~ **N/A - MITIGATED**
- **Pass #4 correction**: DOMPurify.sanitize() is called on the output of parseMarkdown() and strips `javascript:` protocol URLs by default. This is a battle-tested sanitizer. The XSS risk is neutralized. Defense-in-depth URL validation is nice-to-have but not a gap.
- **Status**: **CLOSED - Mitigated by DOMPurify**

---

### GAP-037-25: Addon cancel route N+1 ownership check with race condition (MEDIUM)

- **Audit**: Pass #3 (confirmed Pass #4)
- **Severity**: MEDIUM
- **Complexity**: 3
- **File**: `apps/api/src/routes/billing/addons.ts:244-251`
- **Problem**: Fetches ALL user addons to check one, then cancels separately. N+1 query + TOCTOU race condition.
- **Proposed Solution**: Atomic ownership check + cancel in single transaction.
- **Recommendation**: **New SPEC** (billing error handling standardization)

---

### GAP-037-26: Cookie cache TTL allows 5-minute stale sessions (LOW)

- **Audit**: Pass #3 (confirmed Pass #4)
- **Severity**: LOW
- **File**: `apps/api/src/lib/auth.ts:181-183,87`
- **Problem**: 300-second session cache delay for revocation.
- **Recommendation**: **Document as accepted risk** (standard performance tradeoff)

---

### GAP-037-27: CSP headers include `unsafe-inline` and `unsafe-eval` (MEDIUM)

- **Audit**: Pass #3 (confirmed Pass #4)
- **Severity**: MEDIUM
- **Complexity**: 3
- **Files**: `apps/web/vercel.json:37`, `apps/admin/vercel.json:36`
- **Problem**: CSP Report-Only with `unsafe-inline` + `unsafe-eval` = zero XSS protection. Decorative security header.
- **Pass #4 note**: Report-Only mode means these don't block anything. Astro/Vite frameworks may require `unsafe-inline` for hydration.
- **Proposed Solution**: Investigate nonce-based CSP. Remove `unsafe-eval` at minimum.
- **Recommendation**: **New SPEC** (requires framework research)

---

### GAP-037-28: console.error without structured logger in email package (LOW)

- **Audit**: Pass #3 (confirmed Pass #4)
- **Severity**: LOW
- **Complexity**: 1
- **File**: `packages/email/src/send.ts:109,116`
- **Problem**: Two `console.error` calls bypass structured logging.
- **Proposed Solution**: Replace with `@repo/logger`.
- **Recommendation**: **Fix directly**

---

### GAP-037-29: Hardcoded URL fallbacks inconsistent (.com vs .ar) (LOW)

- **Audit**: Pass #3 (confirmed Pass #4, **+1 location found**)
- **Severity**: LOW
- **Complexity**: 1
- **Files**:
  - `apps/api/src/cron/jobs/notification-schedule.job.ts:213,292` - uses `hospeda.com`
  - `apps/api/src/services/trial.service.ts:405` - uses `hospeda.com` (NEW in Pass #4)
  - `apps/api/src/utils/notification-helper.ts:75,99` - uses `hospeda.ar`
- **Problem**: Inconsistent fallback domains. If env var missing, different paths use different domains.
- **Proposed Solution**: Remove fallbacks (env validation catches missing vars) or centralize.
- **Recommendation**: **Fix directly**

---

### GAP-037-30: Renovate missing urgent vulnerability rules (LOW)

- **Audit**: Pass #3 (confirmed Pass #4)
- **Severity**: LOW
- **Complexity**: 2
- **File**: `renovate.json`
- **Problem**: All updates scheduled weekends only. Critical CVEs wait up to 7 days.
- **Proposed Solution**: Add `packageRules` for security patches with `"schedule": ["at any time"]`.
- **Recommendation**: **Fix directly** (config change)

---

### GAP-037-31: `any[]` type violation in destination route (LOW)

- **Audit**: Pass #3 (confirmed Pass #4)
- **Severity**: LOW
- **Complexity**: 1
- **File**: `apps/api/src/routes/destination/public/list.ts:134`
- **Problem**: `let items: any[]` violates "no any types" rule.
- **Proposed Solution**: Use proper type.
- **Recommendation**: **Fix directly**

---

### GAP-037-32: TypeScript `as ServiceErrorCode` casts pervasive (LOW)

- **Audit**: Pass #3 (**Pass #4: 278 occurrences, was "multiple"**)
- **Severity**: LOW
- **Complexity**: 3
- **Files**: 267 files in `apps/api/src/routes/` use `as ServiceErrorCode`
- **Problem**: Cast without runtime validation. Upstream types don't guarantee valid codes.
- **Proposed Solution**: Fix upstream type (service result should include proper `ServiceErrorCode` type).
- **Recommendation**: **New SPEC** (systematic, many files)

---

### GAP-037-33: Exchange-rate API URLs hardcoded in route file (INFO)

- **Audit**: Pass #3 (confirmed Pass #4)
- **Severity**: INFO
- **Complexity**: 1
- **File**: `apps/api/src/routes/exchange-rates/admin/index.ts:126-132`
- **Problem**: External API URLs hardcoded instead of env vars.
- **Proposed Solution**: Move to env vars (may already exist in cron job).
- **Recommendation**: **Fix directly**

---

### GAP-037-34: Auth rate limit tier unreachable + Better Auth unprotected (MEDIUM) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Complexity**: 2
- **Spec Task**: T-009 (rate limiting)
- **File**: `apps/api/src/middlewares/rate-limit.ts:239`
- **Problem**: Two compounding issues:
  1. `getEndpointType` checks `path.startsWith('/api/v1/auth/')` but NO routes exist at `/api/v1/auth/`. Auth routes are at `/api/auth/*`, `/api/v1/public/auth/*`, `/api/v1/protected/auth/*`, `/api/v1/admin/auth/*`. The `auth` tier with its stricter limits is **never applied**.
  2. Better Auth handler at `/api/auth/*` doesn't match any tier prefix and falls to `general` (default) tier. Sign-in, sign-up, password reset get default limits instead of auth-specific brute-force protection.
- **Impact**: Authentication endpoints (the most security-sensitive in the API) get permissive rate limits instead of strict brute-force protection.
- **Proposed Solution**: Update `getEndpointType` to match actual auth route paths (`/api/auth/`, `/api/v1/public/auth/`, `/api/v1/protected/auth/`).
- **Recommendation**: **Fix directly** (compounds GAP-037-01, security-critical)

---

### GAP-037-35: Open redirect via returnUrl parameter in signin.astro (MEDIUM) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Complexity**: 2
- **Spec Task**: Outside scope (frontend security)
- **File**: `apps/web/src/pages/[lang]/auth/signin.astro:40-42`
- **Problem**: `returnUrl` query parameter is read from user input. `new URL(returnPath, siteOrigin)` resolves absolute URLs to the attacker's domain: `new URL('https://evil.com', 'https://hospeda.com')` returns `https://evil.com`. After login, user redirected to attacker site.
- **Impact**: Classic open redirect phishing vector. Post-authentication redirect to malicious site.
- **Proposed Solution**: Validate `returnPath` is relative (starts with `/`, no `://`):
  ```typescript
  const isRelative = returnPath.startsWith('/') && !returnPath.startsWith('//');
  const safeReturn = isRelative ? returnPath : defaultPath;
  ```
- **Recommendation**: **Fix directly** (security-critical, 5-minute fix)

---

### GAP-037-36: `_isSystemActor` flag exposed in API response schema (MEDIUM) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Complexity**: 1
- **Spec Task**: T-002 (system actor flag)
- **File**: `packages/schemas/src/api/auth.schema.ts:16-19`
- **Problem**: `ActorSchema` includes `_isSystemActor` as optional boolean, which is part of `AuthMeResponseSchema`. This internal implementation detail is serialized in `/auth/me` responses.
- **Impact**: Information disclosure of internal system architecture. Clients learn about system actor mechanism.
- **Proposed Solution**: Strip `_isSystemActor` from the response schema (keep in internal Actor type only).
- **Recommendation**: **Fix directly** (schema change, no runtime impact)

---

### GAP-037-37: Production falls back to localhost trusted origins (MEDIUM) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Complexity**: 1
- **Spec Task**: Outside scope (auth configuration)
- **File**: `apps/api/src/lib/auth.ts:419-427`
- **Problem**: If `HOSPEDA_SITE_URL` and `HOSPEDA_ADMIN_URL` are both missing in production, code logs an error but still falls back to localhost origins for Better Auth. Should `throw` in production.
- **Impact**: Production could silently operate with localhost trusted origins.
- **Proposed Solution**: Replace `logger.error(...)` with `throw new Error(...)` when `NODE_ENV === 'production'`.
- **Recommendation**: **Fix directly** (one-line change, defense-in-depth)

---

### GAP-037-38: Orphaned exchange-rate protected route files (LOW) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: LOW
- **Complexity**: 1
- **Spec Task**: T-018/T-019 (exchange-rate cleanup)
- **Files**:
  - `apps/api/src/routes/exchange-rates/protected/index.ts`
  - `apps/api/src/routes/exchange-rates/protected/get-config.ts`
  - `apps/api/src/routes/exchange-rates/protected/history.ts`
  - `apps/api/src/routes/exchange-rates/index.ts` (barrel file)
- **Problem**: `routes/index.ts` imports directly from `./exchange-rates/admin/index.js` and `./exchange-rates/public/index.js`. The barrel file `exchange-rates/index.ts` is never imported. The entire protected exchange-rate directory is dead code. This also absorbs GAP-037-15 (JSDoc mismatch) and GAP-037-22 (permission mismatch).
- **Impact**: Dead code. No security impact since routes are unreachable.
- **Proposed Solution**: Delete the orphaned files.
- **Recommendation**: **Fix directly** (delete dead code)

---

### GAP-037-39: Mock auth uses string literal 'USER' instead of RoleEnum (LOW) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: LOW
- **Complexity**: 1
- **Spec Task**: T-004 (string literal role references)
- **File**: `apps/api/src/middlewares/auth.ts:89`
- **Problem**: Mock auth middleware sets `role: 'USER'` as string literal instead of `RoleEnum.USER`. Guarded by `isMockAuthAllowed()` (test-only), but violates project convention.
- **Proposed Solution**: Change to `role: RoleEnum.USER`.
- **Recommendation**: **Fix directly** (1 minute)

---

### GAP-037-40: Promo-codes admin routes lack granular permissions (LOW) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: LOW
- **Complexity**: 2
- **Spec Task**: Outside scope (permissions)
- **File**: `apps/api/src/routes/billing/promo-codes.ts`
- **Problem**: Five admin routes (`list`, `create`, `get`, `update`, `delete`) use `createAdminRoute`/`createAdminListRoute` but none specify `requiredPermissions`. They only require generic admin access. Compare with `/admin/billing/metrics` which correctly specifies `requiredPermissions: [PermissionEnum.BILLING_READ_ALL]`.
- **Proposed Solution**: Add appropriate `requiredPermissions` (e.g., `BILLING_PROMO_CODE_MANAGE`).
- **Recommendation**: **New SPEC** (needs new permission enum values, part of billing hardening)

---

### GAP-037-41: Protected billing metrics routes lack granular permissions (LOW) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: LOW
- **Complexity**: 2
- **Spec Task**: Outside scope (permissions)
- **File**: `apps/api/src/routes/billing/metrics.ts`
- **Problem**: Four routes in protected-tier billing metrics use `createAdminRoute` but without `requiredPermissions`. Their admin-tier counterparts in `admin/metrics.ts` correctly include `requiredPermissions: [PermissionEnum.BILLING_READ_ALL]`.
- **Proposed Solution**: Add `requiredPermissions` matching the admin counterparts.
- **Recommendation**: **Fix directly** (consistency with admin tier)

---

### GAP-037-42: Raw error.message leaked in billing-metrics.service.ts (MEDIUM) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Complexity**: 2
- **Spec Task**: Outside scope (same pattern as GAP-037-03)
- **File**: `apps/api/src/services/billing-metrics.service.ts:300,363,422,474`
- **Problem**: Four catch blocks return `error.message` without `HOSPEDA_API_DEBUG_ERRORS` guard. Same pattern as GAP-037-03.
- **Impact**: DB/internal details could leak in production API responses.
- **Proposed Solution**: Apply `HOSPEDA_API_DEBUG_ERRORS` guard.
- **Recommendation**: **Fix directly** (same pattern, 4 locations)

---

### GAP-037-43: Raw error.message leaked in usage-tracking.service.ts (MEDIUM) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Complexity**: 2
- **Spec Task**: Outside scope (same pattern as GAP-037-03)
- **File**: `apps/api/src/services/usage-tracking.service.ts:257,302,416`
- **Problem**: Three catch blocks return `error.message` without debug guard.
- **Proposed Solution**: Apply `HOSPEDA_API_DEBUG_ERRORS` guard.
- **Recommendation**: **Fix directly** (same pattern, 3 locations)

---

### GAP-037-44: console.warn/error in notifications retry.service.ts (LOW) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: LOW
- **Complexity**: 2
- **Spec Task**: Outside scope (logging policy)
- **File**: `packages/notifications/src/services/retry.service.ts:51,70,113,183,229,251,259,297,316`
- **Problem**: Nine `console.warn`/`console.error` calls bypass `@repo/logger`. Notification IDs and error details won't appear in structured logs.
- **Proposed Solution**: Replace with `@repo/logger`.
- **Recommendation**: **Fix directly** (consistency)

---

### GAP-037-45: Email logged at DEBUG level in trial.service.ts (LOW) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: LOW
- **Complexity**: 1
- **Spec Task**: Outside scope (PII in logs)
- **File**: `apps/api/src/services/trial.service.ts:409`
- **Problem**: Customer email logged unmasked: `{ customerId: customer.id, email: customer.email }` at DEBUG level.
- **Impact**: PII in logs if DEBUG is enabled.
- **Proposed Solution**: Mask email or remove from log payload.
- **Recommendation**: **Fix directly** (trivial)

---

### GAP-037-46: configure-open-api.ts unconditionally exposes err.message (LOW) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: LOW
- **Complexity**: 1
- **Spec Task**: Related to GAP-037-16
- **File**: `apps/api/src/utils/configure-open-api.ts:42`
- **Problem**: `message: err.message` is always in response regardless of environment. Only `debug` (stack) is gated by NODE_ENV.
- **Proposed Solution**: Gate `message` with `HOSPEDA_API_DEBUG_ERRORS` too.
- **Recommendation**: **Fix with GAP-037-16** (same SPEC)

---

### GAP-037-47: 22+ `as any`/`: any` type violations in production code (MEDIUM) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Complexity**: 3
- **Files**: 22+ instances across `apps/api/src/`:
  - `middlewares/cors.ts:36` - `customConfig?: any`
  - `middlewares/response-validator.ts:168` - `data: any, status?: any`
  - `middlewares/compression.ts:19,21` - `_c: any, next: any`
  - `utils/openapi-schema.ts:18,20,40` - `(schema as any)._def`
  - `middlewares/response.ts:170` - `data: any, status?: any`
  - `utils/env.ts:357` - `ApiEnvSchema as any`
  - `utils/route-factory.ts:95,330,349,357,364,469` - multiple `as any` for Hono internals
  - `routes/docs/scalar.ts:48`, `routes/docs/swagger.ts:37`
- **Problem**: Violates "no any types" policy. Some are framework escape hatches (Hono type gaps), but many could have proper types.
- **Proposed Solution**: Fix where possible, add `biome-ignore` with explanation for genuine framework gaps.
- **Recommendation**: **New SPEC** (systematic, needs Hono type investigation)

---

### GAP-037-48: 21 TODO/FIXME indicating incomplete implementations (INFO) [NEW - Pass #4]

- **Audit**: Pass #4
- **Severity**: INFO
- **Complexity**: varies
- **Files**: 21 TODO comments across `packages/service-core/src/`:
  - `post.service.ts:703` - "TODO: Implement comment removal logic"
  - `destination.service.ts:351` - "TODO: implement events count"
  - `event.permissions.ts:6` - "TODO: Implement permission checks"
  - `amenity.service.ts:129` - "TODO: Implement permission hooks"
  - `tag.service.ts:344` - "TODO: Implement permission hooks"
  - Plus 16 more
- **Problem**: Incomplete implementations that could have security implications (e.g., missing permission checks in `event.permissions.ts`).
- **Proposed Solution**: Audit each TODO for security impact. Fix permission-related ones immediately.
- **Recommendation**: **Triage individually** (some are security-relevant, most are feature gaps)

---

### GAP-037-49: Full email PII logged at INFO level in billing-customer-sync (MEDIUM) [NEW - Pass #5]

- **Audit**: Pass #5 (confirmed **Pass #6**: email at line 103 is operationally needed for QZPay customer creation, but should still be masked in log payload)
- **Severity**: MEDIUM
- **Complexity**: 1
- **Spec Task**: T-007 (PII removal from logs)
- **File**: `apps/api/src/services/billing-customer-sync.ts`
- **Problem**: Three locations log full email addresses:
  - Line 103: `apiLogger.info({ userId, email }, 'Creating new billing customer')` - full email at INFO level
  - Line 152: `{ userId, email, error: errorMessage }` - full email at ERROR level
  - Line 247: `{ userId, email, error: errorMessage }` - full email at ERROR level (same pattern in updateOrCreateCustomer)
- **Pass #6 note**: Email is functionally needed for QZPay API call, but the log payload should use `emailDomain` or masked format. The email can remain in the function args, just not in the logger output.
- **Impact**: Full email PII in structured logs. If logs are shipped to external aggregation (Sentry, Datadog, etc.), email addresses are stored in plain text in third-party systems.
- **Proposed Solution**: Replace `email` with `emailDomain` (e.g., `email.split('@')[1]`) or masked format (`a***@domain.com`) consistent with T-007 contact form pattern.
- **Recommendation**: **Fix directly in SPEC-037 scope** (trivial, same pattern as T-007 contact form fix)

---

## Prioritized Action Plan

### Immediate Fixes (SPEC-037 scope, should be done now)

| # | Gap | Severity | Est. Effort | Action |
|---|-----|----------|-------------|--------|
| 1 | GAP-037-01 | CRITICAL | 2-3 hours | Implement customRateLimit enforcement in rateLimitMiddleware |
| 2 | GAP-037-34 | MEDIUM | 30 min | Fix getEndpointType to match actual auth route paths |
| 3 | GAP-037-02 | HIGH | 15 min | Fix field name `API_CSRF_ORIGINS` -> `API_SECURITY_CSRF_ORIGINS` + fix test |
| 4 | ~~GAP-037-35~~ | ~~MEDIUM~~ | ~~10 min~~ | ~~Validate returnUrl~~ **CLOSED Pass #7** (URL constructor validates) |
| 5 | GAP-037-37 | MEDIUM | 5 min | Throw in production when trusted origins empty |
| 6 | GAP-037-03 | MEDIUM | 10 min | Add debug guard to getApproachingLimits() |
| 7 | GAP-037-42 | MEDIUM | 15 min | Add debug guard to billing-metrics.service (4 locations) |
| 8 | GAP-037-43 | MEDIUM | 10 min | Add debug guard to usage-tracking.service (3 locations) |
| 9 | GAP-037-04 | MEDIUM | 15 min | Remove password chars, mask email in superAdminLoader |
| 9b | GAP-037-49 | MEDIUM | 10 min | Mask email in billing-customer-sync.ts (3 locations) |
| 10 | GAP-037-36 | MEDIUM | 10 min | Strip _isSystemActor from API response schema |
| 11 | GAP-037-08 | LOW | 30 min | Extract shared IP extraction utility |
| 12 | GAP-037-10 | LOW | 5 min | Add @warning JSDoc to Math.random() utilities |
| 13 | GAP-037-11 | LOW | 1-2 hours | Replace 58 role-check anti-patterns in documentation |
| 14 | GAP-037-13 | LOW | 5 min | Add delete() on success path in webhook handler |
| 15 | GAP-037-23 | LOW | 2 min | Delete commented-out code in feature.normalizers.ts |
| 16 | GAP-037-28 | LOW | 10 min | Replace console.error with @repo/logger in email |
| 17 | GAP-037-29 | LOW | 10 min | Remove/centralize hardcoded URL fallbacks (3 files) |
| 18 | GAP-037-30 | LOW | 10 min | Add Renovate urgent security rules |
| 19 | GAP-037-31 | LOW | 5 min | Replace any[] with proper type |
| 20 | GAP-037-38 | LOW | 5 min | Delete orphaned exchange-rate protected files |
| 21 | GAP-037-39 | LOW | 1 min | Change 'USER' to RoleEnum.USER in mock auth |
| 22 | GAP-037-41 | LOW | 10 min | Add requiredPermissions to protected billing metrics |
| 23 | GAP-037-44 | LOW | 15 min | Replace console.* with @repo/logger in notifications |
| 24 | GAP-037-45 | LOW | 5 min | Mask email in trial.service.ts log |
| 25 | GAP-037-33 | INFO | 10 min | Consolidate exchange-rate API URLs to env vars |
| 26 | GAP-037-18 | INFO | 30 min | Consolidate dual ACCEPTED_RISKS.md files |
| 27 | GAP-037-19 | INFO | 20 min | Translate 12+ Spanish comment locations to English |
| 28 | GAP-037-20 | INFO | 5 min | Change .includes() to .startsWith() in metrics |
| 29 | GAP-037-52 | INFO | 5 min | Fix billing metrics JSDoc tier references (5 locations) |
| 30 | GAP-037-53 | LOW | 15 min | Fix auth docs role-check examples (4 locations) - merge with GAP-037-11 sweep |
| 31 | GAP-037-54 | LOW | 1 min | Add `.min(32)` to HOSPEDA_CRON_SECRET in env schema [NEW Pass #7] |
| 32 | GAP-037-55 | LOW | 2 min | Add `@warning Non-cryptographic` JSDoc to array utils (merge GAP-037-10) [NEW Pass #7] |

**Estimated total effort**: ~9-11 hours

### Document as Accepted Risk

| # | Gap | Severity | Rationale |
|---|-----|----------|-----------|
| 1 | GAP-037-05 | MEDIUM | Raw MP ID in DB needed for support/debugging/reconciliation |
| 2 | GAP-037-21 | MEDIUM | Performance optimization, SUPER_ADMIN always has all permissions by design |
| 3 | GAP-037-09 | LOW | Negligible practical risk (nanosecond timing difference) |
| 4 | GAP-037-12 | LOW | Product decision: social feature ("X users favorited") vs privacy |
| 5 | GAP-037-26 | LOW | Session cache is standard performance tradeoff (5 min TTL) |
| 6 | GAP-037-50 | MEDIUM | CSRF functional via trustedOrigins + origin middleware. Explicit config is nice-to-have |

### Defer to New SPEC

| # | Gap | Severity | Reason | Suggested SPEC |
|---|-----|----------|--------|----------------|
| 1 | GAP-037-06 | MEDIUM | 27 `throw new Error()` across 5 billing/route files | SPEC-039: Billing Error Handling |
| 2 | GAP-037-25 | MEDIUM | Addon cancel N+1 + race condition | SPEC-039 (same SPEC) |
| 3 | GAP-037-32 | LOW | 278 `as ServiceErrorCode` casts across 267 files | SPEC-039 (same SPEC) |
| 4 | GAP-037-27 | MEDIUM | CSP unsafe-inline/unsafe-eval needs framework research | SPEC-040: CSP Nonce Integration |
| 5 | GAP-037-16 | LOW | 10 instances NODE_ENV gating across response helpers | SPEC-039 or standalone |
| 6 | GAP-037-46 | LOW | configure-open-api.ts unconditional err.message | SPEC-039 (with GAP-037-16) |
| 7 | GAP-037-17 | LOW | Addon purchase transaction, billing integrity | SPEC-039 (same SPEC) |
| 8 | GAP-037-47 | MEDIUM | 22+ `as any` type violations | SPEC-041: TypeScript Strictness |
| 9 | GAP-037-40 | LOW | Promo-codes routes lack granular permissions | SPEC-042: Billing Permissions |
| 10 | GAP-037-48 | INFO | 21 TODOs with potential security impact | Triage individually |
| 11 | GAP-037-51 | LOW | Promo-codes Error() vs HTTPException (7 instances) | SPEC-039 (subset of GAP-037-06) |

### Closed

| # | Gap | Reason |
|---|-----|--------|
| 1 | GAP-037-14 | **False positive** - corrected in Pass #3 (but see GAP-037-38 for orphaned files) |
| 2 | GAP-037-07 | **By design** - Protected billing routes are correct per three-tier architecture (Pass #4) |
| 3 | GAP-037-24 | **Mitigated** - DOMPurify sanitization neutralizes parseMarkdown XSS (Pass #4) |
| 4 | GAP-037-15 | **Absorbed** into GAP-037-38 (orphaned file) |
| 5 | GAP-037-22 | **Absorbed** into GAP-037-38 (orphaned file) |
| 6 | GAP-037-35 | **Mitigated** - `new URL()` constructor validates origin, rejects absolute URLs and javascript: protocol (Pass #7) |

---

## Appendix: Task Verification Matrix

| Task | Pass #1 | Pass #2 | Pass #3 | Pass #4 | Pass #5 | Notes |
|------|---------|---------|---------|---------|---------|-------|
| T-001 | PASS | PASS | PASS | PASS | **PASS** | USER_BOOKMARK_VIEW_ANY and METRICS_RESET properly defined and seeded |
| T-002 | PASS | PASS | PASS | **PARTIAL** | **PASS** | _isSystemActor implemented. Schema exposure (GAP-037-36) is separate concern |
| T-003 | PASS | PASS | PASS | PASS | **PASS** | timingSafeEqual correct, minor length side-channel (GAP-037-09, accepted risk) |
| T-004 | PASS | PASS | PASS | **PARTIAL** | **PASS** | Zero string literals in production code. Mock auth literal (GAP-037-39) is test-only |
| T-005 | PASS | PASS | PASS | PASS | **PASS** | CSPRNG correct. CSRF bug (GAP-037-02) still open (env field name mismatch) |
| T-006 | PASS | PASS | PASS | PASS | **PASS** | Health endpoints properly sanitized, no NODE_ENV |
| T-007 | PARTIAL | PARTIAL | PARTIAL | PARTIAL | **PARTIAL** | SuperAdminLoader (GAP-037-04) + NEW: billing-customer-sync PII (GAP-037-49) |
| T-008 | PARTIAL | PARTIAL | PARTIAL | **WORSE** | **CONFIRMED** | GAP-037-03 still open (getApproachingLimits leaks error.message) |
| T-009 | PARTIAL FAIL | PARTIAL FAIL | PARTIAL FAIL | **WORSE** | **CONFIRMED CRITICAL** | GAP-037-01: 99 routes declare customRateLimit, middleware ignores it entirely |
| T-010 | PASS | PASS | PASS | PASS | **PASS** | Dead sanitization code properly removed |
| T-011 | PASS | PASS | PASS | PASS | **PASS** | System actor guard works correctly |
| T-012 | PASS | **PARTIAL** | **PARTIAL** | **PARTIAL** | **PASS** | SUPER_ADMIN bypasses removed from authorization.ts, billing-guard, permission.ts |
| T-013 | PASS | PASS | PASS | PASS | **PASS** | Promo-codes auth checks use PermissionEnum + HTTPException(403) |
| T-014 | PASS | PASS | PASS | PASS | **PARTIAL** | listBookmarksByUser/count verified. listBookmarksByEntity lacks ownership filter (unused in routes) |
| T-015 | PASS | PASS | PASS | PASS | **PASS** | METRICS_RESET enforced, billing ownership fail-closed |
| T-016 | PASS | PASS | PASS | PASS | **PASS** | Transaction wrapping correct in subscription-logic (db.transaction at line 292) |
| T-017 | PASS | PASS | PASS | PASS | **PASS** | webhookEventIds removed, Redis fallback logs warnings in all 5 catch blocks |
| T-018 | PASS | PASS | PASS | **PARTIAL** | **PASS** | Write files deleted. Protected dir has only read-only get-config + history (by design) |
| T-019 | PASS | PASS | PASS | **PARTIAL** | **PASS** | No duplication between tiers. Admin has permissions, protected is read-only |
| T-020 | PASS | PASS | PASS | PASS | **PASS** | Cron routes properly consolidated and secret-protected |
| T-021 | PASS | PASS | PASS | PASS | **PASS** | Admin billing ops at /admin/billing/ with proper permissions |
| T-022 | N/A | N/A | N/A | N/A | **PASS** | Reports correctly in protected tier with file validation |
| T-023 | PASS | PASS | PASS | PASS | **PASS** | JSON-LD XSS properly escaped with .replace(/</g, '\\u003c') |
| T-024 | PASS | PASS | PASS | PASS | **PASS** | UUID validation on all 3 accommodation route params |
| T-025 | PASS | PASS | **PARTIAL** | **PARTIAL** | **PASS** | CSP-Report-Only present in both vercel.json. Nonce integration (GAP-037-27) is separate SPEC |
| T-026 | PASS | PASS | PASS | PASS | **PASS** | CI audit blocks on high/critical |
| T-027 | PASS | PASS | PASS | PASS | **PASS** | Node 20 + pnpm v4 consistent across all workflows |
| T-028 | PASS | PASS | **PARTIAL** | **WORSE** | **CONFIRMED** | console.error in email (GAP-037-28) + notifications (GAP-037-44) still open |
| T-029 | PASS | PASS | PASS | PASS | **PASS** | Dead code cleaned, error type guard implemented |
| T-030 | FAIL | FAIL | FAIL | **WORSE** | **CONFIRMED** | Documentation examples still have role-check patterns (GAP-037-11) |
| T-031 | PASS | PASS | PASS | PASS | **PASS** | ACCEPTED_RISKS.md updated with SEC-IDs and accepted risks |
| T-032 | PASS | PASS | PASS | PASS | **PASS** | CORS docs clean, cron jobs documented |

---

## Pass #5 Conclusions

### Overall Assessment

De las 32 tareas de SPEC-037 marcadas como "completed":

- **29 tareas (90.6%)**: Implementación correcta verificada al 100%
- **3 tareas con gaps residuales**:
  - **T-009** (Rate Limiting): GAP-037-01 CRITICAL.. `customRateLimit` en 99 rutas es configuración muerta
  - **T-007** (PII Logs): GAP-037-04 + GAP-037-49 NEW.. email sin enmascarar en billing-customer-sync
  - **T-008** (Error Leaks): GAP-037-03.. `getApproachingLimits()` filtra `error.message` sin debug guard

### Convergence Analysis

| Metric | Pass #4 | Pass #5 | Trend |
|--------|---------|---------|-------|
| New gaps found | 15 | 1 | Convergente (estabilización) |
| False positives | 8 | 0 | Sin ruido |
| Tasks fully verified | 22/32 | 29/32 | Mejora (reclasificación más precisa) |
| Critical open gaps | 1 | 1 (same) | Estable |

### Key Insight

La auditoría Pass #5 confirma que SPEC-037 fue ejecutada correctamente en su gran mayoría. Los gaps restantes se dividen en:

1. **GAP-037-01** (CRITICAL): Arquitectural.. requiere refactorizar cómo el rate-limit middleware consume opciones per-route. Es el gap más importante pendiente.
2. **GAP-037-02** (HIGH): One-line fix.. campo `API_CSRF_ORIGINS` vs `API_SECURITY_CSRF_ORIGINS` en env.ts
3. **PII leaks** (MEDIUM, 3 gaps): Patron repetido.. servicios nuevos no aplicaron el patron de masking ya establecido
4. **Documentation** (LOW): Ejemplos con patrones legacy.. no impacta seguridad en runtime

### Recommendation

Los gaps 1 (CRITICAL) y 2 (HIGH) deben resolverse antes de producción. Los gaps MEDIUM (PII) son fixes triviales que siguen patrones ya implementados. El resto puede ir a SPECs dedicadas.

---

## Appendix: Pass #4 False Positives Evaluated and Rejected

| Finding | Agent Severity | Actual Assessment | Reason |
|---------|---------------|-------------------|--------|
| Math.random in toast-store.ts | LOW | Non-issue | Has crypto.randomUUID primary path, toast IDs not security-sensitive |
| Math.random in auth-images.ts | INFO | Non-issue | Random background image selection, purely cosmetic |
| Math.random in seed utils.ts | INFO | Non-issue | Random date generation for test data, not production |
| MD5 in test factory utilities | INFO | Non-issue | Test-only code for deterministic UUID generation |
| console.log in JSDoc @example | INFO | Non-issue | Inside documentation examples, not executable |
| @ts-expect-error in addon-entitlement.service | LOW | Acceptable | Documented QZPay type gap, workaround is correct |
| RichTextViewField XSS (GAP-037-24) | MEDIUM | Mitigated | DOMPurify.sanitize() strips javascript: protocol by default |
| Protected billing routes (GAP-037-07) | MEDIUM | By design | User-facing billing operations correctly in protected tier |

---

## Appendix: Suggested New SPECs Summary

| SPEC ID | Title | Gaps Covered | Priority |
|---------|-------|-------------|----------|
| SPEC-039 | Billing Error Handling & Type Safety | GAP-037-06, 16, 17, 25, 32, 46, 51 | HIGH |
| SPEC-040 | CSP Nonce Integration | GAP-037-27 | MEDIUM |
| SPEC-041 | TypeScript Strictness Remediation | GAP-037-47 | LOW |
| SPEC-042 | Billing Permissions Granularity | GAP-037-40 | LOW |

---

## Pass #6 New Gap Details

### GAP-037-50: Better Auth CSRF relies on implicit defaults (MEDIUM) [NEW - Pass #6]

- **Audit**: Pass #6
- **Severity**: MEDIUM
- **Complexity**: 2
- **Spec Task**: T-005 (env validation, auth config)
- **File**: `apps/api/src/lib/auth.ts:393`
- **Problem**: Better Auth CSRF protection relies entirely on framework defaults. `trustedOrigins: parseTrustedOrigins()` is configured (line 393), and defense-in-depth origin verification exists in `apps/api/src/middlewares/security.ts:86-97`, but no explicit `csrfProtection` object is set in the betterAuth() config. If Better Auth changes its defaults in a future version, CSRF protection could silently degrade.
- **Impact**: Fragile dependency on framework defaults for CSRF. Not a current vulnerability, but a maintenance risk.
- **Proposed Solution**:
  1. Option A: Add explicit `csrfProtection: { enabled: true }` in betterAuth() config
  2. Option B: Document in ACCEPTED_RISKS.md that CSRF relies on Better Auth defaults + custom origin middleware
- **Recommendation**: **Option B (document)** - current protection is functional via trustedOrigins + origin middleware. Explicit config is nice-to-have.

---

### GAP-037-51: Promo-codes route throws Error() instead of HTTPException for service errors (LOW) [NEW - Pass #6]

- **Audit**: Pass #6
- **Severity**: LOW (subset of GAP-037-06)
- **Complexity**: 2
- **Spec Task**: T-013 (promo-codes auth) - auth checks are correct, but service error handling is not
- **File**: `apps/api/src/routes/billing/promo-codes.ts`
- **Lines**: 64, 106, 137, 173, 203, 276, 294
- **Problem**: Seven instances of `throw new Error(result.error?.message)` in route handlers for service-layer errors (not auth). These become HTTP 500 instead of appropriate 400/404/402. The auth checks at lines 234 and 284 correctly use `HTTPException(403)`, but service error paths use generic `Error()`.
- **Note**: This is a specific verification of GAP-037-06 for the promo-codes file. Included here because Pass #6 independently confirmed the exact line numbers and count.
- **Proposed Solution**: Replace with `throw new HTTPException(statusCode, { message })` using appropriate HTTP status codes.
- **Recommendation**: **Defer to SPEC-039** (part of systematic billing error handling)

---

### GAP-037-52: Billing metrics documentation claims wrong route tier (INFO) [NEW - Pass #6]

- **Audit**: Pass #6
- **Severity**: INFO
- **Complexity**: 1
- **Spec Task**: T-021 (billing admin route organization)
- **File**: `apps/api/src/routes/billing/metrics.ts`
- **Lines**: 9, 100, 203, 293, 328
- **Problem**: JSDoc comments claim routes are "mounted under /api/v1/protected/billing/metrics" but routes actually use `createAdminRoute` and are wrapped with `billingAdminGuardMiddleware()` (mounted via billing/index.ts:191). The routes work correctly at the admin tier, only the documentation is misleading.
- **Impact**: Developer confusion. No security or runtime impact.
- **Proposed Solution**: Update JSDoc comments to reference correct admin tier path.
- **Recommendation**: **Fix directly** (5 minutes, documentation-only)

---

### GAP-037-53: Authentication documentation still uses role-check anti-patterns (LOW) [NEW - Pass #6]

- **Audit**: Pass #6
- **Severity**: LOW (reinforces GAP-037-11)
- **Complexity**: 1
- **Spec Task**: T-030 (documentation cleanup)
- **File**: `docs/security/authentication.md`
- **Lines**: 1020, 1099, 1238, 1270
- **Problem**: Four examples in the authentication security documentation use `actor.role` checks instead of `PermissionEnum`:
  - Line 1020: `if (!hasPermission(actor.role, 'accommodation:write'))`
  - Line 1238: `actor.role !== 'admin'`
  - These contradict the CLAUDE.md mandate to ONLY use PermissionEnum
- **Note**: This is a specific file verification confirming GAP-037-11 extends beyond the 14 files already listed. The authentication.md file was not in the Pass #4 expanded file list.
- **Proposed Solution**: Update examples to use PermissionEnum pattern.
- **Recommendation**: **Fix with GAP-037-11** (same documentation sweep)

---

## Pass #6 Conclusions

### Overall Assessment

De las 32 tareas de SPEC-037 marcadas como "completed":

- **29 tareas (90.6%)**: Implementacion correcta verificada al 100% por 6 pases independientes
- **3 tareas con gaps residuales** (sin cambio desde Pass #5):
  - **T-009** (Rate Limiting): GAP-037-01 CRITICAL.. `customRateLimit` en 34+ rutas es configuracion muerta. El middleware `rate-limit.ts` tiene CERO referencias a `routeOptions` o `customRateLimit`
  - **T-007** (PII Logs): GAP-037-04 + GAP-037-49.. email sin enmascarar en billing-customer-sync y password prefix en superAdminLoader
  - **T-008** (Error Leaks): GAP-037-03.. `getApproachingLimits()` filtra `error.message` sin debug guard

### Convergence Analysis

| Metric | Pass #4 | Pass #5 | Pass #6 | Trend |
|--------|---------|---------|---------|-------|
| New gaps found | 15 | 1 | 4 | Convergente (3 son refinamientos de gaps existentes) |
| False positives | 8 | 0 | 0 | Sin ruido |
| Tasks fully verified | 22/32 | 29/32 | 29/32 | Estable |
| Critical open gaps | 1 | 1 | 1 (same) | Estable |
| Independent verification | N/A | N/A | 6 agents, all confirmed | Alta confianza |

### Key Insights from Pass #6

1. **Convergencia confirmada**: Solo 1 de los 4 nuevos hallazgos es genuinamente nuevo (GAP-037-50 CSRF). Los otros 3 son refinamientos/verificaciones de gaps existentes.
2. **GAP-037-01 es el unico bloqueante real**: Verificado independientemente por 6ta vez. El rate limiting per-route simplemente no funciona.
3. **El patron de error masking tiene 3 instancias sin fix**: GAP-037-03, 42, 43. Son triviales (copiar patron de `getSystemUsage()`) pero siguen abiertos.
4. **La documentacion tiene deuda tecnica significativa**: 58+ ejemplos con anti-patron de role-check (GAP-037-11), pero es riesgo de propagacion, no de seguridad runtime.
5. **Nuevos SPECs sugeridos**: SPEC-039 (billing errors) deberia ser HIGH priority por la cantidad de `throw new Error()` en rutas billing que se convierten en HTTP 500.

### Pre-Production Blockers (must fix)

| Priority | Gap | Fix Effort | Impact |
|----------|-----|-----------|--------|
| **P0** | GAP-037-01 (CRITICAL) | 2-3 hours | Rate limiting per-route no funciona |
| **P0** | GAP-037-34 (MEDIUM) | 30 min | Auth endpoints sin rate limit brute-force |
| **P0** | GAP-037-02 (HIGH) | 15 min | CSRF env validation rota por typo |
| **P1** | GAP-037-35 (MEDIUM) | 10 min | Open redirect en signin |
| **P1** | GAP-037-37 (MEDIUM) | 5 min | Production fallback a localhost origins |
| **P1** | GAP-037-03/42/43 (MEDIUM) | 30 min | Error messages sin masking (8 locations) |
| **P1** | GAP-037-04/49 (MEDIUM) | 20 min | PII en logs (password prefix + emails) |
| **P2** | GAP-037-36 (MEDIUM) | 10 min | _isSystemActor en schema API |

**Esfuerzo total P0+P1**: ~4-5 horas
**Esfuerzo total P0+P1+P2**: ~4.5-5.5 horas

---

## Pass #7 (2026-03-08)

Six specialized agents performed seventh exhaustive pass with independent full-code verification:

1. **Security Engineer #1 (Crypto & Auth)**: Full re-audit of timingSafeEqual, CSPRNG, env validation, OAuth cross-validation, system actor, RoleEnum usage. All 5 tasks (T-002/003/004/005/011) VERIFIED. All 6 known gaps re-confirmed open. Found 2 NEW findings.
2. **Security Engineer #2 (Info Leaks & PII)**: Full re-audit of health endpoints, contact PII, webhook masking, file.name, error messages. 7 files verified secure, 7 files with confirmed info leak vulnerabilities. All 6 known gaps re-confirmed. GAP-037-46 re-confirmed at line 33 (was 42).
3. **Security Engineer #3 (Rate Limiting)**: **CRITICAL GAP-037-01 independently re-confirmed for 7th time**. Complete read of rate-limit.ts verified ZERO references to `routeOptions` or `customRateLimit`. Middleware order in create-app.ts confirmed: rate limit at line 102, routes loaded after. Contact form gets 200 req/min instead of declared 5 req/min (40x looser). Auth tier unreachable (GAP-037-34 re-confirmed). Validation middleware sanitization is NOT dead code (T-010 nuance: `sanitizeObjectStrings` is active via `createValidationMiddleware` with `manualZodSchema`, but underutilized).
4. **Security Engineer #4 (Permissions & Routes)**: Full re-audit of permission system. All 5 tasks (T-001/012/013/014/015) VERIFIED. Zero direct role checks in authorization logic. Three-tier architecture correctly implemented. GAP-037-38 RECLASSIFIED as false positive (protected exchange-rate files are read-only configs, not orphaned write operations). GAP-037-48 NOT FOUND in API codebase.
5. **API Architect (Webhooks & Frontend)**: Full re-audit of transactions, JSON-LD XSS, UUID validation, CSP headers, open redirect. All 5 tasks (T-016/017/023/024/025) VERIFIED. GAP-037-35 (open redirect) RECLASSIFIED: `new URL(returnPath, siteOrigin)` constructor validates origin, rejecting absolute URLs and javascript: protocol. Webhook event Map confirmed request-local (not module-level), serverless-safe.
6. **DevOps/Quality Engineer (CI/CD & Quality)**: Full re-audit of CI pipeline, workflows, console.*, documentation. Tasks T-026/027/028/029/030/031/032 all verified. GAP-037-28 (email console.error) and GAP-037-44 (notifications console.*) re-confirmed open. GAP-037-11 re-confirmed with 5 role-check examples in quick-start.md.

**Result**: 2 NEW gaps found, all prior open gaps re-confirmed (with 2 reclassifications), audit fully convergent.

---

### GAP-037-54: HOSPEDA_CRON_SECRET lacks minimum length validation (LOW) [NEW - Pass #7]

- **Audit**: Pass #7
- **Severity**: LOW
- **Complexity**: 1
- **Spec Task**: T-003 (env validation)
- **File**: `apps/api/src/utils/env.ts:259`
- **Problem**: `HOSPEDA_CRON_SECRET: z.string().optional()` has no `.min()` constraint. Unlike `HOSPEDA_BETTER_AUTH_SECRET` which requires min(32), cron secret accepts any length string. A short secret (e.g., 4 chars) is vulnerable to brute-force.
- **Note**: Production superRefine (lines 284-292) checks presence but not length.
- **Impact**: Weak cron secrets could be brute-forced in production.
- **Proposed Solution**: Add `.min(32, 'HOSPEDA_CRON_SECRET must be at least 32 characters')` to match auth secret pattern.
- **Recommendation**: **Fix directly** (1 minute, consistency with auth secret)

---

### GAP-037-55: Math.random() in shared array utilities lacks JSDoc warning (LOW) [NEW - Pass #7]

- **Audit**: Pass #7
- **Severity**: LOW
- **Complexity**: 1
- **Spec Task**: Related to GAP-037-10
- **File**: `packages/utils/src/array.ts:22,33`
- **Problem**: `getRandomItem()` and `shuffleArray()` use `Math.random()` without `@warning` JSDoc indicating non-cryptographic usage. While these are not security-sensitive (array selection for cosmetic/data purposes), the lack of documentation could lead to misuse in security contexts.
- **Note**: This was identified in Pass #1 as GAP-037-10 but with a different framing. Pass #7 re-confirms and merges the recommendation: add `@warning Non-cryptographic, do not use for security-sensitive random selection` JSDoc.
- **Proposed Solution**: Add `@warning` JSDoc to both functions.
- **Recommendation**: **Fix directly** (merge with GAP-037-10 fix, 2 minutes)

---

### Pass #7 Reclassifications

| Gap | Previous Status | New Status | Reason |
|-----|----------------|------------|--------|
| GAP-037-35 | MEDIUM (open redirect) | **CLOSED - Mitigated** | `new URL(returnPath, siteOrigin)` constructor rejects absolute URLs and `javascript:` protocol. Open redirect vector does NOT work as originally described. |
| GAP-037-38 | LOW (orphaned files) | **RECLASSIFIED - Partially False Positive** | Protected exchange-rate files contain read-only operations (get-config, history), not orphaned write operations. The barrel file may still be dead code, but read-only routes are by design. |

---

## Pass #7 Updated Task Verification Matrix

| Task | Pass #5 | Pass #6 | **Pass #7** | Notes |
|------|---------|---------|-------------|-------|
| T-001 | PASS | PASS | **PASS** | Permissions defined and seeded correctly |
| T-002 | PASS | PASS | **PASS** | _isSystemActor implemented. Schema exposure (GAP-037-36) still open |
| T-003 | PASS | PASS | **PASS** | timingSafeEqual correct. NEW: cron secret needs min(32) (GAP-037-54) |
| T-004 | PASS | PASS | **PASS** | Zero string literals in production. Mock auth (GAP-037-39) still open |
| T-005 | PASS | PASS | **PASS** | CSPRNG correct. CSRF field bug (GAP-037-02) still open |
| T-006 | PASS | PASS | **PASS** | Health endpoints fully sanitized |
| T-007 | PARTIAL | PARTIAL | **PARTIAL** | GAP-037-04 + GAP-037-49 still open |
| T-008 | CONFIRMED | CONFIRMED | **CONFIRMED** | GAP-037-03 still open |
| T-009 | **CRITICAL** | **CRITICAL** | **CRITICAL** | GAP-037-01 re-confirmed 7th time. 98 routes with dead customRateLimit |
| T-010 | PASS | PASS | **PASS (nuance)** | sanitizeObjectStrings is active but underutilized, not dead code |
| T-011 | PASS | PASS | **PASS** | System actor guard correctly rejects in HTTP context |
| T-012 | PASS | PASS | **PASS** | Zero role-based bypasses in authorization |
| T-013 | PASS | PASS | **PASS** | PermissionEnum + HTTPException(403) correct |
| T-014 | PARTIAL | PARTIAL | **PASS** | Ownership verification works. listBookmarksByEntity not implemented (non-issue) |
| T-015 | PASS | PASS | **PASS** | METRICS_RESET enforced, billing fail-closed |
| T-016 | PASS | PASS | **PASS** | Transaction wrapping correct, audit in try-catch |
| T-017 | PASS | PASS | **PASS** | Map is request-local (serverless-safe), not module-level |
| T-018 | PASS | PASS | **PASS** | Write files deleted. Remaining read files are by design |
| T-019 | PASS | PASS | **PASS** | No tier duplication |
| T-020 | PASS | PASS | **PASS** | Cron routes properly organized |
| T-021 | PASS | PASS | **PASS** | Admin billing at correct tier |
| T-022 | PASS | PASS | **PASS** | Reports at correct tier |
| T-023 | PASS | PASS | **PASS** | JSON-LD XSS escaped in all 3 locations |
| T-024 | PASS | PASS | **PASS** | UUID validation on all accommodation params |
| T-025 | PASS | PASS | **PASS** | CSP-Report-Only in both vercel.json |
| T-026 | PASS | PASS | **PASS** | CI audit blocks on high/critical |
| T-027 | PASS | PASS | **PASS** | Node 20 + pnpm v4 across all workflows |
| T-028 | CONFIRMED | CONFIRMED | **CONFIRMED** | email (GAP-037-28) + notifications (GAP-037-44) console.* still open |
| T-029 | PASS | PASS | **PASS** | Dead code cleaned, error type guard present |
| T-030 | CONFIRMED | CONFIRMED | **CONFIRMED** | Role-check anti-patterns in docs (GAP-037-11) still open |
| T-031 | PASS | PASS | **PASS** | ACCEPTED_RISKS.md current |
| T-032 | PASS | PASS | **PASS** | CORS + cron docs present |

---

## Pass #7 Conclusions

### Overall Assessment

De las 32 tareas de SPEC-037 marcadas como "completed":

- **29 tareas (90.6%)**: Implementacion correcta verificada al 100% por 7 pases independientes
- **3 tareas con gaps residuales** (sin cambio desde Pass #5):
  - **T-009** (Rate Limiting): GAP-037-01 CRITICAL.. `customRateLimit` en 98 rutas es configuracion muerta. Verificado por 7ma vez
  - **T-007** (PII Logs): GAP-037-04 + GAP-037-49.. PII sin enmascarar en superAdminLoader y billing-customer-sync
  - **T-008** (Error Leaks): GAP-037-03.. `getApproachingLimits()` filtra `error.message` sin debug guard

### Convergence Analysis

| Metric | Pass #5 | Pass #6 | Pass #7 | Trend |
|--------|---------|---------|---------|-------|
| New gaps found | 1 | 4 | 2 | **Convergente** (1 genuinamente nuevo, 1 merge) |
| False positives from prior passes | 0 | 0 | 0 | Sin ruido |
| Reclassifications | 0 | 0 | 2 (1 closed, 1 refined) | Mejora de precision |
| Tasks fully verified | 29/32 | 29/32 | 29/32 | **Estable** |
| Critical open gaps | 1 | 1 | 1 (same) | **Estable** |
| Independent verification passes | 5 | 6 | **7** | Alta confianza |

### Key Insights from Pass #7

1. **Auditoria plenamente convergente**: Solo 1 gap genuinamente nuevo (GAP-037-54, cron secret min length). GAP-037-55 es un merge/refinamiento de GAP-037-10 existente.
2. **2 reclasificaciones positivas**:
   - GAP-037-35 (open redirect) **CERRADO**: URL constructor valida correctamente, el vector de ataque no funciona como se describio
   - GAP-037-38 (orphaned files) **refinado**: Los archivos protected son read-only configs, no write operations huerfanas
3. **GAP-037-01 sigue siendo el unico bloqueante critico**: 7 pases independientes confirman que el rate limiting per-route NO funciona
4. **T-010 (dead code) tiene matiz**: `sanitizeObjectStrings` NO es dead code.. se usa via `createValidationMiddleware` con `manualZodSchema`, pero la mayoria de rutas no usan este path
5. **Postura de seguridad general es fuerte**: Permission system, route architecture, crypto, XSS prevention, CI/CD.. todo verificado correcto. Los gaps restantes son puntuales

### Updated Pre-Production Blockers

| Priority | Gap | Fix Effort | Impact | Pass #7 Status |
|----------|-----|-----------|--------|----------------|
| **P0** | GAP-037-01 (CRITICAL) | 2-3 hours | Rate limiting per-route no funciona | Re-confirmed |
| **P0** | GAP-037-34 (MEDIUM) | 30 min | Auth endpoints sin rate limit brute-force | Re-confirmed |
| **P0** | GAP-037-02 (HIGH) | 15 min | CSRF env validation rota por typo | Re-confirmed |
| **P1** | ~~GAP-037-35 (MEDIUM)~~ | ~~10 min~~ | ~~Open redirect~~ | **CLOSED** |
| **P1** | GAP-037-37 (MEDIUM) | 5 min | Production fallback a localhost origins | Re-confirmed |
| **P1** | GAP-037-03/42/43 (MEDIUM) | 30 min | Error messages sin masking (8 locations) | Re-confirmed |
| **P1** | GAP-037-04/49 (MEDIUM) | 20 min | PII en logs (password prefix + emails) | Re-confirmed |
| **P2** | GAP-037-36 (MEDIUM) | 10 min | _isSystemActor en schema API | Re-confirmed |
| **P2** | GAP-037-54 (LOW) | 1 min | Cron secret sin min length | **NEW** |

**Esfuerzo total P0+P1**: ~3.5-4.5 horas (reducido por cierre de GAP-037-35)
**Esfuerzo total P0+P1+P2**: ~4-5 horas

### Updated Net Gap Count

| Category | Count | Details |
|----------|-------|---------|
| Total gaps found (all passes) | 55 | 53 from Pass #1-6 + 2 from Pass #7 |
| Closed/reclassified | 6 | GAP-037-14, 07, 24, 15, 22, **35** |
| **Net open gaps** | **49** | 1 CRITICAL, 1 HIGH, 15 MEDIUM, 24 LOW, 8 INFO |
| Accepted risk (recommend) | 6 | GAP-037-05, 21, 09, 12, 26, 50 |
| Deferred to new SPEC | 11 | GAP-037-06, 25, 32, 27, 16, 46, 17, 47, 40, 48, 51 |
| **Actionable fixes remaining** | **32** | ~9-11 hours estimated effort |

# SPEC-037 Gaps Implementation Plan

> Created: 2026-03-09
> Total gaps to implement: 42
> Estimated effort: 18-22 hours
> Organized in 5 phases, 16 batches

---

## Decision Summary

| Decision | Count | Gaps |
|----------|-------|------|
| HACER ahora | 42 | See phases below |
| Accepted risk (doc only) | 3 | GAP-037-05, 21, 26 |
| Nueva SPEC | 1 | GAP-037-27 -> SPEC-040 |
| Ya cerrados | 6 | GAP-037-07, 14, 15, 22, 24, 35 |

**Note**: GAP-037-05, 21, 26 are "accepted risk" but still require documentation work (included in Phase 5).

---

## Phase 1: CRITICAL & HIGH Security (P0)

### Batch 1A: Rate Limiting Overhaul
**Gaps**: GAP-037-01 (CRITICAL), GAP-037-34 (MEDIUM), GAP-037-08 (LOW)
**Effort**: 3-4 hours
**Files**:
- `apps/api/src/middlewares/rate-limit.ts` (main changes)
- `apps/api/src/utils/route-factory.ts` (verify routeOptions attachment)
- `apps/api/src/utils/create-app.ts` (verify middleware order)
- `apps/api/src/routes/auth/signout.ts` (IP extraction)
- `apps/api/test/middlewares/rate-limit.test.ts` (new tests)

**Tasks**:
- [ ] 1A.1: Create shared IP extraction utility `getClientIp({ c, trustProxy })` in `apps/api/src/utils/ip-extraction.ts`
  - Respect `API_RATE_LIMIT_TRUST_PROXY` config
  - Check headers in order: `cf-connecting-ip`, `x-forwarded-for` (first), `x-real-ip`
  - Return `'untrusted-proxy'` when trustProxy=false
- [ ] 1A.2: Refactor `rateLimitMiddleware` to support per-route limits
  - After getting tier config, check `c.get('routeOptions')?.customRateLimit`
  - If present, override `maxRequests` and `windowMs` from per-route config
  - Use store key format: `custom:{route}:{ip}` for per-route limits
  - **Architecture decision**: Rate limit middleware runs BEFORE routes (line 102 in create-app.ts). Per-route options are attached AFTER. Two options:
    - **Option A (recommended)**: Create `perRouteRateLimitMiddleware()` that runs as route-level middleware (attached by `applyRouteMiddlewares` when `customRateLimit` is present)
    - **Option B**: Move rate limit to after route matching (risky, changes middleware chain for all routes)
- [ ] 1A.3: Fix `getEndpointType()` to match actual auth paths (GAP-037-34)
  - Add: `path.startsWith('/api/auth/')` -> 'auth'
  - Add: `path.startsWith('/api/v1/public/auth/')` -> 'auth'
  - Add: `path.startsWith('/api/v1/protected/auth/')` -> 'auth'
  - Keep existing: `path.startsWith('/api/v1/auth/')` -> 'auth' (safety)
- [ ] 1A.4: Refactor signout.ts to use shared IP extraction utility (GAP-037-08)
- [ ] 1A.5: Write tests
  - Test per-route rate limit overrides tier defaults
  - Test auth tier matches actual auth paths
  - Test IP extraction with/without trustProxy
  - Test signout clears correct rate limit bucket

**Verification**:
```bash
pnpm test -- apps/api/test/middlewares/rate-limit
grep -r "customRateLimit" apps/api/src/middlewares/ # Should find references now
grep -r "getClientIp" apps/api/src/ # Should be used in rate-limit + signout
```

---

### Batch 1B: CSRF & Auth Config Hardening
**Gaps**: GAP-037-02 (HIGH), GAP-037-37 (MEDIUM), GAP-037-50 (MEDIUM), GAP-037-54 (LOW)
**Effort**: 30-45 min
**Files**:
- `apps/api/src/utils/env.ts` (lines 260, 335)
- `apps/api/test/utils/env.test.ts`
- `apps/api/src/lib/auth.ts` (lines 393, 419-427)

**Tasks**:
- [ ] 1B.1: Fix CSRF field name typo (GAP-037-02)
  - `env.ts:335`: Change `data.API_CSRF_ORIGINS` -> `data.API_SECURITY_CSRF_ORIGINS`
  - Verify/fix test file if it uses wrong field name
- [ ] 1B.2: Add cron secret min length (GAP-037-54)
  - `env.ts:260`: Change `z.string().optional()` -> `z.string().min(32).optional()`
  - Add descriptive error message
- [ ] 1B.3: Throw in production when trusted origins empty (GAP-037-37)
  - `auth.ts:419-427`: Replace `logger.error(...)` + fallback with `throw new Error(...)` when `NODE_ENV === 'production'`
  - Keep localhost fallback ONLY for development/test
- [ ] 1B.4: Add explicit CSRF config (GAP-037-50)
  - `auth.ts:393`: Add `csrfProtection: { enabled: true }` to betterAuth() config
- [ ] 1B.5: Update/add tests for env validation and auth config

**Verification**:
```bash
pnpm test -- apps/api/test/utils/env
grep "API_CSRF_ORIGINS" apps/api/src/utils/env.ts # Should only find API_SECURITY_CSRF_ORIGINS
grep "localhost" apps/api/src/lib/auth.ts # Should only be in non-production branch
```

---

## Phase 2: MEDIUM Security - Error Masking & PII

### Batch 2A: Error Message Debug Guard
**Gaps**: GAP-037-03 (MEDIUM), GAP-037-42 (MEDIUM), GAP-037-43 (MEDIUM)
**Effort**: 30-45 min
**Files**:
- `apps/api/src/services/billing-usage.service.ts` (line 229)
- `apps/api/src/services/billing-metrics.service.ts` (lines 300, 363, 422, 473-474)
- `apps/api/src/services/usage-tracking.service.ts` (lines 257, 302, 416)

**Pattern to apply** (copy from `getSystemUsage()` in billing-usage.service.ts):
```typescript
const errorMessage =
    process.env.HOSPEDA_API_DEBUG_ERRORS === 'true'
        ? `Failed to ...: ${error instanceof Error ? error.message : 'Unknown error'}`
        : 'Failed to ...';
```

**Tasks**:
- [ ] 2A.1: Fix `getApproachingLimits()` in billing-usage.service.ts (1 location)
- [ ] 2A.2: Fix 4 catch blocks in billing-metrics.service.ts
- [ ] 2A.3: Fix 3 catch blocks in usage-tracking.service.ts
- [ ] 2A.4: Add tests verifying error messages are masked when debug=false

**Verification**:
```bash
grep -n "error.message" apps/api/src/services/billing-usage.service.ts
grep -n "error.message" apps/api/src/services/billing-metrics.service.ts
grep -n "error.message" apps/api/src/services/usage-tracking.service.ts
# All should be behind HOSPEDA_API_DEBUG_ERRORS guard
```

---

### Batch 2B: NODE_ENV -> HOSPEDA_API_DEBUG_ERRORS Migration
**Gaps**: GAP-037-16 (LOW), GAP-037-46 (LOW)
**Effort**: 30 min
**Files**:
- `apps/api/src/utils/response-helpers.ts` (9 locations: lines 170, 211, 223, 256, 269, 282, 293, 310, 323)
- `apps/api/src/utils/configure-open-api.ts` (line 43)

**Tasks**:
- [ ] 2B.1: Replace all `env.NODE_ENV === 'development'` with `process.env.HOSPEDA_API_DEBUG_ERRORS === 'true'` in response-helpers.ts (9 locations)
- [ ] 2B.2: Replace NODE_ENV check in configure-open-api.ts (1 location)
  - Also gate `message: err.message` behind debug flag (currently only `debug: err.stack` is gated)
- [ ] 2B.3: Add/update tests

**Verification**:
```bash
grep -n "NODE_ENV.*development" apps/api/src/utils/response-helpers.ts # Should return 0
grep -n "NODE_ENV.*development" apps/api/src/utils/configure-open-api.ts # Should return 0
grep -n "HOSPEDA_API_DEBUG_ERRORS" apps/api/src/utils/response-helpers.ts # Should return 9
```

---

### Batch 2C: PII Masking in Logs
**Gaps**: GAP-037-04 (MEDIUM), GAP-037-45 (LOW), GAP-037-49 (MEDIUM)
**Effort**: 30 min
**Files**:
- `packages/seed/src/utils/superAdminLoader.ts` (lines 60, 77)
- `apps/api/src/services/trial.service.ts` (line 409)
- `apps/api/src/services/billing-customer-sync.ts` (lines 103, 152, 247)

**Masking utility**: Use or create `maskEmail(email)` -> `a***@domain.com` pattern.
Check if a masking utility already exists in `@repo/utils` or `apps/api/src/utils/`.

**Tasks**:
- [ ] 2C.1: Fix superAdminLoader.ts (GAP-037-04)
  - Line 60: Remove `password.slice(0, 4)`, replace with `'[REDACTED]'` or just indicate password was generated
  - Line 77: Mask email with `maskEmail()` pattern
- [ ] 2C.2: Fix trial.service.ts (GAP-037-45)
  - Line 409: Replace `email: customer.email` with masked version in log payload
- [ ] 2C.3: Fix billing-customer-sync.ts (GAP-037-49)
  - Lines 103, 152, 247: Replace `email` with `emailDomain: email.split('@')[1]` or masked version in log payloads
  - Keep `email` in function args (needed for QZPay API call)
- [ ] 2C.4: Add/verify maskEmail utility exists

**Verification**:
```bash
grep -n "password.slice" packages/seed/src/utils/superAdminLoader.ts # Should return 0
grep -n "email:" apps/api/src/services/billing-customer-sync.ts | grep -v "emailDomain\|maskEmail" # Should return 0 in log contexts
```

---

### Batch 2D: _isSystemActor Schema Cleanup
**Gaps**: GAP-037-36 (MEDIUM)
**Effort**: 15 min
**Files**:
- `packages/schemas/src/api/auth.schema.ts` (lines 16-19)

**Tasks**:
- [ ] 2D.1: Create `ActorResponseSchema` that omits `_isSystemActor` from `ActorSchema`
  - Use `ActorSchema.omit({ _isSystemActor: true })` for API response
  - Keep `ActorSchema` with `_isSystemActor` for internal use
- [ ] 2D.2: Update `AuthMeResponseSchema` to use `ActorResponseSchema`
- [ ] 2D.3: Verify no API routes depend on `_isSystemActor` being in response
- [ ] 2D.4: Update tests if needed

**Verification**:
```bash
grep -rn "_isSystemActor" packages/schemas/src/ # Should only be in internal schema
grep -rn "ActorResponseSchema" packages/schemas/src/ # Should exist and be used in response
```

---

## Phase 3: Billing Route Fixes

### Batch 3A: throw Error -> HTTPException
**Gaps**: GAP-037-06 (MEDIUM, 27 instances), GAP-037-51 (LOW, subset)
**Effort**: 2-3 hours
**Files**:
- `apps/api/src/routes/billing/addons.ts` (13 instances)
- `apps/api/src/routes/billing/promo-codes.ts` (7 instances)
- `apps/api/src/routes/billing/metrics.ts` (3 instances)
- `apps/api/src/routes/billing/admin/metrics.ts` (3 instances)
- `apps/api/src/routes/accommodation/public/getStats.ts` (1 instance)

**Tasks**:
- [ ] 3A.1: Audit each `throw new Error()` and determine correct HTTP status:
  - Service `INTERNAL_ERROR` -> 500 (keep as-is but use HTTPException)
  - Service `NOT_FOUND` -> 404
  - Service `VALIDATION_ERROR` -> 400
  - Service `PERMISSION_DENIED` -> 403
  - Missing context (billing customer) -> 400 or 422
  - Missing data after success -> 500
- [ ] 3A.2: Replace in addons.ts (13 instances)
- [ ] 3A.3: Replace in promo-codes.ts (7 instances)
- [ ] 3A.4: Replace in billing/metrics.ts (3 instances)
- [ ] 3A.5: Replace in admin/metrics.ts (3 instances)
- [ ] 3A.6: Replace in getStats.ts (1 instance)
- [ ] 3A.7: Add tests for error status codes

**Pattern**:
```typescript
// BEFORE:
throw new Error(result.error?.message ?? 'Unknown error');
// AFTER:
throw new HTTPException(mapServiceErrorToStatus(result.error?.code), {
    message: result.error?.message ?? 'Unknown error'
});
```

**Verification**:
```bash
grep -rn "throw new Error" apps/api/src/routes/billing/ # Should return 0
grep -rn "throw new Error" apps/api/src/routes/accommodation/public/getStats.ts # Should return 0
grep -rn "HTTPException" apps/api/src/routes/billing/ # Should find replacements
```

---

### Batch 3B: Addon Cancel Atomicity
**Gaps**: GAP-037-25 (MEDIUM)
**Effort**: 30-45 min
**Files**:
- `apps/api/src/routes/billing/addons.ts` (lines 244-251)

**Tasks**:
- [ ] 3B.1: Replace N+1 ownership check with atomic query
  - Instead of fetching ALL user addons and filtering, query single addon with ownership WHERE clause
  - Or wrap ownership check + cancel in single transaction
- [ ] 3B.2: Add test for concurrent cancel race condition

**Verification**:
```bash
grep -n "getUserAddons" apps/api/src/routes/billing/addons.ts # Should not be used for single addon cancel
```

---

### Batch 3C: Addon Purchase Transaction
**Gaps**: GAP-037-17 (LOW)
**Effort**: 15-20 min
**Files**:
- `apps/api/src/services/addon.checkout.ts` (lines 424-453)

**Tasks**:
- [ ] 3C.1: Wrap `confirmAddonPurchase()` operations in `db.transaction()`
  - Insert purchase record
  - Apply entitlements
  - Both succeed or both rollback
- [ ] 3C.2: Add test for transaction rollback scenario

**Verification**:
```bash
grep -n "db.transaction" apps/api/src/services/addon.checkout.ts # Should find transaction wrapper
```

---

### Batch 3D: Billing Permissions Granularity
**Gaps**: GAP-037-40 (LOW), GAP-037-41 (LOW)
**Effort**: 1-2 hours
**Files**:
- `packages/schemas/src/enums/permission.enum.ts` (add new permissions)
- `packages/seed/src/required/permissions.seed.ts` (seed new permissions)
- `apps/api/src/routes/billing/promo-codes.ts` (add requiredPermissions)
- `apps/api/src/routes/billing/metrics.ts` (add requiredPermissions)
- DB migration for new permissions

**Tasks**:
- [ ] 3D.1: Add new permission enum values:
  - `BILLING_PROMO_CODE_READ = 'billing.promoCode.read'`
  - `BILLING_PROMO_CODE_MANAGE = 'billing.promoCode.manage'`
  - `BILLING_METRICS_READ = 'billing.metrics.read'` (or reuse BILLING_READ_ALL)
- [ ] 3D.2: Seed new permissions with appropriate role assignments
- [ ] 3D.3: Add `requiredPermissions` to promo-codes routes (5 routes)
  - List/Get: `BILLING_PROMO_CODE_READ`
  - Create/Update/Delete: `BILLING_PROMO_CODE_MANAGE`
- [ ] 3D.4: Add `requiredPermissions` to billing/metrics.ts (4 routes)
  - Match admin/metrics.ts pattern: `BILLING_READ_ALL` or `BILLING_METRICS_READ`
- [ ] 3D.5: Generate migration and update seed
- [ ] 3D.6: Add tests

**Verification**:
```bash
grep -n "requiredPermissions" apps/api/src/routes/billing/promo-codes.ts # Should find in all routes
grep -n "requiredPermissions" apps/api/src/routes/billing/metrics.ts # Should find in all routes
```

---

## Phase 4: Code Quality Fixes

### Batch 4A: Quick One-Liner Fixes
**Gaps**: GAP-037-10/55 (LOW), GAP-037-23 (LOW), GAP-037-39 (LOW), GAP-037-13 (LOW), GAP-037-20 (INFO), GAP-037-31 (LOW), GAP-037-09 (LOW)
**Effort**: 45 min total
**Files**: Multiple (1-3 lines each)

**Tasks**:
- [ ] 4A.1: Add `@warning Non-cryptographic` JSDoc to `getRandomItem()` and `shuffleArray()` in `packages/utils/src/array.ts` (GAP-037-10/55)
- [ ] 4A.2: Delete commented-out code block in `packages/service-core/src/services/feature/feature.normalizers.ts:248-263` (GAP-037-23)
- [ ] 4A.3: Change `role: 'USER'` to `role: RoleEnum.USER` in `apps/api/src/middlewares/auth.ts:89` (GAP-037-39)
- [ ] 4A.4: Add `delete()` on success path in `apps/api/src/routes/webhooks/mercadopago/event-handler.ts` Map cleanup (GAP-037-13)
- [ ] 4A.5: Change `.includes()` to `.startsWith()` patterns in `apps/api/src/middlewares/metrics.ts:325,386-397` (GAP-037-20)
- [ ] 4A.6: Replace `any[]` with proper type in `apps/api/src/routes/destination/public/list.ts:134` (GAP-037-31)
- [ ] 4A.7: Fix timing side-channel in `apps/api/src/cron/middleware.ts:21` - hash both inputs with SHA-256 before comparing (GAP-037-09)

**Verification**:
```bash
pnpm typecheck
pnpm lint
```

---

### Batch 4B: console.* -> @repo/logger
**Gaps**: GAP-037-28 (LOW), GAP-037-44 (LOW)
**Effort**: 30 min
**Files**:
- `packages/email/src/send.ts` (2 console.error, lines 109, 116)
- `packages/notifications/src/services/retry.service.ts` (14 console.* calls)

**Tasks**:
- [ ] 4B.1: Replace 2 `console.error` in email/send.ts with `@repo/logger`
- [ ] 4B.2: Replace 14 `console.*` calls in retry.service.ts with `@repo/logger`
  - `console.warn` -> `logger.warn`
  - `console.error` -> `logger.error`
  - `console.info` -> `logger.info`
- [ ] 4B.3: Add `@repo/logger` as dependency if not already present in these packages

**Verification**:
```bash
grep -rn "console\." packages/email/src/send.ts # Should return 0
grep -rn "console\." packages/notifications/src/services/retry.service.ts # Should return 0
```

---

### Batch 4C: Dead Code & Hardcoded Values Cleanup
**Gaps**: GAP-037-38 (LOW), GAP-037-33 (INFO), GAP-037-29 (LOW)
**Effort**: 30 min
**Files**:
- `apps/api/src/routes/exchange-rates/protected/` (delete directory)
- `apps/api/src/routes/exchange-rates/index.ts` (delete barrel file)
- `apps/api/src/routes/exchange-rates/admin/index.ts` (lines 126-132)
- `apps/api/src/cron/jobs/notification-schedule.job.ts` (lines 213, 292)
- `apps/api/src/services/trial.service.ts` (line 405)
- `apps/api/src/utils/notification-helper.ts` (lines 75, 99)

**Tasks**:
- [ ] 4C.1: Delete orphaned exchange-rate protected files (GAP-037-38)
  - Delete `apps/api/src/routes/exchange-rates/protected/` directory
  - Delete `apps/api/src/routes/exchange-rates/index.ts` (barrel file)
  - Verify `routes/index.ts` still imports correctly from admin/ and public/
- [ ] 4C.2: Move hardcoded exchange-rate API URLs to env vars (GAP-037-33)
  - Add `HOSPEDA_DOLAR_API_BASE_URL` and `HOSPEDA_EXCHANGE_RATE_API_BASE_URL` to env schema
  - Replace hardcoded URLs with env vars (with development defaults)
- [ ] 4C.3: Remove hardcoded URL fallbacks (GAP-037-29)
  - Remove `?? 'hospeda.com'` fallbacks in notification-schedule.job.ts and trial.service.ts
  - Remove `?? 'hospeda.ar'` fallbacks in notification-helper.ts
  - Env validation already catches missing vars at startup

**Verification**:
```bash
ls apps/api/src/routes/exchange-rates/protected/ # Should not exist
grep -rn "hospeda.com\|hospeda.ar" apps/api/src/ --include="*.ts" | grep -v ".test." | grep -v "node_modules" # Should find 0 fallback URLs
```

---

### Batch 4D: TypeScript Strictness
**Gaps**: GAP-037-32 (LOW, 278 instances), GAP-037-47 (MEDIUM, 22+ instances)
**Effort**: 4-6 hours
**Files**: ~270 route files + 15 middleware/util files

**Tasks**:
- [ ] 4D.1: Fix upstream ServiceResult type to include proper `ServiceErrorCode` (GAP-037-32)
  - Update `Result<T>` type in service-core to include typed `error.code: ServiceErrorCode`
  - This should eliminate the need for `as ServiceErrorCode` in most cases
  - Run typecheck to find remaining casts
- [ ] 4D.2: Fix `as any` violations where proper types exist (GAP-037-47)
  - `cors.ts:36` - type the customConfig parameter
  - `response-validator.ts:168`, `response.ts:170` - type data/status params
  - `compression.ts:19,21` - type Hono middleware params
  - `env.ts:357` - investigate why cast is needed
  - Framework escape hatches (route-factory.ts, openapi-schema.ts, docs/) - add `biome-ignore` with explanation
- [ ] 4D.3: Run typecheck after changes

**Verification**:
```bash
pnpm typecheck
grep -rn "as ServiceErrorCode" apps/api/src/routes/ --include="*.ts" | wc -l # Should be significantly reduced
grep -rn "as any\|: any" apps/api/src/ --include="*.ts" | grep -v "biome-ignore" | wc -l # Should be reduced
```

---

### Batch 4E: Bookmark Ownership
**Gaps**: GAP-037-12 (LOW)
**Effort**: 20 min
**Files**:
- `packages/service-core/src/services/userBookmark/userBookmark.service.ts` (lines 194-216)
- Permission enum (add `USER_BOOKMARK_VIEW_ANY` if not already present)

**Tasks**:
- [ ] 4E.1: Verify `USER_BOOKMARK_VIEW_ANY` permission exists in enum (was added by SPEC-037)
- [ ] 4E.2: Add ownership check to `listBookmarksByEntity()`:
  - Require `USER_BOOKMARK_VIEW_ANY` permission to list all bookmarks for an entity
  - Or filter to only show own bookmarks unless actor has `USER_BOOKMARK_VIEW_ANY`
- [ ] 4E.3: Add test for ownership filtering

**Verification**:
```bash
grep -n "USER_BOOKMARK_VIEW_ANY" packages/service-core/src/services/userBookmark/userBookmark.service.ts # Should find usage
```

---

## Phase 5: Documentation & Config

### Batch 5A: Role-Check Anti-Pattern Docs Sweep
**Gaps**: GAP-037-11 (LOW), GAP-037-53 (LOW)
**Effort**: 1.5-2 hours
**Files** (15+ .md files with 60+ instances):
- `packages/service-core/docs/guides/permissions.md` (16 instances)
- `packages/service-core/docs/quick-start.md` (8 instances)
- `docs/security/billing-audit-2026-02.md` (6 instances)
- `packages/service-core/docs/guides/creating-services.md` (6 instances)
- `packages/service-core/docs/guides/lifecycle-hooks.md` (4 instances)
- `packages/service-core/docs/api/BaseCrudService.md` (3 instances)
- `packages/service-core/docs/api/errors.md` (2 instances)
- `packages/service-core/docs/README.md` (2 instances)
- `docs/security/authentication.md` (lines 1020, 1099, 1238, 1270)
- `docs/security/api-protection.md` (2 instances)
- `docs/security/input-sanitization.md` (1 instance)
- `docs/security/owasp-top-10.md` (4 instances)
- Plus others

**Tasks**:
- [ ] 5A.1: Create a find-replace mapping:
  - `actor.role === RoleEnum.ADMIN` -> `hasPermission(actor, PermissionEnum.XXX)`
  - `actor.role !== RoleEnum.ADMIN` -> `!hasPermission(actor, PermissionEnum.XXX)`
  - `user.role === 'admin'` -> permission check pattern
  - `role === UserRole.ADMIN` -> permission check pattern
- [ ] 5A.2: Apply to service-core docs (40+ instances)
- [ ] 5A.3: Apply to security docs (20+ instances)
- [ ] 5A.4: Preserve "Wrong Patterns" examples in CLAUDE.md (labeled as what NOT to do)
- [ ] 5A.5: Verify no broken markdown after changes

**Verification**:
```bash
grep -rn "actor\.role\|user\.role\|role ===\|role !==\|hasRole" docs/ packages/service-core/docs/ --include="*.md" | grep -v "NEVER\|Wrong\|anti-pattern\|avoid\|DO NOT" | wc -l # Should be near 0
```

---

### Batch 5B: Spanish Comments Translation
**Gaps**: GAP-037-19 (INFO)
**Effort**: 20 min
**Files**:
- `packages/service-core/src/services/accommodation/accommodation.service.ts` (lines 245, 263)
- `apps/api/src/middlewares/validation.ts` (line 3)
- `packages/service-core/src/services/userBookmark/userBookmark.normalizers.ts` (lines 13, 30, 44, 54)
- `packages/db/src/schemas/tag/r_entity_tag.dbschema.ts` (lines 34-47)
- `apps/admin/src/components/entity-form/utils/section-filter.utils.ts` (line 120)
- `apps/api/src/utils/limit-check.ts` (line 184) - move to i18n

**Tasks**:
- [ ] 5B.1: Translate all Spanish comments to English (11 locations across 6 files)
- [ ] 5B.2: Move user-facing Spanish string in limit-check.ts to `@repo/i18n`

**Verification**:
```bash
# Manual review - no automated check for Spanish vs English
```

---

### Batch 5C: JSDoc Fixes & Accepted Risks Documentation
**Gaps**: GAP-037-52 (INFO), GAP-037-18 (INFO), GAP-037-05 (MEDIUM-accepted), GAP-037-21 (MEDIUM-accepted), GAP-037-26 (LOW-accepted)
**Effort**: 45 min
**Files**:
- `apps/api/src/routes/billing/metrics.ts` (5 JSDoc locations)
- `docs/security/ACCEPTED_RISKS.md` (consolidate)
- `apps/api/docs/ACCEPTED_RISKS.md` (merge into above then delete)

**Tasks**:
- [ ] 5C.1: Fix metrics.ts JSDoc tier references (GAP-037-52)
  - Lines 9, 100, 203, 293, 334: Change "protected" -> correct tier path
- [ ] 5C.2: Consolidate ACCEPTED_RISKS.md (GAP-037-18)
  - Merge `apps/api/docs/ACCEPTED_RISKS.md` content into `docs/security/ACCEPTED_RISKS.md`
  - Unify numbering scheme (SEC-NNN)
  - Delete `apps/api/docs/ACCEPTED_RISKS.md`
- [ ] 5C.3: Add new accepted risks:
  - **SEC-XXX**: GAP-037-05 - Raw mpPreapprovalId in DB metadata (needed for MP reconciliation)
  - **SEC-XXX**: GAP-037-21 - SUPER_ADMIN gets all permissions at actor construction (by-design perf optimization)
  - **SEC-XXX**: GAP-037-26 - 5-minute session cache TTL (standard perf tradeoff)

**Verification**:
```bash
ls apps/api/docs/ACCEPTED_RISKS.md # Should not exist (merged)
grep -c "SEC-" docs/security/ACCEPTED_RISKS.md # Should include all risks
```

---

### Batch 5D: Renovate Config
**Gaps**: GAP-037-30 (LOW)
**Effort**: 10 min
**Files**:
- `renovate.json`

**Tasks**:
- [ ] 5D.1: Add security patch rule with `"schedule": ["at any time"]`
```json
{
    "matchUpdateTypes": ["patch"],
    "matchCategories": ["security"],
    "schedule": ["at any time"],
    "automerge": false,
    "description": "Security patches should not wait for weekend schedule"
}
```

**Verification**:
```bash
cat renovate.json | grep -A 3 "security" # Should find the new rule
```

---

### Batch 5E: TODO Triage (Security-Relevant)
**Gaps**: GAP-037-48 (INFO)
**Effort**: 1-2 hours
**Files**: 21 TODO comments across `packages/service-core/src/`

**Tasks**:
- [ ] 5E.1: Audit all 21 TODOs and classify:
  - **Security-relevant** (fix now): permission-related TODOs
  - **Feature gaps** (document): functionality TODOs
  - **Dead stubs** (delete): empty implementations that will never be filled
- [ ] 5E.2: Fix security-relevant TODOs (especially `event.permissions.ts:6`)
- [ ] 5E.3: Add `// TODO(SPEC-XXX):` prefix to feature-gap TODOs linking to relevant specs
- [ ] 5E.4: Delete truly dead TODO stubs

**Verification**:
```bash
grep -rn "TODO" packages/service-core/src/ --include="*.ts" | grep -i "permission\|security\|auth" # Should be 0 unfixed
```

---

### Batch 5F: SPEC-040 Placeholder
**Gaps**: GAP-037-27 (deferred)
**Effort**: 10 min

**Tasks**:
- [ ] 5F.1: Create placeholder spec file `.claude/specs/SPEC-040-csp-nonce-integration/spec.md` with:
  - Problem statement (CSP Report-Only with unsafe-inline/unsafe-eval = zero protection)
  - Research needed (Astro nonce support, Vite nonce support)
  - Acceptance criteria
  - Status: `draft`

---

## Execution Order & Dependencies

```
Phase 1 (P0 - blockers)
  Batch 1A: Rate Limiting ──────────────────┐
  Batch 1B: CSRF & Auth Config ─────────────┤
                                             │
Phase 2 (P1 - error masking & PII)          │
  Batch 2A: Error Debug Guard ──────────────┤ (no deps)
  Batch 2B: NODE_ENV Migration ─────────────┤ (no deps)
  Batch 2C: PII Masking ───────────────────┤ (no deps)
  Batch 2D: Schema Cleanup ────────────────┤ (no deps)
                                             │
Phase 3 (Billing)                           │
  Batch 3A: Error -> HTTPException ─────────┤ (no deps)
  Batch 3B: Addon Cancel Atomicity ─────────┤ (no deps)
  Batch 3C: Addon Purchase Transaction ─────┤ (no deps)
  Batch 3D: Billing Permissions ────────────┤ (needs DB migration)
                                             │
Phase 4 (Code Quality)                      │
  Batch 4A: Quick Fixes ───────────────────┤ (no deps)
  Batch 4B: console -> logger ─────────────┤ (no deps)
  Batch 4C: Dead Code & URLs ─────────────┤ (no deps)
  Batch 4D: TypeScript Strictness ──────── ┤ (depends on 3A for route changes)
  Batch 4E: Bookmark Ownership ────────────┤ (no deps)
                                             │
Phase 5 (Docs & Config)                     │
  Batch 5A: Docs Role-Check Sweep ─────────┤ (no deps)
  Batch 5B: Spanish Comments ──────────────┤ (no deps)
  Batch 5C: JSDoc & Accepted Risks ────────┤ (depends on 5A for context)
  Batch 5D: Renovate Config ──────────────┤ (no deps)
  Batch 5E: TODO Triage ──────────────────┤ (no deps)
  Batch 5F: SPEC-040 Placeholder ─────────┘ (no deps)
```

**Notes on parallelism**:
- Batches within the same phase can run in parallel (no cross-batch dependencies within a phase)
- Phase 4D (TypeScript Strictness) should run AFTER Phase 3A (billing route changes) to avoid merge conflicts
- Phase 5C (Accepted Risks) should run AFTER Phase 5A (docs sweep) for context

---

## Quality Gates

After EACH batch:
1. `pnpm typecheck` - must pass
2. `pnpm lint` - must pass
3. `pnpm test` - must pass (when applicable tests exist)
4. Commit with conventional commit format

After ALL phases:
1. Full `pnpm typecheck && pnpm lint && pnpm test`
2. Verify all checklist items marked done
3. Re-run gap audit agent on changed files to confirm fixes
4. Update `specs-gaps-037.md` with resolution status for each gap

---

## Commit Strategy

One commit per batch (16 commits total):
```
fix(api): implement per-route rate limiting and fix auth tier paths [SPEC-037 Batch 1A]
fix(api): fix CSRF field name, add cron secret validation, harden auth config [SPEC-037 Batch 1B]
fix(api): add debug guard to error messages in billing/usage services [SPEC-037 Batch 2A]
fix(api): migrate NODE_ENV checks to HOSPEDA_API_DEBUG_ERRORS [SPEC-037 Batch 2B]
fix(api): mask PII in logs across seed, trial, and billing-sync [SPEC-037 Batch 2C]
fix(schemas): remove _isSystemActor from API response schema [SPEC-037 Batch 2D]
fix(api): replace throw Error with HTTPException in billing routes [SPEC-037 Batch 3A]
fix(api): make addon cancel atomic with ownership check [SPEC-037 Batch 3B]
fix(api): wrap addon purchase confirmation in transaction [SPEC-037 Batch 3C]
feat(api): add granular billing permissions for promo-codes and metrics [SPEC-037 Batch 3D]
fix(api): misc code quality fixes across middlewares and utils [SPEC-037 Batch 4A]
fix(api): replace console.* with @repo/logger in email and notifications [SPEC-037 Batch 4B]
chore(api): remove orphaned files, hardcoded URLs, and fallbacks [SPEC-037 Batch 4C]
fix(api): improve TypeScript strictness, reduce as-casts [SPEC-037 Batch 4D]
fix(service-core): add ownership check to listBookmarksByEntity [SPEC-037 Batch 4E]
docs: fix role-check anti-patterns, Spanish comments, JSDoc, and accepted risks [SPEC-037 Batch 5A-F]
```

# SPEC-044: Addon Purchase Schema Cleanup - Gap Analysis Report

## Metadata

- **Spec**: SPEC-044
- **Created**: 2026-03-16
- **Last Updated**: 2026-03-16
- **Audit Passes**: 6
  - **Pass 1** (2026-03-16): Initial comprehensive audit, 7 specialized agents
  - **Pass 2** (2026-03-16): Deep-dive audit, 7 specialized agents (DB schema, services deep-read, routes/schemas, tests/UI, i18n/billing, cross-reference validation, edge cases)
  - **Pass 3** (2026-03-16): Exhaustive audit, 7 specialized agents (DB schema deep, services deep, routes/schemas, tests coverage, admin/i18n, cross-reference global grep, edge cases/architecture). Focused on finding anything passes 1-2 missed. Validated false positives from pass 2.
  - **Pass 4** (2026-03-16): Full re-audit with 7 fresh specialized agents (DB schema+migration, API services deep, routes+schemas, admin+i18n, tests deep, global grep verification, edge cases+architecture). Found 2 new gaps missed by all prior passes. Dismissed 1 false positive from pass 4 tests agent.
  - **Pass 5** (2026-03-16): Full re-audit with 7 fresh specialized agents (DB schema+migration deep, API services full-read, routes+schemas+middleware, tests line-by-line, admin+i18n, global grep 18-pattern sweep, edge cases+architecture+race conditions). Found **14 new gaps** (after deduplication) missed by all prior passes, including race conditions in UPDATE operations, missing mock columns, JSDoc/log spelling, and architectural concerns.
  - **Pass 6** (2026-03-16): Full cross-cutting audit with 3 specialized agents (spec analyzer, codebase analyzer, billing/cross-cutting analyzer). Exhaustive full-file reads of ALL addon-related code across the entire monorepo. Focus on broader system gaps beyond SPEC-044 scope: checkout flow integrity, MercadoPago integration, notification correctness, schema duplication, service architecture patterns, admin API tier violations. Found **16 new gaps** spanning checkout pricing bugs, missing API endpoints, schema duplication, and service pattern deviations.
- **Spec Status**: draft (20/21 tasks completed)
- **Implementation Status**: ~95% complete (SPEC-044 scope). Broader addon system has significant additional gaps.

---

## Executive Summary

SPEC-044 implementation is **solid and well-executed** for its defined scope. All 20 completed tasks pass verification across 6 exhaustive audit passes with 38 specialized agents total. The rename (`cancelledAt` -> `canceledAt`), status standardization (`'cancelled'` -> `'canceled'`), soft-delete column addition (`deletedAt`), and index updates are correctly implemented across DB schema, migration, API services, API routes, Zod schemas, admin frontend types/components, i18n keys, and test files.

However, **pass 6's cross-cutting analysis revealed significant broader addon system gaps** that were invisible to previous SPEC-044-scoped audits:

- **CRITICAL (FIXED): 100x pricing bug** in MercadoPago checkout (GAP-044-29) .. confirmed and fixed, QZPay verified clean
- **HIGH: Broken Zod response schema** .. orderId requires UUID but gets a slug-timestamp string (GAP-044-30)
- **HIGH: User-facing notification bug** .. slugs shown as addon names in emails (GAP-044-31)
- **HIGH: Missing admin API endpoints** .. Force expire/activate buttons produce 404s (GAP-044-38)
- **MEDIUM: Dual addon schemas** violating SSoT (GAP-044-32), admin using wrong API tier (GAP-044-34), no plan category validation (GAP-044-36)

Previous passes confirmed:

- **Race conditions** in UPDATE operations (GAP-044-15, GAP-044-16)
- **Missing `deletedAt`** in test mocks (GAP-044-13, GAP-044-20, GAP-044-21)
- **British spelling in JSDoc/log messages** (GAP-044-17, GAP-044-18, GAP-044-19) violating AC-9

This report documents **44 gaps** across 6 audit passes (28 from passes 1-5, 16 new from pass 6):

| ID | Severity | Priority | Complexity | Type | Found In | Status |
|----|----------|----------|------------|------|----------|--------|
| GAP-044-01 | Medium | Medium | Low (2) | Declared but not implemented | Pass 1 | Open |
| GAP-044-02 | Low | Medium | Low (1) | Pending task | Pass 1 | Open |
| GAP-044-03 | Low | Low | Low (1) | Undeclared - naming inconsistency | Pass 1 | Deferred |
| GAP-044-04 | Low | Low | Low (1) | Undeclared - documentation drift | Pass 1 | Deferred |
| GAP-044-05 | Info | Low | Low (1) | Undeclared - spec hygiene | Pass 1 | Open |
| GAP-044-06 | Medium | Medium | Low (2) | Undeclared - pagination inconsistency | Pass 2 | Open |
| GAP-044-07 | Low | Low | Medium (3) | Undeclared - service layer bypass | Pass 2 | Deferred |
| GAP-044-08 | Medium | Low | Low (1) | Undeclared - schema type safety | Pass 2 | Open |
| GAP-044-09 | Low | Low | Low (1) | Undeclared - i18n key spelling | Pass 2 | Deferred |
| GAP-044-10 | Medium | Medium | Medium (3) | Undeclared - missing test edge cases | Pass 2 | Partially deferred |
| GAP-044-11 | Low | Low | Low (2) | Undeclared - JSONB type assertions | Pass 2 | Deferred |
| GAP-044-12 | Info | Low | Low (1) | Undeclared - i18n display value inconsistency | Pass 3 | Open |
| GAP-044-13 | Medium | High | Low (1) | Undeclared - missing `deletedAt` in test setup mock | Pass 4 | Open |
| GAP-044-14 | Medium | Medium | Low (1) | Undeclared - British spelling in test mock data | Pass 4 | Open |
| GAP-044-15 | Medium | High | Low (2) | Undeclared - UPDATE race condition in cancelUserAddon | Pass 5 | Open |
| GAP-044-16 | Medium | High | Low (2) | Undeclared - UPDATE race condition in expireAddon | Pass 5 | Open |
| GAP-044-17 | Low | Low | Low (1) | Undeclared - JSDoc British spelling in addon-entitlement.service.ts | Pass 5 | Open |
| GAP-044-18 | Low | Low | Low (1) | Undeclared - log messages British spelling in addon.user-addons.ts | Pass 5 | Open |
| GAP-044-19 | Low | Low | Low (1) | Undeclared - test comments British spelling in addon.service.test.ts | Pass 5 | Open |
| GAP-044-20 | Medium | High | Low (1) | Undeclared - missing `deletedAt` in db-mock.ts shared mock | Pass 5 | Open |
| GAP-044-21 | Low | Medium | Low (1) | Undeclared - addon.checkout.test.ts mock missing deletedAt | Pass 5 | Open |
| GAP-044-22 | Low | Low | Low (1) | Undeclared - CustomerAddonResponseSchema missing deletedAt field | Pass 5 | Open |
| GAP-044-23 | Low | Low | Low (1) | Undeclared - missing totalPages in admin paginated response | Pass 5 | Open |
| GAP-044-24 | Medium | Medium | Medium (3) | Undeclared - entitlement failure blocks expiration permanently | Pass 5 | Open |
| GAP-044-25 | Low | Low | Low (1) | Undeclared - BaseModel.softDelete() does not set updatedAt | Pass 5 | Deferred |
| GAP-044-26 | Low | Low | Low (1) | Undeclared - BaseModel.restore() does not re-grant entitlements | Pass 5 | Deferred |
| GAP-044-27 | Info | Low | Low (1) | Undeclared - stale worktree with pre-SPEC-044 code | Pass 5 | Open |
| GAP-044-28 | Low | Low | Low (1) | Undeclared - migration script idempotency missing deletedAt check | Pass 5 | Deferred |
| GAP-044-29 | **Critical** | **Critical** | Low (2) | Undeclared - MercadoPago unit_price sent in centavos instead of ARS | Pass 6 | **FIXED** |
| GAP-044-30 | High | High | Low (1) | Undeclared - PurchaseAddonResponseSchema.orderId requires UUID but value is not UUID | Pass 6 | Open |
| GAP-044-31 | High | High | Low (2) | Undeclared - Cron sends addon slug as display name in notifications | Pass 6 | Open |
| GAP-044-32 | Medium | Medium | Medium (3) | Undeclared - Dual addon schema definitions violate SSoT | Pass 6 | Open |
| GAP-044-33 | Medium | Low | Medium (4) | Undeclared - Addon services use local ServiceResult instead of BaseCrudService | Pass 6 | Deferred |
| GAP-044-34 | Medium | Medium | Medium (3) | Undeclared - Admin addon/plan hooks use /protected/ tier instead of /admin/ | Pass 6 | Open |
| GAP-044-35 | Medium | Medium | Low (2) | Undeclared - Checkout bypasses createMercadoPagoAdapter using raw SDK | Pass 6 | Open |
| GAP-044-36 | Medium | Medium | Low (2) | Undeclared - No targetCategories validation in checkout against customer plan | Pass 6 | Open |
| GAP-044-37 | Medium | Low | Medium (3) | Undeclared - UsageTrackingService reads JSON metadata instead of table | Pass 6 | Open |
| GAP-044-38 | Medium | High | Medium (3) | Undeclared - Missing admin API endpoints for force expire/activate | Pass 6 | Open |
| GAP-044-39 | Low | Low | Low (1) | Undeclared - No ADDON_PURCHASE email template despite NotificationType defined | Pass 6 | Open |
| GAP-044-40 | Low | Low | Low (1) | Undeclared - annualPriceArs not validated in billing config validator | Pass 6 | Open |
| GAP-044-41 | Low | Low | Low (2) | Undeclared - DB status column has no CHECK constraint | Pass 6 | Deferred |
| GAP-044-42 | Low | Low | Low (2) | Undeclared - Admin plan hooks use extensive unsafe `as` casts | Pass 6 | Deferred |
| GAP-044-43 | Low | Low | Low (1) | Undeclared - ServiceResult type allows invalid states | Pass 6 | Deferred |
| GAP-044-44 | Low | Low | Low (2) | Undeclared - API-local addon schema uses plain English instead of i18n keys | Pass 6 | Deferred |

---

## Gaps

### GAP-044-01: `includeDeleted` Admin Query Parameter Not Implemented

- **Found in**: Audit pass 1, **confirmed open in pass 2 and 3**
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Low (2)
- **Type**: Declared in spec but not implemented

**Description**:
The spec explicitly states (line 164):
> "The admin route queries may optionally show soft-deleted records when an `includeDeleted` query parameter is passed. By default, soft-deleted records should be excluded."

The default filtering IS correctly implemented (always adds `isNull(billingAddonPurchases.deletedAt)` at line 62 of `customer-addons.ts`). However, the `includeDeleted` query parameter was **never added**.

**Evidence** (verified across all 3 passes):

- `apps/api/src/routes/billing/admin/customer-addons.ts:62` - Hard-codes `conditions.push(isNull(billingAddonPurchases.deletedAt))` unconditionally
- `apps/api/src/schemas/customer-addons.schema.ts` - No `includeDeleted` field in the query schema
- Pass 3 global grep: `grep 'includeDeleted' apps/api/src` returns zero matches

**Impact**:
Admin users have NO way to view soft-deleted addon purchases through the UI or API. Audit trail review requires direct DB access.

**Proposed Solutions**:

1. **Add `includeDeleted` to existing route (recommended)**
   - Add `includeDeleted: z.coerce.boolean().optional().default(false)` to `ListCustomerAddonsQuerySchema`
   - Conditionally push `isNull(deletedAt)` only when `includeDeleted !== true`
   - Complexity: ~30 min
   - Pros: Completes the feature as spec'd, minimal change
   - Cons: None significant

2. **Defer to separate SPEC**
   - Document as known limitation
   - Address when admin audit/history features are built

**Recommendation**: Fix directly as part of SPEC-044 since it was explicitly declared in the spec.

---

### GAP-044-02: T-021 Migration Not Applied to Dev Database

- **Found in**: Audit pass 1, **confirmed open in pass 2 and 3**
- **Severity**: Low
- **Priority**: Medium
- **Complexity**: Low (1)
- **Type**: Pending task (declared, not completed)

**Description**:
Task T-021 (the final task) is still `pending`. Migration `0023_addon_purchase_schema_cleanup.sql` exists and is correct, but has not been applied.

**Evidence**:

- `.claude/tasks/SPEC-044-addon-purchase-schema-cleanup/state.json` line 378: `"status": "pending"`
- All 5 subtasks of T-021 show `"completed": false`
- Pass 3 DB schema agent confirmed migration SQL is complete and correct (all 4 steps in proper order)

**Impact**:
DB schema change not active in dev. Integration tests might behave differently. Spec cannot be marked `completed`.

**Proposed Solutions**:

1. **Run migration now** - `pnpm db:migrate`, verify columns with SQL queries from T-021
   - Complexity: ~10 min, requires running PostgreSQL

**Recommendation**: Complete T-021 as the final step.

---

### GAP-044-03: `CancelledIcon` Component Uses British Spelling

- **Found in**: Audit pass 1, **confirmed in pass 3**
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - naming inconsistency
- **Status**: Deferred

**Description**:
`packages/icons/src/icons/booking/CancelledIcon.tsx` uses `CancelledIcon` with semantic name `'cancelled'` (British). Inconsistent with American spelling convention established by SPEC-044.

**Impact**:
Purely naming convention. No functional impact. The icon is cross-cutting (subscriptions still use British).

**Proposed Solutions**:

1. **Leave as-is (recommended)** - Cross-cutting, subscriptions still use British
2. **Rename with re-export alias** - `export { CanceledIcon as CancelledIcon }` for backward compat
3. **Defer to broader naming SPEC** - Rename all at once when subscriptions migrate

**Recommendation**: Leave as-is. Defer to subscription migration effort.

---

### GAP-044-04: Documentation Files Reference Old Spelling

- **Found in**: Audit pass 1, confirmed and expanded in pass 2, **reconfirmed in pass 3**
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - documentation drift
- **Status**: Deferred

**Description**:
Several docs still reference old British spelling. Out of scope per SPEC-044 line 61, but creates confusion.

**Evidence** (confirmed across all 3 passes):

- `docs/runbooks/billing-incidents.md:67` - SQL uses `status IN ('rejected', 'cancelled', 'refunded')` (billing_payments context, not addon-specific)
- `docs/runbooks/billing-incidents.md:373-376` - SQL uses `SET status = 'cancelled', cancelled_at = NOW()` for subscription manual fix (subscription context, not addon)

**Important clarification from pass 2, reconfirmed pass 3**: The runbook SQL examples reference `billing_subscriptions` and `billing_payments` contexts, NOT `billing_addon_purchases`. Since subscriptions are explicitly out of scope for SPEC-044, these examples are technically NOT wrong for their current context.

**Recommendation**: Leave as-is. Optionally add a note about the spelling difference between addon purchases and subscriptions.

---

### GAP-044-05: Spec and Task State Hygiene

- **Found in**: Audit pass 1, **confirmed open in pass 3**
- **Severity**: Info
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - spec hygiene

**Description**:
Minor state management inconsistencies:

1. **Spec status still "draft"**: `metadata.json` shows `"status": "draft"` but 20/21 tasks completed. Should be `"in-progress"`.
2. **TODOs.md is stale**: Shows all tasks as `[ ]` while `state.json` shows 20/21 as `completed`.
3. **Task timestamps all identical**: All 20 completed tasks have same `started`/`completed` timestamps (batch-update).

**Impact**: No functional impact. Spec management hygiene only.

**Recommendation**: Update spec status to `"in-progress"` now, then `"completed"` after T-021.

---

### GAP-044-06: Admin Customer-Addons Pagination Uses `limit` Instead of `pageSize`

- **Found in**: Audit pass 2, **confirmed open in pass 3**
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Low (2)
- **Type**: Undeclared - API convention inconsistency

**Description**:
The admin customer-addons route uses `page` + `limit` for pagination, but the project convention (documented in CLAUDE.md) states:
> "Admin routes use `page`+`pageSize` (NOT `limit`). `createAdminListRoute` rejects unknown params."

This route does NOT use `createAdminListRoute` (it's a custom handler with raw Drizzle queries), so it bypasses the standard pagination convention.

**Evidence** (verified in pass 3):

- `apps/api/src/schemas/customer-addons.schema.ts:25` - `limit: z.coerce.number().int().min(1).max(100).default(20)`
- `apps/api/src/routes/billing/admin/customer-addons.ts:37-44` - Destructures and uses `limit`
- `apps/api/src/routes/billing/admin/customer-addons.ts:100-101` - Drizzle `.limit(limit).offset(offset)`
- CLAUDE.md convention: "Admin routes use `page`+`pageSize` (NOT `limit`)"

**Impact**:

- Inconsistent API contract. Admin frontend may need to handle both `limit` and `pageSize` depending on the endpoint.
- Violates documented project conventions.

**Proposed Solutions**:

1. **Rename `limit` to `pageSize` in schema and route (recommended)**
   - Update `ListCustomerAddonsQuerySchema`: rename `limit` -> `pageSize`
   - Update route handler: use `pageSize` instead of `limit`
   - Update response shape: return `pageSize` instead of `limit`
   - Update admin UI hooks if they send `limit`
   - Complexity: ~45 min (schema + route + UI hook + test updates)
   - Pros: Consistent with project conventions
   - Cons: Breaking change for any existing consumers

2. **Accept as-is, document exception**
   - Add comment explaining why this route differs
   - Pros: No change risk
   - Cons: Convention violation persists

**Recommendation**: Fix directly. This is a convention violation that should be corrected while the route is fresh.

---

### GAP-044-07: Admin Customer-Addons Route Bypasses Service Layer

- **Found in**: Audit pass 2, **confirmed in pass 3**
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Medium (3)
- **Type**: Undeclared - architectural pattern deviation
- **Status**: Deferred

**Description**:
The admin `customer-addons` route handler performs raw Drizzle queries directly in the route instead of going through a service. This deviates from the project pattern where "API routes are thin wrappers" and "business logic lives in services" (per CLAUDE.md).

**Evidence**:

- `apps/api/src/routes/billing/admin/customer-addons.ts:67-101` - Direct `db.select().from(billingAddonPurchases)` with joins, filters, pagination
- No corresponding admin service for customer-addons listing
- Other admin billing routes (e.g., webhooks, invoices) follow similar patterns, so this may be an accepted convention for admin list views

**Pass 3 note**: Services agent confirmed the query logic is correct and includes all necessary soft-delete filters. The issue is purely architectural (placement, not correctness).

**Recommendation**: Defer to a broader admin routes refactor SPEC. This pattern is not SPEC-044-specific.

---

### GAP-044-08: `CustomerAddonResponseSchema.status` Uses `z.string()` Instead of Enum

- **Found in**: Audit pass 2, **confirmed open in pass 3**
- **Severity**: Medium
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - type safety gap

**Description**:
The `CustomerAddonResponseSchema` in the admin schema uses `z.string()` for the `status` field, while `UserAddonResponseSchema` (in the protected API schema) correctly uses `z.enum(['active', 'expired', 'canceled'])`. This means the admin response has weaker type guarantees.

**Evidence** (verified in pass 3):

- `apps/api/src/schemas/customer-addons.schema.ts:65` - `status: z.string()` (loose)
- `apps/api/src/schemas/addon.schema.ts:73` - `status: z.enum(['active', 'expired', 'canceled'])` (strict)
- `apps/api/src/schemas/customer-addons.schema.ts:16` - `ADDON_PURCHASE_STATUSES = ['all', 'active', 'expired', 'canceled', 'pending']` (constant exists but not used in response schema)

**Pass 3 note**: The query schema `ListCustomerAddonsQuerySchema` correctly uses `z.enum(ADDON_PURCHASE_STATUSES)` for input validation (line 27). The inconsistency is only in the RESPONSE schema.

**Proposed Solutions**:

1. **Use enum in response schema (recommended)**
   - Change `status: z.string()` to `status: z.enum(['active', 'expired', 'canceled', 'pending'])`
   - Note: include `'pending'` since admin might see pending purchases
   - Complexity: ~15 min
   - Pros: Type safety parity with protected API
   - Cons: Minimal risk

2. **Leave as `z.string()`**
   - Future-proof for new status values
   - Pros: Flexible
   - Cons: Weaker type safety

**Recommendation**: Fix directly. Use enum. This closes a type safety gap that SPEC-044's status standardization work should have caught.

---

### GAP-044-09: i18n Subscription Keys Still Use British `cancelled` in Key Names

- **Found in**: Audit pass 2, **confirmed in pass 3**
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - i18n naming inconsistency (out of SPEC-044 scope)
- **Status**: Deferred

**Description**:
The subscription-related i18n keys in `admin-billing.json` use British `cancelled` as key names. This is NOT addon-related, so it's explicitly out of SPEC-044 scope.

**Evidence** (confirmed pass 3 with exact line numbers):

- `packages/i18n/src/locales/en/admin-billing.json:476` - `"cancelled": "Cancelled"` under `sponsorships.statuses`
- `packages/i18n/src/locales/en/admin-billing.json:908` - `"cancelled": "Cancelled"` under `subscriptions.statuses`

**Recommendation**: Leave as-is. Explicitly out of SPEC-044 scope. Defer to subscription spelling migration.

---

### GAP-044-10: Missing Test Edge Cases for Soft-Delete Behavior

- **Found in**: Audit pass 2, **pass 3 confirmed existing test coverage is good but edge cases still missing**
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Medium (3)
- **Type**: Undeclared - test coverage gaps

**Description**:
While SPEC-044 added 6 explicit soft-delete tests and 2+ status consistency tests (confirmed by pass 3 tests agent), the audit identified several edge case scenarios that are NOT covered.

**Pass 3 test coverage summary** (confirmed by tests agent):

- `addon-expiration.service.test.ts`: 58 total tests, 3 explicit soft-delete tests
- `addon.service.test.ts`: 50+ total tests, 3 explicit soft-delete tests
- `addon-entitlement.service.test.ts`: 21+ tests, deletedAt in mock schema
- `addon.checkout.test.ts`: 14 tests, no soft-delete needed (insert-only)
- Total: 143+ addon tests, 6 explicit soft-delete tests

**Missing test scenarios** (unchanged from pass 2):

1. **Batch processing boundary (>100 addons)**: `findExpiredAddons()` has `.limit(100)` but no boundary test
2. **Timezone handling in `expiresAt` comparison**: Tests use `new Date()` without timezone verification
3. **Partial entitlement failure**: No rollback/recovery test for partial `applyAddonEntitlements()` failure
4. **Race condition: concurrent cancel + expire**: No concurrency test
5. **`includeDeleted=true` query behavior**: Depends on GAP-044-01
6. **Repurchase after soft-delete**: Unique partial index allows it but no end-to-end test

**Recommendation**: Implement tests #6 (repurchase after soft-delete) and #5 (includeDeleted query, after GAP-044-01) as part of SPEC-044. Defer #1-#4 to SPEC-038 or a dedicated testing SPEC.

---

### GAP-044-11: JSONB Columns Use Type Assertions Instead of Runtime Validation

- **Found in**: Audit pass 2, **confirmed in pass 3**
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (2)
- **Type**: Undeclared - type safety concern (pre-existing, not introduced by SPEC-044)
- **Status**: Deferred

**Description**:
The JSONB columns `limitAdjustments` and `entitlementAdjustments` are read from the database and cast using TypeScript `as Array<...>` assertions instead of being validated at runtime with Zod.

**Evidence** (confirmed pass 3):

- `apps/api/src/services/addon-expiration.service.ts:181-186` - `(purchase.limitAdjustments as Array<{ limitKey: string; increase: number; ... }>)`
- `apps/api/src/services/addon-expiration.service.ts:188-191` - `(purchase.entitlementAdjustments as Array<{ entitlementKey: string; granted: boolean; }>)`
- `apps/api/src/services/addon.user-addons.ts:84` - `firstLimit.limitKey as string`

**Recommendation**: Defer. Pre-existing pattern, not introduced by SPEC-044. Low risk since data is only written by the application.

---

### GAP-044-12: English i18n Display Values Use British "Cancelled" Spelling

- **Found in**: Audit pass 3 (cross-reference agent)
- **Severity**: Info
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - i18n display value cosmetic inconsistency

**Description**:
The English locale i18n addon keys use the correct American spelling for KEY NAMES (`"canceled"`, `"statusCanceled"`) but use British spelling for the DISPLAY VALUES shown to users (`"Cancelled"`).

**Evidence**:

- `packages/i18n/src/locales/en/admin-billing.json:256` - `"statusCanceled": "Cancelled"` (key=American, value=British)
- `packages/i18n/src/locales/en/admin-billing.json:316` - `"canceled": "Cancelled"` under `purchasedStatuses` (key=American, value=British)
- Spanish and Portuguese locales are unaffected (both use "Cancelado")

**Impact**:

- Cosmetic only. No functional impact.
- Both "canceled" and "cancelled" are valid English spellings (American vs British)
- The codebase standardizes on American English for CODE identifiers, but display text is a localization concern
- Arguments could be made either way for the display value

**Proposed Solutions**:

1. **Change display value to "Canceled" (American)**
   - Consistency with codebase American English convention
   - Complexity: ~5 min
   - Pros: Full consistency
   - Cons: "Cancelled" is more commonly seen in British English UI and some style guides

2. **Leave as-is (recommended)**
   - Both spellings are valid English
   - Display text is a localization decision, not a code convention
   - The KEY name (code identifier) correctly uses American spelling
   - No user will notice or care about the difference

**Recommendation**: Leave as-is. This is a cosmetic localization preference, not a code consistency issue. The important thing (key names in code) is correct.

---

### GAP-044-13: Missing `deletedAt` in Global Test Setup Schema Mock

- **Found in**: Audit pass 4
- **Severity**: Medium
- **Priority**: High
- **Complexity**: Low (1)
- **Type**: Undeclared - test infrastructure gap

**Description**:
The global mocked `billingAddonPurchases` schema in `apps/api/test/setup.ts` (lines 143-158) is missing the `deletedAt` column mapping. The real Drizzle schema has `deletedAt: timestamp('deleted_at', { withTimezone: true })` (added by SPEC-044 T-001), but the test mock was never updated to include it.

**Evidence** (verified manually, pass 4):

- `apps/api/test/setup.ts:143-158` - Mock schema lists all columns (`id`, `customerId`, `subscriptionId`, `addonSlug`, `status`, `purchasedAt`, `expiresAt`, `canceledAt`, `paymentId`, `limitAdjustments`, `entitlementAdjustments`, `promoCodeId`, `metadata`, `createdAt`, `updatedAt`) but **does NOT include `deletedAt: 'deleted_at'`**
- `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts:51` - Real schema has `deletedAt: timestamp('deleted_at', { withTimezone: true })`
- `apps/api/test/services/addon-expiration.service.test.ts:23-40` - This test file defines its OWN local mock with `deletedAt: 'deleted_at'`, compensating for the missing global mock
- `apps/api/test/helpers/mock-factories.ts:162,194` - Mock factories DO include `deletedAt: null`, but the schema mock doesn't map it

**Impact**:

- Tests that use the global schema mock (from `setup.ts`) and reference `billingAddonPurchases.deletedAt` may get `undefined` instead of the expected column reference
- Tests that define their own local mocks (like `addon-expiration.service.test.ts`) work correctly, masking this gap
- Any NEW test that relies on the global mock for `isNull(billingAddonPurchases.deletedAt)` would silently fail or behave unexpectedly

**Why passes 1-3 missed this**: Previous audit passes checked that `canceledAt` was renamed (it was, at line 151) and that mock factories included `deletedAt` (they do). But no pass compared the GLOBAL schema mock column list against the REAL Drizzle schema column list to verify completeness.

**Proposed Solutions**:

1. **Add `deletedAt` to setup.ts mock (recommended)**
   - Add `deletedAt: 'deleted_at'` after `updatedAt: 'updated_at'` at line 158
   - Complexity: ~2 min, 1 line change
   - Pros: Fixes infrastructure gap, prevents future test failures
   - Cons: None

**Recommendation**: Fix immediately as part of SPEC-044. This is a 1-line fix that completes the schema mock.

---

### GAP-044-14: British Spelling `'cancelled'` in Test Mock Data

- **Found in**: Audit pass 4
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Low (1)
- **Type**: Undeclared - test data inconsistency, violates AC-9

**Description**:
The test file `apps/api/test/services/addon.service.test.ts` at line 1054 creates a mock addon purchase with `status: 'cancelled'` (British, double-L). After the SPEC-044 migration, no database row can have `status = 'cancelled'` because the migration explicitly converts all such rows to `'canceled'`. The test simulates an impossible post-migration state.

**Evidence** (verified manually, pass 4):

- `apps/api/test/services/addon.service.test.ts:1054` - `status: 'cancelled'` in mock data for the test "should return NOT_FOUND when purchase exists but status is already canceled"
- `apps/api/test/services/addon.service.test.ts:1050` - Comment says "already cancelled" (British)
- Spec AC-9 states: "When a grep is run for `'cancelled'` in addon-purchase-related files, Then zero matches are found"

**Pass 4 false positive dismissed**: Line 1220 was initially flagged by the tests agent as another `'cancelled'` issue. Manual verification confirmed it's a CORRECT negative assertion (`expect(...).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))`) that tests the British spelling is NEVER written. The string `'cancelled'` is intentionally the value being checked against. This is valid test code.

**Impact**:

- Functionally, the test still passes because the service checks `status !== 'active'` (not `status === 'cancelled'`), so both spellings trigger the same NOT_FOUND path
- However, it violates AC-9 (zero British spelling in addon files) and simulates an impossible DB state
- Creates confusion for future developers who might think `'cancelled'` is a valid status value

**Why passes 1-3 missed this**: Previous passes confirmed that ALL `cancelledAt` PROPERTY references were renamed and that status values in UPDATE SET clauses were changed. However, mock data STATUS VALUES in test assertions were not exhaustively checked line-by-line. The test at line 1054 is in a "negative path" test (checking an already-canceled addon) that was easy to overlook.

**Proposed Solutions**:

1. **Change mock status to `'canceled'` (recommended)**
   - Change line 1054: `status: 'cancelled'` -> `status: 'canceled'`
   - Change line 1050 comment: "already cancelled" -> "already canceled"
   - Complexity: ~2 min, 2 lines
   - Pros: Achieves AC-9, simulates realistic DB state
   - Cons: None

**Recommendation**: Fix immediately as part of SPEC-044. 2-line fix that achieves AC-9 compliance.

---

### GAP-044-15: UPDATE Race Condition in `cancelUserAddon` -- Missing Status + deletedAt Guards

- **Found in**: Audit pass 5 (API Services agent + Edge Cases agent)
- **Severity**: Medium
- **Priority**: High
- **Complexity**: Low (2)
- **Type**: Undeclared - race condition / data integrity

**Description**:
The `cancelUserAddon` function at `addon.user-addons.ts` performs a SELECT (line 248) that validates `status='active'` + `isNull(deletedAt)`, then a separate UPDATE (line 295-302) keyed ONLY by `eq(billingAddonPurchases.id, input.purchaseId)` without re-checking status or deletedAt.

**Race scenario**:

1. Cancel request A: SELECT finds status='active', deletedAt=null. Proceeds.
2. Cron expiration (or cancel request B): Sets status='expired' (or 'canceled').
3. Cancel request A: UPDATE blindly overwrites status to 'canceled', overwriting the 'expired' status set by the cron.

The code at line 304 checks `rowCount=0` but only catches the case where the row was deleted.. it does NOT catch status changes.

**Evidence**:

- `apps/api/src/services/addon.user-addons.ts:302` - UPDATE WHERE: `eq(billingAddonPurchases.id, input.purchaseId)` only
- No `eq(billingAddonPurchases.status, 'active')` in UPDATE WHERE
- No `isNull(billingAddonPurchases.deletedAt)` in UPDATE WHERE

**Impact**:
An expired addon could be re-labeled as 'canceled', losing the expiration status. Entitlement removal runs twice.

**Proposed Solutions**:

1. **Add status + deletedAt guards to UPDATE WHERE (recommended)**
   - Add `eq(billingAddonPurchases.status, 'active')` and `isNull(billingAddonPurchases.deletedAt)` to the UPDATE's WHERE clause
   - Then the existing `rowCount=0` check handles all concurrent mutations correctly
   - Complexity: ~15 min
   - Pros: Defense-in-depth, correct handling of all race conditions
   - Cons: Minimal

**Recommendation**: Fix directly in SPEC-044. Low effort, high impact defense-in-depth.

---

### GAP-044-16: UPDATE Race Condition in `expireAddon` -- Missing Status + deletedAt Guards

- **Found in**: Audit pass 5 (API Services agent + Edge Cases agent)
- **Severity**: Medium
- **Priority**: High
- **Complexity**: Low (2)
- **Type**: Undeclared - race condition / data integrity

**Description**:
Same pattern as GAP-044-15 but in the expiration flow. `expireAddon()` at `addon-expiration.service.ts` validates `purchase.status === 'active'` in a SELECT (line 413), then the UPDATE (line 452-458) uses only `eq(billingAddonPurchases.id, input.purchaseId)`.

If a cancel request runs between the SELECT and UPDATE, the expire flow overwrites `status='canceled'` with `status='expired'`, losing the cancellation.

**Evidence**:

- `apps/api/src/services/addon-expiration.service.ts:458` - UPDATE WHERE: `eq(billingAddonPurchases.id, input.purchaseId)` only

**Proposed Solutions**:

1. **Add status + deletedAt guards to UPDATE WHERE (recommended)**
   - Same fix as GAP-044-15: add `eq(status, 'active')` + `isNull(deletedAt)` to UPDATE WHERE
   - Treat rowCount=0 as concurrent-modification signal
   - Complexity: ~15 min

**Recommendation**: Fix directly in SPEC-044. Same fix pattern as GAP-044-15.

---

### GAP-044-17: JSDoc Comments Use British "cancelled" in addon-entitlement.service.ts

- **Found in**: Audit pass 5 (API Services agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - AC-9 violation (British spelling in addon files)

**Description**:
Two JSDoc comments in addon-entitlement.service.ts use "cancelled" (British):

- Line 5: `"when add-ons are purchased or cancelled"`
- Line 262: `"Remove entitlements and limits when an add-on is cancelled"`

**Impact**: Violates AC-9 ("zero matches for `'cancelled'` in addon-purchase-related files"). No functional impact.

**Recommendation**: Fix directly. 2-line text change. Change "cancelled" to "canceled" in both JSDoc comments.

---

### GAP-044-18: Log Messages Use British "cancelled" in addon.user-addons.ts

- **Found in**: Audit pass 5 (API Services agent + Global Grep agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - AC-9 violation (British spelling in addon files)

**Description**:
Three log messages in addon.user-addons.ts use "cancelled" (British):

- Line 314: `'UPDATE affected 0 rows -- record may have been concurrently cancelled; continuing with entitlement removal'`
- Line 324: `'Cancelled billing_addon_purchase record'`
- Line 366: `'Add-on cancelled and entitlements removed'`

**Impact**: Violates AC-9. No functional impact but inconsistent with the "canceled" standardization goal.

**Recommendation**: Fix directly. 3 string replacements. Change "cancelled" to "canceled" and "Cancelled" to "Canceled".

---

### GAP-044-19: Test Comments Use British "cancelled" in addon.service.test.ts

- **Found in**: Audit pass 5 (Tests agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - AC-9 violation (British spelling in addon test files)

**Description**:
Two comments in addon.service.test.ts use "cancelled" (British):

- Line 1050: `"// Arrange: purchase belongs to the right customer but is already cancelled"`
- Line 1108: `"// The DB update should have been called to set status=cancelled"`

**Impact**: Violates AC-9. No functional impact.

**Recommendation**: Fix directly alongside GAP-044-14 (same file). Change "cancelled" to "canceled" in both comments.

---

### GAP-044-20: `db-mock.ts` Shared Mock Missing `deletedAt` Column

- **Found in**: Audit pass 5 (Tests agent)
- **Severity**: Medium
- **Priority**: High
- **Complexity**: Low (1)
- **Type**: Undeclared - test infrastructure gap

**Description**:
The shared `billingAddonPurchasesCols` mock in `apps/api/test/helpers/mocks/db-mock.ts` is missing `deletedAt: 'deleted_at'`. This mock is used by multiple test files via the `@repo/db` module mock. Any test that references `billingAddonPurchases.deletedAt` through the shared mock will get `undefined` instead of the expected column reference.

**Evidence**:

- `apps/api/test/helpers/mocks/db-mock.ts` - `billingAddonPurchasesCols` object does not include `deletedAt`
- Tests that work correctly (like `addon-expiration.service.test.ts`) define their OWN local mock with `deletedAt`, masking this gap

**Impact**: Same class of issue as GAP-044-13 (setup.ts). Any NEW test relying on the shared mock for `isNull(billingAddonPurchases.deletedAt)` would silently fail.

**Proposed Solutions**:

1. **Add `deletedAt: 'deleted_at'` to db-mock.ts (recommended)**
   - 1-line fix
   - Complexity: ~2 min

**Recommendation**: Fix immediately alongside GAP-044-13.

---

### GAP-044-21: `addon.checkout.test.ts` Mock Missing `deletedAt`

- **Found in**: Audit pass 5 (Tests agent)
- **Severity**: Low
- **Priority**: Medium
- **Complexity**: Low (1)
- **Type**: Undeclared - test infrastructure gap

**Description**:
The mock schema in `apps/api/test/services/addon.checkout.test.ts` does not include `deletedAt` in its column definitions. While the checkout flow only does INSERTs (not SELECTs that filter by deletedAt), the mock should be complete for consistency and to prevent issues if the test is extended.

**Recommendation**: Fix directly. 1-line addition to the local mock.

---

### GAP-044-22: `CustomerAddonResponseSchema` Missing `deletedAt` Field

- **Found in**: Audit pass 5 (Routes agent + Edge Cases agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - future-proofing gap

**Description**:
The admin-facing `CustomerAddonResponseSchema` in `customer-addons.schema.ts` (lines 57-75) does NOT include `deletedAt`. The admin SELECT (lines 77-94) also omits it. If `includeDeleted` is added (GAP-044-01), admins won't know WHEN a record was soft-deleted.

**Impact**: No current bug. Future `includeDeleted` feature would need schema and SELECT updates.

**Recommendation**: Defer. Address together with GAP-044-01 when implementing `includeDeleted`.

---

### GAP-044-23: Missing `totalPages` in Admin Customer-Addons Paginated Response

- **Found in**: Audit pass 5 (Routes agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - convention violation

**Description**:
The `CustomerAddonsListResponseSchema` returns `{ data, total, page, limit }` but does NOT include `totalPages`. The standard admin list response pattern (via `createAdminListRoute` and `ResponseFactory.paginated()`) includes `totalPages: Math.ceil(total / pageSize)`.

**Impact**: Frontend can compute it, but it breaks convention used by all other admin list endpoints.

**Recommendation**: Fix alongside GAP-044-06 (limit -> pageSize rename). Add `totalPages` to the response.

---

### GAP-044-24: `expireAddon` Entitlement Failure Blocks Status Update Permanently

- **Found in**: Audit pass 5 (Edge Cases agent)
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Medium (3)
- **Type**: Undeclared - architectural resilience issue

**Description**:
In `expireAddon()` at `addon-expiration.service.ts`, if `removeAddonEntitlements` fails (lines 424-428), the method returns early with an error (lines 441-448) WITHOUT updating the purchase status to 'expired'. The addon stays 'active' in the DB and will be retried by the next cron run.

However, the entitlement service wraps QZPay errors as warnings (addon-entitlement.service.ts lines 369-383), meaning a transient QZPay failure can block expiration permanently. The purchase remains stuck as 'active' while functionally expired.

Contrast with `cancelUserAddon` (addon.user-addons.ts lines 327-337), which catches DB errors and continues with entitlement removal anyway.

**Proposed Solutions**:

1. **Add retry with fallback (recommended)**
   - If entitlement removal fails due to transient error, log warning and still update status to 'expired'
   - Add a separate reconciliation cron to catch entitlement drift
   - Complexity: ~1 hour

2. **Defer to SPEC-038**
   - This is an entitlement architecture concern

**Recommendation**: Defer to SPEC-038. Pre-existing pattern not introduced by SPEC-044.

---

### GAP-044-25: `BaseModel.softDelete()` Does Not Set `updatedAt`

- **Found in**: Audit pass 5 (Edge Cases agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - audit trail inconsistency
- **Status**: Deferred

**Description**:
`BaseModel.softDelete()` at `packages/db/src/base/base.model.ts:322` only sets `deletedAt: new Date()`. It does NOT set `updatedAt`. Similarly, `restore()` only clears `deletedAt` without updating `updatedAt`.

**Impact**: `deletedAt > updatedAt` is valid but misleading for audit purposes. Addon services do manual cancellation (setting `updatedAt` explicitly), so this only affects direct `softDelete()` calls.

**Recommendation**: Defer. Pre-existing BaseModel behavior, not SPEC-044-specific. Consider a broader BaseModel improvement SPEC.

---

### GAP-044-26: `BaseModel.restore()` Does Not Re-Grant Entitlements (Documentation Trap)

- **Found in**: Audit pass 5 (Edge Cases agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - documentation / future development trap
- **Status**: Deferred

**Description**:
If `BaseModel.restore()` is called on a soft-deleted addon purchase, the record becomes visible again but:

1. No entitlements are re-granted via QZPay
2. No metadata is re-added to the subscription JSON
3. Could violate the unique partial index if a new active purchase was created after soft-delete

No current code path triggers this (no restore route/service exists), but it's a trap for future development.

**Recommendation**: Defer. Document as a known limitation. When an admin restore feature is built, create an explicit `restoreAddonPurchase` service method.

---

### GAP-044-27: Stale Worktree with Pre-SPEC-044 Code

- **Found in**: Audit pass 5 (Global Grep agent)
- **Severity**: Info
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - stale artifact

**Description**:
The directory `.claude/worktrees/agent-aadd9e3f/` contains old copies of files with pre-SPEC-044 `cancelledAt` spelling. This is a stale worktree from a prior agent run, not part of the main codebase.

**Recommendation**: Clean up the stale worktree: `rm -rf .claude/worktrees/agent-aadd9e3f/`

---

### GAP-044-28: Migration Script Idempotency Check Missing `isNull(deletedAt)` Filter

- **Found in**: Audit pass 5 (API Services agent + Edge Cases agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - one-time migration script gap
- **Status**: Deferred

**Description**:
The one-time migration script `packages/db/src/billing/migrate-addon-purchases.ts` at lines 632-642 performs an idempotency check SELECT that does NOT include `isNull(deletedAt)`. If a previous migration created a record that was later soft-deleted, the migration could see it as "already migrated" and skip re-inserting.

**Impact**: Minimal. One-time migration script unlikely to run again. The unique partial index provides safety.

**Recommendation**: Defer. Document as known limitation of the one-time migration.

---

### GAP-044-29: MercadoPago `unit_price` Potentially Sent in Centavos Instead of ARS Units

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Critical
- **Priority**: Critical
- **Complexity**: Low (2)
- **Type**: Undeclared - pricing/payment bug (REQUIRES VERIFICATION)

**Description**:
The `createAddonCheckout` function in `addon.checkout.ts` sends `unit_price: finalPrice` to MercadoPago's Preference API. The `finalPrice` is derived from `AddonDefinition.priceArs` which stores values in centavos (e.g., `500000` for ARS $5,000). MercadoPago's API expects `unit_price` in the currency's standard unit (e.g., `5000` for ARS $5,000), NOT in centavos.

**Evidence**:

- `packages/billing/src/config/addons.config.ts` - `priceArs: 500000` (500k centavos = ARS $5,000)
- `apps/api/src/services/addon.checkout.ts` - `unit_price: finalPrice` passed directly to MercadoPago Preference
- MercadoPago API docs: `unit_price` expects decimal/whole units, not centavos

**CRITICAL CAVEAT**: This needs manual verification. The billing system may normalize prices somewhere upstream (e.g., the `billing.promos.calculateDiscountedPrice()` call might return ARS units, not centavos). Or the `priceArs` values might already be in ARS units (confusing naming). **Do NOT deploy a fix without verifying the actual values flowing through the checkout.**

**Impact**:
If confirmed, customers would be charged 100x the intended amount (ARS $500,000 instead of ARS $5,000 for a visibility boost). This would be a P0 production incident.

**Proposed Solutions**:

1. **Verify actual behavior first (MANDATORY)**
   - Add logging or check the existing MercadoPago sandbox transactions
   - Verify what `priceArs` values actually mean (centavos or units?)
   - Check if `billing.promos.calculateDiscountedPrice()` normalizes

2. **If confirmed as bug: divide by 100 before sending**
   - `unit_price: finalPrice / 100`
   - Add a comment explaining the conversion
   - Complexity: ~15 min code + 30 min verification

3. **If priceArs is actually in units (misleading naming): document**
   - Add JSDoc clarifying that `priceArs` is in ARS units despite the naming convention elsewhere

**Resolution (Pass 6)**: Bug CONFIRMED and FIXED. Changed `addon.checkout.ts:189` from `unit_price: finalPrice` to `unit_price: finalPrice / 100`. QZPay was verified to correctly handle centavos->ARS conversion in its own MercadoPago adapters (payment, price, checkout adapters all divide by 100), so subscription flows are NOT affected. Only the addon checkout (which bypasses QZPay and uses raw MercadoPago SDK) had this bug.

**QZPay verification evidence**: `/home/qazuor/projects/PACKAGES/qzpay/packages/mercadopago/src/adapters/payment.adapter.ts:67` has `transaction_amount: input.amount / 100` with comment "MercadoPago uses decimal, not cents". All 5 adapter files consistently convert. Tests confirm: input `10000` cents becomes `transaction_amount: 100` in MP calls.

---

### GAP-044-30: `PurchaseAddonResponseSchema.orderId` Requires UUID But Actual Value Is Not UUID

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: High
- **Priority**: High
- **Complexity**: Low (1)
- **Type**: Undeclared - schema validation mismatch

**Description**:
The `PurchaseAddonResponseSchema` in `apps/api/src/schemas/addon.schema.ts` defines `orderId: z.string().uuid()`. However, the actual `orderId` generated in `addon.checkout.ts` (line ~159) is `addon_${addon.slug}_${Date.now()}` -- a string like `addon_visibility-boost-7d_1741234567890`, which is NOT a valid UUID.

**Evidence**:

- `apps/api/src/schemas/addon.schema.ts` - `orderId: z.string().uuid()` in response schema
- `apps/api/src/services/addon.checkout.ts:~159` - `orderId: \`addon_${addon.slug}_${Date.now()}\``

**Impact**:
If the response is validated against the Zod schema (e.g., via OpenAPI or response validation middleware), the checkout response would FAIL validation and return an error to the user, even though the checkout was created successfully on MercadoPago's side.

**Proposed Solutions**:

1. **Fix the schema to match reality (recommended)**
   - Change `orderId: z.string().uuid()` to `orderId: z.string().min(1)`
   - Complexity: ~5 min
   - Pros: Matches actual behavior, no breaking change
   - Cons: Weaker validation

2. **Generate actual UUIDs for orderIds**
   - Use `crypto.randomUUID()` for order tracking
   - Store the slug+timestamp in metadata instead
   - Complexity: ~30 min
   - Pros: Proper UUID-based tracking
   - Cons: Loses human-readable order IDs

**Recommendation**: Fix the schema (option 1). The current orderId format is useful for debugging. Consider a new SPEC for order tracking improvements.

---

### GAP-044-31: Cron Job Sends Addon Slug as Display Name in Notifications

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: High
- **Priority**: High
- **Complexity**: Low (2)
- **Type**: Undeclared - user-facing notification bug

**Description**:
The addon expiry cron job at `addon-expiry.job.ts` passes `addonName: expiringAddon.addonSlug` (line ~258) to the notification system. This means email notifications would display the slug (e.g., "visibility-boost-7d") instead of the human-readable name (e.g., "Visibility Boost (7 days)").

**Evidence**:

- `apps/api/src/cron/jobs/addon-expiry.job.ts:~258` - `addonName: expiringAddon.addonSlug`
- `packages/billing/src/config/addons.config.ts` - Each addon has a `name` field (e.g., `name: 'Visibility Boost (7 days)'`)

**Impact**:
Customers receive emails with slugified addon names. Unprofessional and confusing.

**Proposed Solutions**:

1. **Look up addon name from config (recommended)**
   - `addonName: getAddonBySlug(expiringAddon.addonSlug)?.name ?? expiringAddon.addonSlug`
   - Apply to all notification calls in the cron job (expiration warning and expired)
   - Complexity: ~15 min
   - Pros: Correct user-facing display
   - Cons: None

**Recommendation**: Fix directly. Quick fix with high user-facing impact.

---

### GAP-044-32: Dual Addon Schema Definitions Violate Single Source of Truth

- **Found in**: Audit pass 6 (Codebase analyzer + Billing/Cross-cutting agent)
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Medium (3)
- **Type**: Undeclared - architecture / SSoT violation

**Description**:
Two separate addon schema files exist with overlapping but DIFFERENT definitions:

1. `packages/schemas/src/api/billing/addon.schema.ts` - `PurchaseAddonRequestSchema` uses field `slug`, `ListAddonsQuerySchema` has `{ billingType, search }`
2. `apps/api/src/schemas/addon.schema.ts` - `PurchaseAddonSchema` uses field `addonId`, `ListAddonsQuerySchema` has `{ billingType, targetCategory, active }`

The API routes import from the local `apps/api/src/schemas/` version. The `@repo/schemas` version appears partially unused by the actual API.

**Impact**:

- Types exported from `@repo/schemas` don't match actual API behavior
- Consumers relying on `@repo/schemas` types (e.g., web app) get wrong type information
- The `addonId` vs `slug` naming confusion could cause bugs in API consumers

**Proposed Solutions**:

1. **Consolidate to `@repo/schemas` (recommended)**
   - Move all addon schemas to `packages/schemas/src/api/billing/addon.schema.ts`
   - Delete `apps/api/src/schemas/addon.schema.ts`
   - Update all API imports
   - Complexity: ~2 hours
   - Pros: Single source of truth, correct types for all consumers
   - Cons: Larger change surface

2. **Document the split and mark `@repo/schemas` addon as deprecated**
   - Complexity: ~15 min
   - Cons: Leaves the SSoT violation in place

**Recommendation**: Create a new SPEC for addon schema consolidation. Not SPEC-044 scope but high importance.

---

### GAP-044-33: Addon Services Use Local `ServiceResult<T>` Instead of `BaseCrudService`

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Medium
- **Priority**: Low
- **Complexity**: Medium (4)
- **Type**: Undeclared - service architecture deviation
- **Status**: Deferred

**Description**:
All addon services (`addon.service.ts`, `addon.checkout.ts`, `addon.user-addons.ts`, `addon-entitlement.service.ts`, `addon-expiration.service.ts`) use a custom `ServiceResult<T>` type from `addon.types.ts` instead of extending `BaseCrudService` from `@repo/service-core` with the standard `Result<T>` type.

**Impact**:

- Addon services lack automatic logging via `runWithLoggingAndValidation()`
- No permission checking via `PermissionEnum` at service layer
- No standard soft delete integration
- Different error handling pattern from all other services
- `BillingMetricsService` also imports `ServiceResult` from `addon.types.ts`, spreading the deviation

**Recommendation**: Defer. Major refactor that should be its own SPEC. The current services work correctly, they just don't follow the established pattern.

---

### GAP-044-34: Admin Addon/Plan Hooks Use `/protected/` Tier Instead of `/admin/`

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Medium (3)
- **Type**: Undeclared - API tier violation

**Description**:
The admin billing addon hooks at `apps/admin/src/features/billing-addons/hooks.ts` and plan hooks at `apps/admin/src/features/billing-plans/hooks.ts` call `/api/v1/protected/billing/addons` and `/api/v1/protected/billing/plans` respectively. Per the project's route architecture (documented in CLAUDE.md), admin pages should exclusively use `/api/v1/admin/*` endpoints.

**Evidence**:

- `apps/admin/src/features/billing-addons/hooks.ts:47,79,95,101,113` - Uses `/protected/billing/addons`
- `apps/admin/src/features/billing-plans/hooks.ts` - Uses `/protected/billing/plans`
- CLAUDE.md: "Admin panel uses only `/admin/` endpoints. Exception: `/api/v1/public/auth/me`"

**Impact**:

- Protected tier lacks admin permission checks (uses user session, not admin+permissions)
- Admin users bypass the admin authorization layer
- Inconsistent with all other admin billing routes

**Proposed Solutions**:

1. **Create admin addon/plan routes (recommended)**
   - Add `/api/v1/admin/billing/addons` and `/api/v1/admin/billing/plans` routes
   - Mirror the existing protected endpoints but add admin permission checks
   - Update admin hooks to use admin endpoints
   - Complexity: ~3 hours

2. **Document as known exception**
   - These endpoints only read data, risk is lower

**Recommendation**: Create a new SPEC. This is a security/architecture concern beyond SPEC-044 scope.

---

### GAP-044-35: Checkout Bypasses `createMercadoPagoAdapter()` Using Raw SDK

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Low (2)
- **Type**: Undeclared - bypasses billing package abstraction

**Description**:
The `createAddonCheckout` function in `addon.checkout.ts` imports `MercadoPagoConfig` and `Preference` directly from the `mercadopago` SDK package (lines ~156-157) instead of using the `createMercadoPagoAdapter()` factory from `@repo/billing`. This bypasses any retry logic, timeout settings, webhook secret validation, or future middleware that the adapter provides.

**Evidence**:

- `apps/api/src/services/addon.checkout.ts:~156-157` - Direct `new MercadoPagoConfig()` and `new Preference()`
- `packages/billing/src/adapters/mercadopago.ts` - Adapter factory exists with configured settings

**Proposed Solutions**:

1. **Use the adapter (recommended)**
   - Replace raw SDK usage with `createMercadoPagoAdapter()` from `@repo/billing`
   - Complexity: ~30 min

**Recommendation**: Fix directly or as part of an addon checkout hardening SPEC.

---

### GAP-044-36: No `targetCategories` Validation in Checkout Against Customer Plan

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Medium
- **Priority**: Medium
- **Complexity**: Low (2)
- **Type**: Undeclared - business logic gap

**Description**:
The `createAddonCheckout` function validates that the addon exists and that the customer has an active subscription, but does NOT validate that the addon's `targetCategories` includes the customer's plan category. A customer on a `tourist` plan could potentially purchase an addon intended only for `owner` plans.

**Evidence**:

- `packages/billing/src/config/addons.config.ts` - All addons have `targetCategories: ['owner', 'complex']`
- `apps/api/src/services/addon.checkout.ts` - No `targetCategories` check in validation logic

**Proposed Solutions**:

1. **Add category validation (recommended)**
   - After resolving the customer's subscription, check `addon.targetCategories.includes(customerPlan.category)`
   - Return a clear error like `ADDON_NOT_AVAILABLE_FOR_PLAN`
   - Complexity: ~30 min

**Recommendation**: Fix directly. Important business logic guard.

---

### GAP-044-37: `UsageTrackingService` Still Reads Addon Adjustments from JSON Metadata

- **Found in**: Audit pass 6 (Codebase analyzer)
- **Severity**: Medium
- **Priority**: Low
- **Complexity**: Medium (3)
- **Type**: Undeclared - stale code path

**Description**:
The `UsageTrackingService.getAddonAdjustments()` method (at `usage-tracking.service.ts:~543`) reads addon adjustments from `subscription.metadata.addonAdjustments` JSON instead of querying the `billing_addon_purchases` table. This is the deprecated metadata path.

Currently this works because `applyAddonEntitlements` writes to BOTH the table and the JSON metadata. However, this creates a dependency on the deprecated path and means usage tracking won't work correctly if the JSON write is ever removed.

**Proposed Solutions**:

1. **Update to read from table (recommended)**
   - Replace JSON metadata read with a query to `billing_addon_purchases WHERE status='active' AND isNull(deletedAt)`
   - Complexity: ~1 hour

2. **Defer until JSON metadata deprecation**

**Recommendation**: Defer. Not urgent while both paths are maintained, but should be tracked.

---

### GAP-044-38: Missing Admin API Endpoints for Force Expire/Activate

- **Found in**: Audit pass 6 (Codebase analyzer)
- **Severity**: Medium
- **Priority**: High
- **Complexity**: Medium (3)
- **Type**: Undeclared - missing API endpoints

**Description**:
The admin UI hooks (`apps/admin/src/features/billing-addons/hooks.ts`) call:

- `POST /api/v1/admin/billing/customer-addons/{id}/expire`
- `POST /api/v1/admin/billing/customer-addons/{id}/activate`

But these endpoints do NOT exist in the API. Only `GET /api/v1/admin/billing/customer-addons` (list) is implemented in `apps/api/src/routes/billing/admin/customer-addons.ts`.

**Evidence**:

- `apps/admin/src/features/billing-addons/hooks.ts:~126,136` - Mutation hooks call these endpoints
- `apps/admin/src/routes/_authed/billing/addons.tsx` - Force expire/activate buttons in the UI
- `apps/api/src/routes/billing/admin/customer-addons.ts` - Only GET list handler exists

**Impact**:
Admin users see "Force Expire" and "Force Activate" buttons that produce 404 errors when clicked.

**Proposed Solutions**:

1. **Implement the endpoints (recommended)**
   - Add POST `/:id/expire` and POST `/:id/activate` to admin customer-addons routes
   - Require `BILLING_MANAGE` permission
   - Expire: set status='expired', remove entitlements
   - Activate: set status='active', re-apply entitlements (with safety checks)
   - Complexity: ~2 hours

2. **Remove the UI buttons until endpoints exist**
   - Hide or disable the buttons
   - Complexity: ~15 min

**Recommendation**: Create a new SPEC for admin addon management. The activate flow especially needs careful design (entitlement re-granting, expiration date handling).

---

### GAP-044-39: No `ADDON_PURCHASE` Email Template Despite `NotificationType` Defined

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - missing notification template

**Description**:
`NotificationType.ADDON_PURCHASE` is defined in `packages/notifications/src/types/notification.types.ts` but no corresponding email template exists in `packages/notifications/src/templates/addon/`. Only expiration-related templates exist (warning, expired, renewal confirmation).

**Impact**: Customers receive no purchase confirmation email. Low priority since this is a "nice to have" notification.

**Recommendation**: Defer. Create as part of an addon notifications SPEC.

---

### GAP-044-40: `annualPriceArs` Not Validated in Billing Config Validator

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - config validation gap

**Description**:
The `validateAddons()` function in `packages/billing/src/validation/config-validator.ts` validates `priceArs > 0` but never validates `annualPriceArs`. For recurring addons that have annual pricing, this field could be `null`, `0`, or negative without triggering a validation error.

**Recommendation**: Fix directly alongside any billing config work. Low effort.

---

### GAP-044-41: DB `status` Column Has No CHECK Constraint

- **Found in**: Audit pass 6 (Codebase analyzer)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (2)
- **Type**: Undeclared - DB schema safety
- **Status**: Deferred

**Description**:
The `billing_addon_purchases.status` column is `varchar(50)` with no CHECK constraint. Valid statuses (`active`, `expired`, `canceled`, `pending`) are enforced only at the application level.

**Recommendation**: Defer. Consider adding in a future schema hardening SPEC. Low risk since all writes go through application code.

---

### GAP-044-42: Admin Plan Hooks Use Extensive Unsafe `as` Type Casts

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (2)
- **Type**: Undeclared - type safety concern
- **Status**: Deferred

**Description**:
`transformPlanRecord` in `apps/admin/src/features/billing-plans/hooks.ts` uses multiple `as` casts from `unknown` with no runtime validation (e.g., `meta.slug as string`, `meta.category as PlanDefinition['category']`).

**Recommendation**: Defer. Admin-internal type safety issue that should be addressed during admin billing refactor.

---

### GAP-044-43: `ServiceResult<T>` Type Allows Invalid States

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (1)
- **Type**: Undeclared - type design issue
- **Status**: Deferred

**Description**:
The `ServiceResult<T>` type in `addon.types.ts` has `success: boolean` instead of a discriminated union. This allows invalid states like `{ success: true, error: {...} }` or `{ success: false, data: {...} }`.

**Recommendation**: Defer. Address alongside GAP-044-33 (service pattern refactor).

---

### GAP-044-44: API-Local Addon Schema Uses Plain English Instead of i18n Keys for Validation Messages

- **Found in**: Audit pass 6 (Billing/Cross-cutting agent)
- **Severity**: Low
- **Priority**: Low
- **Complexity**: Low (2)
- **Type**: Undeclared - i18n consistency gap
- **Status**: Deferred

**Description**:
The `@repo/schemas` addon schema uses i18n keys for Zod error messages (e.g., `validation.billing.addon.*`), but the API-local schemas in `apps/api/src/schemas/addon.schema.ts` use plain English strings (e.g., `'Add-on ID is required'`). This creates inconsistent validation error messaging.

**Recommendation**: Defer. Address alongside GAP-044-32 (schema consolidation).

---

## Pass 6: False Positives Investigated and Dismissed

The following items were flagged by Pass 6 agents but determined to be correct, out of scope, or already documented:

| Flagged Item | Investigation Result | Reason |
|---|---|---|
| Admin `PurchasedAddon` type diverges from API `UserAddon` type | **EXPECTED** | Admin and protected APIs return different shapes (admin includes customer info from JOIN). Not a bug, just different response models for different consumers. |
| Missing `annualPriceArs` in admin `CreateAddonPayload` | **FEATURE GAP** | Admin UI doesn't support annual pricing for addons. Pre-existing limitation, not SPEC-044 scope. |
| `createAddonCheckout` creates `PromoCodeService` twice | **CODE SMELL, NOT BUG** | Two instances for validation (pre-checkout) and recording (post-checkout). Could be refactored but functionally correct. |
| Dynamic imports in checkout/cancel routes | **INTENTIONAL** | Workaround for circular dependency in Drizzle schema imports. Pre-existing pattern. |
| Entitlement middleware plan_id UUID vs varchar mismatch | **ALREADY DOCUMENTED** | Listed in CLAUDE.md gotchas: "billing_plans.id is UUID but billing_subscriptions.plan_id is varchar". Pre-existing, not SPEC-044 scope. |

---

## Pass 5: False Positives Investigated and Dismissed

The following items were flagged by Pass 5 agents but determined to be correct or out of scope:

| Flagged Item | Investigation Result | Reason |
|---|---|---|
| `addon.checkout.ts` INSERT doesn't set `deletedAt: null` | **NOT A BUG** | Column has DB default of `NULL`. Explicit set is unnecessary. |
| Admin route JOIN doesn't filter `billingCustomers.deletedAt` | **OUT OF SCOPE** | SPEC-044 targets `billingAddonPurchases` only. Customer soft-delete is a separate concern. |
| Subscription routes use `'cancelled'` (double-L) | **OUT OF SCOPE** | Subscriptions explicitly excluded from SPEC-044. Pre-existing intentional convention. |
| MercadoPago webhook `'cancelled'` status | **OUT OF SCOPE** | External API value, must not be changed. |
| `0023_snapshot.json` has extraneous `"autoincrement": false` on `deleted_at` | **NOT A BUG** | Cosmetic Drizzle-kit inconsistency. Harmless for timestamp columns. |
| pgEnum types (`invoice_status_enum`, etc.) contain `'cancelled'` | **OUT OF SCOPE** | These are separate billing enums, not addon purchase status (which is a varchar). |
| Documentation examples use `cancelledAt` | **OUT OF SCOPE** | Explicitly excluded in spec line 61. |

---

## Pass 4: False Positives Investigated and Dismissed

The tests agent (pass 4) flagged one item that was investigated and determined to be a **false positive**:

| Flagged Item | Investigation Result | Reason |
|---|---|---|
| `addon.service.test.ts:1220` uses `'cancelled'` | **FALSE POSITIVE** | This is a NEGATIVE assertion: `expect(mockDbUpdateSet).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))`. The test is correctly verifying that the British spelling is NEVER written to the database. The string `'cancelled'` is the value being REJECTED, not asserted. This is correct test behavior. |

---

## Pass 3: False Positives Investigated and Dismissed

The edge cases agent (pass 3) flagged several items as "CRITICAL" that were investigated and determined to be **false positives or out-of-scope**:

| Flagged Item | Investigation Result | Reason |
|---|---|---|
| Web app uses `'cancelled'` in SubscriptionCard, endpoints-protected.ts, subscription-card.types.ts | **FALSE POSITIVE** | All references are SUBSCRIPTION code, explicitly out of SPEC-044 scope (spec line 59). Verified: `SubscriptionData.status`, `SubscriptionCard`, `subscription-card.types.ts` all deal with subscriptions, not addon purchases. |
| Cron job doesn't filter soft-deleted addons | **FALSE POSITIVE** | Pass 3 services agent confirmed `AddonExpirationService.findExpiredAddons()` DOES include `isNull(billingAddonPurchases.deletedAt)` at line 164. The cron job delegates to the service which handles filtering correctly. |
| Entitlement middleware no soft-delete filter | **Pre-existing, out of scope** | The entitlement middleware reads from QZPay billing service, not directly from `billing_addon_purchases`. Addon entitlements are loaded via `addon-entitlement.service.ts:525-534` which DOES filter `isNull(deletedAt)`. The middleware's reliance on QZPay metadata is a separate architectural concern (metadata staleness), not a SPEC-044 gap. |
| No admin delete route for addon purchases | **Feature gap, not SPEC-044** | The spec does not require a delete endpoint. Soft-delete is supported at the DB/model level via `BaseModel.softDelete()`. No admin UI or API route exposes this yet, which is a separate feature request. |
| No restore endpoint for addon purchases | **Feature gap, not SPEC-044** | `BaseModel.restore()` exists and works at the code level. No API route exposes it. This is a future feature, not a SPEC-044 gap. |
| No bulk delete for addon purchases | **Feature gap, not SPEC-044** | GDPR/compliance bulk operations are a separate concern. |
| Race condition: soft-delete vs entitlements | **Pre-existing architectural concern** | Metadata staleness in QZPay subscription data is documented as a KNOWN LIMITATION in `addon-entitlement.service.ts:61-66`. Not introduced by SPEC-044. |

---

## Verification Matrix (What Was Confirmed Working)

For completeness, here is what all 3 audit passes CONFIRMED as correctly implemented:

| Area | Files Checked | Status | Verified In |
|------|---------------|--------|-------------|
| Drizzle schema (`canceledAt`, `deletedAt`, indexes) | 1 file | PASS | Pass 1, 2, 3 |
| Migration SQL (RENAME, not DROP+ADD, data migration, 4-step order) | 1 file | PASS | Pass 1, 2, 3 |
| Migration snapshot consistency (0022→0023 diff correct) | 2 files | PASS | Pass 3 |
| BaseModel soft-delete integration (softDelete/restore methods) | 1 file | PASS | Pass 3 |
| BillingAddonPurchaseModel type inference | 1 file | PASS | Pass 3 |
| API services - rename (`cancelledAt` -> `canceledAt`) | 6 files | PASS | Pass 1, 2, 3 |
| API services - soft-delete filters (`isNull(deletedAt)`) | 4 files, 8 queries | PASS | Pass 2, 3 (deep) |
| API services - zero `any` types | 6 files | PASS | Pass 2, 3 |
| API services - typed error handling (`ServiceResult<T>`) | 6 files | PASS | Pass 2, 3 |
| API services - Zod input validation | 4 files | PASS | Pass 2, 3 |
| API routes - soft-delete filters | 2 files, 3 queries | PASS | Pass 1, 2, 3 |
| API routes - ownership checks with soft-delete guard | 1 route | PASS | Pass 2, 3 |
| Zod schemas - status enum and field rename | 2 files | PASS | Pass 1, 2, 3 |
| Admin frontend types (`PurchasedAddon.status`, `StatusFilter`) | 1 file | PASS | Pass 1, 2, 3 |
| Admin frontend components (status values, badge, filter dropdown) | 3 files | PASS | Pass 1, 2, 3 |
| Admin route page (`addons.tsx` - SelectItem, i18n keys) | 1 file | PASS | Pass 3 |
| i18n addon locale keys (all 3 locales, 2 keys each) | 3 files, 6 keys | PASS | Pass 1, 2, 3 |
| Test mocks and assertions | 5 files | PARTIAL FAIL | Pass 1-5 (pass 4: GAP-044-13/14, pass 5: GAP-044-19/20/21) |
| Mock factory accuracy vs real schema | 1 file | PASS | Pass 2, 3 |
| New soft-delete tests (6 explicit tests across 2 files) | 2 files | PASS | Pass 1, 2, 3 |
| New status consistency tests | 2+ test cases | PASS | Pass 1, 2, 3 |
| Total addon test count (143+ tests) | 6 test files | PASS | Pass 3 |
| purchaseId propagation (DB insert -> entitlementService) | 2 files | PASS | Pass 2, 3 |
| Status enum consistency across all layers | 8+ files | PASS | Pass 2, 3 |
| Out-of-scope boundaries (subscriptions, MercadoPago) | 6 files | PASS | Pass 1, 2, 3 |
| Global grep for `cancelledAt` remnants in source | Entire codebase | PASS | Pass 1, 2, 3, 4 |
| Global grep for `'cancelled'` status value in addon code | Entire codebase | PARTIAL FAIL | Pass 2-5 (pass 4: GAP-044-14, pass 5: GAP-044-17/18/19 in JSDoc/logs/comments) |
| Global grep for `cancelled_at` in source TS files | Entire codebase | PASS | Pass 3 |
| Migration ordering and snapshot consistency | Migration dir | PASS | Pass 1, 3 |
| Seed data | packages/seed/ | PASS | Pass 1 |
| Cron job soft-delete awareness (delegates to service with filter) | 1 job + 3 methods | PASS | Pass 2, 3 |
| FK constraints correctness (3 FKs unchanged) | 1 file | PASS | Pass 2, 3 |
| Index definitions (9 total, 2 partial with soft-delete) | 1 file | PASS | Pass 2, 3 |
| Unique partial index correctness (`status='active' AND deleted_at IS NULL`) | 1 file | PASS | Pass 2, 3 |
| Billing package addon definitions | 5 addons, types consistent | PASS | Pass 2 |
| Web app subscription code (correctly untouched) | 3 files | PASS | Pass 3 |
| MercadoPago webhook handler (correctly untouched) | 1 file | PASS | Pass 1, 3 |
| Entitlement middleware (delegates to service with filter) | 1 file | PASS | Pass 3 |
| `addon.checkout.ts` (INSERT-only, no old spellings) | 1 file | PASS | Pass 2, 3 |
| `usage-tracking.service.ts` (reads metadata, no direct addon queries) | 1 file | PASS | Pass 3 |
| `billing-metrics.service.ts` (no addon purchase queries) | 1 file | PASS | Pass 3 |
| UPDATE WHERE guards (status + deletedAt in cancel/expire) | 2 UPDATE ops | FAIL | Pass 5 (GAP-044-15, GAP-044-16) |
| JSDoc/log British spelling in addon service files | 5 strings | FAIL | Pass 5 (GAP-044-17, GAP-044-18) |
| Test comment British spelling in addon.service.test.ts | 2 comments | FAIL | Pass 5 (GAP-044-19) |
| Shared db-mock.ts includes `deletedAt` column | 1 file | FAIL | Pass 5 (GAP-044-20) |
| addon.checkout.test.ts mock includes `deletedAt` | 1 file | FAIL | Pass 5 (GAP-044-21) |
| Admin response schema includes `deletedAt` for future use | 1 schema | FAIL | Pass 5 (GAP-044-22) |
| Admin paginated response includes `totalPages` | 1 route | FAIL | Pass 5 (GAP-044-23) |
| Expiration resilience to entitlement failures | 1 service | FAIL | Pass 5 (GAP-044-24, deferred) |
| Stale worktrees cleanup | 1 directory | INFO | Pass 5 (GAP-044-27) |
| Admin frontend types, components, routes | 6 files | PASS | Pass 1-5 |
| i18n addon keys (all 3 locales) | 3 files | PASS | Pass 1-5 |

---

## Recommendations Summary

### FIXED (resolved during audit)

| Gap | Action Taken | Status |
|-----|-------------|--------|
| GAP-044-29 | Added `/ 100` conversion in `addon.checkout.ts:189`. Verified QZPay handles conversion correctly in its own adapters. | **FIXED** |

### Fix Directly in SPEC-044 (before marking complete)

| Gap | Action | Effort | Justification |
|-----|--------|--------|---------------|
| GAP-044-01 | Add `includeDeleted` query param to admin route | 30 min | Explicitly declared in spec |
| GAP-044-02 | Run `pnpm db:migrate` and verify | 10 min | Pending task T-021 |
| GAP-044-05 | Update metadata.json status to `in-progress` | 5 min | Spec hygiene |
| GAP-044-06 | Rename `limit` -> `pageSize` in admin schema/route + add `totalPages` | 45 min | Convention violation |
| GAP-044-08 | Change `z.string()` -> `z.enum()` in response schema | 15 min | Type safety, part of status standardization |
| GAP-044-13 | Add `deletedAt: 'deleted_at'` to setup.ts mock | 2 min | Test infrastructure completeness |
| GAP-044-14 | Change `'cancelled'` -> `'canceled'` in test mock data (line 1054) | 2 min | AC-9 compliance |
| GAP-044-15 | Add status + deletedAt guards to cancel UPDATE WHERE | 15 min | Race condition - data integrity |
| GAP-044-16 | Add status + deletedAt guards to expire UPDATE WHERE | 15 min | Race condition - data integrity |
| GAP-044-17 | Change "cancelled" to "canceled" in JSDoc (addon-entitlement.service.ts:5,262) | 2 min | AC-9 compliance |
| GAP-044-18 | Change "cancelled"/"Cancelled" to "canceled"/"Canceled" in log messages (addon.user-addons.ts:314,324,366) | 3 min | AC-9 compliance |
| GAP-044-19 | Change "cancelled" to "canceled" in test comments (addon.service.test.ts:1050,1108) | 2 min | AC-9 compliance |
| GAP-044-20 | Add `deletedAt: 'deleted_at'` to db-mock.ts shared mock | 2 min | Test infrastructure completeness |
| GAP-044-21 | Add `deletedAt: 'deleted_at'` to addon.checkout.test.ts mock | 2 min | Test mock completeness |
| GAP-044-23 | Add `totalPages` to admin response (with GAP-044-06) | 0 min (included in GAP-044-06) | Convention compliance |
| GAP-044-27 | Clean up stale worktree `rm -rf .claude/worktrees/agent-aadd9e3f/` | 1 min | Cleanup |
| GAP-044-30 | Fix `orderId` schema from `.uuid()` to `.min(1)` | 5 min | Broken response validation |
| GAP-044-31 | Use addon display name instead of slug in notifications | 15 min | User-facing bug |

Total effort for "fix directly" items: ~2h 51min

### Fix Shortly After (low-risk improvements, part of SPEC-044 cleanup)

| Gap | Action | Effort | Justification |
|-----|--------|--------|---------------|
| GAP-044-10 (partial) | Add soft-delete-specific tests (#5, #6) | 1.5 hr | Tests SPEC-044 features directly |
| GAP-044-04 | Optionally add note to runbook about addon vs subscription spelling | 15 min | Prevents confusion |
| GAP-044-22 | Add `deletedAt` to CustomerAddonResponseSchema (with GAP-044-01) | 5 min | Future-proofing for includeDeleted |
| GAP-044-40 | Add `annualPriceArs` validation to config validator | 15 min | Config safety |

### Requires New SPEC (broader addon system fixes)

| Gap | Recommended SPEC | Effort | Justification |
|-----|------------------|--------|---------------|
| GAP-044-32 | **SPEC-045: Addon Schema Consolidation** | 2-3 hrs | Dual schema definitions violate SSoT |
| GAP-044-34 | **SPEC-045: Addon Schema Consolidation** (or admin API tier SPEC) | 3 hrs | Admin hooks use wrong API tier |
| GAP-044-35 | **SPEC-045: Addon Checkout Hardening** | 30 min | Bypasses billing adapter |
| GAP-044-36 | **SPEC-045: Addon Checkout Hardening** | 30 min | No targetCategories validation |
| GAP-044-37 | **SPEC-038: Addon Entitlements Architecture** | 1 hr | UsageTracking reads deprecated JSON path |
| GAP-044-38 | **SPEC-046: Admin Addon Management** | 3-4 hrs | Missing force expire/activate endpoints |
| GAP-044-39 | **SPEC-046: Admin Addon Management** | 1 hr | Missing purchase confirmation notification |

### Defer (out of scope or requires broader effort)

| Gap | Defer To | Justification |
|-----|----------|---------------|
| GAP-044-03 | Subscription spelling migration SPEC | Icon is cross-cutting, subscriptions still British |
| GAP-044-07 | Admin routes refactor SPEC | Pre-existing pattern, not SPEC-044-specific |
| GAP-044-09 | Subscription spelling migration SPEC | Subscription i18n keys, explicitly out of scope |
| GAP-044-10 (partial) | SPEC-038 or testing SPEC | Broader lifecycle tests (#1-#4) |
| GAP-044-11 | Defensive JSONB validation initiative | Pre-existing pattern, low risk |
| GAP-044-12 | Leave as-is | Cosmetic localization preference, both spellings valid |
| GAP-044-24 | SPEC-038 (Addon Entitlements Architecture) | Pre-existing resilience issue, not introduced by SPEC-044 |
| GAP-044-25 | BaseModel improvement SPEC | Pre-existing behavior across all models |
| GAP-044-26 | Future admin restore feature SPEC | No current code path triggers this |
| GAP-044-28 | Leave as-is | One-time migration script, unlikely to rerun |
| GAP-044-33 | Addon service architecture SPEC | Major refactor to adopt BaseCrudService |
| GAP-044-41 | DB schema hardening SPEC | Low risk, app-level enforcement sufficient |
| GAP-044-42 | Admin billing refactor SPEC | Admin-internal type safety |
| GAP-044-43 | With GAP-044-33 | Part of service pattern refactor |
| GAP-044-44 | With GAP-044-32 | Part of schema consolidation |

---

## Appendix: TODO Comments Found in Addon Code

For reference, these are active TODO/KNOWN LIMITATION comments found during the audit:

| Location | Comment | Severity |
|----------|---------|----------|
| `apps/api/src/routes/billing/addons.ts:304-307` | `TODO(GAP-038-48)`: Redundant DB fetch in cancel route (ownership check + service both fetch same row) | Low - profile first |
| `apps/api/src/services/addon-entitlement.service.ts:61-66` | KNOWN LIMITATION: Metadata race condition on `subscription.metadata.addonAdjustments` read-modify-write without distributed lock | Accepted - table is source of truth, metadata is deprecated path |
| `apps/api/src/services/addon-entitlement.service.ts:281-285` | KNOWN LIMITATION (repeated): Same race condition in `removeAddonEntitlements()` | Accepted |

## Appendix: Compiled Dist Artifacts

Pass 3 cross-reference agent found `cancelledAt` in `packages/db/dist/index.d.ts`. Pass 4 global grep agent confirmed `cancelledAt` also present in `packages/db/dist/index.js`. These are **stale compiled artifacts** from before the rename, NOT source code. Running `pnpm build` for the `@repo/db` package will regenerate them with the correct `canceledAt` spelling. This is NOT a gap, but a reminder to rebuild before deploying.

---

## Gap Review Decisions (2026-03-16)

All 44 gaps were reviewed individually with the tech lead. Decisions:

### HACER (37 gaps)

| Gap | Description | Solution | Est. |
|-----|-------------|----------|------|
| GAP-044-01 | `includeDeleted` admin query param | Add to schema + conditional filter | 30 min |
| GAP-044-02 | Migration not applied | Run `pnpm db:migrate` + verify | 10 min |
| GAP-044-05 | Spec state hygiene | Update metadata.json status | 5 min |
| GAP-044-06 | `limit` → `pageSize` + `totalPages` | Rename in schema/route/response (includes GAP-044-23) | 45 min |
| GAP-044-07 | Route bypasses service layer | Extract query to a service | 1h |
| GAP-044-08 | `z.string()` → `z.enum()` in response | Use enum for status field | 15 min |
| GAP-044-11 | JSONB type assertions | Add Zod runtime validation for JSONB columns | 30 min |
| GAP-044-12 | Display value "Cancelled" → "Canceled" | Update i18n display values | 5 min |
| GAP-044-13 | setup.ts mock missing `deletedAt` | Add `deletedAt: 'deleted_at'` | 2 min |
| GAP-044-14 | Test mock uses `'cancelled'` | Change to `'canceled'` (includes GAP-044-19 same file) | 2 min |
| GAP-044-15 | Race condition in cancelUserAddon | Add status + deletedAt guards to UPDATE WHERE | 15 min |
| GAP-044-16 | Race condition in expireAddon | Add status + deletedAt guards to UPDATE WHERE | 15 min |
| GAP-044-17 | JSDoc British spelling | Change "cancelled" → "canceled" in JSDoc | 2 min |
| GAP-044-18 | Log messages British spelling | Change "cancelled"/"Cancelled" in 3 log strings | 2 min |
| GAP-044-19 | Test comments British spelling | Fix alongside GAP-044-14 (same file) | 0 min |
| GAP-044-20 | db-mock.ts missing `deletedAt` | Add `deletedAt: 'deleted_at'` | 2 min |
| GAP-044-21 | checkout test mock missing `deletedAt` | Add `deletedAt: 'deleted_at'` | 2 min |
| GAP-044-22 | Response schema missing `deletedAt` | Add field, done alongside GAP-044-01 | 5 min |
| GAP-044-23 | Missing `totalPages` in response | Included in GAP-044-06 | 0 min |
| GAP-044-24 | Entitlement failure blocks expiration | Fallback: log warning + update status anyway | 1h |
| GAP-044-25 | `softDelete()` doesn't set `updatedAt` | Fix BaseModel softDelete/restore | 15 min |
| GAP-044-26 | `restore()` entitlement trap | Add JSDoc warning documenting the trap | 10 min |
| GAP-044-27 | Stale worktree cleanup | `rm -rf .claude/worktrees/agent-aadd9e3f/` | 1 min |
| GAP-044-28 | Migration script idempotency | Add `isNull(deletedAt)` to idempotency check | 10 min |
| GAP-044-30 | orderId UUID mismatch | Fix schema to regex `/^addon_[\w-]+_\d+$/` | 5 min |
| GAP-044-31 | Slug as display name in notifications | Lookup addon name from config | 15 min |
| GAP-044-32 | Dual addon schemas violate SSoT | Consolidate to `@repo/schemas` (resolves GAP-044-44) | 2h |
| GAP-044-33 | Services use local ServiceResult | Migrate to BaseCrudService (granular sub-tasks, resolves GAP-044-43) | 4-6h |
| GAP-044-34 | Admin hooks use `/protected/` tier | Create admin routes + update hooks | 3h |
| GAP-044-35 | Checkout bypasses billing adapter | Migrate to `createMercadoPagoAdapter()` | 30 min |
| GAP-044-36 | No targetCategories validation | Add plan category check in checkout | 30 min |
| GAP-044-37 | UsageTracking reads JSON metadata | Migrate to read from table | 1h |
| GAP-044-38 | Missing admin force expire/activate endpoints | Implement POST endpoints with permission checks | 2h |
| GAP-044-39 | No addon purchase email template | Create purchase confirmation template | 30 min |
| GAP-044-40 | `annualPriceArs` not validated | Add validation in config validator | 15 min |
| GAP-044-41 | DB status no CHECK constraint | Add CHECK constraint via migration | 15 min |
| GAP-044-42 | Admin plan hooks unsafe `as` casts | Add Zod validation in transformations | 45 min |

### NUEVA SPEC (3 gaps → 1 spec)

| Gap | Description | Target Spec |
|-----|-------------|-------------|
| GAP-044-03 | `CancelledIcon` British spelling | Global British→American spelling migration (when subscriptions migrate) |
| GAP-044-04 | Docs reference old spelling | Same spec as GAP-044-03 |
| GAP-044-09 | i18n subscription keys British | Same spec as GAP-044-03 |

### POSTERGAR (1 gap)

| Gap | Description | Reason |
|-----|-------------|--------|
| GAP-044-10 | Missing test edge cases (#1-#6) | Defer edge case tests to testing phase |

### YA FIXED (1 gap)

| Gap | Description | Resolution |
|-----|-------------|------------|
| GAP-044-29 | 100x MercadoPago pricing bug | Fixed: `unit_price: finalPrice / 100` in addon.checkout.ts:189 |

### Estimated Total Effort

- Quick fixes (spelling, mocks, schema tweaks): ~1h
- Medium fixes (race conditions, pagination, config): ~2.5h
- Larger fixes (service refactor, admin routes, schema consolidation): ~13-15h
- **Total estimated: ~17-19h of implementation work**

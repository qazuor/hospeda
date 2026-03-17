# SPEC-044: Gaps Implementation Plan

**Generated:** 2026-03-16
**Status:** Planning (37 gaps across 8 phases)
**Prerequisite:** T-001 through T-020 are complete. T-021 (DB migration apply) is pending.

This document covers the 37 gaps identified during the post-implementation gap analysis.
These are additive improvements on top of the original SPEC-044 scope.

---

## Summary Table

| Phase | Effort | Gaps | Parallel? | Depends On |
|-------|--------|------|-----------|------------|
| Phase 1: Quick Wins (Spelling & Mocks) | ~1h | 9 gaps | No deps | - |
| Phase 2: Schema & Type Safety | ~1h | 4 gaps | Parallel with P1 | - |
| Phase 3: Race Conditions & Resilience | ~1.5h | 3 gaps | Parallel with P1-2 | - |
| Phase 4: Admin Route & Pagination | ~4h | 4 gaps | Needs P1 mocks | Phase 1 |
| Phase 5: Checkout Hardening | ~1.5h | 3 gaps | No deps | - |
| Phase 6: Schema Consolidation | ~5h | 4 gaps | Needs P2 | Phase 2 |
| Phase 7: Service Architecture Refactor | ~6h | 10 sub-tasks | Needs P6 | Phase 6 |
| Phase 8: DB & Misc | ~1h | 7 gaps | Partial (DB needs running DB) | Partial |

**Total estimated effort:** ~21 hours

---

## Critical Path

```
Phase 2 (schema enum fix)
    → Phase 6 (schema consolidation, includes enum)
        → Phase 7 (service refactor using consolidated schemas)
```

Phase 1, 3, and 5 have no dependencies and can start immediately in parallel with Phase 2.
Phase 4 needs Phase 1 mock fixes to avoid test noise.
Phase 8 (non-DB tasks) can run anytime; DB tasks need a running database.

---

## Parallel Tracks Diagram

```
Track A (no deps):   Phase 1 → Phase 4
Track B (no deps):   Phase 2 → Phase 6 → Phase 7
Track C (no deps):   Phase 3
Track D (no deps):   Phase 5
Track E (anytime):   Phase 8 (non-DB tasks)
Track F (needs DB):  T-021 (pending) + Phase 8 DB tasks
```

---

## Phase 1: Quick Wins — Spelling & Mock Fixes

**Effort:** ~1 hour
**Dependencies:** None (start immediately)
**Parallel with:** Phase 2, Phase 3, Phase 5
**Gaps addressed:** GAP-044-05, GAP-044-12, GAP-044-13, GAP-044-14, GAP-044-17, GAP-044-18, GAP-044-19, GAP-044-20, GAP-044-21, GAP-044-27

These are all trivial text changes. Can be done as a single atomic commit.

---

### P1-T001: Update spec metadata status

**Effort:** 5 min
**Gaps:** GAP-044-05
**Files:** `.claude/specs/SPEC-044-addon-purchase-schema-cleanup/metadata.json`

Update the `status` field from `"draft"` to `"in-progress"`.

**Done criteria:** `metadata.json` shows `"status": "in-progress"`.

---

### P1-T002: Fix remaining spelling in test mocks

**Effort:** 15 min
**Gaps:** GAP-044-13, GAP-044-20, GAP-044-21
**Files:**

- `apps/api/test/setup.ts` (line ~158): add `deletedAt: 'deleted_at'` to `billingAddonPurchasesCols`
- `apps/api/test/helpers/mocks/db-mock.ts`: add `deletedAt: 'deleted_at'` to `billingAddonPurchasesCols`
- `apps/api/test/services/addon.checkout.test.ts`: add `deletedAt: 'deleted_at'` to local mock column map

**Implementation:**
In each file, locate the `billingAddonPurchasesCols` mock object (or equivalent local mock) and append the missing column:

```typescript
deletedAt: 'deleted_at',
```

Add this line immediately after the existing `canceledAt: 'canceled_at'` entry.

**Done criteria:** `pnpm test` passes in `apps/api`. No missing column errors in addon-related tests.

---

### P1-T003: Fix "cancelled" spelling in service JSDoc and log messages

**Effort:** 15 min
**Gaps:** GAP-044-14, GAP-044-17, GAP-044-18, GAP-044-19
**Files:**

- `apps/api/src/services/addon-entitlement.service.ts` (lines 5 and 262): JSDoc `"cancelled"` → `"canceled"`
- `apps/api/src/services/addon.user-addons.ts` (lines 314, 324, 366): log message strings `"cancelled"`/`"Cancelled"` → `"canceled"`/`"Canceled"`
- `apps/api/test/services/addon.service.test.ts` (line 1054): `'cancelled'` → `'canceled'`; comments on lines 1050 and 1108

**Implementation:** String replacements only. No logic changes.

**Done criteria:** `rg "cancelled" apps/api/src/services/` returns zero results.

---

### P1-T004: Fix "Cancelled" display values in English i18n

**Effort:** 10 min
**Gaps:** GAP-044-12
**Files:** `packages/i18n/src/locales/en/admin-billing.json`

Change the display *values* (not keys) for the following addon-specific entries:

- `addons.statusCanceled`: `"Cancelled"` → `"Canceled"`
- `addons.purchasedStatuses.canceled`: `"Cancelled"` → `"Canceled"`

**CRITICAL:** Do NOT change the keys (already updated in T-015 of original plan). Do NOT touch `sponsorships.statuses.cancelled` or `subscriptions.statuses.cancelled` — those use British spelling intentionally.

**Done criteria:** `grep "Cancelled" packages/i18n/src/locales/en/admin-billing.json` returns zero results under the `addons` section.

---

### P1-T005: Delete stale worktree directory

**Effort:** 2 min
**Gaps:** GAP-044-27
**Command:** `rm -rf /home/qazuor/projects/WEBS/hospeda/.claude/worktrees/agent-aadd9e3f/`

**Done criteria:** Directory no longer exists.

---

## Phase 2: Schema & Type Safety Fixes

**Effort:** ~1 hour
**Dependencies:** None (start immediately)
**Parallel with:** Phase 1, Phase 3, Phase 5
**Gaps addressed:** GAP-044-08, GAP-044-11, GAP-044-30, GAP-044-40

---

### P2-T001: Strengthen CustomerAddonResponseSchema status field

**Effort:** 10 min
**Gaps:** GAP-044-08
**Files:** `apps/api/src/schemas/customer-addons.schema.ts`

Replace the weak `z.string()` status with a strict enum:

```typescript
// Before
status: z.string(),

// After
status: z.enum(['active', 'expired', 'canceled', 'pending']),
```

**Done criteria:** `pnpm typecheck` passes. Sending an invalid status from the API layer produces a Zod validation error, not a silent pass.

---

### P2-T002: Strengthen PurchaseAddonResponseSchema orderId format

**Effort:** 10 min
**Gaps:** GAP-044-30
**Files:** `apps/api/src/schemas/addon.schema.ts`

Replace the permissive `z.string().uuid()` with a format-specific regex for addon order IDs:

```typescript
// Before
orderId: z.string().uuid(),

// After
orderId: z.string().regex(/^addon_[\w-]+_\d+$/, 'Invalid addon order ID format'),
```

**Done criteria:** `pnpm typecheck` passes. A UUID like `550e8400-e29b-41d4-a716-446655440000` fails validation; `addon_premium-boost_1710000000000` passes.

---

### P2-T003: Add Zod runtime validation for JSONB columns in addon-expiration.service.ts

**Effort:** 30 min
**Gaps:** GAP-044-11
**Files:** `apps/api/src/services/addon-expiration.service.ts`

The service currently does unsafe type casting of JSONB columns `limitAdjustments` and `entitlementAdjustments`. Add runtime Zod validation before casting:

```typescript
// Define schemas (inline or in the schemas package)
const LimitAdjustmentsSchema = z.record(z.string(), z.number()).nullable();
const EntitlementAdjustmentsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable();

// Before casting, validate:
const limitAdjustments = LimitAdjustmentsSchema.parse(row.limitAdjustments);
const entitlementAdjustments = EntitlementAdjustmentsSchema.parse(row.entitlementAdjustments);
```

If validation fails, log a warning with the raw value and skip the record rather than crashing.

**Done criteria:** `pnpm typecheck` passes. Corrupted JSONB data produces a logged warning instead of a runtime exception.

---

### P2-T004: Add annualPriceArs validation for recurring addons in config-validator.ts

**Effort:** 15 min
**Gaps:** GAP-044-40
**Files:** `packages/billing/src/validation/config-validator.ts`

Recurring addons that support annual billing must have `annualPriceArs` defined. Add a `.refine()` check:

```typescript
.refine(
  (config) => config.billingType !== 'recurring' || config.annualPriceArs !== undefined,
  { message: 'annualPriceArs is required for recurring addons', path: ['annualPriceArs'] }
)
```

**Done criteria:** `pnpm typecheck` passes. A recurring addon config without `annualPriceArs` fails validation at startup.

---

## Phase 3: Race Condition & Resilience Fixes

**Effort:** ~1.5 hours
**Dependencies:** None (start immediately)
**Parallel with:** Phase 1, Phase 2, Phase 5
**Gaps addressed:** GAP-044-15, GAP-044-16, GAP-044-24

---

### P3-T001: Harden cancelUserAddon WHERE clause against race conditions

**Effort:** 20 min
**Gaps:** GAP-044-15
**Files:** `apps/api/src/services/addon.user-addons.ts`

The current `cancelUserAddon()` UPDATE only filters by `id`. If two concurrent requests cancel the same purchase, both succeed and both write `status: 'canceled'` (idempotent, but the second is a phantom write). Fix by adding status + deletedAt guards:

```typescript
// In the UPDATE .where() clause, add:
.where(
  and(
    eq(billingAddonPurchases.id, purchaseId),
    eq(billingAddonPurchases.status, 'active'),  // ADD THIS
    isNull(billingAddonPurchases.deletedAt)       // ADD THIS
  )
)
```

After the update, check `result.rowsAffected`. If 0, the purchase was not in `active` state — return an error or log a warning.

**Done criteria:** Concurrent cancel calls are idempotent without silent phantom writes.

---

### P3-T002: Harden expireAddon WHERE clause against race conditions

**Effort:** 20 min
**Gaps:** GAP-044-16
**Files:** `apps/api/src/services/addon-expiration.service.ts`

Same pattern as P3-T001 but for the expiry UPDATE. Add `eq(status, 'active')` and `isNull(deletedAt)` to the UPDATE WHERE clause in `expireAddon()` (line ~458). Check `rowsAffected` to detect phantom writes.

**Done criteria:** Concurrent expiry calls do not produce phantom writes or double-expiry events.

---

### P3-T003: Make entitlement removal non-blocking in expireAddon

**Effort:** 45 min
**Gaps:** GAP-044-24
**Files:** `apps/api/src/services/addon-expiration.service.ts`

Currently if entitlement removal fails, it may block the status update to `'expired'`, leaving the record in a inconsistent state. Apply defensive pattern:

```typescript
try {
  await removeEntitlements(purchase);
} catch (err) {
  // Transient error: log warning, continue with status update
  // The entitlements will be cleaned up on next reconciliation
  logger.warn({ err, purchaseId: purchase.id }, 'Entitlement removal failed during expiry, continuing with status update');
}

// Always update status, even if entitlement removal failed
await db.update(billingAddonPurchases)
  .set({ status: 'expired', updatedAt: new Date() })
  .where(/* ... */);
```

Add a TODO comment to track the deferred entitlement cleanup pattern.

**Done criteria:** An entitlement service failure during expiry does not leave addon purchases stuck in `'active'` state indefinitely.

---

## Phase 4: Admin Route & Pagination Fixes

**Effort:** ~4 hours
**Dependencies:** Phase 1 (mock fixes for test reliability)
**Gaps addressed:** GAP-044-01, GAP-044-06, GAP-044-07, GAP-044-22, GAP-044-23, GAP-044-38

---

### P4-T001: Fix pagination conventions in admin customer-addons

**Effort:** 45 min
**Gaps:** GAP-044-06, GAP-044-23
**Files:**

- `apps/api/src/routes/billing/admin/customer-addons.ts`
- `apps/api/src/schemas/customer-addons.schema.ts` (or equivalent query schema)

The admin customer-addons route currently uses `limit` instead of `pageSize`, violating the project-wide admin pagination convention (`page` + `pageSize`). Also missing `totalPages` in the response.

Changes:

1. Replace `limit` query param with `pageSize` in the route schema.
2. Update the route handler to use `pageSize` in Drizzle `.limit()` call.
3. Add `totalPages` to the response: `Math.ceil(total / pageSize)`.
4. Response schema: add `totalPages: z.number().int()` field.

**Done criteria:** `GET /api/v1/admin/billing/customer-addons?page=2&pageSize=10` returns `{ data, total, page, pageSize, totalPages }`.

---

### P4-T002: Add includeDeleted support to admin customer-addons

**Effort:** 30 min
**Gaps:** GAP-044-01, GAP-044-22
**Files:** `apps/api/src/routes/billing/admin/customer-addons.ts`

The admin route currently always excludes soft-deleted records. Admins need visibility into deleted records.

Changes:

1. Add `includeDeleted: z.boolean().optional().default(false)` to the query schema.
2. In the WHERE conditions array, conditionally include `isNull(billingAddonPurchases.deletedAt)` only when `includeDeleted` is false.
3. Add `deletedAt: z.string().datetime().nullable().optional()` to the response schema.
4. Include `deletedAt` in the SELECT columns.

**Done criteria:** `GET /api/v1/admin/billing/customer-addons?includeDeleted=true` returns soft-deleted records. Without the param (or `false`), they are excluded.

---

### P4-T003: Extract raw Drizzle query into a service method

**Effort:** 60 min
**Gaps:** GAP-044-07
**Files:**

- `apps/api/src/routes/billing/admin/customer-addons.ts` (reads from here)
- `apps/api/src/services/addon.user-addons.ts` (or a new `addon.admin.service.ts`)

The admin customer-addons route has a raw Drizzle query inline. Move the business logic to a service method, following project conventions (thin routes, logic in services).

New service method signature:

```typescript
listAdminCustomerAddons({
  customerId,
  status,
  page,
  pageSize,
  includeDeleted,
}: ListAdminCustomerAddonsParams): Promise<Result<{ data: CustomerAddon[]; total: number; totalPages: number }>>
```

Update the route to call this service method and use `ResponseFactory` for the response.

**Done criteria:** Route file contains no Drizzle imports. Business logic is in the service and covered by unit tests.

---

### P4-T004: Add expire and activate admin endpoints

**Effort:** 90 min
**Gaps:** GAP-044-38
**Files:**

- `apps/api/src/routes/billing/admin/customer-addons.ts`

Add two new admin-only endpoints:

```
POST /api/v1/admin/billing/customer-addons/:id/expire
POST /api/v1/admin/billing/customer-addons/:id/activate
```

Both require `BILLING_MANAGE` permission. The `expire` endpoint calls `expireAddon()` from the expiration service. The `activate` endpoint sets `status: 'active'`, clears `canceledAt`, and re-provisions entitlements.

Each endpoint:

- Validates the purchase exists and belongs to the expected customer (optional: body param for safety)
- Checks the current status is valid for the transition
- Returns the updated purchase record

Add integration tests for both endpoints.

**Done criteria:** Admin panel can manually expire or reactivate an addon purchase via API.

---

## Phase 5: Checkout Hardening

**Effort:** ~1.5 hours
**Dependencies:** None
**Parallel with:** Phase 1, Phase 2, Phase 3
**Gaps addressed:** GAP-044-31, GAP-044-35, GAP-044-36

---

### P5-T001: Replace raw MercadoPago SDK with billing adapter in checkout

**Effort:** 45 min
**Gaps:** GAP-044-35
**Files:** `apps/api/src/services/addon.checkout.ts`

The checkout service uses the raw MercadoPago SDK directly instead of the `createMercadoPagoAdapter()` factory from `@repo/billing`. This violates the Single Source of Truth principle and duplicates payment logic.

Replace:

```typescript
import { MercadoPagoConfig, Preference } from 'mercadopago';
const client = new MercadoPagoConfig({ accessToken });
const preference = new Preference(client);
```

With:

```typescript
import { createMercadoPagoAdapter } from '@repo/billing';
const mpAdapter = createMercadoPagoAdapter({ accessToken });
```

Use the adapter's methods for preference creation. Update tests in `apps/api/test/services/addon.checkout.test.ts` to mock the adapter, not the raw SDK.

**Done criteria:** `addon.checkout.ts` has no direct `mercadopago` SDK imports. `pnpm test` passes.

---

### P5-T002: Add targetCategories validation in checkout

**Effort:** 30 min
**Gaps:** GAP-044-36
**Files:** `apps/api/src/services/addon.checkout.ts`

Some addons are restricted to specific plan categories (e.g., only for `'premium'` customers). Currently `targetCategories` is stored in the addon config but not validated during purchase.

Add validation step:

```typescript
if (addon.targetCategories && addon.targetCategories.length > 0) {
  const customerCategory = await getCustomerPlanCategory(customerId);
  if (!addon.targetCategories.includes(customerCategory)) {
    return { success: false, error: 'ADDON_NOT_AVAILABLE_FOR_PLAN' };
  }
}
```

**Done criteria:** A customer on `'basic'` plan cannot purchase an addon with `targetCategories: ['premium']`. Returns `400 ADDON_NOT_AVAILABLE_FOR_PLAN`.

---

### P5-T003: Fix notification calls to use addon name instead of slug

**Effort:** 15 min
**Gaps:** GAP-044-31
**Files:** `apps/api/src/cron/jobs/addon-expiry.job.ts`

The current code passes `addonName: expiringAddon.addonSlug` to notification calls, sending users a raw slug (e.g., `premium-boost`) instead of a human-readable name (e.g., `Premium Boost`).

Fix:

```typescript
// Before
addonName: expiringAddon.addonSlug,

// After
const addonConfig = getAddonBySlug(expiringAddon.addonSlug);
addonName: addonConfig?.name ?? expiringAddon.addonSlug,
```

Import `getAddonBySlug` from `@repo/billing`.

**Done criteria:** Expiry notification emails show the addon display name, not the slug.

---

## Phase 6: Schema Consolidation & Admin Tier Fix

**Effort:** ~5 hours
**Dependencies:** Phase 2 (enum fix should be part of consolidated schema)
**Gaps addressed:** GAP-044-32, GAP-044-34, GAP-044-42, GAP-044-44

This is the most architecturally significant phase. Plan carefully before executing.

---

### P6-T001: Consolidate addon schemas into @repo/schemas

**Effort:** 2.5 hours
**Gaps:** GAP-044-32, GAP-044-44
**Files:**

- CREATE: `packages/schemas/src/billing/addon-purchase.schema.ts`
- DELETE: `apps/api/src/schemas/addon.schema.ts`
- UPDATE: All files that import from `apps/api/src/schemas/addon.schema.ts`

Currently addon validation schemas exist in two places: `apps/api/src/schemas/addon.schema.ts` and `apps/api/src/schemas/customer-addons.schema.ts`. These should live in `@repo/schemas` as the Single Source of Truth.

Steps:

1. Create `packages/schemas/src/billing/addon-purchase.schema.ts` with all addon-related schemas (merge both files), using the Phase 2 enum fixes (status as `z.enum`).
2. Export from `packages/schemas/src/index.ts`.
3. Update all API route and service imports to use `@repo/schemas` instead of local schema files.
4. Delete `apps/api/src/schemas/addon.schema.ts`.
5. Update `apps/api/src/schemas/customer-addons.schema.ts` to re-export from `@repo/schemas` OR delete and update all consumers.
6. Ensure validation error messages use i18n keys for consistency.

**Done criteria:** `find apps/api/src -name "addon.schema.ts"` returns nothing. All addon schema imports resolve to `@repo/schemas`.

---

### P6-T002: Create admin billing routes for addons and plans

**Effort:** 2 hours
**Gaps:** GAP-044-34
**Files:**

- CREATE: `apps/api/src/routes/billing/admin/addons.ts`
- CREATE: `apps/api/src/routes/billing/admin/plans.ts`
- UPDATE: `apps/api/src/routes/billing/index.ts` (register new routes)
- UPDATE: `apps/admin/src/lib/billing-http-adapter/` (update hooks to use admin endpoints)

Currently the admin panel consumes `/api/v1/billing/plans` and `/api/v1/billing/addons` which are public/protected tier routes — no admin permission checks. This is a security gap.

Create:

```
GET /api/v1/admin/billing/addons    - list all addons (requires BILLING_READ)
GET /api/v1/admin/billing/addons/:slug  - get addon details
GET /api/v1/admin/billing/plans     - list all plans (requires BILLING_READ)
GET /api/v1/admin/billing/plans/:id - get plan details
```

Update admin hooks in `apps/admin` to use `/api/v1/admin/billing/` endpoints instead of the public ones.

**Done criteria:** Admin panel cannot access billing data without `BILLING_READ` permission. Public `/api/v1/billing/addons` remains unchanged for the web app.

---

### P6-T003: Add Zod validation in admin plan hooks to replace unsafe casts

**Effort:** 30 min
**Gaps:** GAP-044-42
**Files:** `apps/admin/src/lib/billing-http-adapter/` (hooks for plans)

The `transformPlanRecord` function uses `as PlanRecord` casting without runtime validation. Replace with Zod parsing:

```typescript
// Before
return data as PlanRecord;

// After
const result = PlanRecordSchema.safeParse(data);
if (!result.success) {
  logger.warn({ errors: result.error.issues }, 'Invalid plan record from API');
  throw new Error('Invalid plan data received from API');
}
return result.data;
```

**Done criteria:** Malformed API responses produce a logged warning and a user-visible error, not a silent runtime type violation.

---

## Phase 7: Service Architecture Refactor

**Effort:** ~6 hours
**Dependencies:** Phase 6 (schema consolidation should be complete first)
**Gaps addressed:** GAP-044-33, GAP-044-43

This phase migrates addon services to the standard `BaseCrudService` + `Result<T>` pattern used across the rest of the codebase. It replaces the local `ServiceResult<T>` type from `addon.types.ts`.

**IMPORTANT:** These sub-tasks are ordered. Each depends on the previous. Do not parallelize within Phase 7.

---

### P7-T001: Create AddonServiceResult discriminated union as bridge type

**Effort:** 30 min
**Gaps:** GAP-044-33 (partial)
**Files:** `apps/api/src/services/addon.types.ts`

Before migrating services, create a `AddonServiceResult<T>` discriminated union that is compatible with `Result<T>` from `@repo/service-core`. This acts as a bridge while migrating:

```typescript
// Temporary bridge - will be deleted in P7-T008
export type AddonServiceResult<T> = Result<T>; // re-export alias
```

This allows incremental migration without a flag day.

**Done criteria:** `pnpm typecheck` passes. No services broken.

---

### P7-T002: Migrate addon.service.ts to BaseCrudService + Result<T>

**Effort:** 45 min
**Gaps:** GAP-044-33
**Files:** `apps/api/src/services/addon.service.ts`

Extend `BaseCrudService` from `@repo/service-core`. Replace `ServiceResult<T>` return types with `Result<T>`. Use `runWithLoggingAndValidation()` for automatic logging.

**Done criteria:** `addon.service.ts` extends `BaseCrudService`. All methods return `Result<T>`. `pnpm typecheck` passes.

---

### P7-T003: Migrate addon.checkout.ts to Result<T> pattern

**Effort:** 30 min
**Gaps:** GAP-044-33
**Files:** `apps/api/src/services/addon.checkout.ts`

Replace `ServiceResult<T>` return types with `Result<T>` from `@repo/service-core`.

**Done criteria:** `addon.checkout.ts` returns `Result<T>`. `pnpm typecheck` passes.

---

### P7-T004: Migrate addon.user-addons.ts to BaseCrudService + Result<T>

**Effort:** 60 min
**Gaps:** GAP-044-33
**Files:** `apps/api/src/services/addon.user-addons.ts`

Extend `BaseCrudService`. Replace all `ServiceResult<T>` with `Result<T>`. This service has the most methods, so careful migration.

**Done criteria:** `addon.user-addons.ts` extends `BaseCrudService`. `pnpm typecheck` passes.

---

### P7-T005: Migrate addon-entitlement.service.ts to Result<T>

**Effort:** 45 min
**Gaps:** GAP-044-33
**Files:** `apps/api/src/services/addon-entitlement.service.ts`

Replace `ServiceResult<T>` with `Result<T>`.

**Done criteria:** `pnpm typecheck` passes.

---

### P7-T006: Migrate addon-expiration.service.ts to Result<T>

**Effort:** 45 min
**Gaps:** GAP-044-33
**Files:** `apps/api/src/services/addon-expiration.service.ts`

Replace `ServiceResult<T>` with `Result<T>`.

**Done criteria:** `pnpm typecheck` passes.

---

### P7-T007: Migrate BillingMetricsService to Result<T>

**Effort:** 30 min
**Gaps:** GAP-044-43
**Files:** `apps/api/src/services/billing-metrics.service.ts`

Replace the local `ServiceResult<T>` with standard `Result<T>` from `@repo/service-core`.

**Done criteria:** `pnpm typecheck` passes.

---

### P7-T008: Delete addon.types.ts ServiceResult type

**Effort:** 15 min
**Gaps:** GAP-044-33
**Files:**

- DELETE: `apps/api/src/services/addon.types.ts` (or remove `ServiceResult` from it if other types remain)
- UPDATE: `apps/api/src/services/index.ts` (remove export if applicable)

Only delete after all consumers have been migrated (P7-T002 through P7-T007).

**Done criteria:** `rg "ServiceResult" apps/api/src/services/` returns zero results.

---

### P7-T009: Update all route handlers for new Result<T> return types

**Effort:** 60 min
**Gaps:** GAP-044-33
**Files:** All route files that consume addon services

After changing service return types, route handlers that destructured `{ success, data, error }` from `ServiceResult` need to use `Result<T>` shape. Use `ResponseFactory` for consistent response formatting.

**Done criteria:** `pnpm typecheck` passes across all route files. `pnpm test` passes.

---

### P7-T010: Update all test files for new service patterns

**Effort:** 60 min
**Gaps:** GAP-044-33
**Files:** All test files that test addon services

Update mock return values from `{ success: true, data: ... }` (ServiceResult shape) to `{ ok: true, value: ... }` (Result<T> shape from service-core, verify exact shape).

**Done criteria:** `pnpm test` passes with >= 90% coverage on addon service files.

---

## Phase 8: DB & Misc Tasks

**Effort:** ~1 hour
**Dependencies:** Mixed (see individual tasks)
**Gaps addressed:** GAP-044-02, GAP-044-25, GAP-044-26, GAP-044-28, GAP-044-37, GAP-044-39, GAP-044-41

---

### P8-T001: Apply migration to dev database (T-021 prerequisite)

**Effort:** 10 min
**Gaps:** GAP-044-02
**Requires:** Running PostgreSQL database
**Note:** This is the existing T-021 from the original plan, still pending.

Run `pnpm db:migrate` and verify:

```sql
-- Column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'billing_addon_purchases'
ORDER BY ordinal_position;

-- No British spelling rows
SELECT COUNT(*) FROM billing_addon_purchases WHERE status = 'cancelled';

-- Data preserved
SELECT COUNT(*) FROM billing_addon_purchases WHERE canceled_at IS NOT NULL;
```

**Done criteria:** `deleted_at` and `canceled_at` columns exist. Zero rows with `status = 'cancelled'`.

---

### P8-T002: Add CHECK constraint migration for status column

**Effort:** 20 min
**Gaps:** GAP-044-41
**Requires:** Running PostgreSQL database (run after P8-T001)
**Files:**

- CREATE: `packages/db/src/migrations/XXXX_addon_purchases_status_check.sql`

Generate or manually create a migration adding a CHECK constraint:

```sql
ALTER TABLE billing_addon_purchases
  ADD CONSTRAINT billing_addon_purchases_status_check
  CHECK (status IN ('active', 'expired', 'canceled', 'pending'));
```

This prevents any future code from writing invalid status values at the DB level.

**Done criteria:** Attempting `UPDATE billing_addon_purchases SET status = 'cancelled'` fails with a constraint violation.

---

### P8-T003: Fix migration script idempotency check

**Effort:** 15 min
**Gaps:** GAP-044-28
**Files:** `packages/db/src/billing/migrate-addon-purchases.ts`

The idempotency check query currently does not filter by `deletedAt IS NULL`, meaning a soft-deleted record could cause the migration to skip when it should run.

Add `isNull(billingAddonPurchases.deletedAt)` (or SQL equivalent) to the check query WHERE clause.

**Done criteria:** Running the migration twice on a dataset with soft-deleted records still applies correctly to active records.

---

### P8-T004: Fix BaseModel.softDelete() and restore() to set updatedAt

**Effort:** 20 min
**Gaps:** GAP-044-25, GAP-044-26
**Files:** The `BaseModel` class in `@repo/db` (or `@repo/service-core`)

`softDelete()` sets `deletedAt` but does not update `updatedAt`, creating an inconsistency in audit logs.
`restore()` similarly forgets `updatedAt`.

Fix both methods to always set `updatedAt: new Date()` alongside the deletion/restoration timestamp.

Also add a JSDoc warning on `restore()`:

```typescript
/**
 * Restores a soft-deleted record.
 *
 * WARNING for addon purchases: restoring does NOT re-provision entitlements.
 * If you restore a billing_addon_purchase, you must manually call
 * addonEntitlementService.provisionEntitlements() to restore user access.
 * Failing to do so leaves the customer paying for an addon without access.
 */
```

**Done criteria:** `pnpm typecheck` passes. A soft-deleted record has the same `updatedAt` as `deletedAt`.

---

### P8-T005: Migrate UsageTrackingService to read from billing_addon_purchases table

**Effort:** 45 min
**Gaps:** GAP-044-37
**Files:** `apps/api/src/services/usage-tracking.service.ts`

`getAddonAdjustments()` currently reads adjustment data from JSON metadata stored in a generic field. This should read from the structured `billing_addon_purchases` table instead.

Migration path:

1. Query `billing_addon_purchases` where `status = 'active'` and `isNull(deletedAt)`.
2. Join with addon config to get `limitAdjustments` and `entitlementAdjustments`.
3. Remove the JSON metadata parsing path (or keep as fallback during transition).

**Done criteria:** `pnpm test` passes. Addon adjustments are sourced from the structured table, not untyped JSON.

---

### P8-T006: Create ADDON_PURCHASE email template

**Effort:** 30 min
**Gaps:** GAP-044-39
**Files:**

- CREATE: `packages/notifications/src/templates/addon-purchase.template.ts`
- UPDATE: `packages/notifications/src/index.ts` (export)

Create an email template for addon purchase confirmations. The template should accept:

```typescript
interface AddonPurchaseNotificationData {
  customerName: string;
  addonName: string;
  addonDescription: string;
  expiresAt: Date | null;  // null for lifetime addons
  orderId: string;
  amount: number;          // in centavos
  currency: 'ARS';
}
```

Follow the existing notification template pattern in the package.

**Done criteria:** `pnpm typecheck` passes. Template renders correctly in the notification system.

---

## Execution Order Recommendation

Given the dependency graph, execute phases in this order for maximum parallelism:

### Day 1 (parallel start)

- **Track A:** Phase 1 (Quick Wins, ~1h) — immediately actionable, no deps
- **Track B:** Phase 2 (Schema Safety, ~1h) — immediately actionable, needed for Phase 6
- **Track C:** Phase 3 (Race Conditions, ~1.5h) — immediately actionable
- **Track D:** Phase 5 (Checkout Hardening, ~1.5h) — immediately actionable

### Day 1-2 (after Phase 1 completes)

- **Track A continues:** Phase 4 (Admin Routes, ~4h)

### Day 2 (after Phase 2 completes)

- **Track B continues:** Phase 6 (Schema Consolidation, ~5h)

### Day 3 (after Phase 6 completes)

- **Track B continues:** Phase 7 (Service Refactor, ~6h, sequential sub-tasks)

### Anytime (requires running DB)

- Phase 8 DB tasks: P8-T001, P8-T002, P8-T003

### Anytime (no DB needed)

- Phase 8 non-DB tasks: P8-T004, P8-T005, P8-T006

---

## Quality Gates

Before marking any phase complete:

1. `pnpm typecheck` — zero errors across monorepo
2. `pnpm lint` — zero biome errors
3. `pnpm test` — all tests pass, >= 90% coverage on modified files
4. Phase-specific grep checks (see individual tasks)

---

## Gaps Reference Index

| Gap ID | Phase | Task | Description |
|--------|-------|------|-------------|
| GAP-044-01 | Phase 4 | P4-T002 | Add includeDeleted to admin customer-addons |
| GAP-044-02 | Phase 8 | P8-T001 | Apply migration to dev DB |
| GAP-044-05 | Phase 1 | P1-T001 | Update metadata.json status |
| GAP-044-06 | Phase 4 | P4-T001 | Rename limit → pageSize |
| GAP-044-07 | Phase 4 | P4-T003 | Extract Drizzle query to service |
| GAP-044-08 | Phase 2 | P2-T001 | Status enum in CustomerAddonResponseSchema |
| GAP-044-11 | Phase 2 | P2-T003 | Zod validation for JSONB columns |
| GAP-044-12 | Phase 1 | P1-T004 | Fix English i18n display values |
| GAP-044-13 | Phase 1 | P1-T002 | Add deletedAt to test/setup.ts mock |
| GAP-044-14 | Phase 1 | P1-T003 | Fix 'cancelled' in addon.service.test.ts |
| GAP-044-15 | Phase 3 | P3-T001 | Harden cancelUserAddon WHERE clause |
| GAP-044-16 | Phase 3 | P3-T002 | Harden expireAddon WHERE clause |
| GAP-044-17 | Phase 1 | P1-T003 | Fix JSDoc in addon-entitlement.service.ts |
| GAP-044-18 | Phase 1 | P1-T003 | Fix log messages in addon.user-addons.ts |
| GAP-044-19 | Phase 1 | P1-T003 | Fix comments in addon.service.test.ts |
| GAP-044-20 | Phase 1 | P1-T002 | Add deletedAt to db-mock.ts |
| GAP-044-21 | Phase 1 | P1-T002 | Add deletedAt to addon.checkout.test.ts mock |
| GAP-044-22 | Phase 4 | P4-T002 | Add deletedAt to response schema |
| GAP-044-23 | Phase 4 | P4-T001 | Add totalPages to admin response |
| GAP-044-24 | Phase 3 | P3-T003 | Make entitlement removal non-blocking |
| GAP-044-25 | Phase 8 | P8-T004 | Fix BaseModel.softDelete() updatedAt |
| GAP-044-26 | Phase 8 | P8-T004 | Add JSDoc warning on BaseModel.restore() |
| GAP-044-27 | Phase 1 | P1-T005 | Delete stale worktree |
| GAP-044-28 | Phase 8 | P8-T003 | Add isNull to migration idempotency check |
| GAP-044-30 | Phase 2 | P2-T002 | Fix orderId regex in PurchaseAddonResponseSchema |
| GAP-044-31 | Phase 5 | P5-T003 | Fix addon name vs slug in notifications |
| GAP-044-32 | Phase 6 | P6-T001 | Consolidate addon schemas to @repo/schemas |
| GAP-044-33 | Phase 7 | P7-T001..P7-T010 | Migrate services to BaseCrudService + Result<T> |
| GAP-044-34 | Phase 6 | P6-T002 | Create admin billing routes |
| GAP-044-35 | Phase 5 | P5-T001 | Use createMercadoPagoAdapter in checkout |
| GAP-044-36 | Phase 5 | P5-T002 | Add targetCategories validation in checkout |
| GAP-044-37 | Phase 8 | P8-T005 | Migrate UsageTrackingService to DB table |
| GAP-044-38 | Phase 4 | P4-T004 | Add expire/activate admin endpoints |
| GAP-044-39 | Phase 8 | P8-T006 | Create ADDON_PURCHASE email template |
| GAP-044-40 | Phase 2 | P2-T004 | Add annualPriceArs validation for recurring addons |
| GAP-044-41 | Phase 8 | P8-T002 | Add CHECK constraint migration |
| GAP-044-42 | Phase 6 | P6-T003 | Replace unsafe casts in admin plan hooks |
| GAP-044-43 | Phase 7 | P7-T007 | Migrate BillingMetricsService to Result<T> |
| GAP-044-44 | Phase 6 | P6-T001 | Unify validation messages with i18n keys |

# Plan: Billing System Audit Fixes

## Context

An exhaustive audit of the billing/monetization system identified 13 confirmed issues across the monorepo. Five items from the original report were invalidated (pricing pages, notification templates, rate limiting, sponsorship seeds, and promo code tests already exist). This plan addresses all remaining issues organized into 6 phases ordered by priority and dependency.

## Updated Report Corrections

Before starting fixes, the report file at `.claude/reports/billing-system-audit.md` needs updating to remove the 5 invalidated findings:

- ~~H-002~~: Pricing pages exist at `apps/web/src/pages/precios/propietarios.astro` and `turistas.astro`
- ~~H-003~~: 12 notification templates exist in `packages/notifications/src/templates/`
- ~~M-005~~: Sponsorship seeds exist (`sponsorshipLevels.seed.ts`, `sponsorshipPackages.seed.ts`)
- ~~M-006~~: Rate limiting implemented in `apps/api/src/middlewares/rate-limit.ts`
- H-001 scope narrowed: promo code tests exist in `config-validator.test.ts`

---

## Phase 1: Critical DB Fixes + Security (3 tasks)

### T-01: Fix `discountValue` type in owner_promotion schema [C-001]

**Effort**: M | **Risk**: Medium (requires migration)

**Analysis**: `discountValue` uses `numeric` (returns string in JS) while all other monetary fields use `integer`. The `OwnerPromotionDiscountTypeEnum` has 3 values: `PERCENTAGE` (e.g., 20 = 20%), `FIXED` (amount in centavos), `FREE_NIGHT` (count). All current usage shows integer values. Changing to `integer` is safe.

**Files to modify**:

- `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts:30` - change `numeric('discount_value')` to `integer('discount_value')`
- Generate migration with `pnpm db:generate`
- Check/update Zod schema: `packages/schemas/src/entities/owner-promotion/owner-promotion.schema.ts:39`
- Check/update service: `packages/service-core/src/services/owner-promotion/owner-promotion.service.ts`
- Check/update admin columns: `apps/admin/src/features/owner-promotions/config/owner-promotions.columns.ts`

**Commit**: `fix(db): standardize discountValue to integer type in owner_promotion schema`

### T-02: Fix broken audit trail in notification_log [C-002]

**Effort**: S | **Risk**: Low

**Files to modify**:

- `packages/db/src/schemas/billing/billing_notification_log.dbschema.ts:12-14` - change `onDelete: 'set null'` to `onDelete: 'restrict'`
- Generate migration with `pnpm db:generate`

**Commit**: `fix(db): change notification_log customerId to restrict on delete for audit integrity`

### T-03: Fix error message leak in plan-change API [M-004]

**Effort**: S | **Risk**: Low

**File to modify**:

- `apps/api/src/routes/billing/plan-change.ts:213-216` - replace `Failed to change plan: ${errorMessage}` with generic message

**Pattern** (from existing `billing-error-handler.ts`):

```typescript
throw new HTTPException(500, {
    message: 'Failed to change plan. Please try again or contact support.'
});
```

**Commit**: `fix(api): sanitize error messages in billing plan-change endpoint`

---

## Phase 2: Database Indexes (1 task)

### T-04: Add missing indexes to sponsorship tables [H-004]

**Effort**: M | **Risk**: Low

**Current state**:

- `sponsorship_package`: 2 indexes (isActive, deletedAt)
- `sponsorship_level`: 4 indexes (targetType, tier, isActive, deletedAt)
- Compare: `billing_addon_purchase` has 7 indexes including composites

**Files to modify**:

- `packages/db/src/schemas/sponsorship/sponsorship_package.dbschema.ts` - add indexes:
  - `sponsorshipPackages_slug_idx` on `slug` (URL routing lookups)
  - `sponsorshipPackages_sortOrder_idx` on `sortOrder` (display ordering)
  - `sponsorshipPackages_isActive_deletedAt_idx` composite (common filter pattern)
- `packages/db/src/schemas/sponsorship/sponsorship_level.dbschema.ts` - add indexes:
  - `sponsorshipLevels_slug_idx` on `slug` (if slug column exists)
  - `sponsorshipLevels_targetType_tier_idx` composite (common filter pattern)
  - `sponsorshipLevels_sortOrder_idx` on `sortOrder`
- Generate migration with `pnpm db:generate`

**Commit**: `perf(db): add missing indexes to sponsorship tables for query optimization`

---

## Phase 3: Test Coverage (2 tasks)

### T-05: Write tests for billing constants [H-001a]

**Effort**: S | **Risk**: None

**File to create**: `packages/billing/test/constants.test.ts`

**Test cases**:

- Verify trial days are positive integers
- Verify grace period is positive
- Verify retry attempts is reasonable (1-10)
- Verify cache TTLs are positive and sensible ranges
- Verify default currency is valid ISO code
- Verify timeout values are reasonable

**Existing pattern**: Follow `packages/billing/test/plans.test.ts` structure

**Commit**: `test(billing): add tests for billing constants validation`

### T-06: Write tests for sponsorship level/package configs [H-001b]

**Effort**: S | **Risk**: None

**Analysis**: Sponsorship data lives in seed JSON files (`packages/seed/src/data/sponsorshipLevel/`, `packages/seed/src/data/sponsorshipPackage/`), not in billing config. Tests should validate seed data integrity.

**File to create**: `packages/seed/test/sponsorship-seeds.test.ts`

**Test cases**:

- Verify all JSON seed files parse correctly
- Verify priceAmount is positive integer (centavos)
- Verify required fields are present
- Verify sortOrder is unique within each category
- Verify isActive is boolean

**Commit**: `test(seed): add validation tests for sponsorship seed data`

---

## Phase 4: Code Quality & Standards (4 tasks)

### T-07: Translate billing config text to English [M-001]

**Effort**: M | **Risk**: Low

**Files to modify** (all `name`/`description` fields):

- `packages/billing/src/config/addons.config.ts` (5 addons)
- `packages/billing/src/config/plans.config.ts` (9 plans)
- `packages/billing/src/config/limits.config.ts` (6 limits)
- `packages/billing/src/config/entitlements.config.ts` (38 entitlements)
- `packages/billing/src/config/promo-codes.config.ts` (3 promo codes)

**Important**: These are internal config identifiers. User-facing display text should come from i18n translations (which already exist in `packages/i18n/src/locales/es/billing.json`).

**Also update**: Seed files that consume these configs will pick up changes automatically.

**Also update tests**: `packages/billing/test/` test files that assert on specific name/description strings.

**Commit**: `refactor(billing): translate config text to English per coding standards`

### T-08: Remove unused PromoCodeConditionType [M-002]

**Effort**: S | **Risk**: None

**File to modify**: `packages/billing/src/config/promo-codes.config.ts` - remove the `PromoCodeConditionType` type definition

**Commit**: `refactor(billing): remove unused PromoCodeConditionType`

### T-09: Add missing JSDoc to billing helpers [L-001]

**Effort**: S | **Risk**: None

**Files to modify**:

- `packages/billing/src/config/addons.config.ts` - `getAddonBySlug()`
- `packages/billing/src/config/plans.config.ts` - `getPlanBySlug()`, `getDefaultPlan()`, other helpers
- `packages/billing/src/config/entitlements.config.ts` - any exported helpers

**Commit**: `docs(billing): add JSDoc to exported helper functions`

### T-10: Fix addon targetCategories type [L-003]

**Effort**: S | **Risk**: Low

**File to modify**: `packages/billing/src/types/addon.types.ts:32`

- Change `targetCategories: ('owner' | 'complex')[]` to `targetCategories: PlanCategory[]`
- Import `PlanCategory` from `./plan.types.js`

**Commit**: `refactor(billing): use PlanCategory type for addon targetCategories`

---

## Phase 5: Admin i18n Integration (1 task, 3 batches)

### T-11: Add i18n to admin billing pages [H-005]

**Effort**: L | **Risk**: Medium (large scope, 13 files)

**i18n pattern** (from existing admin pages):

```tsx
import { useTranslations } from '@repo/i18n';
// ...
const { t } = useTranslations();
// Usage: t('billing.plans.title')
```

**Existing translations**: `packages/i18n/src/locales/es/billing.json` (246 lines) and `en/billing.json`

**Batch 1 - Core pages** (highest traffic):

- `apps/admin/src/routes/_authed/billing/plans.tsx`
- `apps/admin/src/routes/_authed/billing/subscriptions.tsx`
- `apps/admin/src/routes/_authed/billing/invoices.tsx`
- `apps/admin/src/routes/_authed/billing/payments.tsx`

**Batch 2 - Management pages**:

- `apps/admin/src/routes/_authed/billing/addons.tsx`
- `apps/admin/src/routes/_authed/billing/promo-codes.tsx`
- `apps/admin/src/routes/_authed/billing/owner-promotions.tsx`
- `apps/admin/src/routes/_authed/billing/sponsorships.tsx`

**Batch 3 - Operations pages**:

- `apps/admin/src/routes/_authed/billing/metrics.tsx`
- `apps/admin/src/routes/_authed/billing/settings.tsx`
- `apps/admin/src/routes/_authed/billing/notification-logs.tsx`
- `apps/admin/src/routes/_authed/billing/webhook-events.tsx`
- `apps/admin/src/routes/_authed/billing/cron.tsx`

**Note**: May need to add new translation keys to `packages/i18n/src/locales/*/billing.json` for admin-specific strings not already covered.

**Commits**: One per batch:

- `feat(admin): add i18n to core billing pages (plans, subscriptions, invoices, payments)`
- `feat(admin): add i18n to billing management pages (addons, promos, promotions, sponsorships)`
- `feat(admin): add i18n to billing operations pages (metrics, settings, logs, webhooks, cron)`

---

## Phase 6: UX & Architecture Improvements (3 tasks)

### T-12: Add static data fallback warning in admin [H-006]

**Effort**: S | **Risk**: Low

**File to modify**: `apps/admin/src/routes/_authed/billing/plans.tsx`

Add a warning banner when `data?.items` is falsy (falling back to `ALL_PLANS`):

```tsx
{!data?.items && !isLoading && (
    <Alert variant="warning">
        {t('billing.fallbackWarning')}
    </Alert>
)}
```

**Also check**: Other admin billing pages that may have similar fallback patterns.

**Commit**: `feat(admin): show warning when billing data falls back to static config`

### T-13: Add annual pricing support to addons [M-003]

**Effort**: M | **Risk**: Low

**Files to modify**:

- `packages/billing/src/types/addon.types.ts` - add `annualPriceArs: number | null` to `AddonDefinition`
- `packages/billing/src/config/addons.config.ts` - add `annualPriceArs` to each addon (null for one-time, calculated for recurring)
- `packages/billing/test/addons.test.ts` - update tests
- `packages/billing/src/validation/index.ts` - update Zod validation if applicable

**Commit**: `feat(billing): add annual pricing support for recurring addons`

### T-14: Add config drift detection [M-007]

**Effort**: M | **Risk**: Low

**File to create**: `packages/billing/src/utils/config-drift-check.ts`

**Implementation**:

- Function that compares static config (plans, addons, entitlements) against DB state
- Returns list of drifted items (missing in DB, different values, extra in DB)
- Can be run as CLI script or at app startup in development
- Log warnings for any detected drift

**Also create**: `packages/billing/test/utils/config-drift-check.test.ts`

**Commit**: `feat(billing): add config drift detection utility`

---

## Phase 7: Report Update (1 task)

### T-15: Update audit report with corrections

**Effort**: S | **Risk**: None

**File to modify**: `.claude/reports/billing-system-audit.md`

- Mark H-002, H-003, M-005, M-006 as RESOLVED/INVALID with explanation
- Narrow H-001 scope (promo code tests exist)
- Add "Corrections" section documenting what was found to already exist
- Update findings count in executive summary

**Commit**: `docs: update billing audit report with corrected findings`

---

## Execution Summary

| Phase | Tasks | Effort | Dependencies |
|-------|-------|--------|-------------|
| 1. Critical + Security | T-01, T-02, T-03 | S+S+S | None |
| 2. DB Indexes | T-04 | M | None (parallel with Phase 1) |
| 3. Test Coverage | T-05, T-06 | S+S | None (parallel with Phase 1-2) |
| 4. Code Quality | T-07, T-08, T-09, T-10 | M+S+S+S | T-05, T-06 must pass first |
| 5. Admin i18n | T-11 (3 batches) | L | T-07 (English config text) |
| 6. UX & Architecture | T-12, T-13, T-14 | S+M+M | T-11 batch 1 (for T-12 i18n) |
| 7. Report Update | T-15 | S | All phases complete |

**Total**: 15 tasks across 7 phases
**Parallelizable**: Phases 1, 2, 3 can run in parallel. Phase 4 after Phase 3. Phase 5 after Phase 4 T-07. Phase 6 after Phase 5 batch 1.

## Verification

After all phases:

1. **Run full test suite**: `pnpm test` across all packages
2. **Type checking**: `pnpm typecheck` must pass
3. **Linting**: `pnpm lint` must pass
4. **DB migration test**: `pnpm db:fresh-dev` to verify migrations apply cleanly
5. **Admin smoke test**: Start admin (`pnpm dev:admin`) and verify all 13 billing pages render
6. **API smoke test**: Start API (`pnpm dev`) and hit billing endpoints
7. **Coverage check**: `pnpm test:coverage` - verify 90%+ on billing package

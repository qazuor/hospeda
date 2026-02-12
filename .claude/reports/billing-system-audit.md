# Billing System Audit Report

**Date**: 2026-02-10
**Updated**: 2026-02-11
**Scope**: Full monetization/billing system across all packages and apps
**Status**: Completed (with remediation)

---

## Executive Summary

Comprehensive audit of the Hospeda billing/monetization system spanning `packages/billing`, `packages/db`, `packages/schemas`, `packages/service-core`, `packages/seed`, `packages/i18n`, `apps/api`, `apps/admin`, and `apps/web`.

**Overall assessment**: The architecture is solid with good error handling, comprehensive entitlements (38 definitions), robust API coverage (8 sub-routers), and zero `any` types.

**Initial audit**: 18 findings (2 critical, 6 high, 7 medium, 3 low)
**After verification**: 5 findings were false positives, leaving 13 confirmed issues
**After remediation**: 12 of 13 issues resolved, 1 deferred (admin i18n)

### Findings Summary

| Severity | Found | False Positive | Confirmed | Fixed | Deferred |
|----------|-------|----------------|-----------|-------|----------|
| CRITICAL | 2 | 0 | 2 | 2 | 0 |
| HIGH | 6 | 3 | 3 | 2 | 1 |
| MEDIUM | 7 | 2 | 5 | 5 | 0 |
| LOW | 3 | 0 | 3 | 3 | 0 |
| **Total** | **18** | **5** | **13** | **12** | **1** |

---

## CRITICAL Findings

### C-001: Price Type Inconsistency in owner_promotion [FIXED]

**File**: `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts`

**Problem**: `discountValue` used `numeric('discount_value')` which returns a string in JS, while all other monetary columns use `integer` (returns number). This causes silent calculation errors like `"5000" + 1000 = "50001000"`.

**Fix applied**: Changed `numeric('discount_value')` to `integer('discount_value')`. Verified the Zod schema (`z.number()`) and admin columns (number formatting) are already aligned. All three discount types (PERCENTAGE, FIXED, FREE_NIGHT) work with integer values.

**Migration needed**: Yes. Run `pnpm db:generate` to create the migration SQL.

---

### C-002: Broken Audit Trail in notification_log [FIXED]

**File**: `packages/db/src/schemas/billing/billing_notification_log.dbschema.ts`

**Problem**: `customerId` FK used `onDelete: 'set null'`, causing billing notification logs to lose customer references when customers are deleted. Breaks audit trail for payment disputes and compliance.

**Fix applied**: Changed `onDelete: 'set null'` to `onDelete: 'restrict'`. Customer deletion is now prevented while notification logs exist.

**Migration needed**: Yes. Run `pnpm db:generate` to create the migration SQL.

---

## HIGH Findings

### H-001: Missing Test Coverage for Critical Billing Modules [FIXED]

**Problem**: Tests were missing for billing constants, sponsorship seed data, and config drift detection.

**Fix applied**:

- Created `packages/billing/test/constants.test.ts` (17 tests) validating trial days, grace period, retry attempts, cache TTLs, currency, and timeouts
- Created `packages/billing/test/sponsorship-seeds.test.ts` (51 tests) validating JSON parsing, required fields, price validation, sort order uniqueness, slug uniqueness, valid tier/targetType values, and cross-reference validation
- Created `packages/billing/test/config-drift-check.test.ts` (9 tests) validating drift detection for plans, addons, entitlements, and limits

**Current test count**: 202 tests, all passing (9 test files)

---

### H-002: No Public Pricing Page [FALSE POSITIVE]

**Correction**: Public pricing pages DO exist at:

- `apps/web/src/pages/precios/propietarios.astro`
- `apps/web/src/pages/precios/turistas.astro`

---

### H-003: No Notification Templates for Billing Events [FALSE POSITIVE]

**Correction**: 12 notification templates exist in `packages/notifications/src/templates/` covering billing events.

---

### H-004: Missing Database Indexes on Sponsorship Tables [FIXED]

**Files**:

- `packages/db/src/schemas/sponsorship/sponsorship_package.dbschema.ts`
- `packages/db/src/schemas/sponsorship/sponsorship_level.dbschema.ts`

**Fix applied**: Added 6 new indexes:

- sponsorship_package: slug, sortOrder, isActive+deletedAt composite
- sponsorship_level: slug, sortOrder, targetType+tier composite

**Migration needed**: Yes. Run `pnpm db:generate` to create the migration SQL.

---

### H-005: Admin Billing Pages Without i18n [DEFERRED]

**Problem**: All 13 admin billing pages have hardcoded Spanish strings despite comprehensive i18n translations existing in `packages/i18n/src/locales/*/billing.json`.

**Status**: Deferred. This requires ~600+ string changes across 13 TSX files. Should be handled as a separate task/epic. The translations already exist in the i18n package.

---

### H-006: Static Data Fallback in Admin When API Fails [ALREADY IMPLEMENTED]

**Correction**: The three pages that use static fallback data already have yellow warning banners:

- `plans.tsx` (line 186): "La API de facturacion no esta disponible. Mostrando datos estaticos..."
- `promo-codes.tsx`: Similar warning banner
- `settings.tsx`: Similar warning banner

Other billing admin pages (invoices, payments, webhook-events, etc.) only fetch from API without static fallback.

---

## MEDIUM Findings

### M-001: Config Text in Spanish [FIXED]

**Files translated**:

- `packages/billing/src/config/addons.config.ts` (5 addons)
- `packages/billing/src/config/plans.config.ts` (9 plans)
- `packages/billing/src/config/limits.config.ts` (6 limits)
- `packages/billing/src/config/entitlements.config.ts` (38 entitlements)
- `packages/billing/src/config/promo-codes.config.ts` (3 promo codes)

**Fix applied**: Translated all `name` and `description` fields from Spanish to English across 61 config entries. Updated corresponding test assertions.

---

### M-002: Unused PromoCodeConditionType [FIXED]

**File**: `packages/billing/src/config/promo-codes.config.ts`

**Fix applied**: Removed the unused `PromoCodeConditionType` type definition.

---

### M-003: Add-ons Lack Annual Pricing Option [FIXED]

**Files**:

- `packages/billing/src/types/addon.types.ts`
- `packages/billing/src/config/addons.config.ts`

**Fix applied**: Added `annualPriceArs: number | null` field to `AddonDefinition` interface. Configured annual pricing for recurring addons with 20% discount:

- `extra-photos-20`: ARS $48,000/year (vs $60,000 monthly total)
- `extra-accommodations-5`: ARS $96,000/year (vs $120,000 monthly total)
- `extra-properties-5`: ARS $192,000/year (vs $240,000 monthly total)
- One-time addons: `annualPriceArs: null`

---

### M-004: Internal Error Message Leak in API [FIXED]

**File**: `apps/api/src/routes/billing/plan-change.ts`

**Fix applied**: Replaced internal error details with a generic message:

```typescript
// Before:
throw new HTTPException(500, { message: `Failed to change plan: ${errorMessage}` });
// After:
throw new HTTPException(500, { message: 'Failed to change plan. Please try again or contact support.' });
```

---

### M-005: Missing Sponsorship Seed Data [FALSE POSITIVE]

**Correction**: Sponsorship seeds exist at:

- `packages/seed/src/required/sponsorshipLevels.seed.ts`
- `packages/seed/src/required/sponsorshipPackages.seed.ts`
- JSON data files in `packages/seed/src/data/sponsorshipLevel/` (5 files) and `packages/seed/src/data/sponsorshipPackage/` (3 files)

---

### M-006: No Rate Limiting on Billing Endpoints [FALSE POSITIVE]

**Correction**: Rate limiting is implemented in `apps/api/src/middlewares/rate-limit.ts` and applied to billing routes.

---

### M-007: Config/DB Synchronization [FIXED]

**Problem**: No mechanism to detect when database billing data drifts from static config.

**Fix applied**: Created `packages/billing/src/utils/config-drift-check.ts` with:

- `checkConfigDrift()` function comparing plans, addons, entitlements, and limits against DB state
- `formatDriftReport()` function for human-readable output
- Exported types: `DriftCheckResult`, `DriftItem`, `DriftSeverity`, `DatabaseState`
- Created `packages/billing/src/utils/index.ts` barrel export
- Added export from `packages/billing/src/index.ts`
- Created test file with 9 tests covering sync, missing-in-db, missing-in-config, orphaned records, empty DB, and mixed drift scenarios

---

## LOW Findings

### L-001: Missing JSDoc on Helper Functions [FIXED]

**Files**:

- `packages/billing/src/config/addons.config.ts` (`getAddonBySlug`)
- `packages/billing/src/config/plans.config.ts` (`getPlanBySlug`, `getDefaultPlan`)

**Fix applied**: Added comprehensive JSDoc with `@param`, `@returns`, `@throws`, and `@example` tags.

---

### L-002: Inconsistent Naming (slug vs id)

**Assessment**: This is a documentation issue, not a code bug. The convention is consistent: `slug` for public-facing identifiers (URL routing), `id` for internal database keys. No code changes needed.

---

### L-003: Limited Add-on Target Categories [FIXED]

**File**: `packages/billing/src/types/addon.types.ts`

**Fix applied**: Changed `targetCategories: ('owner' | 'complex')[]` to `targetCategories: PlanCategory[]`, using the centralized type from `plan.types.ts` that includes `'tourist'`.

---

## Positive Findings

1. **Zero `any` types** across the entire billing codebase
2. **Comprehensive error handling** with `BillingError` class, typed error codes, and Sentry integration
3. **38 entitlement definitions** covering owner, complex, tourist, and accommodation features
4. **8 API sub-routers** with proper middleware chains (auth, billing check, Sentry)
5. **MercadoPago adapter** with proper abstraction layer for payment processing
6. **Config validation** via Zod schemas ensuring data integrity at build time
7. **Billing metrics API** with resilient `Promise.allSettled` pattern
8. **Proper proration handling** for plan upgrades (immediate) vs downgrades (end of period)
9. **Comprehensive i18n translations** (246 lines each for es/en) already prepared
10. **Soft delete patterns** consistently applied across billing entities
11. **Rate limiting** implemented on API routes
12. **Public pricing pages** for both property owners and tourists
13. **12 notification templates** for billing events

---

## Remediation Summary

### Files Modified (12)

- `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts` - C-001 fix
- `packages/db/src/schemas/billing/billing_notification_log.dbschema.ts` - C-002 fix
- `packages/db/src/schemas/sponsorship/sponsorship_package.dbschema.ts` - H-004 fix
- `packages/db/src/schemas/sponsorship/sponsorship_level.dbschema.ts` - H-004 fix
- `apps/api/src/routes/billing/plan-change.ts` - M-004 fix
- `packages/billing/src/types/addon.types.ts` - M-003, L-003 fixes
- `packages/billing/src/config/addons.config.ts` - M-001, M-003, L-001 fixes
- `packages/billing/src/config/plans.config.ts` - M-001, L-001 fixes
- `packages/billing/src/config/limits.config.ts` - M-001 fix
- `packages/billing/src/config/entitlements.config.ts` - M-001 fix
- `packages/billing/src/config/promo-codes.config.ts` - M-001, M-002 fixes
- `packages/billing/src/index.ts` - M-007 export

### Files Created (6)

- `packages/billing/test/constants.test.ts` - 17 tests
- `packages/billing/test/sponsorship-seeds.test.ts` - 51 tests
- `packages/billing/test/config-drift-check.test.ts` - 9 tests
- `packages/billing/src/utils/config-drift-check.ts` - Drift detection utility
- `packages/billing/src/utils/index.ts` - Barrel export
- `.claude/reports/billing-system-audit.md` - This report

### Test Files Updated (2)

- `packages/billing/test/entitlements.test.ts` - Updated assertions for English translations
- `packages/billing/test/plans.test.ts` - Updated assertions for English translations

### Pending Actions

1. **Run `pnpm db:generate`** to generate migration SQL for C-001, C-002, and H-004 schema changes
2. **Run `pnpm db:migrate`** to apply the migrations
3. **Admin i18n (H-005)**: Schedule as separate task (~600+ changes across 13 files)

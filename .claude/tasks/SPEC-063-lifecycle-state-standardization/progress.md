# SPEC-063 — Implementation Progress Log

## Session 1 (2026-04-17)

### Pre-work
- Verified SPEC-062 Phase 0 is merged to main (commit `e80ee559`)
- AdminSchema access schemas for OwnerPromotion, Sponsorship, DestinationReview already contain preemptive `lifecycleState` field
- Confirmed spec dependencies satisfied, safe to proceed
- Generated 58 atomic tasks from SPEC-063 with complexity ceiling 2.5 (per user constraint)
- Execution order follows spec recommendation: Phase 1 -> 2 -> 4 -> 3 -> cleanup

### Completed tasks

#### T-003 — OwnerPromotion Drizzle DB schema
- **File:** `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts`
- Removed `isActive: boolean('is_active').notNull().default(true)` column
- Removed `boolean` import from `drizzle-orm/pg-core` (no longer needed)
- Added `lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE')`
- Imported `LifecycleStatusPgEnum` from `../enums.dbschema.ts`
- Dropped indexes: `ownerPromotions_isActive_idx`, `ownerPromotions_ownerId_isActive_idx`
- Added indexes: `ownerPromotions_lifecycleState_idx`, `ownerPromotions_ownerId_lifecycleState_idx`
- Lint: pass
- Typecheck: deferred (removing `isActive` breaks consumers until T-011/T-014/T-015 update them)

#### T-007 — OwnerPromotion Zod base schema + fixtures
- **Files:**
  - `packages/schemas/src/entities/ownerPromotion/owner-promotion.schema.ts`
  - `packages/schemas/test/fixtures/ownerPromotion.fixtures.ts`
- Base schema: removed `isActive: z.boolean().default(true)`, added `...BaseLifecycleFields` spread
- Imported `BaseLifecycleFields` from `../../common/lifecycle.schema.js`
- BONUS fix: renamed `isActive` to `lifecycleState` in the legacy `OwnerPromotionSearchSchema` that lives in the same file (to keep file coherent). Imported `LifecycleStatusEnumSchema` from `../../enums/lifecycle-state.schema.js`
- Fixtures: 4 occurrences of `isActive` replaced by `lifecycleState` using `LifecycleStatusEnum` (DRAFT/ACTIVE/ARCHIVED). Imported `LifecycleStatusEnum` from `../../src/enums/lifecycle-state.enum.js`
- Lint: pass
- Typecheck: deferred (consumers still reference old field, fixed in T-008/T-009/T-010/T-019/T-020)

### Known typecheck errors (expected, NOT regressions)

The following errors appear in `pnpm typecheck` of `packages/schemas` and will be resolved by the next tasks:

```
src/entities/ownerPromotion/owner-promotion.access.schema.ts(46,5): error TS2322 -> fixed in T-008
src/entities/ownerPromotion/owner-promotion.access.schema.ts(76,5): error TS2322 -> fixed in T-008
src/entities/ownerPromotion/owner-promotion.http.schema.ts(169,9): error TS2353  -> fixed in T-010
src/entities/ownerPromotion/owner-promotion.http.schema.ts(194,49): error TS2339 -> fixed in T-010
src/entities/ownerPromotion/owner-promotion.query.schema.ts(131,5): error TS2322 -> fixed in T-009
src/entities/ownerPromotion/owner-promotion.query.schema.ts(178,5): error TS2322 -> fixed in T-009
test/entities/ownerPromotion/owner-promotion.schema.test.ts(162,36): error TS2339 -> fixed in T-019
test/entities/ownerPromotion/owner-promotion.schema.test.ts(423,43): error TS2339 -> fixed in T-019
```

Additionally, `packages/db` typecheck will fail because `model/ownerPromotion.model.ts` still references `ownerPromotions.isActive` (fixed in T-011). `apps/api/src/services/usage-tracking.service.ts:406` and `apps/api/src/middlewares/limit-enforcement.ts:318` also still reference `isActive: true` (fixed in T-014, T-015).

#### T-008 — OwnerPromotion access + CRUD schemas
- **Files:**
  - `packages/schemas/src/entities/ownerPromotion/owner-promotion.access.schema.ts`
  - `packages/schemas/src/entities/ownerPromotion/owner-promotion.crud.schema.ts` (no changes needed — re-exports from base)
- Public tier: removed `isActive: true` (no replacement — service filters by `lifecycleState=ACTIVE` by default per AC-005-01)
- Protected tier: removed `isActive: true` (no replacement — follows Post access schema convention)
- Admin tier: removed preemptive `lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()` extend (field now in base via `BaseLifecycleFields`)
- Converted `import { z } from 'zod'` to `import type { z } from 'zod'` since only used in `z.infer<...>` after removing the nativeEnum
- Removed unused `LifecycleStatusEnum` import
- Lint: pass
- Typecheck: resolves L46, L76 errors as expected

#### T-009 — OwnerPromotion query + admin-search schemas
- **Files:**
  - `packages/schemas/src/entities/ownerPromotion/owner-promotion.query.schema.ts`
  - `packages/schemas/src/entities/ownerPromotion/owner-promotion.admin-search.schema.ts`
- Query schema: imported `LifecycleStatusEnumSchema`; replaced `isActive: z.boolean().optional()` with `lifecycleState: LifecycleStatusEnumSchema.optional()` in `OwnerPromotionFiltersSchema` AND `OwnerPromotionQuerySchema`; renamed `isActive: true` to `lifecycleState: true` in `OwnerPromotionListItemSchema` and `OwnerPromotionSummarySchema` picks
- Admin-search: removed `isActive: queryBooleanParam()` filter; removed now-unused `queryBooleanParam` import; added JSDoc note pointing to base `status` field handled by `adminList()`
- Lint: pass
- Typecheck: resolves query.schema.ts L131, L178 as expected

#### T-010 — OwnerPromotion HTTP schema + conversion function
- **Files:** `packages/schemas/src/entities/ownerPromotion/owner-promotion.http.schema.ts`
- Imports: added `LifecycleStatusEnum` (enum values) and `LifecycleStatusEnumSchema` (zod)
- `OwnerPromotionSearchHttpSchema`: replaced `isActive: createBooleanQueryParam(...)` with `lifecycleState: LifecycleStatusEnumSchema.optional().describe(...)` — no default here, service injects ACTIVE default in `_executeSearch` per AC-005-01
- `OwnerPromotionCreateHttpSchema`: replaced `isActive: z.coerce.boolean().default(true)` with `lifecycleState: LifecycleStatusEnumSchema.default(LifecycleStatusEnum.ACTIVE)`
- `httpToDomainOwnerPromotionSearch()`: replaced `isActive: httpParams.isActive` with `lifecycleState: httpParams.lifecycleState` (pass-through — enum string, no coercion needed)
- `httpToDomainOwnerPromotionCreate()`: replaced with `lifecycleState: httpData.lifecycleState`
- `httpToDomainOwnerPromotionUpdate()`: replaced with `if (httpData.lifecycleState !== undefined) result.lifecycleState = httpData.lifecycleState`
- `createBooleanQueryParam` import retained (still used by `hasMaxRedemptions`)
- Lint: pass
- Typecheck: resolves http.schema.ts L123, L169, L194 — `packages/schemas` source now 100% clean for OwnerPromotion

### Not yet committed

Changes are in working directory, NOT committed. Current commit boundary: T-003, T-007, T-008, T-009, T-010 — 5 files changed in `packages/schemas` + 1 in `packages/db` + fixtures. `packages/schemas` source is fully typecheck-clean (test errors are T-019/T-020 scope). Good atomic commit here before moving to T-011 (db model).

### Remaining expected typecheck errors (mapped to future tasks)

- `test/entities/ownerPromotion/owner-promotion.schema.test.ts` L162, L423 -> fixed in T-019
- `test/entities/ownerPromotion/owner-promotion.admin-search.schema.test.ts` L178, L181, L277 -> fixed in T-020
- `test/entities/admin-search/group-c.admin-search.schema.test.ts` L109, L147 -> fixed in T-020

Additionally, `packages/db` and `apps/api` will have typecheck errors (documented previously) fixed in T-011 / T-014 / T-015.

### Next up

T-011 (model findActive methods) -> T-012 (service default injection) -> T-014 (usage-tracking) -> T-015 (limit-enforcement). These leave `packages/db` + `apps/api` typecheck-clean.

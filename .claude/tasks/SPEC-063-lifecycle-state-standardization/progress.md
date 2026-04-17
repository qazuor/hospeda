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

#### T-011 — OwnerPromotion model findActive methods
- **File:** `packages/db/src/models/owner-promotion/ownerPromotion.model.ts`
- `findActiveByAccommodationId` (line ~103): replaced `eq(ownerPromotions.isActive, true)` with `eq(ownerPromotions.lifecycleState, 'ACTIVE')`
- `findActiveByOwnerId` (line ~147): same change
- Grep `isActive` on file: 0 matches (clean)
- Lint: pass (`pnpm biome check ...` — 1 file, no fixes)
- Typecheck: **`packages/db` fully clean** — no errors emitted by `pnpm typecheck`. Better than forecast: DB typecheck does not depend on `apps/api`, so the remaining `usage-tracking.service.ts` + `limit-enforcement.ts` errors only surface when typechecking `apps/api` (T-014/T-015 scope).
- Decision: used string literal `'ACTIVE'` (matches existing Drizzle enum usage in codebase), approved by user.

#### T-012 — OwnerPromotion service default lifecycleState injection (AC-005-01)
- **Files:**
  - `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts`
  - `packages/service-core/test/factories/ownerPromotionFactory.ts` *(absorbed into T-012 scope — see note)*
- Service: imported `LifecycleStatusEnum` value; in `_executeSearch`, inject `filterParams.lifecycleState = LifecycleStatusEnum.ACTIVE` when caller did not provide one. Added 3-line comment explaining AC-005-01 and the admin-path exception.
- Factory: replaced 2 `isActive: true` occurrences (OwnerPromotion mock + OwnerPromotionCreateInput mock) with `lifecycleState: LifecycleStatusEnum.ACTIVE`; added `LifecycleStatusEnum` to value import.
- Verified: admin path uses default `_executeAdminSearch` (no override), so only public/protected list() is affected.
- Lint: pass · Typecheck: `packages/service-core` clean for SPEC-063. Remaining error in `test/base/crud/getById.test.ts:379` (DrizzleClient | undefined / unknown) is preexisting from SPEC-066 and unrelated.
- Decision: used enum import `LifecycleStatusEnum.ACTIVE` in service layer (matches http.schema.ts pattern from T-010). Confirmed by user.
- Scope note: `_executeCount` NOT updated — out of AC-005-01 literal scope. Flagged as gap to revisit with T-022 (public endpoint test).
- Scope creep note: factory fix was absorbed into T-012 because (a) it was blocking the whole service-core suite typecheck, (b) no other existing task covered this specific file (T-019/T-020 cover `packages/schemas/test/...`), (c) it preserves the commit boundary "packages/db + apps/api + service-core typecheck clean". Subtask added to state.json to track it. Approved by user.

#### T-014 — usage-tracking service MAX_ACTIVE_PROMOTIONS query
- **File:** `apps/api/src/services/usage-tracking.service.ts`
- Added `LifecycleStatusEnum` to the existing `@repo/schemas` import.
- Line 407 `MAX_ACTIVE_PROMOTIONS` case: `isActive: true` → `lifecycleState: LifecycleStatusEnum.ACTIVE`. The `as never` cast (pre-existing, SPEC-059 generic workaround) preserved.
- Grep `isActive`: 0 matches.
- Lint: pass.

#### T-015 — limit-enforcement middleware promotion count query
- **Files:**
  - `apps/api/src/middlewares/limit-enforcement.ts`
  - `apps/api/test/schema-validation/owner-promotion-getById-schema.test.ts` *(absorbed scope)*
- Middleware: new import `{ LifecycleStatusEnum } from '@repo/schemas'`; line 318 `isActive: true` → `lifecycleState: LifecycleStatusEnum.ACTIVE`.
- Schema validation test: removed `isActive: true` from mock, added `lifecycleState: LifecycleStatusEnum.ACTIVE`. Rationale: test mock was already typecheck-fail PRE-session due to 6 missing fields from pre-existing `OwnerPromotion` type (commits `387295bf` + `03321786` mergeados antes de esta sesión); adding `lifecycleState` + removing `isActive` restores SPEC-063 alignment. The remaining 5 missing audit fields (`ownerId, currentRedemptions, createdAt, updatedAt, createdById, updatedById`) are **pre-existing test infra bug**, flagged below, NOT SPEC-063 scope.
- Grep `isActive`: 0 matches in middleware.
- Lint: pass. `apps/api` typecheck: no SPEC-063-related errors remain (only pre-existing unrelated failures: `accommodation|event|post-getById-schema.test.ts`, `admin-list-routes.test.ts`, `auth/status.ts`, `getBySlug.ts`, `similar.ts`).

### SPEC-063 commit boundary #2 complete

Files changed in this boundary (stage individually):
1. `packages/db/src/models/owner-promotion/ownerPromotion.model.ts` (T-011)
2. `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts` (T-012)
3. `packages/service-core/test/factories/ownerPromotionFactory.ts` (T-012 scope creep)
4. `apps/api/src/services/usage-tracking.service.ts` (T-014)
5. `apps/api/src/middlewares/limit-enforcement.ts` (T-015)
6. `apps/api/test/schema-validation/owner-promotion-getById-schema.test.ts` (T-015 scope creep)

Typecheck posture after this boundary:
- `packages/db`: 100% clean
- `packages/service-core`: clean for SPEC-063 (pre-existing SPEC-066 error in `getById.test.ts:379`)
- `apps/api`: clean for SPEC-063 (pre-existing unrelated failures in 7 files, none touched by SPEC-063)

### Outstanding gaps / deuda flaggeada

- **apps/api schema-validation mocks** (accommodation/event/post/owner-promotion getById tests): pre-existing 5+ missing audit fields per mock. Pre-session, not SPEC-063 regression. Consider dedicated task.
- **OwnerPromotionService `_executeCount`**: not updated to inject `lifecycleState=ACTIVE`. Literal AC-005-01 scope is only `_executeSearch`. Revisit with T-022.
- **`getById.test.ts:379` DrizzleClient typing**: pre-existing SPEC-066 residue, unrelated.

#### T-013 — admin OwnerPromotion API routes (verification only)
- **Files:** none (verification task)
- Route location: `apps/api/src/routes/owner-promotion/admin/` (not `/admin/owner-promotion/` as description suggested). Grep `isActive` in admin/public/protected tiers: 0 matches.
- Routes consume `OwnerPromotionAdminSearchSchema` + `OwnerPromotionAdminSchema` already migrated by T-008/T-009/T-010.
- `adminList()` inherits `status -> lifecycleState` mapping from `AdminSearchBaseSchema` (T-009 removed the `queryBooleanParam` override). No code changes needed.

### Replan 2026-04-17T17:55

Admin UI scope analysis revealed that original T-016, T-017, T-018 referenced **dead code files** (`config/*.ts`, `schemas/*.schemas.ts`, `columns.tsx` top-level) and did not cover the **LIVE** route, types, or dialog components. Scope-correcting replan:

**Files in scope post-replan** (live UI):
- `features/owner-promotions/types.ts` (source of truth for feature) -> **T-016a**
- `routes/_authed/billing/owner-promotions.tsx` (route with table, filter, actions) -> **T-016b, T-018a, T-018c**
- `features/owner-promotions/hooks.ts` (togglePromotionActive mutation) -> **T-017 (reused + scope refined)**
- `features/owner-promotions/components/PromotionDetailDialog.tsx` + `PromotionFormDialog.tsx` -> **T-018b**
- `test/fixtures/owner-promotion.fixture.ts` (test infra) -> **T-016d**

**Dead code cleanup** (verified no external consumers via exhaustive grep):
- `features/owner-promotions/columns.tsx`, `config/owner-promotions.columns.ts`, `config/owner-promotions.config.ts`, `schemas/owner-promotions.schemas.ts` + `index.ts` re-export -> **T-016c**

**Tasks removed:** T-016 (original), T-018 (original).
**Tasks reused with refined scope:** T-017.
**Tasks added:** T-016a, T-016b, T-016c, T-016d, T-018a, T-018b, T-018c (7 new).
**Net task count change:** 58 -> 63 (+5).

**UX decisions captured at replan:**
- **Filter dropdown** exposes all 3 enum values + 'all' (4 options total).
- **Action button** (toggle) replaced by inline `<Select>` in row actions (default UX approved; alternatives `cycle` and `modal` rejected).
- **Dead code**: delete all 4 files (user confirmed `delete if 100% sure; we are`).

### Next up

T-016a (types.ts; source of truth for feature — unblocks most of the replan chain) -> parallel batch: T-016b, T-016d, T-017, T-018a, T-018b -> T-018c. T-016c (dead code cleanup) can run any time (independent). State bookkeeping continues.

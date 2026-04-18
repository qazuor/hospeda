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

### Admin UI block (2026-04-17T18:35 — 8 tasks + T-027 partial)

#### T-016a — types.ts migration
- Imported `LifecycleStatusEnum` from `@repo/schemas`
- Migrated `OwnerPromotion.isActive` + `CreateOwnerPromotionInput.isActive` + `OwnerPromotionFilters.status` (absorbed scope) to `lifecycleState`

#### T-016b — column in route
- `accessorKey: 'isActive'` → `'lifecycleState'`
- 2-variant badge → 3-variant (ACTIVE→success, DRAFT→secondary, ARCHIVED→outline)

#### T-016c — dead code delete
- Removed 4 files (`columns.tsx`, `config/*.ts` x2, `schemas/owner-promotions.schemas.ts`) + 2 empty dirs (`config/`, `schemas/`) + `./columns` re-export in `index.ts`

#### T-016d — test fixtures
- 3 fixture refs migrated: `isActive:true` → `LifecycleStatusEnum.ACTIVE`; `isActive:false` → `LifecycleStatusEnum.ARCHIVED`

#### T-017 — hooks.ts rename
- `togglePromotionActive(id, isActive)` → `updatePromotionLifecycle(id, lifecycleState)`
- `useTogglePromotionActiveMutation` → `useUpdatePromotionLifecycleMutation`
- Payload: `{ isActive }` → `{ lifecycleState }`
- Backend compat verified via T-010 (HTTP schema accepts lifecycleState in PATCH)

#### T-018a — filter state + dropdown
- Filter state type: `isActive?: string` → `lifecycleState?: LifecycleStatusEnum`
- Dropdown 4 options: 'all', DRAFT, ACTIVE, ARCHIVED (user-approved UX: expose all 3 enum values)

#### T-018b — dialog components
- DetailDialog: 3-variant lifecycle badge
- FormDialog: initial value + added native `<select>` for lifecycleState

#### T-018c — action handler
- Toggle Button replaced with inline native `<select>` (consistency with existing discountType/filter selects)
- Bound to `useUpdatePromotionLifecycleMutation` via `handleLifecycleChange`
- Added `aria-label` for accessibility
- UX approved: inline select on row (not cycle, not modal)

#### T-027 — i18n (PARTIAL, absorbed in this block)
- Added 4 keys to es/en/pt `admin-billing.json`: `statusDraft`, `statusArchived`, `actions.changeLifecycle`, `form.lifecycleStateLabel`
- Regenerated `packages/i18n/src/types.ts` via `pnpm --filter @repo/i18n run generate-types` (also ran biome format)
- **Remaining T-027 scope:** remove legacy `actionActivate`/`actionDeactivate`, rename `statuses.inactive`→`statuses.draft`, remove `statusInactive` now that UI doesn't reference it
- Task kept status: pending (partial progress flagged in state.json `_partialProgress`)

### Quality gate for this block

- Biome: pass (11 files verified)
- Typecheck admin: clean for SPEC-063. Pre-existing unrelated errors in:
  - `src/components/entity-list/api/createEntityApi.ts:121` (SPEC-066 or previous)
  - `src/routes/_authed/me/accommodations/index.tsx:28` (AccommodationListFilters pageSize)

### Phase 2 testing batch — T-019 complete (2026-04-17T20:10)

#### T-019 — OwnerPromotion schema + CRUD tests migration
- **Files:**
  - `packages/schemas/test/entities/ownerPromotion/owner-promotion.schema.test.ts`
  - `packages/schemas/test/entities/ownerPromotion/owner-promotion.crud.schema.test.ts`
- Imported `LifecycleStatusEnum` value in both test files
- `schema.test.ts`:
  - Replaced `should default isActive to true` → `should default lifecycleState to ACTIVE when not provided`
  - Added `should accept lifecycleState DRAFT` (AC-002-01)
  - Added `should accept lifecycleState ARCHIVED` (AC-002-01)
  - Added `should reject invalid lifecycleState enum value` (AC-002-01)
  - Type Inference test L423: `typeof isActive === 'boolean'` → `typeof lifecycleState === 'string'` + enum membership assertion
- `crud.schema.test.ts`:
  - Replaced `should accept partial update with only isActive` → `should accept partial update with only lifecycleState` (uses `LifecycleStatusEnum.ARCHIVED`)
  - Added `should reject legacy isActive field in update (strict mode, AC-002-02)` using `UpdateInputSchema.strict()`
  - Integration workflow (L411): `updateInput.isActive=false` → `updateInput.lifecycleState=ARCHIVED`
- Rationale for `.strict()` on AC-002-02: Zod ignores unknown keys by default; without `.strict()` `{ isActive: false }` would pass silently, violating the subtask contract "rejected with validation error". Pattern already used in same file (lines 95/107/118 for auto-generated fields).
- Quality gate: **biome pass**, **typecheck pass** (both T-019 files clean — remaining errors are T-020 scope as forecasted), **tests 73/73 pass** (37 schema + 36 crud).
- Scope expansion: absorbed AC-002-01 coverage at schema layer per user approval (option 1 breakdown).

### Outstanding typecheck errors (unchanged, T-020 scope)

- `test/entities/ownerPromotion/owner-promotion.admin-search.schema.test.ts` L178, L181, L277 → fixed in T-020
- `test/entities/admin-search/group-c.admin-search.schema.test.ts` L109, L147 → fixed in T-020

#### T-020 — OwnerPromotion admin-search + group tests migration (2026-04-17T20:40)
- **Files:**
  - `packages/schemas/test/entities/ownerPromotion/owner-promotion.admin-search.schema.test.ts`
  - `packages/schemas/test/entities/admin-search/group-c.admin-search.schema.test.ts`
- **Key context:** Post-T-009, `OwnerPromotionAdminSearchSchema` has NO `lifecycleState` nor `isActive` field of its own. The lifecycle filter is handled via the inherited `status` field from `AdminSearchBaseSchema` (`z.enum(['all', 'DRAFT', 'ACTIVE', 'ARCHIVED']).default('all')`), which `adminList()` maps to `lifecycleState`.
- `admin-search.schema.test.ts`:
  - Deleted `should validate isActive as boolean` (field no longer exists — Zod silently ignored it, test asserted nothing meaningful).
  - Deleted `should validate isActive as string "true"/"false" (query param coercion)` (L169-183 — root of TS2339 at L178/L181).
  - Added new describe block `Lifecycle Status Filter (via base status field)` with 5 tests: default "all", accept DRAFT/ACTIVE/ARCHIVED, reject invalid.
  - Combined Filters test: removed `isActive: true` input + L277 assertion (TS2339); added `expect(result.data.status).toBe('ACTIVE')` assertion instead.
- `group-c.admin-search.schema.test.ts`:
  - `should accept promotion-specific filters`: removed `isActive: true` input + L109 assertion.
  - `should coerce string boolean for isActive` → replaced with `should accept status enum values (DRAFT, ACTIVE, ARCHIVED) via base schema` parametrized test.
- Quality gate: **biome pass**, **typecheck `@repo/schemas` 100% CLEAN (milestone — no SPEC-063 errors remaining)**, **tests 118/118 pass** (4 files: schema 37 + crud 36 + admin-search 25 + group-c 20).
- Scope expansion absorbed: status enum coverage added at schema layer per user approval (option 1 breakdown), consistent with T-019 pattern.

### packages/schemas milestone

After T-020, `packages/schemas` typecheck is **100% clean** for SPEC-063. All OwnerPromotion-related schema surface + tests are migrated. Remaining SPEC-063 work is in `apps/api` (tests + cron), `packages/db` (model tests T-023), and `packages/service-core` (integration tests).

#### T-023 — OwnerPromotion model test fixtures migration (2026-04-17T20:55)
- **File:** `packages/db/test/models/ownerPromotion.model.test.ts` (path corrected — no subdir).
- Imported `LifecycleStatusEnum` from `@repo/schemas`.
- `findActiveByAccommodationId > should return active promotions`: mock result `isActive: true` → `lifecycleState: LifecycleStatusEnum.ACTIVE`.
- `findActiveByOwnerId > should return active promotions`: mock result `isActive: true` → `lifecycleState: LifecycleStatusEnum.ACTIVE`.
- **Scope decision:** Tests are mock-based (`vi.mock(getDb)`; `.where()` mock returns results directly). SQL-level exclusion verification ("DRAFT/ARCHIVED excluded") is **delegated to T-022 integration test** — impossible to verify in mock-based tests without fragile SQL object inspection. Pattern aligned with `post_sponsorship.model.test.ts` precedent (mock data shape only, no SQL capture).
- Quality gate: **biome pass**, **typecheck `@repo/db` clean**, **tests 19/19 pass**.

### Next up

Commit boundary for T-023 (1 test file + bookkeeping). Then:

**Phase 2 testing batch continuation:** T-021 (integration: admin list AC-001-01), T-022 (integration: public default ACTIVE AC-005-01 + closes T-023 SQL-exclusion verification), T-024 (usage-tracking + limit-enforcement tests).

**Phase 2 cron:** T-025, T-026.

**Phase 2 i18n closing:** T-027 remaining scope.

Then Phase 4 (DestinationReview), Phase 3 (Sponsorship), cleanup (T-058).

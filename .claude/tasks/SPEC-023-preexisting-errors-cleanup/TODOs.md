# SPEC-023: Pre-existing Errors Cleanup - Task Tracker

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 25 |
| Pending | 0 |
| In Progress | 0 |
| Completed | 25 |

## Phase 1: API Typecheck Fixes - COMPLETED

- [x] **T-001** [C:2] Fix `stats.ts` missing `sortBy`/`sortOrder` params
- [x] **T-002** [C:1] Fix `stats.ts` `.total` property access
- [x] **T-003** [C:2] Fix type errors in API test files

## Phase 2: Web/i18n Typecheck & Lint Fixes - COMPLETED

- [x] **T-004** [C:3] Fix i18n types and formatting
- [x] **T-005** [C:1] Unify vitest versions across monorepo

## Phase 3: List Normalizer Test Fix - COMPLETED

- [x] **T-006** [C:2] Fix list normalizer test to match current `ListOptions` contract. Changed normalizer to modify `pageSize` (known field) instead of adding arbitrary `normalized: true`.

## Phase 4: UserService Test Fixes - COMPLETED

- [x] **T-007a** [C:2] Identified all permission requirements per UserService method
- [x] **T-007b** [C:2] Fix `count.test.ts` - replaced `createUser()` with `createActor()` + `USER_READ_ALL`
- [x] **T-007c** [C:2] Fix `list.test.ts` - same pattern
- [x] **T-007d** [C:2] Fix `search.test.ts` - same pattern
- [x] **T-007e** [C:2] Fix `create.test.ts` - use `createSuperAdminActor()` (needs `USER_CREATE`)
- [x] **T-007f** [C:2] Fix `softDelete.test.ts` - use proper permissions
- [x] **T-007g** [C:2] Fix `hardDelete.test.ts` - use `USER_HARD_DELETE`
- [x] **T-007h** [C:2] Fix `restore.test.ts` - use `USER_RESTORE`
- [x] **T-007i** [C:2] Fix `addPermission.test.ts`, `removePermission.test.ts`, `setPermissions.test.ts` - use `USER_UPDATE_ROLES`
- [x] **T-007j** [C:2] Fix `assignRole.test.ts` - use `USER_UPDATE_ROLES`

## Phase 5: Additional Test Fixes (discovered during verification) - COMPLETED

- [x] **T-010** [C:1] Fix exchange-rate formatting tests - ICU-agnostic thousands separator assertions
- [x] **T-011** [C:1] Fix MercadoPago adapter tests - restored throw errors for invalid token validation
- [x] **T-012** [C:1] Fix `@repo/schemas` UserListItemSchema test - add missing required `email` field
- [x] **T-013** [C:2] Fix `@repo/db` base.model tests - add `$dynamic()` to 7 findAll mock chains
- [x] **T-014** [C:1] Fix admin Header/navigation tests - change mock from `default` to `HeaderUser` named export
- [x] **T-015** [C:2] Fix admin billing-http-adapter tests - update mocks for fetchApi refactor (Bearer token removed, error message format changed)
- [x] **T-016** [C:2] Fix web static tests - update import string assertions for multi-export patterns (formatDate, formatNumber, formatCurrency + toBcp47Locale)
- [x] **T-017** [C:1] Fix web Footer test - gradient uses CSS variable instead of hardcoded hex
- [x] **T-018** [C:1] Fix web UserNav test - mock auth-client to prevent ECONNREFUSED errors
- [x] **T-019** [C:2] Fix web event page tests - namespace changed from `'event'` to `'events'`
- [x] **T-020** [C:2] Fix API test failures (26 tests across 12 files)

## Phase 6: Verification - COMPLETED

- [x] **T-008** [C:1] `pnpm typecheck` passes across all 16 packages
- [x] **T-009** [C:1] `pnpm lint` and `pnpm build` pass across all packages
- [x] **T-021** [C:1] `pnpm test` passes across all 27 tasks (0 failures)

---
spec-id: SPEC-023
title: Pre-existing Errors Cleanup
type: improvement
complexity: medium
status: completed
created: 2026-03-01T00:00:00.000Z
---

## SPEC-023: Pre-existing Errors Cleanup

## Part 1 - Functional Specification

### 1. Overview & Goals

- **Goal**: Eliminate all pre-existing typecheck errors, test failures, and configuration issues across the monorepo so that `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass cleanly in every package.
- **Motivation**: During the SPEC-020 audit, several errors were identified that pre-date the spec's changes. These errors block CI from being fully green and mask future regressions. A clean baseline is essential for production confidence.
- **Success Metrics**:
  1. `pnpm typecheck` passes with zero errors across all 16 packages
  2. `pnpm lint` passes with zero errors across all packages
  3. `pnpm test` passes with zero failures across all packages
  4. `pnpm build` succeeds for all apps
  5. CI pipeline runs green end-to-end

### 2. Current State (as of 2026-03-02)

#### Already Fixed (during SPEC-020 work)

- API typecheck errors: stats.ts sortBy/sortOrder, .total property, dunning.job.test.ts, notification tests, trial-lifecycle test, db-mock protected fields
- Web typecheck: i18n types regenerated (changePassword keys)
- i18n lint: formatting fixed (trailing spaces, quote style)
- Vitest version unified: @repo/config and apps/api updated from ^2.1.8 to ^3.1.3, admin from 3.0.5 to ^3.1.3
- @vitest/coverage-v8 updated in apps/api from ^2.1.8 to ^3.2.4
- minThreads/maxThreads crash in @repo/config resolved

#### Still Pending

- **service-core tests**: 49 tests failing across 12 files (1 in base/crud, 11 in services/user)
- **Staging deployment verification**: Covered by SPEC-025

### 3. Remaining Errors Inventory

#### service-core Test Failures (49 tests in 12 files)

**File: `test/base/crud/list.test.ts`** (1 failure)

- `should use the list normalizer if provided`

**Files: `test/services/user/*.test.ts`** (48 failures across 11 files)

- `addPermission.test.ts` - 4 failures
- `assignRole.test.ts` - 4 failures
- `count.test.ts` - 5 failures
- `create.test.ts` - 2 failures
- `hardDelete.test.ts` - 4 failures
- `list.test.ts` - failures
- `removePermission.test.ts` - failures
- `restore.test.ts` - failures
- `search.test.ts` - failures
- `setPermissions.test.ts` - failures
- `softDelete.test.ts` - failures

**Root Cause Hypothesis**: The UserService or UserModel was recently modified (e.g., new fields, changed method signatures, or permission logic refactor) and the test mocks/expectations were not updated to match.

### 4. Out of Scope

- Adding new test coverage beyond fixing existing failures
- Refactoring the code that contains issues (only minimal fixes to satisfy tests)
- Staging environment setup (covered by SPEC-025)
- Manual deployment verification (covered by SPEC-025)

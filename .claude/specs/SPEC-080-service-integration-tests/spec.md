# SPEC-080: Service-Layer Integration Tests with Real Database

> **Status**: completed
> **Priority**: P2
> **Complexity**: High
> **Origin**: SPEC-066 gap remediation — GAP-005
> **Tracks**: GAP-005 from `specs-gaps-066.md`
> **Created**: 2026-04-17
> **Related**:
> - SPEC-066 (getById Relation Loading Consistency — the feature being validated)
> - SPEC-061 (DB Integration Testing Infrastructure — reuse pattern)
> - SPEC-062 (Runtime Response Validation — complementary coverage)

---

## Overview

SPEC-066 modified `getByField()` in `BaseCrudService` so that 10 services now load relations via `findOneWithRelations()` instead of a bare `findOne()`. All existing tests for these services mock the model layer. A subtle misconfiguration at the Drizzle layer — such as a missing `relations()` definition in a schema file, a wrong join column, or an incorrect key in `validRelationKeys` — would NOT be caught by those unit tests. This spec creates integration test infrastructure for `packages/service-core` and writes per-service tests that call `getById()` against a real PostgreSQL database and assert the response includes fully populated relation objects.

---

## Problem Statement

### Current State

The 10 services affected by SPEC-066 are:

| # | Service | Relations Loaded (via `getDefaultListRelations()`) |
|---|---------|---------------------------------------------------|
| 1 | AccommodationService | `destination`, `owner` |
| 2 | PostService | `author`, `relatedAccommodation`, `relatedDestination`, `relatedEvent`, `sponsorship.sponsor` |
| 3 | EventService | `author`, `location`, `organizer`, `tags` |
| 4 | AccommodationReviewService | `user`, `accommodation` |
| 5 | DestinationReviewService | `user`, `destination` |
| 6 | UserBookmarkService | `user` |
| 7 | OwnerPromotionService | `owner`, `accommodation` |
| 8 | SponsorshipService | `sponsorUser`, `level`, `package` |
| 9 | SponsorshipPackageService | `eventLevel` |
| 10 | PostSponsorshipService | `post`, `sponsor` |

### What Existing Tests Verify

Unit tests mock `findOneWithRelations` via `createTypedModelMock` (from `packages/service-core/test/factories/`). They verify:
- That `findOneWithRelations` is called (not `findOne`) when `getDefaultListRelations()` returns a non-undefined config.
- That the correct `where` clause and relation config are passed.
- That permission hooks receive the returned entity.

### What They Do NOT Verify

- That the Drizzle `relations()` definitions in the schema files are correct.
- That the `validRelationKeys` declarations on models match actual schema relation keys.
- That `getTableName()` returns the correct Drizzle query key for the `db.query[tableName]` lookup.
- That nested relations (e.g., `sponsorship.sponsor` in PostService) resolve correctly at the Drizzle level.
- That the actual relation objects returned from PostgreSQL have the expected shape.

GAP-005 from the SPEC-066 audit identified this coverage gap and explicitly recommended per-service integration tests with a real database (Option A in the gap analysis).

---

## Goals

1. Create integration test infrastructure in `packages/service-core` that mirrors the pattern established by SPEC-061 in `packages/db` — reusing `HOSPEDA_TEST_DATABASE_URL`, the `hospeda_integration_test` database, and the `withTestTransaction` isolation helper.
2. Write one integration test file per affected service (10 files total) that seeds the required entities, calls `getById()`, and asserts relation objects are populated in the response.
3. Ensure tests skip gracefully when no database is available, so the local dev workflow is not broken when Docker is not running.
4. Integrate the test suite into the CI pipeline.

---

## Scope

### In Scope

- Integration test Vitest config for `packages/service-core`.
- Setup/teardown helpers for connecting to the SPEC-061 test database.
- Seed helpers that insert valid test entities with all FK dependencies satisfied.
- 10 per-service integration test files that call `service.getById()` with a real DB.
- CI pipeline step to run service-core integration tests.
- Documentation in `packages/service-core/CLAUDE.md`.

### Out of Scope

- Testing `list()`, `create()`, `update()`, or other service methods. This spec is scoped to `getById()` relation loading only.
- Testing services NOT in the SPEC-066 list (DestinationService, UserService, TagService, etc.).
- Testing API routes or HTTP-level behavior. That is covered by SPEC-062.
- Performance or load testing.
- Testing soft-deleted relations behavior (GAP-023 — separate design decision pending).
- Visual regression or UI tests.

---

## Existing Infrastructure to Reuse

SPEC-061 (`packages/db`) established the following artifacts that this spec builds on:

| SPEC-061 Artifact | Location | How SPEC-080 Uses It |
|-------------------|----------|----------------------|
| `hospeda_integration_test` database | Created by global-setup | Connect to the same DB |
| `HOSPEDA_TEST_DATABASE_URL` env var | Set by SPEC-061 global-setup | Use same connection string |
| `withTestTransaction()` | `packages/db/test/integration/helpers.ts` | Re-export or call directly for test isolation |
| `global-setup.ts` (DB lifecycle) | `packages/db/test/integration/global-setup.ts` | Reference as external dependency |
| `testData.user()`, `testData.destination()`, `testData.tag()` factories | `packages/db/test/integration/helpers.ts` | Use as FK dependency seeds |

**Important**: SPEC-080 does NOT replicate the global-setup. It assumes the SPEC-061 infrastructure already exists and the `hospeda_integration_test` database is ready. If SPEC-061 is not yet merged, SPEC-080 must wait for it (see Dependencies section).

Additionally, `apps/api/test/helpers/test-db.ts` contains `createTestDb()`, `seedTestData()`, and `cleanupTestDb()` that provided a reference pattern for `isDatabaseAvailable()` checks and skip behavior.

---

## User Stories

### Story 1: As a developer, I want integration tests that call getById() against a real database so that Drizzle schema misconfigurations are caught automatically before reaching production.

**Given** the `hospeda_integration_test` database is running and SPEC-061 infrastructure is available,
**When** I run `pnpm test:integration` in `packages/service-core`,
**Then** all 10 service integration tests execute against real PostgreSQL, call `getById()` for each service, and assert that relation objects are populated (not just FK columns).

**Given** the test database is NOT running (HOSPEDA_TEST_DATABASE_URL is not set or connection fails),
**When** I run `pnpm test:integration` in `packages/service-core`,
**Then** all integration tests are skipped with a clear message explaining how to start the database, and the test run exits with code 0 so local dev workflows are not broken.

### Story 2: As a developer, I want each test to run in isolation so that seed data from one test does not affect other tests.

**Given** a test seeds an Accommodation, a Destination, and an Owner User into the test database,
**When** the test completes (pass or fail),
**Then** all inserted rows are rolled back and the database is left in the same state it was before the test started.

**Given** two service integration tests run in parallel in the same test run,
**When** both tests seed data inside their own transactions,
**Then** neither test can see the other's uncommitted rows, and both pass independently.

### Story 3: As a developer, I want to verify that AccommodationService.getById() returns a response where `destination` and `owner` are populated objects, not FK strings.

**Given** an Accommodation row with a valid `destinationId` and `ownerId` exists in the test database,
**When** `AccommodationService.getById({ id })` is called with a valid actor,
**Then** the response is `{ success: true, data: { ..., destination: { id, name, slug, ... }, owner: { id, email, ... } } }`,
**And** `data.destinationId` equals `data.destination.id` (FK column and relation are consistent),
**And** `data.ownerId` equals `data.owner.id`.

**Given** an Accommodation row exists but the `destinationId` is `null` (optional relation),
**When** `AccommodationService.getById({ id })` is called,
**Then** the response contains `data.destination: null` (not an error, just a null relation).

### Story 4: As a developer, I want to verify that PostService.getById() returns nested relations (sponsorship.sponsor) populated correctly, not just top-level relations.

**Given** a Post with a PostSponsorship linked to a Sponsor User exists in the test database,
**When** `PostService.getById({ id })` is called,
**Then** `data.sponsorship` is a populated object (not `null`),
**And** `data.sponsorship.sponsor` is a populated User object (the nested relation is resolved),
**And** none of the nested fields are `undefined` or FK strings where objects are expected.

**Given** a Post with no PostSponsorship exists,
**When** `PostService.getById({ id })` is called,
**Then** `data.sponsorship` is `null` and the response is successful.

### Story 5: As a developer, I want a seed helper that inserts all required FK dependencies for any of the 10 services so that tests can focus on assertion, not boilerplate insertion.

**Given** I want to write an integration test for AccommodationReviewService,
**When** I call `seedAccommodationReview(tx)` in my test setup,
**Then** the helper inserts a User, a Destination, an Accommodation, and an AccommodationReview in the correct dependency order, and returns the IDs of all inserted entities so I can call `getById(review.id)`.

**Given** I call `seedAccommodationReview(tx)` inside a `withTestTransaction()` callback,
**When** the test completes,
**Then** all rows inserted by `seedAccommodationReview()` are rolled back along with the rest of the transaction.

### Story 6: As a developer, I want the integration tests to run separately from unit tests so that `pnpm test` (the fast feedback loop) is not slowed down by database-dependent tests.

**Given** I run `pnpm test` in `packages/service-core`,
**When** the unit test suite runs,
**Then** none of the integration test files are picked up by the unit Vitest config.

**Given** I run `pnpm test:integration` in `packages/service-core`,
**When** the integration test suite runs,
**Then** only files under `test/integration/**` are executed.

---

## Acceptance Criteria

- [ ] `packages/service-core/vitest.integration.config.ts` exists and is valid.
- [ ] `packages/service-core/test/integration/helpers.ts` exports `getServiceTestDb()`, `withServiceTestTransaction()`, `closeServiceTestPool()`, and seed helpers for all 10 entities.
- [ ] All 10 service integration test files exist under `packages/service-core/test/integration/services/`.
- [ ] Each test file contains at minimum: (a) happy path — entity with all relations seeded, `getById()` returns populated objects; (b) optional relation path — entity with one optional relation absent, `getById()` returns `null` for that relation (not an error).
- [ ] Tests skip gracefully when `HOSPEDA_TEST_DATABASE_URL` is not set, with a descriptive message.
- [ ] `packages/service-core/vitest.config.ts` excludes `test/integration/**` to prevent accidental execution.
- [ ] `pnpm test:integration` script works from `packages/service-core` and from the monorepo root.
- [ ] `turbo.json` includes `test:integration` task for `packages/service-core`.
- [ ] CI pipeline runs service-core integration tests after the unit test step.
- [ ] Connection pool is properly closed in `afterAll` of each test file (no hanging processes).
- [ ] `packages/service-core/CLAUDE.md` documents how to run integration tests locally.

---

## Technical Design

### Dependencies

SPEC-080 has a hard dependency on SPEC-061 being merged first. Specifically:

- SPEC-061's global-setup creates the `hospeda_integration_test` database and pushes the Drizzle schema.
- SPEC-080 tests connect to this database using `HOSPEDA_TEST_DATABASE_URL`.
- Without SPEC-061, SPEC-080 has no database to connect to.

**When SPEC-061 is not yet merged**, SPEC-080 tests will skip (no `HOSPEDA_TEST_DATABASE_URL`) and CI will need both integration test steps enabled together.

### 1. Vitest Configuration

**File**: `packages/service-core/vitest.integration.config.ts`

The config follows the same pattern as SPEC-061's `packages/db/vitest.integration.config.ts`:

- `include: ['test/integration/**/*.test.ts']`
- `pool: 'forks'` with `singleFork: false` and `maxForks: 3`
- `testTimeout: 30_000` (30 seconds — service calls involve multiple DB operations)
- `hookTimeout: 60_000`
- `globalSetup` is NOT needed here because SPEC-061 already manages the DB lifecycle. SPEC-080 only connects to the database that SPEC-061 created.

The unit test config (`vitest.config.ts`) must add `test/integration/**` to its `exclude` array.

**npm scripts** to add to `packages/service-core/package.json`:

```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:integration:watch": "vitest --config vitest.integration.config.ts"
}
```

### 2. Test Helpers

**File**: `packages/service-core/test/integration/helpers.ts`

This file provides three categories of exports:

**Category A: Database connection**

- `getServiceTestDb()` — returns a Drizzle client connected to `hospeda_integration_test` using `HOSPEDA_TEST_DATABASE_URL`. Uses the same combined schema (`{ ...hospedaSchema, ...qzpaySchema }`) as SPEC-061.
- `closeServiceTestPool()` — closes the pool, called in `afterAll` of each test file.
- `isServiceTestDbAvailable()` — returns `true` if `HOSPEDA_TEST_DATABASE_URL` is set.

**Category B: Transaction isolation**

- `withServiceTestTransaction(fn)` — wraps the test function in a Drizzle transaction that is always rolled back. Same `RollbackSignal` pattern as SPEC-061. This ensures every test starts and ends with the database in the same state.

**Category C: Seed helpers (one per affected service)**

Each seed helper inserts all required FK dependencies in the correct order and returns an object with the IDs of inserted entities. Helpers accept an optional `overrides` parameter for test-specific field values.

All helpers must be called inside a `withServiceTestTransaction()` callback so their inserts are rolled back after each test.

| Seed Helper | Entities Inserted | Returns |
|-------------|-------------------|---------|
| `seedAccommodation(tx, overrides?)` | User (owner), Destination, Accommodation | `{ userId, destinationId, accommodationId }` |
| `seedPost(tx, overrides?)` | User (author), Post | `{ userId, postId }` |
| `seedPostWithSponsorship(tx, overrides?)` | User (author), Post, User (sponsor), PostSponsorship | `{ authorId, postId, sponsorId, sponsorshipId }` |
| `seedEvent(tx, overrides?)` | User (author), EventLocation, EventOrganizer, Event | `{ userId, locationId, organizerId, eventId }` |
| `seedAccommodationReview(tx, overrides?)` | User, Destination, Accommodation, AccommodationReview | `{ userId, destinationId, accommodationId, reviewId }` |
| `seedDestinationReview(tx, overrides?)` | User, Destination, DestinationReview | `{ userId, destinationId, reviewId }` |
| `seedUserBookmark(tx, overrides?)` | User, UserBookmark | `{ userId, bookmarkId }` |
| `seedOwnerPromotion(tx, overrides?)` | User (owner), Destination, Accommodation, OwnerPromotion | `{ ownerId, destinationId, accommodationId, promotionId }` |
| `seedSponsorship(tx, overrides?)` | User (sponsor), SponsorshipLevel, SponsorshipPackage, Sponsorship | `{ sponsorId, levelId, packageId, sponsorshipId }` |
| `seedSponsorshipPackage(tx, overrides?)` | SponsorshipLevel, SponsorshipPackage | `{ levelId, packageId }` |
| `seedPostSponsorship(tx, overrides?)` | User (author), Post, User (sponsor), PostSponsorship | `{ authorId, postId, sponsorId, sponsorshipId }` |

Seed helpers reuse the minimal factory patterns from `packages/service-core/test/factories/` where applicable. They insert actual rows into the real database (not mock objects), so they must satisfy all NOT NULL constraints and FK references.

### 3. Service Instantiation in Tests

Services in `packages/service-core` require a Hono `Context` object to be instantiated (they extract the DB connection from the context). For integration tests, a minimal context mock is needed that provides the real Drizzle DB instance while leaving auth/actor fields as test stubs.

**Pattern**:

```
function createTestContext(db): MockContext {
  // Returns a minimal object satisfying the Context interface used by services.
  // The service accesses the DB via ctx.get('db') or equivalent.
  // Auth actor is a test admin actor with all permissions.
}
```

The exact mechanism depends on how `BaseCrudService` extracts the DB from context. Before implementing, review `packages/service-core/src/base/base.service.ts` to confirm the access pattern (`c.var.db`, `getDb(c)`, etc.).

If services use `initializeDb()` from `@repo/db` stored in context, the test context must call `initializeDb(pool)` with the test pool.

### 4. Per-Service Test Structure

Each test file follows this structure:

```
packages/service-core/test/integration/services/
├── accommodation.integration.test.ts
├── post.integration.test.ts
├── event.integration.test.ts
├── accommodation-review.integration.test.ts
├── destination-review.integration.test.ts
├── user-bookmark.integration.test.ts
├── owner-promotion.integration.test.ts
├── sponsorship.integration.test.ts
├── sponsorship-package.integration.test.ts
└── post-sponsorship.integration.test.ts
```

**Template for each file**:

```
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeServiceTestPool,
  isServiceTestDbAvailable,
  seedAccommodation,    // (replace with appropriate seed helper)
  withServiceTestTransaction,
} from '../helpers';
import { AccommodationService } from '../../src/services/...';  // (replace)
import { createTestContext } from '../test-context';

const SKIP = !isServiceTestDbAvailable();

afterAll(async () => {
  await closeServiceTestPool();
});

describe.skipIf(SKIP)('AccommodationService getById — integration', () => {
  it('returns populated destination and owner when both relations exist', async () => {
    await withServiceTestTransaction(async (tx) => {
      // Arrange
      const { accommodationId } = await seedAccommodation(tx);

      // Act
      const ctx = createTestContext(tx);
      const service = new AccommodationService(ctx);
      const result = await service.getById({ id: accommodationId });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data!.destination).toBeDefined();
      expect(result.data!.destination!.id).toBeDefined();
      expect(result.data!.destination!.name).toBeDefined();
      expect(result.data!.owner).toBeDefined();
      expect(result.data!.owner!.id).toBeDefined();
      expect(result.data!.destination!.id).toBe(result.data!.destinationId);
      expect(result.data!.owner!.id).toBe(result.data!.ownerId);
    });
  });

  it('returns null for optional relation when it is not set', async () => {
    await withServiceTestTransaction(async (tx) => {
      // Arrange: seed an accommodation where ownerId is null (if the column is nullable)
      // OR seed with a valid FK and verify the relation is present.
      // This test exists to confirm the service handles absent optional relations.
      const { accommodationId } = await seedAccommodation(tx, { ownerId: null });

      // Act
      const ctx = createTestContext(tx);
      const service = new AccommodationService(ctx);
      const result = await service.getById({ id: accommodationId });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data!.owner).toBeNull();
    });
  });

  it('returns NOT_FOUND when entity does not exist', async () => {
    await withServiceTestTransaction(async (tx) => {
      const ctx = createTestContext(tx);
      const service = new AccommodationService(ctx);
      const result = await service.getById({ id: crypto.randomUUID() });

      expect(result.success).toBe(false);
      // Error code depends on service-core's error enum
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });
});
```

Each service test file must include at minimum:
1. Happy path — all relations seeded and returned.
2. Optional relation absent — entity exists but one optional FK is null.
3. NOT_FOUND — entity does not exist.

For **PostService** specifically, add a fourth test for the nested relation (`sponsorship.sponsor`):
- Seed a Post with a PostSponsorship linked to a sponsor User.
- Call `PostService.getById({ id })`.
- Assert `data.sponsorship` is an object AND `data.sponsorship.sponsor` is an object (not just `sponsorshipId`).

### 5. CI Pipeline Integration

The service-core integration tests run in the same CI job that already runs `pnpm test:integration` for `packages/db` (added by SPEC-061). Add a sequential step after the `packages/db` integration tests:

```yaml
- name: Run DB integration tests
  run: pnpm --filter @repo/db test:integration
  env:
    HOSPEDA_TEST_DATABASE_URL: postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres

- name: Run service-core integration tests
  run: pnpm --filter @repo/service-core test:integration
  env:
    HOSPEDA_TEST_DATABASE_URL: postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres
```

The service-core step runs AFTER the DB step because SPEC-061's global-setup creates the database and pushes the schema. If the DB step fails, service-core tests are skipped (standard CI behavior for sequential steps).

If a monorepo-root `pnpm test:integration` command is preferred, confirm that `turbo.json` has `@repo/service-core#test:integration` depending on `@repo/db#test:integration` so execution order is guaranteed.

---

## UX Considerations (Developer Experience)

### Skip Behavior

When `HOSPEDA_TEST_DATABASE_URL` is not set, every test in every file must be skipped via `describe.skipIf(SKIP)`. The skip message should explain the prerequisite:

```
Skipped: HOSPEDA_TEST_DATABASE_URL not set.
To run service-core integration tests:
  1. Run "pnpm db:start" to start the Docker containers
  2. Run "pnpm --filter @repo/db test:integration" once to create and seed the test database
  3. Run "pnpm --filter @repo/service-core test:integration"
```

### Error Messages

If the database IS configured but the connection fails (network error, auth failure), the test should fail immediately with the original error rather than printing a confusing timeout. The `getServiceTestDb()` helper should attempt a connection probe at startup and throw a clear error if it fails.

### Watch Mode

`pnpm test:integration:watch` should work identically to the unit watch mode. Because transactions are rolled back after each test, re-running tests on file save is safe and does not accumulate state.

### Test Output

Each test file should log the service name and the relations being verified at the start of the `describe` block (via a comment or a `beforeAll` log). This makes it easy to understand which assertion corresponds to which Drizzle configuration when a test fails.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SPEC-061 not yet merged when SPEC-080 starts | High | High | SPEC-080 is blocked on SPEC-061. Do not start Phase 2 until SPEC-061 is merged and `hospeda_integration_test` DB is available. |
| Service context mock is wrong — service fails to get DB connection | Medium | High | Read `BaseCrudService` constructor and DB access pattern before writing `createTestContext()`. Align with the same `initializeDb(pool)` pattern used in `apps/api`. |
| Seed helpers violate NOT NULL or check constraints | Medium | Medium | Derive seed data from actual schema files (same discipline as SPEC-061's `testData` factories). Run schema inspection before writing each factory. |
| Optional relations — unclear which FK columns are nullable | Medium | Medium | Check DB schema for each entity before writing the "optional relation absent" test. If a relation column is NOT NULL, the "absent" test case is replaced with a "relation FK points to valid row" test only. |
| PostService nested relation (`sponsorship.sponsor`) fails due to GAP-028 | Medium | High | GAP-028 documents that PostService's service-level tests are false positives. The integration test here is precisely the safety net for this scenario. If the test fails, it confirms GAP-028 was a real bug. |
| Transaction rollback does not work for service-level inserts | Low | High | Service methods may use their own DB connections that are not transactionally linked to the test transaction. Verify how service methods obtain their DB connection and whether passing `tx` via context is feasible. If not, fall back to `withCleanSlate` isolation. |
| CI flakiness from connection pool exhaustion | Low | Medium | Cap `maxForks: 3` and `pool.max: 5` per worker (15 connections total). PostgreSQL default `max_connections: 100` is well above this. |
| Drizzle schema gaps discovered late (GAP-009, GAP-010) | High | Medium | These integration tests are DESIGNED to catch schema gaps. A test failure is the expected outcome if schema relations are misconfigured. Treat failures as bugs to fix, not test failures to suppress. |

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/service-core/vitest.integration.config.ts` | Vitest config: forks pool, 30s timeout, includes only `test/integration/**` |
| `packages/service-core/test/integration/helpers.ts` | DB connection, `withServiceTestTransaction`, `closeServiceTestPool`, `isServiceTestDbAvailable`, all 10 seed helpers, `createTestContext` |
| `packages/service-core/test/integration/services/accommodation.integration.test.ts` | AccommodationService getById: destination, owner |
| `packages/service-core/test/integration/services/post.integration.test.ts` | PostService getById: author, nested sponsorship.sponsor |
| `packages/service-core/test/integration/services/event.integration.test.ts` | EventService getById: author, location, organizer, tags |
| `packages/service-core/test/integration/services/accommodation-review.integration.test.ts` | AccommodationReviewService getById: user, accommodation |
| `packages/service-core/test/integration/services/destination-review.integration.test.ts` | DestinationReviewService getById: user, destination |
| `packages/service-core/test/integration/services/user-bookmark.integration.test.ts` | UserBookmarkService getById: user |
| `packages/service-core/test/integration/services/owner-promotion.integration.test.ts` | OwnerPromotionService getById: owner, accommodation |
| `packages/service-core/test/integration/services/sponsorship.integration.test.ts` | SponsorshipService getById: sponsorUser, level, package |
| `packages/service-core/test/integration/services/sponsorship-package.integration.test.ts` | SponsorshipPackageService getById: eventLevel |
| `packages/service-core/test/integration/services/post-sponsorship.integration.test.ts` | PostSponsorshipService getById: post, sponsor |

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/service-core/package.json` | Add `test:integration` and `test:integration:watch` scripts |
| `packages/service-core/vitest.config.ts` | Add `'test/integration/**'` to the `exclude` array |
| `turbo.json` | Add `test:integration` task for `@repo/service-core` with `cache: false` and dependency on `@repo/db#test:integration` |
| Root `package.json` | Ensure `pnpm test:integration` runs `turbo run test:integration` (covers all packages) |
| `.github/workflows/ci.yml` | Add service-core integration test step after the DB integration test step |
| `packages/service-core/CLAUDE.md` | Add "Integration Tests" section (see below) |

---

## Documentation to Add to `packages/service-core/CLAUDE.md`

```markdown
## Integration Tests

Integration tests verify that `getById()` for the 10 SPEC-066 affected services returns
populated relation objects when connected to a real PostgreSQL database.

### Prerequisites

- SPEC-061 infrastructure must be available: `pnpm --filter @repo/db test:integration` must
  have run at least once to create the `hospeda_integration_test` database and push the schema.
- Docker must be running: `pnpm db:start`

### Commands

```bash
pnpm test:integration          # Run all service-core integration tests
pnpm test:integration:watch    # Watch mode
```

### How It Works

1. Tests connect to the `hospeda_integration_test` database (created by SPEC-061 infrastructure).
2. Each test seeds the required entities inside a transaction.
3. `service.getById()` is called against the real DB.
4. Assertions verify relation objects are populated (not FK strings).
5. The transaction is rolled back after each test.

### Skip Behavior

When `HOSPEDA_TEST_DATABASE_URL` is not set, all tests skip gracefully with a
descriptive message. Run `pnpm db:start` and `pnpm --filter @repo/db test:integration` first.

### What These Tests Catch

- Missing `relations()` definitions in Drizzle schema files.
- Incorrect `validRelationKeys` declarations on model classes.
- Wrong `getTableName()` keys that cause `db.query[tableName]` lookup failures.
- Incorrect join columns or relation configurations.
- Nested relation resolution issues (e.g., `sponsorship.sponsor`).
```

---

## Estimated Effort

6-8 days:

- Day 1: Vitest config, review `BaseCrudService` DB access pattern, design `createTestContext()`.
- Day 2: Write `helpers.ts` — DB connection, `withServiceTestTransaction`, `closeServiceTestPool`.
- Day 3: Seed helpers for Accommodation, Post, PostSponsorship, Event.
- Day 4: Seed helpers for AccommodationReview, DestinationReview, UserBookmark, OwnerPromotion.
- Day 5: Seed helpers for Sponsorship, SponsorshipPackage. Write test files for all 10 services.
- Day 6: Verify all 10 test files pass against a live test database. Fix any schema issues discovered.
- Day 7: CI pipeline integration, documentation.
- Day 8: Buffer for schema gap fixes (GAP-009, GAP-010, etc.) discovered during test execution.

---

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| SPEC-061 merged | Hard | `hospeda_integration_test` DB and `withTestTransaction` pattern |
| Docker PostgreSQL running | Runtime | `pnpm db:start` required for local execution |
| GAP-001 fix merged | Soft | The `findOne()` fallback tx bug. If unfixed, tests that exercise the no-relations path may behave unexpectedly in tx context. |
| GAP-009, GAP-010, GAP-016, GAP-017 fixes | Soft | Missing `validRelationKeys` and incorrect model keys. If unfixed, some integration tests may fail due to schema mismatches rather than service logic. These are expected failures that the tests are designed to surface. |

---

## Out of Scope (Deferred)

| Item | Reason | Tracks |
|------|--------|--------|
| Soft-deleted related entity behavior | Cross-cutting design decision pending (GAP-023) | New SPEC pending |
| `list()` integration tests | Out of SPEC-066's `getById`-specific scope | General coverage improvement |
| Write operation relation loading | Separate architectural decision (GAP-021, recommended as SPEC-067) | GAP-021 |
| API route-level Zod schema validation | SPEC-062 Phase 1 covers this | GAP-031, SPEC-062 |
| Services not in SPEC-066 list | Not affected by the relation loading change | General coverage improvement |

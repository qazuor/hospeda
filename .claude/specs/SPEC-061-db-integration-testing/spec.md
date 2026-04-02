# SPEC-061: DB Integration Testing Infrastructure

> **Status**: draft
> **Priority**: P2
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-012, GAP-050)
> **Created**: 2026-04-01
> **Dependencies**: None (validates SPEC-058/059/060)

## Problem Statement

All 38 test files in `packages/db/test/` are unit tests with mocked DB. Zero integration tests exist against a real PostgreSQL instance. Transaction behavior, constraint enforcement, and query correctness can only be verified with real database queries.

GAP-050 (verified as false positive) highlighted that `tx.query.*.findMany()` propagation was assumed correct but never tested against a real Drizzle + PostgreSQL setup.

## Proposed Solution

### 1. Test Infrastructure

- Docker PostgreSQL container for tests (reuse existing `docker-compose.yml` with a separate `hospeda_test` database)
- Test database creation/teardown in `globalSetup`
- Schema push via `drizzle-kit push` in setup (not migrations, for speed)
- Separate vitest config: `packages/db/vitest.integration.config.ts`
- New npm script: `pnpm test:integration` (in `packages/db/package.json`)

### 2. Test Isolation Strategy

Each test runs inside a transaction that is rolled back after the test completes. This provides:

- Clean state per test without `TRUNCATE` overhead
- Parallel test safety (each test sees its own uncommitted data)

```typescript
// packages/db/test/integration/helpers.ts
export async function withTestTransaction<T>(
  fn: (tx: DrizzleClient) => Promise<T>
): Promise<void> {
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new RollbackSignal(); // Force rollback
    });
  } catch (e) {
    if (!(e instanceof RollbackSignal)) throw e;
  }
}
```

### 3. Core Integration Tests

| Test | Purpose |
|------|---------|
| `tx.query.*.findMany()` propagation | Insert → findAllWithRelations with tx → verify visible → rollback → verify gone |
| `withTransaction` rollback | Start tx → insert → throw → verify row absent |
| `count()` with tx | Insert inside tx → count with tx → verify count includes uncommitted |
| `findAll()` with tx | Insert inside tx → findAll with tx → verify item visible |
| Concurrent tx isolation | Two transactions don't see each other's uncommitted data |
| Unique constraint enforcement | Verify duplicate insert throws constraint error |

## Acceptance Criteria

- [ ] Integration test infrastructure runs against real PostgreSQL
- [ ] Test database is created/destroyed automatically
- [ ] Each test is isolated via transaction rollback
- [ ] Core tx propagation tests pass
- [ ] `pnpm test:integration` script works
- [ ] CI pipeline can run integration tests (Docker available)
- [ ] Documentation: how to run integration tests locally

## Files to Create

| File | Purpose |
|------|---------|
| `packages/db/vitest.integration.config.ts` | Vitest config for integration tests |
| `packages/db/test/integration/setup.ts` | Global setup: create DB, push schema |
| `packages/db/test/integration/teardown.ts` | Global teardown: drop test DB |
| `packages/db/test/integration/helpers.ts` | `withTestTransaction`, `createTestData` |
| `packages/db/test/integration/tx-propagation.test.ts` | Core tx tests |

## Estimated Effort

3-4 days

## Risks

- Docker must be available in CI (verify GitHub Actions runner supports it)
- Schema push speed: `drizzle-kit push` on full schema may be slow. Consider caching.
- Test DB connection string management: use `HOSPEDA_TEST_DATABASE_URL` env var.

## Out of Scope

- Performance/load testing
- Testing all model methods (just core tx behavior)

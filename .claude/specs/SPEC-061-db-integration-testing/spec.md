# SPEC-061: DB Integration Testing Infrastructure

> **Status**: draft
> **Priority**: P2
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-012, GAP-050)
> **Created**: 2026-04-01
> **Updated**: 2026-04-02
> **Review pass**: 6
> **Vitest version**: ^3.1.3 (poolOptions.forks API is valid; if upgrading to v4+, replace `poolOptions.forks.maxForks` with top-level `maxWorkers`, and replace `singleFork: true` with `maxWorkers: 1, isolate: false`)
> **Dependencies**: SPEC-058 (non-blocking .. test helpers use `NodePgDatabase<typeof schema>` directly; when SPEC-058 lands, update to `DrizzleClient`/`QueryContext` aliases)
> **Validates**: SPEC-053 (tx mechanism at Drizzle level), SPEC-059 Phase 4 (cross-entity tx infrastructure)
> **Validates (deferred, after SPEC-058+060 land)**: SPEC-060 (model subclass tx propagation via `model-tx-propagation.test.ts`)
> **Depended on by**: SPEC-064 (billing transaction safety .. reuses this test infrastructure)
> **Post-implementation note**: When SPEC-058 is completed, update `helpers.ts` type alias `TestDb` from `NodePgDatabase<typeof schema>` to `DrizzleClient` exported by `@repo/db`

## Parallel Execution Guide for Agents

> **CRITICAL**: This section is the authoritative reference for any agent implementing SPEC-061. Read this ENTIRELY before starting work.

### SPEC-061's Position in the Transaction Safety Chain

```
SPEC-058 ── provides DrizzleClient type (update TestDb alias after merge)
    │
    ├──► SPEC-060 (model tx)        ┐
    │                               ├─ SPEC-061 validates BOTH
    └──► SPEC-059 (service tx)  ◄───┘
                │
                ▼
         SPEC-061 (THIS SPEC)
                │
                ▼
         SPEC-064 (billing tx safety, reuses this test infrastructure)
```

### When Can SPEC-061 Start?

SPEC-061 has a **phased start** capability:

#### Phase A: Core Infrastructure (can start AFTER SPEC-058)
The test infrastructure itself (vitest config, global setup/teardown, helpers, `withTestTransaction`) does NOT depend on SPEC-059 or SPEC-060. You can build and merge this foundation as soon as SPEC-058 provides the `DrizzleClient` type.

**What to build in Phase A**:
- `packages/db/vitest.integration.config.ts`
- `packages/db/test/integration/global-setup.ts`
- `packages/db/test/integration/helpers.ts` (use `DrizzleClient` from SPEC-058 for `TestDb` type)
- Basic `tx-propagation.test.ts` with tests 1-6 (core transaction behavior: findMany, rollback, count, findAll, create+findById, softDelete+restore)
- Exclude integration tests from unit test config

**Pre-conditions for Phase A**:
- [ ] SPEC-058 is **merged to `main`** (for `DrizzleClient` type)
- [ ] PostgreSQL is accessible for CI and local dev

#### Phase B: Model TX Validation (AFTER SPEC-060 is merged)
Add `model-tx-propagation.test.ts` that validates SPEC-060's work:
- Test that model subclass custom methods respect `tx` parameter
- Test that `findWithRelations` overrides pass `tx` through
- Test `getDb()` is fully replaced (verified by grep, not runtime test)

**Pre-conditions for Phase B**:
- [ ] SPEC-060 is **merged to `main`**
- [ ] Phase A is **merged to `main`**

#### Phase C: Service TX Validation (AFTER SPEC-059 Phase 4 is merged)
Add tests that validate SPEC-059's cross-entity transaction wrapping:
- Test that lifecycle hooks participate in transactions
- Test that hookState isolation prevents concurrent request interference
- Test that `withServiceTransaction` rollback works end-to-end

**Pre-conditions for Phase C**:
- [ ] SPEC-059 (all 4 phases) is **merged to `main`**
- [ ] Phase A is **merged to `main`**

### Execution Strategy

The recommended approach is:

1. **Start Phase A immediately after SPEC-058 merges** (don't wait for 059/060)
2. **Merge Phase A** -- this gives the project integration test infrastructure early
3. **Add Phase B tests after SPEC-060 merges** (can be a separate PR)
4. **Add Phase C tests after SPEC-059 Phase 4 merges** (can be a separate PR)

This way SPEC-061 doesn't block on the full transaction chain. The infrastructure is available early, and validation tests are added incrementally as specs land.

### What SPEC-061 Produces (Other Specs Consume These)

| Artifact | Consumer |
|----------|----------|
| `withTestTransaction()` helper | SPEC-064 (billing integration tests reuse this) |
| `testData` factory (user, destination, tag) | SPEC-064 (billing tests need test entities) |
| `getTestDb()` function | SPEC-064 (billing tests connect to test DB) |
| `vitest.integration.config.ts` pattern | SPEC-064 (may add billing-specific integration config) |
| `global-setup.ts` (DB lifecycle) | All future integration test specs |

### What SPEC-061 Does NOT Do (Boundaries)

- Does NOT modify any production code (only test infrastructure)
- Does NOT touch `@repo/service-core` (only `@repo/db`)
- Does NOT add billing-specific tests (that's SPEC-064)
- Does NOT modify existing unit tests (only adds new integration tests + excludes them from unit config)

### Cross-Spec Merge Conflict Risk

| Spec | Risk | Details |
|------|------|---------|
| SPEC-058 | None | SPEC-061 consumes types from SPEC-058. No shared files modified. |
| SPEC-059 | None | Different packages. SPEC-061 validates SPEC-059 behavior but doesn't modify same files. |
| SPEC-060 | None | Different scope. SPEC-061 validates SPEC-060 behavior but doesn't modify same files. |
| SPEC-064 | Low | SPEC-064 extends test infrastructure. If both are in-flight, coordinate on `helpers.ts` additions. |

## Problem Statement

All 42 test files in `packages/db/test/` are unit tests with mocked DB. Zero integration tests exist against a real PostgreSQL instance. Transaction behavior, constraint enforcement, and query correctness can only be verified with real database queries.

GAP-050 (verified as false positive) highlighted that `tx.query.*.findMany()` propagation was assumed correct but never tested against a real Drizzle + PostgreSQL setup.

### Current State

- **Unit tests**: 42 files in `packages/db/test/` using mocked DB via `vi.mock()`
- **E2E tests (apps/api)**: Exist in `apps/api/test/e2e/` with `TestDatabaseManager` class (`apps/api/test/e2e/setup/test-database.ts`). Vitest config (`apps/api/vitest.config.e2e.ts`) uses `setupFiles` pattern, `pool: 'forks'` with `singleFork: true`. `TestDatabaseManager` provides TRUNCATE-based cleanup
- **Docker**: `docker-compose.yml` already defines PostgreSQL 15 Alpine on port 5436. `docker/postgres/init.sql` already creates `hospeda_test` database and installs extensions (`uuid-ossp`, `pgcrypto`, `unaccent`)
- **CI**: `.github/workflows/ci.yml` uses remote DB via `HOSPEDA_DATABASE_URL` secret. No Docker service containers configured
- **Schema tooling**: `drizzle-kit push` applies Drizzle schema but does NOT create triggers, materialized views, or JSONB CHECK constraints. `packages/db/scripts/apply-postgres-extras.sh` must run after push (see ADR-017)

## Proposed Solution

### 1. Test Infrastructure

Create a separate Vitest configuration for integration tests with real PostgreSQL.

#### 1.1 Vitest Configuration

**File**: `packages/db/vitest.integration.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    globalSetup: ['test/integration/global-setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 3,
      },
    },
    testTimeout: 30_000,    // 30s per test (DB operations are slower)
    hookTimeout: 60_000,    // 60s for all lifecycle hooks (beforeAll/afterAll/beforeEach/afterEach; includes closeTestPool)
    teardownTimeout: 10_000, // Vitest global shutdown timeout (NOT per-test teardown)
  },
});
```

**Why `globalSetup` instead of `setupFiles`**:
- `globalSetup` runs ONCE before all workers start and ONCE after all finish. Ideal for DB lifecycle (create, schema push, teardown).
- `setupFiles` runs per test file in the worker process. The existing `apps/api` E2E tests use `setupFiles` because they need per-worker env validation and API-specific setup. For `packages/db`, we only need one-time schema setup.
- `globalSetup` can export a `teardown()` function that drops the test DB after all tests complete.

**Why `pool: 'forks'` with `singleFork: false`**:
- Each fork is a separate OS process with its own memory and DB connection pool. No connection leaks between workers.
- Native modules (including `pg`) may have issues in `threads` mode (worker_threads share memory and native addons are not always thread-safe). `forks` avoids this.
- With transaction rollback isolation (Section 2), each test's uncommitted data is invisible to other tests. Parallel execution is safe.
- `maxForks: 3` matches the existing unit test config and limits DB connection count.

#### 1.2 npm Scripts

**File**: `packages/db/package.json` (add to `"scripts"`)

```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:integration:watch": "vitest --config vitest.integration.config.ts"
}
```

**File**: `turbo.json` (add to pipeline if not already present)

```json
{
  "test:integration": {
    "dependsOn": ["^build"],
    "cache": false
  }
}
```

**File**: Root `package.json` (add to `"scripts"`)

```json
{
  "test:integration": "turbo run test:integration"
}
```

#### 1.3 Global Setup and Teardown

**File**: `packages/db/test/integration/global-setup.ts`

This file runs ONCE before any test worker starts.

```typescript
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_NAME = 'hospeda_integration_test';
const CONNECTION_BASE = process.env.HOSPEDA_TEST_DATABASE_URL
  || 'postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres';

/**
 * Maximum number of retries when connecting to PostgreSQL.
 * Docker containers may need a few seconds to become ready.
 */
const MAX_CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 2_000;

/**
 * Extracts the base connection string (without database name) for admin operations.
 * Used to connect to 'postgres' default DB for CREATE/DROP DATABASE commands.
 */
function getAdminConnectionString(): string {
  const url = new URL(CONNECTION_BASE);
  url.pathname = '/postgres';
  return url.toString();
}

function getTestConnectionString(): string {
  const url = new URL(CONNECTION_BASE);
  url.pathname = `/${DB_NAME}`;
  return url.toString();
}

export async function setup(): Promise<void> {
  console.log('[integration-setup] Starting DB setup...');

  // Step 1: Verify PostgreSQL is reachable (with retries for Docker startup)
  const adminPool = new Pool({ connectionString: getAdminConnectionString() });
  for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
    try {
      await adminPool.query('SELECT 1');
      break;
    } catch (error) {
      if (attempt === MAX_CONNECT_RETRIES) {
        const msg = error instanceof Error ? error.message : String(error);
        await adminPool.end();
        throw new Error(
          `[integration-setup] Cannot connect to PostgreSQL after ${MAX_CONNECT_RETRIES} attempts. Is Docker running?\n`
          + `  Connection: ${getAdminConnectionString()}\n`
          + `  Error: ${msg}\n`
          + `  Hint: Run "pnpm db:start" to start the Docker containers.`
        );
      }
      console.log(`[integration-setup] PostgreSQL not ready (attempt ${attempt}/${MAX_CONNECT_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  // Step 2: Create test database (drop if exists for clean state)
  await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
  await adminPool.end();

  // Step 3: Install PostgreSQL extensions on test DB
  const testPool = new Pool({ connectionString: getTestConnectionString() });
  await testPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await testPool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await testPool.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
  await testPool.end();

  // Step 4: Push Drizzle schema to test DB
  const pkgDir = resolve(__dirname, '../..');
  try {
    // Use the same drizzle-kit invocation as package.json (tsx + bin.cjs)
    // to ensure consistent behavior with the project's drizzle-kit version.
    // Explicit --config for consistency with project's existing scripts
    // (db:migrate, db:generate, db:studio all pass --config explicitly).
    // The package.json script "drizzle-kit" is: "tsx node_modules/drizzle-kit/bin.cjs"
    execSync(
      `pnpm run drizzle-kit push --force --config drizzle.config.ts`,
      {
        cwd: pkgDir,
        env: { ...process.env, HOSPEDA_DATABASE_URL: getTestConnectionString() },
        stdio: 'pipe',
        timeout: 60_000,
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[integration-setup] drizzle-kit push failed.\n`
      + `  Error: ${msg}\n`
      + `  Hint: Check that packages/db/drizzle.config.ts is valid.`
    );
  }

  // Step 5: Apply postgres-specific features (triggers, materialized views, CHECK constraints)
  // See ADR-017 and packages/db/docs/triggers-manifest.md
  const extrasScript = resolve(pkgDir, 'scripts/apply-postgres-extras.sh');
  try {
    execSync(`bash ${extrasScript} "${getTestConnectionString()}"`, {
      cwd: pkgDir,
      stdio: 'pipe',
      timeout: 30_000,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[integration-setup] apply-postgres-extras.sh failed (non-fatal).\n`
      + `  Error: ${msg}\n`
      + `  Some triggers/views may be missing in test DB.`
    );
    // Non-fatal: core tx tests don't depend on triggers/views.
    // Tests that need them should skip with a clear message.
  }

  // Step 6: Export connection string for test workers.
  // With pool: 'forks', Vitest creates workers via child_process.fork() which inherits
  // the parent process's environment at fork time. Since globalSetup completes BEFORE
  // workers are created, env vars set here are visible in all worker processes.
  //
  // CAVEAT: This relies on Node.js fork() behavior, NOT a documented Vitest API.
  // Vitest's official mechanism for globalSetup -> test communication is provide/inject
  // (see https://vitest.dev/config/#globalsetup). However, process.env is simpler for
  // connection strings and is reliable with pool: 'forks' on Vitest ^3.x.
  // If this breaks on a future Vitest upgrade, migrate to provide/inject:
  //   globalSetup: project.provide('testDbUrl', url)
  //   test file:   const url = inject('testDbUrl')
  process.env.HOSPEDA_TEST_DATABASE_URL = getTestConnectionString();

  console.log(`[integration-setup] Test DB "${DB_NAME}" ready.`);
}

export async function teardown(): Promise<void> {
  console.log('[integration-teardown] Cleaning up...');

  const adminPool = new Pool({ connectionString: getAdminConnectionString() });
  try {
    // Terminate active connections before dropping
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()
    `);
    await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    console.log(`[integration-teardown] Test DB "${DB_NAME}" dropped.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[integration-teardown] Failed to drop test DB: ${msg}`);
  } finally {
    await adminPool.end();
  }
}
```

**Key design decisions**:
- Uses a SEPARATE database (`hospeda_integration_test`) from the dev database (`hospeda_dev`) and E2E database (`hospeda_test`) to avoid conflicts with running dev server or API E2E tests.
- `drizzle-kit push --force` auto-accepts schema changes (safe for ephemeral test DB). Note: `--force` may not suppress ALL prompts (drizzle-orm #4921), but `stdio: 'pipe'` in execSync prevents stdin blocking.
- `apply-postgres-extras.sh` failure is non-fatal because core tx tests don't need triggers/views. Tests that DO need them should use `it.skipIf()`.
- Connection string passed to workers via `process.env.HOSPEDA_TEST_DATABASE_URL` (see Step 6 comment for rationale).
- Teardown terminates active connections before dropping DB to prevent "database is being accessed by other users" errors.
- **Orphaned DB cleanup**: `setup()` always runs `DROP DATABASE IF EXISTS` before `CREATE DATABASE`, so if a previous test run was killed mid-execution and teardown didn't run, the next run starts clean automatically.
- **ESM compatibility**: Uses `fileURLToPath(import.meta.url)` instead of `__dirname` because the project uses `"type": "module"` in package.json.

### 2. Test Isolation Strategy

Each test runs inside a transaction that is rolled back after the test completes. This provides:

- **Clean state per test** without TRUNCATE overhead (TRUNCATE acquires ACCESS EXCLUSIVE lock on each table, causing contention under parallelism)
- **Parallel safety** because each fork has its own connection pool, and each test's transaction sees only its own uncommitted writes (PostgreSQL READ COMMITTED isolation)

**Important**: This means tests CANNOT verify cross-transaction visibility (e.g., "insert in tx A, read in tx B"). For those tests, use the `withCleanSlate` helper (Section 2.2) instead.

#### 2.1 Transaction Rollback Helper

**File**: `packages/db/test/integration/helpers.ts`

```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as hospedaSchema from '../../src/schemas/index.ts';
import { qzpaySchema } from '@qazuor/qzpay-drizzle';

// Combined schema matching client.ts to ensure type compatibility
// with models and queries that reference qzpay tables.
const schema = { ...hospedaSchema, ...qzpaySchema };

// NOTE: After SPEC-058 lands, replace this type alias with the
// DrizzleClient type exported by @repo/db. See SPEC-058 post-implementation note.
type TestDb = NodePgDatabase<typeof schema>;

/**
 * Sentinel error used to force transaction rollback without propagating as a real error.
 * Only caught by withTestTransaction.
 */
class RollbackSignal extends Error {
  constructor() {
    super('RollbackSignal');
    this.name = 'RollbackSignal';
  }
}

let pool: Pool | null = null;
let cachedDb: TestDb | null = null;

/**
 * Returns a shared connection pool for the current worker process.
 * Creates the pool on first call, reuses it on subsequent calls.
 * Each Vitest fork (process) gets its own pool instance.
 */
export function getTestPool(): Pool {
  if (!pool) {
    const connectionString = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'HOSPEDA_TEST_DATABASE_URL not set. '
        + 'Run tests via "pnpm test:integration" which sets up the test DB.'
      );
    }
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

/**
 * Returns a cached Drizzle client connected to the test database.
 * Uses the shared pool for the current worker. The drizzle instance
 * is created once and reused for all tests in the same worker process.
 */
export function getTestDb(): TestDb {
  if (!cachedDb) {
    // Use object-form API (recommended since drizzle v0.35+). The legacy positional API
    // drizzle(pool, { schema }) still works and is fully typed, but docs recommend this form.
    cachedDb = drizzle({ client: getTestPool(), schema });
  }
  return cachedDb;
}

/**
 * Runs a test function inside a transaction that is ALWAYS rolled back.
 *
 * Usage:
 * ```typescript
 * it('should insert and find within tx', async () => {
 *   await withTestTransaction(async (tx) => {
 *     await tx.insert(users).values(testData.user());
 *     const found = await tx.query.users.findMany();
 *     expect(found).toHaveLength(1);
 *   });
 *   // After this line, the insert is rolled back. DB is clean.
 * });
 * ```
 *
 * @param fn - Test function receiving a transaction-scoped Drizzle client.
 *   All operations within `fn` use this client and see uncommitted data.
 *   The transaction is rolled back after `fn` completes (success or error).
 */
export async function withTestTransaction(
  fn: (tx: TestDb) => Promise<void>,
): Promise<void> {
  const db = getTestDb();
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new RollbackSignal();
    });
  } catch (error) {
    if (error instanceof RollbackSignal) return;
    throw error;
  }
}

/**
 * Runs a test function with a clean database state (TRUNCATE all tables).
 * Use this ONLY for tests that need cross-transaction visibility
 * (e.g., concurrent transaction isolation tests).
 *
 * This is SLOWER than withTestTransaction. Prefer withTestTransaction
 * for single-transaction tests.
 */
export async function withCleanSlate(
  fn: (db: TestDb) => Promise<void>,
): Promise<void> {
  const db = getTestDb();
  const p = getTestPool();

  // Truncate all user tables (not system tables)
  const result = await p.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const tables = result.rows.map((r: { tablename: string }) => `"${r.tablename}"`);
  if (tables.length > 0) {
    await p.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
  }

  await fn(db);
}

/**
 * Closes the connection pool and clears cached instances for the current worker.
 * Called in afterAll() to prevent hanging processes.
 */
export async function closeTestPool(): Promise<void> {
  cachedDb = null;
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Creates minimal test data for a given entity.
 * Each factory returns the data needed to insert a valid row,
 * satisfying all NOT NULL and FK constraints.
 *
 * NOTE: These are intentionally minimal. They create the bare minimum
 * for a valid row. Tests should override specific fields as needed.
 *
 * IMPORTANT: Column names MUST match the actual Drizzle schema definitions
 * in packages/db/src/schemas/. The users table does NOT have a `name` column;
 * it uses `displayName`, `firstName`, `lastName` instead (Better Auth customization).
 */
export const testData = {
  /**
   * Creates a valid user record. Used as FK dependency for most entities.
   *
   * Required NOT NULL columns: id (defaultRandom), slug (auto-generated),
   * email (unique), emailVerified, role (default USER), settings (has default),
   * visibility (default PUBLIC), lifecycleState (default ACTIVE),
   * createdAt/updatedAt (default NOW).
   */
  user(overrides: Partial<typeof hospedaSchema.users.$inferInsert> = {}) {
    return {
      id: crypto.randomUUID(),
      email: `test-${crypto.randomUUID()}@example.com`,
      displayName: 'Test User',
      emailVerified: true,
      lifecycleState: 'ACTIVE' as const,
      createdById: null,
      ...overrides,
    };
  },

  /**
   * Creates a valid destination record.
   *
   * Required NOT NULL columns (no default): slug (unique), name,
   * destinationType (enum), path (unique), summary, description,
   * location (jsonb, BaseLocationType), media (jsonb, Media).
   *
   * Required NOT NULL columns (with defaults): id (defaultRandom), level (default 0),
   * pathIds (default ''), isFeatured (default false), visibility (default PUBLIC),
   * lifecycleState (default ACTIVE), moderationState (default PENDING),
   * reviewsCount (default 0), averageRating (default 0),
   * createdAt/updatedAt (default NOW).
   *
   * NOTE: Destinations have many required complex fields (location, media, summary,
   * description, path). This factory is provided for tests that need FK targets
   * beyond users. For most tx propagation tests, prefer the simpler `user()` factory.
   */
  destination(overrides: Partial<typeof hospedaSchema.destinations.$inferInsert> = {}) {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
      id: crypto.randomUUID(),
      slug: `test-dest-${uid}`,
      name: 'Test Destination',
      destinationType: 'CITY' as const,
      level: 4,
      path: `/test/dest-${uid}`,
      summary: 'Test destination summary',
      description: 'Test destination description',
      // BaseLocationType (packages/schemas/src/common/location.schema.ts):
      // { state?, zipCode?, country?, coordinates?: { lat: string, long: string } }
      // All fields are optional. Minimal valid object is {}.
      location: {
        state: 'Entre Rios',
        country: 'Argentina',
        coordinates: { lat: '-32.48', long: '-58.23' },
      },
      // Media (packages/schemas/src/common/media.schema.ts):
      // { featuredImage: { moderationState, url, caption?, description? }, gallery?, videos? }
      // featuredImage is REQUIRED with moderationState and url.
      media: {
        featuredImage: {
          moderationState: 'APPROVED',
          url: 'https://example.com/test-destination.jpg',
        },
      },
      lifecycleState: 'ACTIVE' as const,
      ...overrides,
    };
  },

  /**
   * Creates a valid tag record.
   * Required NOT NULL columns: id (defaultRandom), slug (unique), name,
   * color (TagColorPgEnum, no default), lifecycleState (default ACTIVE),
   * createdAt/updatedAt (default NOW).
   */
  tag(overrides: Partial<typeof hospedaSchema.tags.$inferInsert> = {}) {
    return {
      id: crypto.randomUUID(),
      slug: `test-tag-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Test Tag',
      // Verified: BLUE is a valid TagColorPgEnum value.
      // Full enum: RED, BLUE, GREEN, YELLOW, ORANGE, PURPLE, PINK, BROWN,
      // GREY, WHITE, CYAN, MAGENTA, LIGHT_BLUE, LIGHT_GREEN
      color: 'BLUE' as const,
      lifecycleState: 'ACTIVE' as const,
      ...overrides,
    };
  },
} as const;
```

#### 2.2 Worker Lifecycle

Each test file should use this pattern:

```typescript
import { afterAll, describe, it, expect } from 'vitest';
import { withTestTransaction, closeTestPool } from './helpers.ts';

afterAll(async () => {
  await closeTestPool();
});

describe('my integration test', () => {
  it('should do something', async () => {
    await withTestTransaction(async (tx) => {
      // test code using tx
    });
  });
});
```

### 3. Core Integration Tests

**File**: `packages/db/test/integration/tx-propagation.test.ts`

These tests verify the critical transaction propagation paths established by SPEC-053 and validated by SPEC-060.

| # | Test | Purpose | Helper |
|---|------|---------|--------|
| 1 | `findAllWithRelations` sees tx data | Insert user via tx -> `findAllWithRelations` with same tx via relational query API (`tx.query.users.findMany()`) -> verify row visible -> after rollback verify row gone | `withTestTransaction` |
| 2 | `withTransaction` rollback on error | Start tx -> insert user -> throw Error -> verify user row absent from DB | Direct db access |
| 3 | `count()` with tx | Insert 3 rows inside tx -> `count()` with tx -> verify count includes uncommitted rows | `withTestTransaction` |
| 4 | `findAll()` with tx | Insert rows inside tx -> `findAll()` with tx -> verify items visible | `withTestTransaction` |
| 5 | `create()` + `findById()` with tx | Create entity with tx -> findById with same tx -> verify found -> rollback -> findById without tx -> verify not found | `withTestTransaction` |
| 6 | `softDelete()` + `restore()` with tx | Create entity -> softDelete with tx -> verify `deletedAt` set -> restore with tx -> verify `deletedAt` null -> rollback -> verify original state | `withTestTransaction` |
| 7 | Concurrent tx isolation | Two separate transactions with REPEATABLE READ: tx1 inserts user A, tx2 inserts user B. tx1 cannot see user B and vice versa (snapshot isolation). Uses REPEATABLE READ to guarantee deterministic behavior regardless of timing. | `withCleanSlate` |
| 8 | Unique constraint enforcement | Insert user with email X -> insert another user with same email X -> verify throws constraint violation error with specific error code `23505` | `withTestTransaction` |
| 9 | FK constraint enforcement | Insert entity referencing non-existent FK -> verify throws constraint violation error with code `23503` | `withTestTransaction` |
| 10 | `update()` + `updateById()` with tx | Create entity -> update via tx -> verify change visible in tx -> rollback -> verify original value | `withTestTransaction` |

**Concrete table to test**: `users` (simplest entity, fewest FK dependencies, used as FK target by most other entities). Tests use the `users` table via the raw Drizzle query API (insert, select, update, tx.query) to validate the underlying transaction mechanism. Model-level tests (using `UserModel` class methods like `findById(id, tx)`, `create(data, tx)`) are intentionally deferred.. they require SPEC-058 and SPEC-060 to land first. Once those specs are implemented, a follow-up test file (`model-tx-propagation.test.ts`) should be added to verify that model methods correctly propagate `tx` to the underlying Drizzle calls.

### 4. Test File Structure

```typescript
// packages/db/test/integration/tx-propagation.test.ts
import { afterAll, describe, it, expect } from 'vitest';
import {
  withTestTransaction,
  withCleanSlate,
  closeTestPool,
  getTestDb,
  testData,
} from './helpers.ts';
import { users } from '../../src/schemas/index.ts';
import { eq } from 'drizzle-orm';

afterAll(async () => {
  await closeTestPool();
});

describe('Transaction Propagation (real PostgreSQL)', () => {
  // ── Test 1: findMany sees uncommitted data within tx ──────────────
  describe('Drizzle query API with tx', () => {
    it('findMany sees uncommitted data within the same tx', async () => {
      const userId = crypto.randomUUID();

      await withTestTransaction(async (tx) => {
        const userData = testData.user({ id: userId });
        await tx.insert(users).values(userData);

        // Drizzle relational query API (tx.query.users.findMany)
        const found = await tx.query.users.findMany({
          where: eq(users.id, userData.id),
        });

        expect(found).toHaveLength(1);
        expect(found[0].email).toBe(userData.email);
      });

      // After rollback, verify the specific row is gone (use unique ID, not length,
      // because parallel tests may have committed rows in between)
      const db = getTestDb();
      const afterRollback = await db.query.users.findMany({
        where: eq(users.id, userId),
      });
      expect(afterRollback).toHaveLength(0);
    });

    // ── Test 2: withTransaction rollback on error ─────────────────────
    it('withTransaction rolls back on error', async () => {
      const db = getTestDb();
      const userData = testData.user();

      await expect(
        db.transaction(async (tx) => {
          await tx.insert(users).values(userData);
          throw new Error('Intentional rollback');
        }),
      ).rejects.toThrow('Intentional rollback');

      // Verify row was NOT committed
      const found = await db.query.users.findMany({
        where: eq(users.id, userData.id),
      });
      expect(found).toHaveLength(0);
    });
  });

  // ── Test 3: count() with tx ─────────────────────────────────────────
  describe('count() with tx', () => {
    it('count includes uncommitted rows within tx', async () => {
      await withTestTransaction(async (tx) => {
        const before = await tx.select().from(users);
        const countBefore = before.length;

        await tx.insert(users).values(testData.user());
        await tx.insert(users).values(testData.user());
        await tx.insert(users).values(testData.user());

        const after = await tx.select().from(users);
        expect(after.length).toBe(countBefore + 3);
      });
    });
  });

  // ── Test 4: findAll() with tx ───────────────────────────────────────
  describe('findAll() with tx', () => {
    it('findAll returns uncommitted rows within tx', async () => {
      await withTestTransaction(async (tx) => {
        const user1 = testData.user();
        const user2 = testData.user();
        await tx.insert(users).values(user1);
        await tx.insert(users).values(user2);

        const found = await tx.select().from(users).where(
          eq(users.id, user1.id),
        );
        expect(found).toHaveLength(1);
        expect(found[0].email).toBe(user1.email);

        const found2 = await tx.select().from(users).where(
          eq(users.id, user2.id),
        );
        expect(found2).toHaveLength(1);
      });
    });
  });

  // ── Test 5: create() + findById() with tx ───────────────────────────
  describe('create() + findById() with tx', () => {
    it('created entity is visible via findById within same tx, gone after rollback', async () => {
      const userId = crypto.randomUUID();

      await withTestTransaction(async (tx) => {
        await tx.insert(users).values(testData.user({ id: userId }));

        // findById equivalent via relational query
        const found = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        });
        expect(found).toBeDefined();
        expect(found!.id).toBe(userId);
      });

      // After rollback, row must not exist
      const db = getTestDb();
      const afterRollback = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      expect(afterRollback).toBeUndefined();
    });
  });

  // ── Test 6: softDelete() + restore() with tx ───────────────────────
  describe('softDelete() + restore() with tx', () => {
    it('softDelete sets deletedAt, restore clears it, rollback reverts both', async () => {
      const userId = crypto.randomUUID();

      await withTestTransaction(async (tx) => {
        // Create user
        await tx.insert(users).values(testData.user({ id: userId }));

        // softDelete: set deletedAt
        const now = new Date();
        await tx.update(users)
          .set({ deletedAt: now })
          .where(eq(users.id, userId));

        const afterDelete = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        });
        expect(afterDelete).toBeDefined();
        expect(afterDelete!.deletedAt).not.toBeNull();

        // restore: clear deletedAt
        await tx.update(users)
          .set({ deletedAt: null })
          .where(eq(users.id, userId));

        const afterRestore = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        });
        expect(afterRestore).toBeDefined();
        expect(afterRestore!.deletedAt).toBeNull();
      });

      // After rollback, row should not exist at all
      const db = getTestDb();
      const afterRollback = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      expect(afterRollback).toBeUndefined();
    });
  });

  // ── Test 7: Concurrent tx isolation ─────────────────────────────────
  describe('Concurrent tx isolation', () => {
    it('two REPEATABLE READ transactions do not see each other data', async () => {
      await withCleanSlate(async (db) => {
        const userA = testData.user({ displayName: 'User A' });
        const userB = testData.user({ displayName: 'User B' });

        // WHY REPEATABLE READ (not READ COMMITTED):
        // READ COMMITTED only hides UNCOMMITTED data. If txA commits before
        // txB reads, txB WOULD see User A (it's now committed). This makes
        // the test timing-dependent and potentially flaky.
        //
        // REPEATABLE READ takes a snapshot at the START of the transaction.
        // Even if txA commits mid-flight, txB's snapshot won't include it.
        // This makes the assertion DETERMINISTIC regardless of timing.
        //
        // The 100ms delay is still used as best-effort synchronization to
        // ensure both txs overlap, but correctness no longer depends on it.
        const txConfig = { isolationLevel: 'repeatable read' as const };

        const [resultA, resultB] = await Promise.allSettled([
          db.transaction(async (txA) => {
            await txA.insert(users).values(userA);
            // Allow txB time to start and insert
            await new Promise((r) => setTimeout(r, 100));
            const seenByA = await txA.query.users.findMany();
            return seenByA.map((u) => u.displayName);
          }, txConfig),
          db.transaction(async (txB) => {
            await txB.insert(users).values(userB);
            await new Promise((r) => setTimeout(r, 100));
            const seenByB = await txB.query.users.findMany();
            return seenByB.map((u) => u.displayName);
          }, txConfig),
        ]);

        // txA should see User A but NOT User B (snapshot isolation)
        expect(resultA.status).toBe('fulfilled');
        if (resultA.status === 'fulfilled') {
          expect(resultA.value).toContain('User A');
          expect(resultA.value).not.toContain('User B');
        }

        // txB should see User B but NOT User A (snapshot isolation)
        expect(resultB.status).toBe('fulfilled');
        if (resultB.status === 'fulfilled') {
          expect(resultB.value).toContain('User B');
          expect(resultB.value).not.toContain('User A');
        }
      });
    });
  });

  // ── Test 8: Unique constraint enforcement ───────────────────────────
  describe('Constraint enforcement', () => {
    it('rejects duplicate unique constraint (email) with code 23505', async () => {
      await withTestTransaction(async (tx) => {
        const email = `unique-${crypto.randomUUID()}@test.com`;
        await tx.insert(users).values(testData.user({ email }));

        try {
          await tx.insert(users).values(testData.user({ email }));
          expect.fail('Should have thrown unique constraint error');
        } catch (error: unknown) {
          // PostgreSQL unique_violation error code
          expect((error as { code?: string }).code).toBe('23505');
        }
      });
    });

    // ── Test 9: FK constraint enforcement ─────────────────────────────
    it('rejects invalid foreign key reference with code 23503', async () => {
      await withTestTransaction(async (tx) => {
        const nonExistentUserId = crypto.randomUUID();

        try {
          // createdById references users.id .. using a non-existent UUID triggers FK violation
          await tx.insert(users).values(
            testData.user({ createdById: nonExistentUserId }),
          );
          expect.fail('Should have thrown FK constraint error');
        } catch (error: unknown) {
          // PostgreSQL foreign_key_violation error code
          expect((error as { code?: string }).code).toBe('23503');
        }
      });
    });
  });

  // ── Test 10: update() + updateById() with tx ───────────────────────
  describe('update() with tx', () => {
    it('update is visible within tx, reverted after rollback', async () => {
      const userId = crypto.randomUUID();
      const originalEmail = `original-${crypto.randomUUID()}@test.com`;
      const updatedEmail = `updated-${crypto.randomUUID()}@test.com`;

      await withTestTransaction(async (tx) => {
        // Create with original email
        await tx.insert(users).values(
          testData.user({ id: userId, email: originalEmail }),
        );

        // Update email within tx
        await tx.update(users)
          .set({ email: updatedEmail })
          .where(eq(users.id, userId));

        // Verify update is visible within tx
        const found = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        });
        expect(found).toBeDefined();
        expect(found!.email).toBe(updatedEmail);
      });

      // After rollback, the entire row (insert + update) should be gone
      const db = getTestDb();
      const afterRollback = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      expect(afterRollback).toBeUndefined();
    });
  });
});
```

### 5. CI Pipeline Integration

**File**: `.github/workflows/ci.yml`

The existing CI has a single `quality-check` job. Add a PostgreSQL service container to it and append the integration test step after unit tests.

**Changes to the existing `quality-check` job**:

1. Add `services` block at job level (alongside existing `runs-on`, `timeout-minutes`, `env`):

```yaml
  quality-check:
    name: Quality Check
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: hospeda_user
          POSTGRES_PASSWORD: hospeda_pass
          POSTGRES_DB: postgres
        ports:
          - 5436:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      # ... existing env vars unchanged ...
```

2. Add integration test step AFTER the existing `Run tests with coverage` step:

```yaml
      - name: Run tests with coverage
        run: pnpm test:coverage
        # ... existing step unchanged ...

      - name: Run DB integration tests
        run: pnpm test:integration
        env:
          HOSPEDA_TEST_DATABASE_URL: postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres
```

**Notes**:
- The service container uses the SAME image (`postgres:15-alpine`) and credentials as `docker-compose.yml` for consistency.
- Port `5436:5432` maps the container's 5432 to localhost:5436, matching the local Docker Compose mapping.
- GitHub Actions service containers do NOT support volume mounts, so `docker/postgres/init.sql` is NOT loaded. The `global-setup.ts` handles DB creation and extension installation instead.
- `POSTGRES_DB: postgres` creates only the default admin database. The test setup creates `hospeda_integration_test` via `global-setup.ts`.
- The service container starts when the job begins and is healthy before any step runs (thanks to the `health-cmd` option). No extra wait needed.
- Adding the service to the existing job (vs. a separate job) avoids duplicating checkout/install/build steps, saving ~3-5 minutes of CI time.

### 6. Environment Variables

| Variable | Used In | Default | Purpose |
|----------|---------|---------|---------|
| `HOSPEDA_TEST_DATABASE_URL` | `global-setup.ts`, `helpers.ts` | `postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres` | Base connection string. Global setup connects to this to create the test database. |

**Relationship to existing env vars**:
- `HOSPEDA_DATABASE_URL`: Used by dev server and `drizzle-kit`. NOT used by integration tests.
- `TEST_DB_URL` / `TEST_DB_*`: Used by `apps/api` E2E tests. Separate concern, not modified.
- `HOSPEDA_TEST_DATABASE_URL`: New. Used exclusively by `packages/db` integration tests.

**No `.env.example` update needed**: This variable is only used in test infrastructure (not by any app runtime). It has a sensible default in `global-setup.ts` for local development and is explicitly set in CI via the GitHub Actions step env. Document it only in the integration tests section of `packages/db/CLAUDE.md` (Section 8).

### 7. Relationship to Existing apps/api E2E Tests

The `apps/api/test/e2e/setup/test-database.ts` `TestDatabaseManager` is a more complex setup that includes:
- API-specific env validation (`validateApiEnv()`)
- Full table TRUNCATE with FK bypass (necessary because API E2E tests span multiple requests)
- `singleFork: true` (sequential execution, required because TRUNCATE is not safe under parallelism)

**This spec creates a SIMPLER, PURPOSE-BUILT setup** for `packages/db`:
- No API dependencies (pure DB layer)
- Transaction rollback instead of TRUNCATE (faster, parallelism-safe)
- `singleFork: false` with `maxForks: 3` (parallel execution)
- Focused on tx propagation verification, not API flow testing

If future specs need shared DB test utilities across apps and packages, a `packages/test-utils` extraction can be considered. That is out of scope for this spec.

## Acceptance Criteria

- [ ] `packages/db/vitest.integration.config.ts` exists and is valid
- [ ] `packages/db/test/integration/global-setup.ts` creates and destroys `hospeda_integration_test` DB
- [ ] `global-setup.ts` runs `drizzle-kit push` and `apply-postgres-extras.sh` on the test DB
- [ ] `global-setup.ts` fails with clear error message if Docker is not running
- [ ] `packages/db/test/integration/helpers.ts` exports `withTestTransaction`, `withCleanSlate`, `closeTestPool`, `getTestDb`, `testData`
- [ ] `RollbackSignal` is a private implementation detail (not exported)
- [ ] All 10 core tx propagation tests pass (see Section 3 table)
- [ ] Tests run in parallel (`singleFork: false`) without flakiness
- [ ] `pnpm test:integration` script works from `packages/db` and from root
- [ ] `turbo.json` includes `test:integration` task
- [ ] CI pipeline includes PostgreSQL service container and `pnpm test:integration` step
- [ ] Connection pool is properly closed in `afterAll` of every test file (no hanging processes)
- [ ] Integration tests do NOT run as part of `pnpm test` (only via `pnpm test:integration`)
- [ ] `packages/db/vitest.config.ts` excludes `test/integration/**` to prevent accidental execution
- [ ] Documentation: `packages/db/CLAUDE.md` section explaining how to run integration tests locally (see Section 8)

## Files to Create

| File | Purpose |
|------|---------|
| `packages/db/vitest.integration.config.ts` | Vitest config: forks pool, globalSetup, 30s timeout |
| `packages/db/test/integration/global-setup.ts` | Create test DB, push schema, install extensions, apply extras. Teardown drops DB. |
| `packages/db/test/integration/helpers.ts` | `RollbackSignal`, `withTestTransaction`, `withCleanSlate`, `closeTestPool`, `getTestDb`, `testData` factories |
| `packages/db/test/integration/tx-propagation.test.ts` | 10 core integration tests (Section 3) |

## Files to Modify

| File | Change |
|------|--------|
| `packages/db/package.json` | Add `test:integration` and `test:integration:watch` scripts |
| `packages/db/vitest.config.ts` | Add `'test/integration/**'` to the existing `exclude` array (currently `['node_modules', 'dist', 'build']`) to prevent integration tests from running during `pnpm test` |
| `turbo.json` | Add `test:integration` task (no cache) |
| Root `package.json` | Add `test:integration` script |
| `.github/workflows/ci.yml` | Add PostgreSQL `services` block to `quality-check` job and add integration test step after unit tests |
| `packages/db/drizzle.config.ts` | No change needed (global-setup.ts overrides `HOSPEDA_DATABASE_URL` env var via subprocess env) |

### 8. Documentation

Add the following section to `packages/db/CLAUDE.md` under "Key Commands":

```markdown
## Integration Tests

Integration tests run against a real PostgreSQL instance (via Docker) to verify
transaction propagation, constraint enforcement, and query correctness.

### Prerequisites

- Docker running with PostgreSQL container: `pnpm db:start`
- The test infrastructure creates and drops its own database (`hospeda_integration_test`)
  automatically. It does NOT touch your dev database.

### Commands

```bash
pnpm test:integration          # Run all integration tests (from packages/db or root)
pnpm test:integration:watch    # Watch mode for development
```

### How It Works

1. **Global setup** creates `hospeda_integration_test` DB, pushes Drizzle schema, installs extensions
2. Each test runs inside a **transaction that is always rolled back** (clean state per test, no TRUNCATE overhead)
3. Tests that need cross-transaction visibility use `withCleanSlate` helper (TRUNCATE-based, slower)
4. **Global teardown** drops the test database after all tests complete
5. Tests run in parallel (`maxForks: 3`) because transaction isolation prevents cross-test interference

### Troubleshooting

- **"Cannot connect to PostgreSQL"**: Run `pnpm db:start` to start Docker containers
- **Schema push fails**: Ensure `packages/db/drizzle.config.ts` is valid and schema compiles
- **Orphaned test DB**: Killed test runs leave the DB behind; the next run drops it automatically
```

## Estimated Effort

5-6 days:
- Day 1: Vitest config, global-setup.ts (DB lifecycle)
- Day 2: helpers.ts (transaction helpers, test data factories)
- Day 3: tx-propagation.test.ts (tests 1-6)
- Day 4: tx-propagation.test.ts (tests 7-10), parallel execution verification
- Day 5: CI pipeline integration (GitHub Actions service container)
- Day 6: Documentation, edge case handling, cleanup

## Risks

| Risk | Mitigation |
|------|------------|
| Docker not running locally | `global-setup.ts` fails fast with clear error message and hint to run `pnpm db:start` |
| `drizzle-kit push` fails on schema | Schema is already validated by unit tests. Push failure in setup aborts all tests with clear error. |
| `apply-postgres-extras.sh` fails | Non-fatal warning. Core tx tests don't need triggers/views. Tests that do should use `it.skipIf()`. |
| Port 5436 conflict (dev DB running) | Integration tests use a SEPARATE database (`hospeda_integration_test`) on the same PostgreSQL instance. No conflict. |
| CI secret `HOSPEDA_DATABASE_URL` vs service container | Integration tests use `HOSPEDA_TEST_DATABASE_URL` pointing to the service container. Unit tests continue using the secret. |
| Parallel test flakiness | Transaction rollback guarantees isolation. If a test is flaky, it's a bug in the test, not the infrastructure. |
| Connection pool exhaustion | `maxForks: 3` limits workers. Each pool has `max: 5` connections. Total: 15 connections max. PostgreSQL default `max_connections` is 100. |
| `process.env` propagation changes in future Vitest | Env vars set in globalSetup propagate to forks via standard Node.js `child_process.fork()` inheritance. If Vitest changes worker strategy, switch to `provide`/`inject` or a `.env.integration.test` file. |
| Vitest v4 breaking changes | Project uses Vitest ^3.1.3. In v4, `poolOptions` is removed entirely: `maxForks`/`maxThreads` unify into top-level `maxWorkers`, `singleFork: true` becomes `maxWorkers: 1, isolate: false`, and env vars change from `VITEST_MAX_FORKS` to `VITEST_MAX_WORKERS`. Pin Vitest to ^3.x or update config on upgrade. |
| Drizzle `drizzle()` API evolution | The legacy `drizzle(pool, opts)` positional API still works in drizzle-orm 0.44.x with full type support and no runtime deprecation warning. The documentation now recommends the object-form `drizzle({ client, schema })` which this spec uses. If a future version formally deprecates the positional API, no change needed here (spec already uses the recommended form). |
| `drizzle-kit push --force` may not suppress all prompts | Known bug (drizzle-orm GitHub #4490): `--force` may not suppress ALL interactive prompts (e.g., "truncate table?" when adding unique constraints to existing data). Related feature request #4921 proposes `--auto-approve` as a solution. Mitigation: `stdio: 'pipe'` (already done in global-setup.ts) prevents stdin prompts from blocking. Monitor for failures. |
| ESM compatibility | Uses `fileURLToPath(import.meta.url)` for path resolution. If project switches back to CJS (unlikely), revert to `__dirname`. |

## Out of Scope

- Performance/load testing
- Testing ALL model methods (focused on core tx mechanism at Drizzle level)
- Model-level tx propagation tests (deferred until SPEC-058 + SPEC-060 land; then add `model-tx-propagation.test.ts`)
- Extracting shared test utilities to `packages/test-utils`
- Modifying existing `apps/api` E2E test setup
- Testing billing/QZPay-specific tables (deferred to SPEC-064)
- Seed data beyond minimal test factories

## Review History

### Review Pass 6 (2026-04-02) .. External library verification and cross-spec audit

**Sources consulted**: Vitest v3.x official docs (globalSetup, poolOptions, hooks, provide/inject), Vitest v4 migration guide, Drizzle ORM v0.44.x source code and docs (transaction API, drizzle-kit push), PostgreSQL official docs (isolation levels, error codes, TRUNCATE locks, max_connections), node-postgres docs (Pool options), drizzle-orm GitHub issues (#4490, #4921), all specs SPEC-050 through SPEC-065.

**Methodology**: 4 parallel research agents verified every external library/service claim against official documentation. 1 agent verified all test data factories against actual DB schema files.

**Changes made**:

1. **FIX (drizzle-kit issue number)**: Risk table referenced GitHub #4921 as the bug for `--force` not suppressing prompts. Actual bug is **#4490**; #4921 is a feature request for `--auto-approve`. Fixed both in risk table and review pass 5 notes.
2. **FIX (hookTimeout comment)**: Was "for beforeAll/afterAll hooks". Vitest docs say hookTimeout applies to ALL lifecycle hooks (beforeAll, afterAll, beforeEach, afterEach). Fixed comment to be accurate.
3. **FIX (pg native segfault claim)**: Was "The pg native module can segfault in threads mode". This is a reasonable concern but not a documented specific issue for pg. Changed to softer "Native modules (including pg) may have issues in threads mode (native addons are not always thread-safe)".
4. **FIX (TRUNCATE speed claim)**: Was "TRUNCATE ... is slow on many tables". PostgreSQL docs don't support this.. TRUNCATE is actually faster than DELETE. The real issue is ACCESS EXCLUSIVE lock contention under parallelism. Fixed description.
5. **FIX (Vitest v4 migration details)**: Added specifics: `poolOptions` removed entirely, `singleFork: true` replaced by `maxWorkers: 1, isolate: false`, env var changes from `VITEST_MAX_FORKS` to `VITEST_MAX_WORKERS`.
6. **FIX (UserModel class methods claim)**: Section 3 claimed "Tests use the users table via both the Drizzle query API and the UserModel class methods" but ALL 10 tests use raw Drizzle API only. Fixed description to reflect reality: tests validate tx mechanism at Drizzle level. Added note that model-level tests (`model-tx-propagation.test.ts`) should be added after SPEC-058+060 land.
7. **FIX (Validates header)**: Split into current validation (SPEC-053 at Drizzle level, SPEC-059 infrastructure) and deferred validation (SPEC-060 model subclass propagation, pending SPEC-058+060).

**Verified correct (no changes needed)**:
- All test data factories (user, destination, tag) match actual DB schemas 100%
- All PostgreSQL error codes (23505, 23503) confirmed stable
- REPEATABLE READ isolation behavior correctly described
- Drizzle `db.transaction(fn, { isolationLevel })` API confirmed valid
- Drizzle `tx.query.*` relational API works inside transactions (confirmed)
- `drizzle-kit push --force --config` flags both valid
- `NodePgDatabase` import from `drizzle-orm/node-postgres` correct
- `@qazuor/qzpay-drizzle` exists (v1.2.0) and exports `qzpaySchema`
- Combined schema `{ ...hospedaSchema, ...qzpaySchema }` matches client.ts
- pg.Pool `max: 5` is valid (default is 10)
- PG max_connections default 100 confirmed
- Vitest globalSetup `setup()`/`teardown()` named exports confirmed (setup receives TestProject arg, ignored here which is fine)
- process.env propagation via child_process.fork() works de facto (correctly caveated in spec)
- No overlaps or contradictions found across SPEC-050 to SPEC-065
- Dependency graph is clean: SPEC-058→061, SPEC-060→061, SPEC-061→064

### Review Pass 5 (2026-04-02) .. Deep schema verification and cross-spec validation

**Sources consulted**: Actual codebase schema files (user.dbschema.ts, destination.dbschema.ts, tag.dbschema.ts, enums.dbschema.ts, location.schema.ts, media.schema.ts, client.ts), Vitest v3.x docs, drizzle-orm docs, drizzle-kit docs (--force flag), PostgreSQL error codes, all specs SPEC-050 through SPEC-065, CI workflow, turbo.json, Docker config.

**Changes made**:

1. **FIX (destination factory `location` shape)**: Was `{ lat: -32.48, lng: -58.23, address: 'Test Address' }`. Actual `BaseLocationType` (from `packages/schemas/src/common/location.schema.ts`) is `{ state?, zipCode?, country?, coordinates?: { lat: string, long: string } }`. Fixed to `{ state: 'Entre Rios', country: 'Argentina', coordinates: { lat: '-32.48', long: '-58.23' } }`. Note: `lat`/`long` are strings (not numbers), and the field is `long` (not `lng`).
2. **FIX (destination factory `media` shape)**: Was `{ images: [], videos: [] }`. Actual `Media` (from `packages/schemas/src/common/media.schema.ts`) requires `{ featuredImage: { moderationState, url }, gallery?, videos? }`. The `featuredImage` field is REQUIRED. Fixed to include `moderationState: 'APPROVED'` and a placeholder URL.
3. **FIX (test file count)**: Was 41. Actual count via glob is 42 files in `packages/db/test/**/*.test.ts` (33 models + 4 utils + 2 root + 2 exchange-rate + 1 billing).
4. **FIX (destination factory JSDoc)**: Added missing NOT NULL columns with defaults: `pathIds` (default ''), `isFeatured` (default false), `reviewsCount` (default 0), `averageRating` (default 0). These were omitted from the column documentation.
5. **RESOLVED (IMPLEMENTATION NOTEs)**: Replaced placeholder "verify these objects" comments with verified type shapes and references to source files. Tag color 'BLUE' confirmed valid (14 values in TagColorPgEnum).
6. **ADD (drizzle-kit --force CI risk)**: Added risk entry for known bug #4490 where `--force` may not suppress all interactive prompts (related feature request #4921). Noted that `stdio: 'pipe'` in execSync (already in the code) mitigates stdin blocking.

**Verified correct (no changes needed)**:
- User factory: `displayName` (not `name`), `emailVerified` exists as boolean, `createdById` is self-referencing FK, `slug` has `$defaultFn()` auto-gen
- Drizzle `drizzle({ client, schema })` object-form API: confirmed recommended in docs
- Drizzle `db.transaction(fn, { isolationLevel: 'repeatable read' })`: confirmed valid API with `PgTransactionConfig` interface
- `drizzle-kit push --force`: confirmed valid CLI flag
- PostgreSQL error codes 23505 (unique_violation) and 23503 (foreign_key_violation): confirmed stable
- Vitest `globalSetup` named exports `setup()`/`teardown()`: confirmed in v3.x (receives `TestProject` arg)
- Vitest `provide`/`inject`: confirmed available (spec correctly caveats process.env approach)
- `teardownTimeout`: correctly documented as global Vitest shutdown timeout
- No overlaps or contradictions found across SPEC-050 to SPEC-065
- CI workflow: `quality-check` job exists, no services block yet, uses `HOSPEDA_DATABASE_URL` secret
- `turbo.json`: no `test:integration` task yet (spec correctly proposes adding it)
- `packages/db/vitest.config.ts` exclude array: `['node_modules', 'dist', 'build']` confirmed
- `apply-postgres-extras.sh`: accepts connection string as $1, falls back to env vars
- Combined schema in `client.ts`: `{ ...hospedaSchema, ...qzpaySchema }` matches helpers.ts pattern
- Docker: PostgreSQL 15 Alpine on port 5436, init.sql creates `hospeda_test` + extensions

### Review Pass 4 (2026-04-02) .. Exhaustive cross-validation

**Sources consulted**: Vitest v3.x docs, drizzle-orm 0.44.x source + docs, drizzle-kit 0.31.x docs, PostgreSQL isolation level docs, all related specs (SPEC-050 through SPEC-065), codebase schemas/configs.

**Changes made**:

1. **FIX (Test 7 .. concurrent tx isolation)**: Changed from READ COMMITTED to REPEATABLE READ isolation level. READ COMMITTED only hides uncommitted data; if txA commits before txB reads, txB would see txA's data, making the test timing-dependent and potentially flaky. REPEATABLE READ takes a snapshot at tx start, making assertions deterministic regardless of timing.
2. **FIX (drizzle-kit push command)**: Added `--config drizzle.config.ts` flag for consistency with project's existing scripts (`db:migrate`, `db:generate`, `db:studio` all pass `--config` explicitly).
3. **FIX (Drizzle API deprecation risk)**: Corrected the claim that the positional `drizzle(pool, opts)` API "is deprecated since v0.35.0". Investigation of drizzle-orm 0.44.7 source shows NO runtime deprecation warning and full type support. The docs recommend the object form but the positional form is not formally deprecated.
4. **FIX (E2E tests reference)**: Clarified that `setupFiles` pattern and `singleFork: true` are from `vitest.config.e2e.ts`, not from `test-database.ts` itself.
5. **ADD (factory implementation notes)**: Added notes to verify `BaseLocationType`, `Media`, and `TagColorPgEnum` type shapes match factory data before implementation. These are JSONB/enum types that need exact field matching.
6. **ADD (drizzle-kit comment)**: Updated code comment to explain why `--config` is passed explicitly.

**Verified correct (no changes needed)**:
- ~~41~~ 42 test files count: corrected in pass 5
- `vitest.config.ts` exclude array: `['node_modules', 'dist', 'build']` confirmed
- Docker PostgreSQL 15 Alpine on port 5436: confirmed
- `docker/postgres/init.sql` creates `hospeda_test` + extensions: confirmed
- `apply-postgres-extras.sh` accepts connection string as first argument: confirmed
- `users.slug` has `.$defaultFn()`: auto-generated, factory correctly omits it
- `users.role` default `'USER'`, `settings` default object, `visibility` default `'PUBLIC'`: all confirmed
- `destinations.summary` exists and is `.notNull()`: confirmed
- `destinations.level` has `.default(0)`: confirmed
- `@qazuor/qzpay-drizzle` dependency exists, exports `qzpaySchema`: confirmed
- Combined schema pattern in `client.ts` matches `helpers.ts`: confirmed
- Vitest `globalSetup` supports named `setup()`/`teardown()` exports: confirmed
- `poolOptions.forks.singleFork` and `maxForks` valid in Vitest 3.x: confirmed (checked TypeScript types)
- `drizzle-kit push --force` flag valid: confirmed
- `teardownTimeout` is global Vitest shutdown, not per-test: confirmed
- `process.env` propagation via `child_process.fork()`: works but undocumented Vitest API (correctly caveated)
- No overlaps or contradictions with SPEC-050 through SPEC-065: dependency graph is clean

### Review Pass 1-3 (2026-04-01 to 2026-04-02)

Initial drafting and iterative refinement of infrastructure design, test cases, CI integration, and documentation.

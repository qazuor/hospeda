/**
 * Global setup for `packages/seed` real-DB integration tests (HOS-25).
 *
 * The versioned seed data-migration tests (runner, ledger, fkGuard,
 * safeDelete, baselineStamp, billing-plans-port, lifecycle) exercise the real
 * migration runner + `seed_migrations` ledger against a live PostgreSQL
 * database. They MUST NOT run in the sharded unit-test job (which has no
 * database), so they live in the integration carril and are provisioned here.
 *
 * Runs ONCE before any worker starts and ONCE after all workers finish:
 *   1. Verify PostgreSQL is reachable (with retries for Docker/CI warmup).
 *   2. Drop + recreate the ephemeral `hospeda_seed_integration_test` database
 *      (separate from `packages/db`'s `hospeda_integration_test` and
 *      `packages/service-core`'s `hospeda_service_integration_test`, so all
 *      three suites can run in parallel under turbo without colliding).
 *   3. Install the required PostgreSQL extensions.
 *   4. Apply the versioned Drizzle migrations via `@repo/db`'s own drizzle-kit
 *      script (NOT push — same versioned carril as the VPS), which creates the
 *      `seed_migrations` ledger table the tests depend on.
 *   5. Apply triggers/views/CHECK constraints via `apply-postgres-extras.mjs`
 *      (pg driver, no `psql` CLI dependency; non-fatal — the data-migration
 *      tests do not require them).
 *   6. Export the test connection string as BOTH `HOSPEDA_DATABASE_URL` (which
 *      each test's own `new Pool(...)` bootstrap reads) and
 *      `HOSPEDA_TEST_DATABASE_URL`, so worker forks inherit it.
 *
 * On teardown, the test database is dropped after killing any leftover
 * connections. Wired through `globalSetup` in `vitest.integration.config.ts`.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_NAME = 'hospeda_seed_integration_test';
const CONNECTION_BASE =
    process.env.HOSPEDA_TEST_DATABASE_URL ||
    'postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres';

const MAX_CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 2_000;

/** Returns a connection string that points at the `postgres` admin DB. */
function getAdminConnectionString(): string {
    const url = new URL(CONNECTION_BASE);
    url.pathname = '/postgres';
    return url.toString();
}

/** Returns the connection string for the ephemeral test database. */
function getTestConnectionString(): string {
    const url = new URL(CONNECTION_BASE);
    url.pathname = `/${DB_NAME}`;
    return url.toString();
}

/** Vitest globalSetup entry — runs ONCE before any worker. */
export async function setup(): Promise<void> {
    console.info('[seed-integration-setup] Starting DB setup...');

    // 1. Verify PostgreSQL reachable, retry to absorb container warmup.
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
                    `[seed-integration-setup] Cannot connect to PostgreSQL after ${MAX_CONNECT_RETRIES} attempts. Is Docker running?\n  Connection: ${getAdminConnectionString()}\n  Error: ${msg}\n  Hint: Run "pnpm db:start" to start the Docker containers.`
                );
            }
            console.info(
                `[seed-integration-setup] PostgreSQL not ready (attempt ${attempt}/${MAX_CONNECT_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
    }

    // 2. Drop + recreate test DB (idempotent: orphaned state from killed runs is wiped).
    await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
    await adminPool.end();

    // 3. Install extensions on the freshly created DB.
    const testPool = new Pool({ connectionString: getTestConnectionString() });
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    await testPool.end();

    // 4. Apply the versioned Drizzle migrations (NOT push — SPEC-178: CI uses
    //    the same versioned carril as the VPS) via @repo/db's own drizzle-kit
    //    script. This creates every table, including the `seed_migrations`
    //    ledger the data-migration tests read/write.
    const dbPkgDir = resolve(__dirname, '../../../db');
    try {
        execFileSync('pnpm', ['run', 'drizzle-kit', 'migrate', '--config', 'drizzle.config.ts'], {
            cwd: dbPkgDir,
            env: { ...process.env, HOSPEDA_DATABASE_URL: getTestConnectionString() },
            stdio: 'pipe',
            timeout: 120_000
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
            `[seed-integration-setup] drizzle-kit migrate failed.\n  Error: ${msg}\n  Hint: Check that packages/db/drizzle.config.ts is valid and migrations under packages/db/src/migrations/ apply cleanly.`
        );
    }

    // 5. Apply triggers, materialized views, CHECK constraints. Use the Node
    //    variant (apply-postgres-extras.mjs) which uses the `pg` driver and has
    //    no dependency on the `psql` CLI being installed on the runner. Failure
    //    is non-fatal: the data-migration tests do not depend on triggers/views.
    const extrasScript = resolve(dbPkgDir, 'scripts/apply-postgres-extras.mjs');
    try {
        execFileSync('node', [extrasScript, getTestConnectionString()], {
            cwd: dbPkgDir,
            stdio: 'pipe',
            timeout: 60_000
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(
            `[seed-integration-setup] apply-postgres-extras.mjs failed (non-fatal).\n  Error: ${msg}`
        );
    }

    // 6. Seed the required billing plans. The billing-plans-port data-migration
    //    tests operate on already-seeded plan rows (they mutate the seeded rows
    //    then roll back), mirroring the deployed environments these ported
    //    migrations actually target. The other data-migration tests are
    //    self-contained (they create their own scratch data) and need no
    //    baseline seed.
    //
    //    The plan rows are inserted via `ensurePlan` with an EXPLICIT Drizzle
    //    client rather than the seeder's `getDb()` singleton. globalSetup and
    //    the seed source can resolve `@repo/db` to two distinct module copies
    //    (the classic dist-vs-src double-instance) whose singletons don't share
    //    state — so seeding through the singleton silently fails with "Database
    //    not initialized". Passing the client explicitly sidesteps that: the
    //    table objects are plain pgTable metadata and work with any pg client.
    //    Only `billing_plans` is needed (the tests never read `billing_prices`).
    const { initializeDb, resetDb, getDb } = await import('@repo/db');
    const { ALL_PLANS } = await import('@repo/billing');
    const { _internals } = await import('../../src/required/billingPlans.seed.js');
    const seedPool = new Pool({ connectionString: getTestConnectionString() });
    resetDb();
    initializeDb(seedPool);
    try {
        const seedDb = getDb();
        for (const plan of ALL_PLANS) {
            await _internals.ensurePlan(plan, false, seedDb);
        }
    } finally {
        await seedPool.end();
        resetDb();
    }

    // 7. Export connection string for worker forks to inherit via fork() env.
    //    Each data-migration test bootstraps its own `new Pool(...)` from
    //    HOSPEDA_DATABASE_URL, so BOTH names must point at the test DB.
    process.env.HOSPEDA_DATABASE_URL = getTestConnectionString();
    process.env.HOSPEDA_TEST_DATABASE_URL = getTestConnectionString();

    console.info(`[seed-integration-setup] Test DB "${DB_NAME}" ready.`);
}

/** Vitest globalSetup teardown — runs ONCE after the last worker exits. */
export async function teardown(): Promise<void> {
    console.info('[seed-integration-teardown] Cleaning up...');

    const adminPool = new Pool({ connectionString: getAdminConnectionString() });
    try {
        // Terminate active backends so DROP DATABASE does not fail with
        // "database is being accessed by other users".
        await adminPool.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [DB_NAME]
        );
        await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
        console.info(`[seed-integration-teardown] Test DB "${DB_NAME}" dropped.`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[seed-integration-teardown] Failed to drop test DB: ${msg}`);
    } finally {
        await adminPool.end();
    }
}

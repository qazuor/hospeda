/**
 * Global setup for `packages/db` integration tests (SPEC-061).
 *
 * Runs ONCE before any worker starts and ONCE after all workers finish.
 * Responsibilities:
 *   1. Verify PostgreSQL is reachable (with retries for Docker startup).
 *   2. Drop and recreate the ephemeral `hospeda_integration_test` database.
 *   3. Install required PostgreSQL extensions on the test DB.
 *   4. Push the Drizzle schema via `drizzle-kit push`.
 *   5. Apply triggers/views/CHECK constraints via `apply-postgres-extras.sh`
 *      (non-fatal — core tx tests do not need them).
 *   6. Export the connection string via `process.env.HOSPEDA_TEST_DATABASE_URL`
 *      so worker forks inherit it.
 *
 * On teardown, the test database is dropped after killing any leftover
 * connections.
 *
 * Wired through `globalSetup` in `vitest.config.integration.ts`.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_NAME = 'hospeda_integration_test';
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
    console.info('[integration-setup] Starting DB setup...');

    // 1. Verify PostgreSQL reachable, retry to absorb Docker container warmup.
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
                    `[integration-setup] Cannot connect to PostgreSQL after ${MAX_CONNECT_RETRIES} attempts. Is Docker running?\n  Connection: ${getAdminConnectionString()}\n  Error: ${msg}\n  Hint: Run "pnpm db:start" to start the Docker containers.`
                );
            }
            console.info(
                `[integration-setup] PostgreSQL not ready (attempt ${attempt}/${MAX_CONNECT_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
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

    // 4. Push the Drizzle schema. The package's own `drizzle-kit` script wraps
    //    `tsx node_modules/drizzle-kit/bin.cjs`, so call pnpm to keep behaviour
    //    consistent with the project's existing scripts.
    //    execFileSync (no shell) avoids any injection vector even though args
    //    are static here.
    const pkgDir = resolve(__dirname, '../..');
    try {
        execFileSync(
            'pnpm',
            ['run', 'drizzle-kit', 'push', '--force', '--config', 'drizzle.config.ts'],
            {
                cwd: pkgDir,
                env: { ...process.env, HOSPEDA_DATABASE_URL: getTestConnectionString() },
                stdio: 'pipe',
                timeout: 120_000
            }
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
            `[integration-setup] drizzle-kit push failed.\n  Error: ${msg}\n  Hint: Check that packages/db/drizzle.config.ts is valid.`
        );
    }

    // 5. Apply triggers, materialized views, CHECK constraints. Use the Node
    //    variant (apply-postgres-extras.mjs) which uses the `pg` driver and
    //    has no dependency on the `psql` CLI being installed on the runner.
    //    The shell variant requires postgresql-client which is NOT present
    //    on GitHub Actions ubuntu-latest images by default — switching to
    //    the .mjs keeps CI green without an extra apt-get install step
    //    (SPEC-108 T-108-03).
    //    Failure here is non-fatal: the core tx-propagation tests do not
    //    depend on them, and tests that DO require triggers/views should
    //    gate on the boolean exported below.
    const extrasScript = resolve(pkgDir, 'scripts/apply-postgres-extras.mjs');
    try {
        execFileSync('node', [extrasScript], {
            cwd: pkgDir,
            env: { ...process.env, HOSPEDA_DATABASE_URL: getTestConnectionString() },
            stdio: 'pipe',
            timeout: 60_000
        });
        process.env.HOSPEDA_TEST_POSTGRES_EXTRAS_APPLIED = '1';
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(
            `[integration-setup] apply-postgres-extras.mjs failed (non-fatal).\n  Error: ${msg}\n  Tests that require triggers/views should skip via it.skipIf().`
        );
        process.env.HOSPEDA_TEST_POSTGRES_EXTRAS_APPLIED = '0';
    }

    // 6. Export connection string for worker forks to inherit via fork() env.
    process.env.HOSPEDA_TEST_DATABASE_URL = getTestConnectionString();

    console.info(`[integration-setup] Test DB "${DB_NAME}" ready.`);
}

/** Vitest globalSetup teardown — runs ONCE after the last worker exits. */
export async function teardown(): Promise<void> {
    console.info('[integration-teardown] Cleaning up...');

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
        console.info(`[integration-teardown] Test DB "${DB_NAME}" dropped.`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[integration-teardown] Failed to drop test DB: ${msg}`);
    } finally {
        await adminPool.end();
    }
}

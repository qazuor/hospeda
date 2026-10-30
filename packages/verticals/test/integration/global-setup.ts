/**
 * Global setup for the `@repo/verticals` integration tests (HOS-1435).
 *
 * Runs ONCE before any worker and ONCE after all of them:
 *   1. Verify PostgreSQL is reachable (with retries for container warmup).
 *   2. Drop + recreate the ephemeral `hospeda_verticals_integration_test`
 *      database, its own name so this suite runs in parallel with the db,
 *      service-core and seed suites under turbo without colliding.
 *   3. Install the extensions the migrations need.
 *   4. Apply the versioned migrations through `@repo/db`'s drizzle-kit (NOT
 *      push: the same versioned carril as the VPS).
 *   5. Apply the extras carril (triggers, CHECKs). FATAL here, unlike the db
 *      suite: the catalog's immutability lives there.
 *   6. Export the connection string as `HOSPEDA_TEST_DATABASE_URL` for the
 *      worker forks.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const DB_NAME = 'hospeda_verticals_integration_test';
const CONNECTION_BASE =
    process.env.HOSPEDA_TEST_DATABASE_URL ||
    'postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres';

const MAX_CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 2_000;

const withDatabase = (name: string): string => {
    const url = new URL(CONNECTION_BASE);
    url.pathname = `/${name}`;
    return url.toString();
};

/** Vitest globalSetup entry: runs ONCE before any worker. */
export async function setup(): Promise<void> {
    const adminPool = new Pool({ connectionString: withDatabase('postgres') });
    for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
        try {
            await adminPool.query('SELECT 1');
            break;
        } catch (error) {
            if (attempt === MAX_CONNECT_RETRIES) {
                await adminPool.end();
                const msg = error instanceof Error ? error.message : String(error);
                throw new Error(
                    `[verticals-integration-setup] Cannot connect to PostgreSQL: ${msg}. Run "pnpm db:start".`
                );
            }
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
    }
    await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
    await adminPool.end();

    const testUrl = withDatabase(DB_NAME);
    const testPool = new Pool({ connectionString: testUrl });
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    await testPool.end();

    const dbPkgDir = resolve(import.meta.dirname, '../../../db');
    execFileSync('pnpm', ['run', 'drizzle-kit', 'migrate', '--config', 'drizzle.config.ts'], {
        cwd: dbPkgDir,
        env: { ...process.env, HOSPEDA_DATABASE_URL: testUrl },
        stdio: 'pipe',
        timeout: 120_000
    });
    execFileSync('node', [resolve(dbPkgDir, 'scripts/apply-postgres-extras.mjs'), testUrl], {
        cwd: dbPkgDir,
        stdio: 'pipe',
        timeout: 60_000
    });

    process.env.HOSPEDA_TEST_DATABASE_URL = testUrl;
}

/** Vitest globalSetup teardown: runs ONCE after the last worker exits. */
export async function teardown(): Promise<void> {
    const adminPool = new Pool({ connectionString: withDatabase('postgres') });
    try {
        await adminPool.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [DB_NAME]
        );
        await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    } finally {
        await adminPool.end();
    }
}

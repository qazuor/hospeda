/**
 * Global setup for `apps/api`'s `test/integration/ai/**` suite (HOS-247).
 *
 * Runs ONCE before any worker starts and ONCE after all workers finish.
 * Modeled directly on `packages/db/test/integration/global-setup.ts` — see
 * that file for the pattern this mirrors. Responsibilities:
 *   1. Verify PostgreSQL is reachable (with retries for Docker/service startup).
 *   2. Drop and recreate the ephemeral `hospeda_api_integration_test` database
 *      (a name deliberately distinct from `packages/db` and
 *      `packages/service-core`'s own ephemeral DBs so all three can run
 *      concurrently in CI without colliding).
 *   3. Install required PostgreSQL extensions on the test DB.
 *   4. Apply versioned migrations via `drizzle-kit migrate` (run from
 *      `packages/db`, the single source of truth for the schema).
 *   5. Apply triggers/views/CHECK constraints via `apply-postgres-extras.mjs`
 *      (non-fatal — the AI integration tests do not depend on them).
 *   6. Export the connection string via BOTH `process.env.HOSPEDA_DATABASE_URL`
 *      and `process.env.HOSPEDA_TEST_DATABASE_URL` so worker forks inherit it.
 *
 * ## Why overriding `HOSPEDA_DATABASE_URL` here is load-bearing, not cosmetic
 *
 * `apps/api/test/e2e/setup/test-database.ts` (the `testDb` singleton used by
 * `test/integration/ai/quota-enforcement.test.ts` and
 * `test/integration/ai/vault-roundtrip.test.ts`) reads
 * `process.env.HOSPEDA_DATABASE_URL` exclusively — NOT
 * `HOSPEDA_TEST_DATABASE_URL` — and its `clean()` method runs
 * `TRUNCATE ... CASCADE` on every table between tests. In CI,
 * `.github/workflows/ci.yml` sets a workflow-level
 * `HOSPEDA_DATABASE_URL: ${{ secrets.HOSPEDA_DATABASE_URL }}` for every job,
 * including `test-integration` — a value that may point at a real database.
 * Without this override, the AI integration suite would connect to (and
 * TRUNCATE) whatever `HOSPEDA_DATABASE_URL` resolves to in that environment.
 * Setting `process.env.HOSPEDA_DATABASE_URL` to the ephemeral DB URL BEFORE
 * any worker fork is spawned is what makes `testDb` connect to the disposable
 * database instead — this is a safety mechanism, not just DB provisioning.
 *
 * Wired through `globalSetup` in `vitest.config.integration.ts`.
 *
 * @module test/integration/global-setup
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Ephemeral database name for this suite. Must not collide with the names
 * used by `packages/db` (`hospeda_integration_test`) or
 * `packages/service-core`'s own integration suite.
 */
const DB_NAME = 'hospeda_api_integration_test';

const CONNECTION_BASE =
    process.env.HOSPEDA_TEST_DATABASE_URL ||
    process.env.HOSPEDA_DATABASE_URL ||
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
    console.info('[api-integration-setup] Starting DB setup...');

    // 1. Verify PostgreSQL reachable, retry to absorb Docker/service startup.
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
                    `[api-integration-setup] Cannot connect to PostgreSQL after ${MAX_CONNECT_RETRIES} attempts. Is Docker running?\n  Connection: ${getAdminConnectionString()}\n  Error: ${msg}\n  Hint: Run "pnpm db:start" to start the Docker containers.`
                );
            }
            console.info(
                `[api-integration-setup] PostgreSQL not ready (attempt ${attempt}/${MAX_CONNECT_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
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

    // 4. Apply the versioned Drizzle migrations (NOT push — SPEC-178: CI must
    //    exercise the same versioned carril as the VPS) FROM packages/db, the
    //    single source of truth for the schema. execFileSync (no shell) avoids
    //    any injection vector even though args are static here.
    const dbPkgDir = resolve(__dirname, '../../../../packages/db');
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
            `[api-integration-setup] drizzle-kit migrate failed.\n  Error: ${msg}\n  Hint: Check that packages/db/drizzle.config.ts is valid and migrations under packages/db/src/migrations/ apply cleanly.`
        );
    }

    // 5. Apply triggers, materialized views, CHECK constraints. Uses the Node
    //    variant (apply-postgres-extras.mjs), which has no dependency on the
    //    `psql` CLI being installed on the runner. Failure here is non-fatal:
    //    the AI integration tests do not depend on triggers/views.
    const extrasScript = resolve(dbPkgDir, 'scripts/apply-postgres-extras.mjs');
    try {
        execFileSync('node', [extrasScript], {
            cwd: dbPkgDir,
            env: { ...process.env, HOSPEDA_DATABASE_URL: getTestConnectionString() },
            stdio: 'pipe',
            timeout: 60_000
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(
            `[api-integration-setup] apply-postgres-extras.mjs failed (non-fatal).\n  Error: ${msg}`
        );
    }

    // 6. Export the connection string for worker forks to inherit via fork()
    //    env. Setting HOSPEDA_DATABASE_URL is the SAFETY mechanism described
    //    in the module JSDoc above — do not remove it.
    process.env.HOSPEDA_DATABASE_URL = getTestConnectionString();
    process.env.HOSPEDA_TEST_DATABASE_URL = getTestConnectionString();

    // 7. Neutralize the platform-injected `CI` env var for THIS suite only.
    //
    // `quota-enforcement.test.ts` and `vault-roundtrip.test.ts` authenticate
    // via mock-actor headers (`x-mock-actor-id` etc.), accepted by
    // `actorMiddleware` only when `isMockActorAllowed()` in
    // `src/middlewares/actor.ts` returns true:
    //   NODE_ENV === 'test' && HOSPEDA_ALLOW_MOCK_ACTOR === 'true' && CI !== 'true'
    // GitHub Actions sets `CI=true` for every job by default, so — before
    // this override — every mock-actor-authenticated request in this suite
    // would silently fall back to a guest actor (401) the moment it actually
    // ran in CI. That case was never exercised before HOS-247: this AI
    // integration suite never ran in any CI workflow (verified against every
    // `.github/workflows/*.yml`), and the `apps/api/test/e2e/**` suite that
    // shares this same mock-actor pattern only ever runs locally.
    //
    // The `CI !== 'true'` guard exists to stop mock-actor auth from being
    // exploitable in an environment with real tokens/credentials. That does
    // not apply here: this job runs against a fully disposable ephemeral
    // database (`hospeda_api_integration_test`, dropped in `teardown()`) with
    // no real user tokens, gated behind `HOSPEDA_ALLOW_MOCK_ACTOR` which the
    // test files themselves opt into explicitly. Deleting `CI` here — before
    // any worker fork spawns, so every fork inherits the change — is scoped
    // to this `globalSetup` alone; it does not touch `ci.yml`, does not
    // affect any other job, and does not weaken the guard for the (currently
    // non-existent) case of `test/e2e/**` running in real CI.
    delete process.env.CI;

    console.info(`[api-integration-setup] Test DB "${DB_NAME}" ready.`);
}

/** Vitest globalSetup teardown — runs ONCE after the last worker exits. */
export async function teardown(): Promise<void> {
    console.info('[api-integration-teardown] Cleaning up...');

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
        console.info(`[api-integration-teardown] Test DB "${DB_NAME}" dropped.`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[api-integration-teardown] Failed to drop test DB: ${msg}`);
    } finally {
        await adminPool.end();
    }
}

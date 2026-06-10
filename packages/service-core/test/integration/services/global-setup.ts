/**
 * Global setup for `packages/service-core` real-DB integration tests
 * (SPEC-080).
 *
 * Creates and tears down an ephemeral `hospeda_service_integration_test`
 * database, separate from SPEC-061's `hospeda_integration_test`. Each
 * package owns its own DB so the suites can run in parallel under turbo
 * without stepping on each other.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_NAME = 'hospeda_service_integration_test';
const CONNECTION_BASE =
    process.env.HOSPEDA_TEST_DATABASE_URL ||
    'postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres';

const MAX_CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 2_000;

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
    console.info('[service-integration-setup] Starting DB setup...');

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
                    `[service-integration-setup] Cannot connect to PostgreSQL after ${MAX_CONNECT_RETRIES} attempts. Is Docker running?\n  Error: ${msg}\n  Hint: Run "pnpm db:start".`
                );
            }
            console.info(
                `[service-integration-setup] PostgreSQL not ready (attempt ${attempt}/${MAX_CONNECT_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
    }

    await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
    await adminPool.end();

    const testPool = new Pool({ connectionString: getTestConnectionString() });
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    await testPool.end();

    // Apply the versioned Drizzle migrations (NOT push — SPEC-178: CI uses the
    // same versioned carril as the VPS) using @repo/db's own drizzle-kit script.
    const dbPkgDir = resolve(__dirname, '../../../../db');
    try {
        execFileSync('pnpm', ['run', 'drizzle-kit', 'migrate', '--config', 'drizzle.config.ts'], {
            cwd: dbPkgDir,
            env: { ...process.env, HOSPEDA_DATABASE_URL: getTestConnectionString() },
            stdio: 'pipe',
            timeout: 120_000
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`[service-integration-setup] drizzle-kit migrate failed.\n  Error: ${msg}`);
    }

    // Apply triggers/views/CHECK constraints. Non-fatal for service-core
    // tests that focus on relation loading rather than triggered behaviour.
    const extrasScript = resolve(dbPkgDir, 'scripts/apply-postgres-extras.sh');
    try {
        execFileSync('bash', [extrasScript, getTestConnectionString()], {
            cwd: dbPkgDir,
            stdio: 'pipe',
            timeout: 60_000
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(
            `[service-integration-setup] apply-postgres-extras.sh failed (non-fatal). Error: ${msg}`
        );
    }

    process.env.HOSPEDA_TEST_DATABASE_URL = getTestConnectionString();
    console.info(`[service-integration-setup] Test DB "${DB_NAME}" ready.`);
}

export async function teardown(): Promise<void> {
    console.info('[service-integration-teardown] Cleaning up...');

    const adminPool = new Pool({ connectionString: getAdminConnectionString() });
    try {
        await adminPool.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [DB_NAME]
        );
        await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
        console.info(`[service-integration-teardown] Test DB "${DB_NAME}" dropped.`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[service-integration-teardown] Failed to drop test DB: ${msg}`);
    } finally {
        await adminPool.end();
    }
}

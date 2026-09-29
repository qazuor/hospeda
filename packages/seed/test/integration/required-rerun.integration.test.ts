/**
 * HOS-735 — `--required` must be re-runnable.
 *
 * Spawns the real CLI (`seed --required`) TWICE against the same cloned
 * database and requires the second run to exit 0 AND leave every table
 * unchanged.
 *
 * Before the fix the second run died at the first duplicate UNIQUE key
 * (`admin-user`, step 5 of 23), and three seeders never failed at all but
 * silently DUPLICATED rows on every re-run: `attractions` (regenerated as
 * `name-2`), `ai_prompt_versions` and `exchange_rates` (no unique key to trip
 * on). The row-count comparison is what catches those; a green second run alone
 * would not.
 *
 * Why a subprocess and not `runSeed()` in-process: `@repo/ai-core` resolves its
 * own `@repo/db` copy, so `aiSettings` throws "Database not initialized" under
 * vitest's tsconfig-paths resolution (the same dist-vs-src double-instance
 * problem `cli-data-migrate.integration.test.ts` documents). The CLI is also
 * literally what an operator runs.
 *
 * Needs PostgreSQL, so it lives in the integration carril (`test/integration/`,
 * provisioned by `global-setup.ts`); the unit carril excludes it. The
 * `skipIf(!dbAvailable)` mirrors the sibling CLI tests: `global-setup.ts` exports
 * the URL and fails loudly when PostgreSQL is unreachable, so in the carril CI
 * runs it is never skipped.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import requiredManifest from '../../src/manifest-required.json';

const execFileAsync = promisify(execFile);
const seedPkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const integrationDbUrl = process.env.HOSPEDA_DATABASE_URL;
const dbAvailable = Boolean(integrationDbUrl);

/** Clone the two runs share. Own name so it never collides with the sibling CLI tests. */
const RERUN_DB_NAME = 'hospeda_seed_required_rerun_test';

/** Tables the required seed writes, including the ones with no UNIQUE key to protect them. */
const TABLES_TO_COMPARE = [
    'users',
    'account',
    'user_role',
    'amenities',
    'features',
    'attractions',
    'destinations',
    'points_of_interest',
    'poi_categories',
    'sponsorship_levels',
    'sponsorship_packages',
    'exchange_rates',
    'ai_prompt_versions',
    'billing_plans',
    'role_permission'
] as const;

const CLI_TIMEOUT_MS = 180_000;
const CLI_MAX_BUFFER = 50 * 1024 * 1024;
const TWO_RUN_BUDGET_MS = 2 * CLI_TIMEOUT_MS + 60_000;

/** Returns `connectionString` repointed at `dbName`. */
function withDatabase(connectionString: string, dbName: string): string {
    const url = new URL(connectionString);
    url.pathname = `/${dbName}`;
    return url.toString();
}

/** Kills every backend connected to `dbName` so it can be dropped or cloned. */
async function terminateBackends(adminPool: Pool, dbName: string): Promise<void> {
    await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
    );
}

/**
 * Runs `seed --required` against `databaseUrl`.
 *
 * Cloudinary credentials are blanked (dotenv never overrides a variable that is
 * already defined): this test is about idempotency, not uploads, and it must
 * neither hit the network nor spend real upload quota.
 */
async function runRequiredCli(
    databaseUrl: string
): Promise<{ stdout: string; stderr: string; code: number }> {
    const inheritedEnv = process['env'];
    try {
        const { stdout, stderr } = await execFileAsync(
            'pnpm',
            ['exec', 'tsx', '--tsconfig', './tsconfig.json', './src/cli.ts', '--required'],
            {
                cwd: seedPkgDir,
                env: {
                    ...inheritedEnv,
                    HOSPEDA_DATABASE_URL: databaseUrl,
                    HOSPEDA_CLOUDINARY_CLOUD_NAME: '',
                    HOSPEDA_CLOUDINARY_API_KEY: '',
                    HOSPEDA_CLOUDINARY_API_SECRET: '',
                    LOG_LEVEL: inheritedEnv['LOG_LEVEL'] ?? 'INFO'
                },
                timeout: CLI_TIMEOUT_MS,
                maxBuffer: CLI_MAX_BUFFER
            }
        );
        return { stdout, stderr, code: 0 };
    } catch (error) {
        const e = error as { stdout?: string; stderr?: string; code?: number };
        return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: e.code ?? 1 };
    }
}

/** Row count per compared table. */
async function countRows(connectionString: string): Promise<Record<string, number>> {
    const pool = new Pool({ connectionString });
    try {
        const counts: Record<string, number> = {};
        for (const table of TABLES_TO_COMPARE) {
            const { rows } = await pool.query<{ n: number }>(
                `SELECT count(*)::int AS n FROM "${table}"`
            );
            counts[table] = rows[0]?.n ?? -1;
        }
        return counts;
    } finally {
        await pool.end();
    }
}

const rerunDbUrl = dbAvailable ? withDatabase(integrationDbUrl as string, RERUN_DB_NAME) : '';

beforeAll(async () => {
    if (!dbAvailable) return;
    const template = new URL(integrationDbUrl as string).pathname.slice(1);
    const adminPool = new Pool({
        connectionString: withDatabase(integrationDbUrl as string, 'postgres')
    });
    try {
        await terminateBackends(adminPool, RERUN_DB_NAME);
        await adminPool.query(`DROP DATABASE IF EXISTS ${RERUN_DB_NAME}`);
        await terminateBackends(adminPool, template);
        await adminPool.query(`CREATE DATABASE ${RERUN_DB_NAME} TEMPLATE ${template}`);
    } finally {
        await adminPool.end();
    }
});

afterAll(async () => {
    if (!dbAvailable) return;
    const adminPool = new Pool({
        connectionString: withDatabase(integrationDbUrl as string, 'postgres')
    });
    try {
        await terminateBackends(adminPool, RERUN_DB_NAME);
        await adminPool.query(`DROP DATABASE IF EXISTS ${RERUN_DB_NAME}`);
    } finally {
        await adminPool.end();
    }
});

describe('seed --required twice on the same database (HOS-735)', () => {
    it.skipIf(!dbAvailable)(
        'completes the second run and leaves every table unchanged',
        { timeout: TWO_RUN_BUDGET_MS },
        async () => {
            // Arrange: the first run populates the cloned database.
            const first = await runRequiredCli(rerunDbUrl);
            expect(
                first.code,
                `1st run exited ${first.code}:\n${first.stdout}\n${first.stderr}`
            ).toBe(0);
            const afterFirst = await countRows(rerunDbUrl);

            // A match-everything lookup skips every item after the first one it inserts, so
            // the table would hold ONE row and stay "stable" across runs. Pin the absolute
            // size to the fixtures so that shape cannot pass.
            expect(afterFirst.amenities).toBe(requiredManifest.amenities.length);
            expect(afterFirst.exchange_rates).toBe(requiredManifest.exchangeRates.length);

            // A lookup that matches EVERY row would skip every item and keep the counts
            // equal (the DB layer drops unknown where-keys). So delete one slug-keyed row
            // and one composite-keyed row and require the second run to re-create both.
            const pool = new Pool({ connectionString: rerunDbUrl });
            try {
                await pool.query(
                    `DELETE FROM amenities WHERE slug = (SELECT slug FROM amenities ORDER BY slug LIMIT 1)`
                );
                await pool.query(
                    `DELETE FROM exchange_rates WHERE id = (SELECT id FROM exchange_rates ORDER BY id LIMIT 1)`
                );
            } finally {
                await pool.end();
            }
            const afterDelete = await countRows(rerunDbUrl);
            expect(afterDelete.amenities).toBe(afterFirst.amenities - 1);
            expect(afterDelete.exchange_rates).toBe(afterFirst.exchange_rates - 1);

            // Act: the second run over the populated database.
            const second = await runRequiredCli(rerunDbUrl);

            // Assert
            expect(
                second.code,
                `2nd run exited ${second.code}:\n${second.stdout}\n${second.stderr}`
            ).toBe(0);
            expect(afterFirst.users).toBeGreaterThan(0);
            expect(await countRows(rerunDbUrl)).toEqual(afterFirst);
        }
    );
});

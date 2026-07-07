/**
 * @fileoverview
 * Integration tests for baseline-stamp mode (HOS-25, T-010):
 * {@link baselineStamp}.
 *
 * Runs against the REAL worktree PostgreSQL database, mirroring the
 * convention already established by `ledger.test.ts` (T-004) and
 * `runner.test.ts` (T-009): a minimal `pg` `Pool` + `@repo/db`'s
 * `initializeDb()`, loading `HOSPEDA_DATABASE_URL` from `apps/api/.env.local`.
 *
 * `seedMigrations` is imported from the narrower `@repo/db/schemas` subpath
 * (not the top-level `@repo/db` barrel) — see `ledger.test.ts`'s file-level
 * comment for why (a documented Vitest/Vite SSR module-runner quirk with
 * deeply-indirected `export *` chains).
 *
 * Fixture migrations live under `__fixtures__/baseline/` and would write to a
 * shared scratch table (`zzz_test_baseline_scratch`, created in `beforeAll`
 * and dropped in `afterAll`) IF their `up()` ever ran — the whole point of
 * `baselineStamp` is that it never does, so the scratch table must stay
 * empty across every test in this file. Every fixture migration name is
 * prefixed `zzz-test-baseline-` so ledger cleanup can namespace-delete by
 * `LIKE`, matching this package's established `zzz-test-*`/`zzz_test_*`
 * convention for disposable test fixtures in the shared worktree database.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, initializeDb, resetDb } from '@repo/db';
import { seedMigrations } from '@repo/db/schemas';
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { baselineStamp } from '../../src/data-migrations/baselineStamp.js';
import { discoverMigrationFiles } from '../../src/data-migrations/discover.js';
import { getAppliedMigrations } from '../../src/data-migrations/ledger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as ledger.test.ts / runner.test.ts:
// HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const FIXTURES_DIR = path.resolve(__dirname, '__fixtures__/baseline');

const SCRATCH_TABLE = 'zzz_test_baseline_scratch';
const NAME_PREFIX = 'zzz-test-baseline-';

let pool: Pool;

/** Reads the scratch table's `name` column, ordered by insertion (`id`). */
async function readScratchNames(): Promise<string[]> {
    const db = getDb();
    const result = await db.execute<{ name: string }>(
        sql`SELECT name FROM ${sql.identifier(SCRATCH_TABLE)} ORDER BY id ASC`
    );
    return result.rows.map((row) => row.name);
}

describe('HOS-25 T-010: baselineStamp (integration, real worktree DB)', () => {
    beforeAll(async () => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
            );
        }

        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);

        const db = getDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(SCRATCH_TABLE)} CASCADE`);
        await db.execute(sql`
            CREATE TABLE ${sql.identifier(SCRATCH_TABLE)} (
                id serial PRIMARY KEY,
                name text NOT NULL
            )
        `);
    });

    afterEach(async () => {
        const db = getDb();
        await db.execute(sql`DELETE FROM ${sql.identifier(SCRATCH_TABLE)}`);
        await db.execute(
            sql`DELETE FROM ${seedMigrations} WHERE ${seedMigrations.name} LIKE ${`%${NAME_PREFIX}%`}`
        );
    });

    afterAll(async () => {
        const db = getDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(SCRATCH_TABLE)} CASCADE`);
        await pool.end();
        resetDb();
    });

    it('stamps every pending migration as applied without running up()', async () => {
        const result = await baselineStamp({ db: getDb(), dir: FIXTURES_DIR });

        expect(result.stamped).toEqual([
            '0001-zzz-test-baseline-alpha',
            '0002-zzz-test-baseline-bravo',
            '0003-zzz-test-baseline-charlie'
        ]);

        // up() was never invoked: the scratch table each fixture WOULD have
        // written to stays completely empty.
        expect(await readScratchNames()).toEqual([]);

        // Zero pending migrations remain, and every fixture is now recorded
        // in the ledger with result = 'baseline-stamp'.
        const discovered = await discoverMigrationFiles({ dir: FIXTURES_DIR });
        const { names: applied, rows } = await getAppliedMigrations({ db: getDb() });

        for (const migration of discovered) {
            expect(applied.has(migration.name)).toBe(true);
        }

        const stampedRows = rows.filter((row) => row.name.includes(NAME_PREFIX));
        expect(stampedRows).toHaveLength(3);
        for (const row of stampedRows) {
            expect(row.result).toBe('baseline-stamp');
            expect(row.durationMs).toBe(0);
            expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
        }
    });

    it('is idempotent — a second call stamps nothing and creates no duplicate rows', async () => {
        const first = await baselineStamp({ db: getDb(), dir: FIXTURES_DIR });
        expect(first.stamped).toHaveLength(3);

        const second = await baselineStamp({ db: getDb(), dir: FIXTURES_DIR });

        expect(second.stamped).toEqual([]);
        expect(await readScratchNames()).toEqual([]);

        const { rows } = await getAppliedMigrations({ db: getDb() });
        const stampedRows = rows.filter((row) => row.name.includes(NAME_PREFIX));
        expect(stampedRows).toHaveLength(3);
    });

    it('respects the group filter, stamping only migrations in that group', async () => {
        const result = await baselineStamp({ db: getDb(), dir: FIXTURES_DIR, group: 'required' });

        expect(result.stamped).toEqual([
            '0001-zzz-test-baseline-alpha',
            '0003-zzz-test-baseline-charlie'
        ]);

        const { names: applied } = await getAppliedMigrations({ db: getDb() });
        expect(applied.has('0001-zzz-test-baseline-alpha')).toBe(true);
        expect(applied.has('0003-zzz-test-baseline-charlie')).toBe(true);
        expect(applied.has('0002-zzz-test-baseline-bravo')).toBe(false);

        expect(await readScratchNames()).toEqual([]);
    });
});

/**
 * @fileoverview
 * Integration tests for the versioned seed data-migration runner (HOS-25,
 * T-009): {@link runMigrations}.
 *
 * Runs against the REAL worktree PostgreSQL database, mirroring the
 * convention already established by `ledger.test.ts` (T-004) and
 * `fkGuard.test.ts` (T-006): a minimal `pg` `Pool` + `@repo/db`'s
 * `initializeDb()`, loading `HOSPEDA_DATABASE_URL` from `apps/api/.env.local`.
 *
 * `seedMigrations` is imported from the narrower `@repo/db/schemas` subpath
 * (not the top-level `@repo/db` barrel) — see `ledger.test.ts`'s file-level
 * comment for why (a documented Vitest/Vite SSR module-runner quirk with
 * deeply-indirected `export *` chains).
 *
 * Fixture migrations live under `__fixtures__/runner/{success,failure,destructive}/`
 * and write to a shared scratch table (`zzz_test_runner_scratch`, created in
 * `beforeAll` and dropped in `afterAll`) instead of touching any real
 * application table. Every fixture migration name is prefixed
 * `zzz-test-runner-` so ledger cleanup can namespace-delete by `LIKE`,
 * matching this package's established `zzz-test-*`/`zzz_test_*` convention
 * for disposable test fixtures in the shared worktree database.
 *
 * A stub {@link Actor} is injected into every `runMigrations` call so no test
 * here requires a real super-admin bootstrap.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, initializeDb, resetDb } from '@repo/db';
import { seedMigrations } from '@repo/db/schemas';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/data-migrations/runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as ledger.test.ts / fkGuard.test.ts:
// HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const FIXTURES_DIR = path.resolve(__dirname, '__fixtures__/runner');
const SUCCESS_DIR = path.join(FIXTURES_DIR, 'success');
const FAILURE_DIR = path.join(FIXTURES_DIR, 'failure');
const DESTRUCTIVE_DIR = path.join(FIXTURES_DIR, 'destructive');

const SCRATCH_TABLE = 'zzz_test_runner_scratch';
const NAME_PREFIX = 'zzz-test-runner-';

const STUB_ACTOR: Actor = {
    id: 'zzz-test-runner-actor',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

let pool: Pool;

/** Reads the scratch table's `name` column, ordered by insertion (`id`). */
async function readScratchNames(): Promise<string[]> {
    const db = getDb();
    const result = await db.execute<{ name: string }>(
        sql`SELECT name FROM ${sql.identifier(SCRATCH_TABLE)} ORDER BY id ASC`
    );
    return result.rows.map((row) => row.name);
}

describe('HOS-25 T-009: runMigrations (integration, real worktree DB)', () => {
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

    it('applies pending migrations in numeric order and records ok ledger rows', async () => {
        const result = await runMigrations({
            db: getDb(),
            dir: SUCCESS_DIR,
            actor: STUB_ACTOR
        });

        expect(result.applied).toEqual([
            '0001-zzz-test-runner-alpha',
            '0002-zzz-test-runner-bravo',
            '0003-zzz-test-runner-charlie'
        ]);
        expect(result.pendingCount).toBe(3);
        expect(result.skipped).toEqual([]);

        // Scratch rows were inserted in the same numeric order.
        expect(await readScratchNames()).toEqual([
            '0001-zzz-test-runner-alpha',
            '0002-zzz-test-runner-bravo',
            '0003-zzz-test-runner-charlie'
        ]);

        // Every migration got an 'ok' ledger row.
        const rows = await getDb()
            .select()
            .from(seedMigrations)
            .where(sql`${seedMigrations.name} LIKE ${`%${NAME_PREFIX}%`}`);
        expect(rows).toHaveLength(3);
        for (const row of rows) {
            expect(row.result).toBe('ok');
            expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
        }
    });

    it('is a no-op idempotent re-run once every migration is already applied', async () => {
        const first = await runMigrations({ db: getDb(), dir: SUCCESS_DIR, actor: STUB_ACTOR });
        expect(first.applied).toHaveLength(3);

        const second = await runMigrations({ db: getDb(), dir: SUCCESS_DIR, actor: STUB_ACTOR });

        expect(second.applied).toEqual([]);
        expect(second.pendingCount).toBe(0);
        expect(second.skipped.sort()).toEqual([
            '0001-zzz-test-runner-alpha',
            '0002-zzz-test-runner-bravo',
            '0003-zzz-test-runner-charlie'
        ]);

        // No duplicate rows were inserted by the no-op re-run.
        expect(await readScratchNames()).toHaveLength(3);
    });

    it('rolls back a failing migration and aborts before running later migrations', async () => {
        await expect(
            runMigrations({ db: getDb(), dir: FAILURE_DIR, actor: STUB_ACTOR })
        ).rejects.toThrow(/0002-zzz-test-runner-throws/);

        // 0001-ok committed (ran before the failure).
        const rows = await getDb()
            .select()
            .from(seedMigrations)
            .where(sql`${seedMigrations.name} LIKE ${`%${NAME_PREFIX}%`}`);
        expect(rows.map((row) => row.name)).toEqual(['0001-zzz-test-runner-ok']);

        // 0002-throws's own insert was rolled back with its transaction, and
        // 0003-never's up() never ran at all (batch aborted at the first
        // failure — HOS-25 G-5).
        expect(await readScratchNames()).toEqual(['0001-zzz-test-runner-ok']);
    });

    it('refuses to run a destructive migration in production without opt-in, touching nothing', async () => {
        await expect(
            runMigrations({
                db: getDb(),
                dir: DESTRUCTIVE_DIR,
                actor: STUB_ACTOR,
                env: { NODE_ENV: 'production' }
            })
        ).rejects.toThrow(/destructive/i);

        expect(await readScratchNames()).toEqual([]);

        const rows = await getDb()
            .select()
            .from(seedMigrations)
            .where(sql`${seedMigrations.name} LIKE ${`%${NAME_PREFIX}%`}`);
        expect(rows).toHaveLength(0);
    });

    it('runs the destructive migration when allowDestructive is passed', async () => {
        const result = await runMigrations({
            db: getDb(),
            dir: DESTRUCTIVE_DIR,
            actor: STUB_ACTOR,
            env: { NODE_ENV: 'production' },
            allowDestructive: true
        });

        expect(result.applied).toEqual(['0001-zzz-test-runner-destructive-op']);
        expect(await readScratchNames()).toEqual(['0001-zzz-test-runner-destructive-op']);
    });
});

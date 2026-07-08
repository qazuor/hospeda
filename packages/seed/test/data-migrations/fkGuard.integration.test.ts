/**
 * @fileoverview
 * Integration tests for the inbound-FK introspection primitives (HOS-25, T-006):
 * {@link getInboundForeignKeys} and {@link countActiveReferences}.
 *
 * Runs against the REAL worktree PostgreSQL database (the same one
 * `pnpm --filter @repo/seed seed` targets) — there is no mocking involved
 * because the whole point of this helper is to exercise the real
 * `pg_constraint` / `pg_class` / `pg_attribute` system catalog.
 *
 * `packages/seed` has no pre-existing DB-integration test harness (unlike
 * `packages/db/test/integration/`, which has a dedicated disposable test
 * database + global setup/teardown). This file wires a minimal `pg` `Pool` +
 * `@repo/db`'s `initializeDb()` directly, mirroring the env-loading
 * convention `packages/seed/src/index.ts` already uses: `HOSPEDA_DATABASE_URL`
 * lives in `apps/api/.env.local` (packages/seed has no env file of its own —
 * see that file's own comment for the rationale), which in this worktree
 * points at the isolated `worktree_*` database on `localhost:5436`.
 *
 * All fixture tables are created in the `public` schema with a
 * `zzz_test_fk_` prefix (so they're trivially greppable and can never collide
 * with a real app table) and dropped with `CASCADE` in `afterAll`, so nothing
 * persists in the shared worktree DB after this file runs. `beforeAll` also
 * drops them defensively first, in case a previous crashed run left them
 * behind.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, initializeDb, resetDb } from '@repo/db';
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    countActiveReferences,
    getInboundForeignKeys
} from '../../src/data-migrations/helpers/fkGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as packages/seed/src/index.ts: HOSPEDA_DATABASE_URL
// lives in apps/api/.env.local, not in a (nonexistent) packages/seed env file.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PARENT_TABLE = 'zzz_test_fk_parent';
const LONELY_PARENT_TABLE = 'zzz_test_fk_lonely_parent';
const CHILD_A_TABLE = 'zzz_test_fk_child_a';
const CHILD_B_TABLE = 'zzz_test_fk_child_b';

let pool: Pool;

/** Drops every fixture table (CASCADE, IF EXISTS) — used by both setup and teardown. */
const dropFixtureTables = async (): Promise<void> => {
    const db = getDb();
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(CHILD_A_TABLE)} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(CHILD_B_TABLE)} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(PARENT_TABLE)} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(LONELY_PARENT_TABLE)} CASCADE`);
};

beforeAll(async () => {
    if (!process.env.HOSPEDA_DATABASE_URL) {
        throw new Error(
            'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
        );
    }

    pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
    resetDb();
    initializeDb(pool);

    await dropFixtureTables();

    const db = getDb();

    await db.execute(sql`
        CREATE TABLE ${sql.identifier(PARENT_TABLE)} (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid()
        )
    `);

    await db.execute(sql`
        CREATE TABLE ${sql.identifier(LONELY_PARENT_TABLE)} (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid()
        )
    `);

    await db.execute(sql`
        CREATE TABLE ${sql.identifier(CHILD_A_TABLE)} (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_id uuid REFERENCES ${sql.identifier(PARENT_TABLE)}(id)
        )
    `);

    await db.execute(sql`
        CREATE TABLE ${sql.identifier(CHILD_B_TABLE)} (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_id uuid REFERENCES ${sql.identifier(PARENT_TABLE)}(id)
        )
    `);
});

afterAll(async () => {
    await dropFixtureTables();
    await pool.end();
    resetDb();
});

describe('getInboundForeignKeys', () => {
    it('returns an empty array for a table with zero inbound FKs', async () => {
        const result = await getInboundForeignKeys({ db: getDb(), table: LONELY_PARENT_TABLE });
        expect(result).toEqual([]);
    });

    it('discovers every inbound FK across multiple child tables', async () => {
        const result = await getInboundForeignKeys({ db: getDb(), table: PARENT_TABLE });

        expect(result).toHaveLength(2);

        const referencingTables = result.map((fk) => fk.referencingTable).sort();
        expect(referencingTables).toEqual([CHILD_A_TABLE, CHILD_B_TABLE].sort());

        for (const fk of result) {
            expect(fk.referencingColumn).toBe('parent_id');
            expect(fk.referencedColumn).toBe('id');
            expect(fk.constraintName).toEqual(expect.any(String));
        }
    });
});

describe('countActiveReferences', () => {
    it('returns total 0 when no rows reference the target row', async () => {
        const db = getDb();
        const insertResult = await db.execute<{ id: string }>(
            sql`INSERT INTO ${sql.identifier(PARENT_TABLE)} DEFAULT VALUES RETURNING id`
        );
        const parentRow = insertResult.rows[0];
        expect(parentRow).toBeDefined();

        const result = await countActiveReferences({
            db,
            table: PARENT_TABLE,
            primaryKeyColumn: 'id',
            primaryKeyValue: parentRow!.id
        });

        expect(result.total).toBe(0);
        expect(result.byConstraint).toHaveLength(2);
        for (const entry of result.byConstraint) {
            expect(entry.count).toBe(0);
        }
    });

    it('counts active references across both child tables with a correct per-constraint breakdown', async () => {
        const db = getDb();
        const insertResult = await db.execute<{ id: string }>(
            sql`INSERT INTO ${sql.identifier(PARENT_TABLE)} DEFAULT VALUES RETURNING id`
        );
        const parentRow = insertResult.rows[0];
        expect(parentRow).toBeDefined();
        const parentId = parentRow!.id;

        // 2 rows in child A, 3 rows in child B, all pointing at the same parent.
        await db.execute(
            sql`INSERT INTO ${sql.identifier(CHILD_A_TABLE)} (parent_id) VALUES (${parentId}), (${parentId})`
        );
        await db.execute(
            sql`INSERT INTO ${sql.identifier(CHILD_B_TABLE)} (parent_id) VALUES (${parentId}), (${parentId}), (${parentId})`
        );

        const result = await countActiveReferences({
            db,
            table: PARENT_TABLE,
            primaryKeyColumn: 'id',
            primaryKeyValue: parentId
        });

        expect(result.total).toBe(5);

        const byTable = new Map(
            result.byConstraint.map((entry) => [entry.referencingTable, entry.count])
        );
        expect(byTable.get(CHILD_A_TABLE)).toBe(2);
        expect(byTable.get(CHILD_B_TABLE)).toBe(3);
    });
});

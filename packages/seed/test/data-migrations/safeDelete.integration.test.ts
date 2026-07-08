/**
 * @fileoverview
 * Integration tests for the FK-guarded, operator-edit-aware hard delete
 * (HOS-25, T-007): {@link safeDelete}.
 *
 * Runs against the REAL worktree PostgreSQL database, mirroring the
 * bootstrap convention already established by `test/data-migrations/fkGuard.test.ts`
 * (T-006) and `test/data-migrations/ledger.test.ts` (T-004): a minimal `pg`
 * `Pool` + `@repo/db`'s `initializeDb()`, loading `HOSPEDA_DATABASE_URL` from
 * `apps/api/.env.local` (the same env-loading convention `packages/seed/src/index.ts`
 * already uses).
 *
 * Fixture tables use a `zzz_test_safedelete_` prefix (parent + child) so they
 * are trivially greppable and can never collide with a real app table.
 * `beforeAll` drops them defensively first (in case a previous crashed run
 * left them behind), then creates them; `afterEach` truncates both so each
 * test starts from a clean slate; `afterAll` drops them with `CASCADE`.
 *
 * The parent fixture table is mirrored as an actual Drizzle `pgTable()`
 * object (not just a raw SQL table) because {@link safeDelete} takes a real
 * Drizzle `Table` — it introspects the table's name and primary-key column
 * via `getTableName`/`getTableColumns`, which only work against a genuine
 * Drizzle schema object.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, initializeDb, resetDb } from '@repo/db';
import { config as loadEnv } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { boolean, pgTable, uuid } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { safeDelete } from '../../src/data-migrations/helpers/safeDelete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as packages/seed/src/index.ts and
// test/data-migrations/fkGuard.test.ts: HOSPEDA_DATABASE_URL lives in
// apps/api/.env.local, not in a (nonexistent) packages/seed env file.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PARENT_TABLE = 'zzz_test_safedelete_parent';
const CHILD_TABLE = 'zzz_test_safedelete_child';

/**
 * Drizzle mirror of the raw `zzz_test_safedelete_parent` SQL table below.
 * `safeDelete` needs a real Drizzle `Table` object (not a bare string) to
 * introspect the table name + primary-key column.
 */
const parentTable = pgTable(PARENT_TABLE, {
    id: uuid('id').primaryKey().defaultRandom(),
    isOperatorEdited: boolean('is_operator_edited').notNull().default(false)
});

let pool: Pool;

/** Drops both fixture tables (CASCADE, IF EXISTS) — used by setup and teardown. */
const dropFixtureTables = async (): Promise<void> => {
    const db = getDb();
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(CHILD_TABLE)} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(PARENT_TABLE)} CASCADE`);
};

/** Inserts one parent row and returns its id. */
const insertParent = async (input: { readonly isOperatorEdited: boolean }): Promise<string> => {
    const db = getDb();
    const result = await db.execute<{ id: string }>(
        sql`INSERT INTO ${sql.identifier(PARENT_TABLE)} (is_operator_edited) VALUES (${input.isOperatorEdited}) RETURNING id`
    );
    const row = result.rows[0];
    if (!row) {
        throw new Error('Failed to insert parent fixture row');
    }
    return row.id;
};

/** Inserts one child row referencing the given parent id. */
const insertChild = async (parentId: string): Promise<void> => {
    const db = getDb();
    await db.execute(
        sql`INSERT INTO ${sql.identifier(CHILD_TABLE)} (parent_id) VALUES (${parentId})`
    );
};

/** Counts remaining rows in the parent/child fixture tables. */
const countRows = async (tableName: string): Promise<number> => {
    const db = getDb();
    const result = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)}`
    );
    return Number(result.rows[0]?.count ?? 0);
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
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            is_operator_edited boolean NOT NULL DEFAULT false
        )
    `);

    await db.execute(sql`
        CREATE TABLE ${sql.identifier(CHILD_TABLE)} (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_id uuid REFERENCES ${sql.identifier(PARENT_TABLE)}(id)
        )
    `);
});

afterEach(async () => {
    const db = getDb();
    // TRUNCATE both fixture tables so every test starts from a clean slate.
    await db.execute(
        sql`TRUNCATE TABLE ${sql.identifier(CHILD_TABLE)}, ${sql.identifier(PARENT_TABLE)} CASCADE`
    );
});

afterAll(async () => {
    await dropFixtureTables();
    await pool.end();
    resetDb();
});

describe('safeDelete', () => {
    it('deletes the row when it has zero active FK references and is not operator-edited', async () => {
        const db = getDb();
        const parentId = await insertParent({ isOperatorEdited: false });

        const result = await safeDelete({
            db,
            table: parentTable,
            where: eq(parentTable.id, parentId),
            reason: 'test: no refs, not edited'
        });

        expect(result).toEqual({ deleted: true });
        expect(await countRows(PARENT_TABLE)).toBe(0);
    });

    it('skips the delete when active FK references exist, naming the blocking table, and does not cascade', async () => {
        const db = getDb();
        const parentId = await insertParent({ isOperatorEdited: false });
        await insertChild(parentId);

        const result = await safeDelete({
            db,
            table: parentTable,
            where: eq(parentTable.id, parentId),
            reason: 'test: has refs, not edited'
        });

        expect(result.deleted).toBe(false);
        if (result.deleted) {
            throw new Error('unreachable');
        }
        expect(result.skipped).toBe(true);
        expect(result.reason).toContain(CHILD_TABLE);
        expect(result.reason).toContain('active FK reference');

        // Row present, no cascade.
        expect(await countRows(PARENT_TABLE)).toBe(1);
        expect(await countRows(CHILD_TABLE)).toBe(1);
    });

    it('skips the delete when the row is flagged operator-edited, even with zero FK references', async () => {
        const db = getDb();
        const parentId = await insertParent({ isOperatorEdited: true });

        const result = await safeDelete({
            db,
            table: parentTable,
            where: eq(parentTable.id, parentId),
            reason: 'test: no refs, edited',
            isOperatorEdited: (row) => row.is_operator_edited === true
        });

        expect(result.deleted).toBe(false);
        if (result.deleted) {
            throw new Error('unreachable');
        }
        expect(result.skipped).toBe(true);
        expect(result.reason).toContain('operator-edited');

        expect(await countRows(PARENT_TABLE)).toBe(1);
    });

    it('skips the delete when both FK references exist AND the row is operator-edited, without cascading', async () => {
        const db = getDb();
        const parentId = await insertParent({ isOperatorEdited: true });
        await insertChild(parentId);

        const result = await safeDelete({
            db,
            table: parentTable,
            where: eq(parentTable.id, parentId),
            reason: 'test: has refs, edited',
            isOperatorEdited: (row) => row.is_operator_edited === true
        });

        expect(result.deleted).toBe(false);
        if (result.deleted) {
            throw new Error('unreachable');
        }
        expect(result.skipped).toBe(true);
        // Either the FK reason or the operator-edit reason is acceptable —
        // the guard order (FK checked first) means the FK reason wins here,
        // but the contract only promises "skipped", not which reason wins.
        expect(result.reason.length).toBeGreaterThan(0);

        expect(await countRows(PARENT_TABLE)).toBe(1);
        expect(await countRows(CHILD_TABLE)).toBe(1);
    });

    it('defaults to NOT operator-edited when no predicate is supplied, deleting a clean row', async () => {
        const db = getDb();
        // isOperatorEdited=true in the DB, but no predicate is passed —
        // safeDelete must not read the raw column itself, it only consults
        // the caller-supplied predicate. The documented default (no
        // predicate => not operator-edited) means this row IS deleted.
        const parentId = await insertParent({ isOperatorEdited: true });

        const result = await safeDelete({
            db,
            table: parentTable,
            where: eq(parentTable.id, parentId),
            reason: 'test: default policy, no predicate supplied'
        });

        expect(result).toEqual({ deleted: true });
        expect(await countRows(PARENT_TABLE)).toBe(0);
    });

    it('is a no-op success when the where-clause matches zero rows', async () => {
        const db = getDb();
        const nonExistentId = '00000000-0000-0000-0000-000000000000';

        const result = await safeDelete({
            db,
            table: parentTable,
            where: eq(parentTable.id, nonExistentId),
            reason: 'test: nothing to delete'
        });

        expect(result).toEqual({ deleted: true });
    });

    it('throws when the where-clause matches more than one row', async () => {
        const db = getDb();
        await insertParent({ isOperatorEdited: false });
        await insertParent({ isOperatorEdited: false });

        await expect(
            safeDelete({
                db,
                table: parentTable,
                // Matches both rows just inserted.
                where: eq(parentTable.isOperatorEdited, false),
                reason: 'test: ambiguous where-clause'
            })
        ).rejects.toThrow(/matched 2 rows/);

        expect(await countRows(PARENT_TABLE)).toBe(2);
    });
});

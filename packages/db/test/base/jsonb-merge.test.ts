import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
/**
 * Tests for T-015: opt-in JSONB merge semantics in BaseModel.update()
 *
 * Covers:
 * - GAP-078-186: shallow merge via PostgreSQL `||` operator preserves sibling keys
 * - GAP-078-198: SELECT FOR UPDATE prevents lost updates under concurrent writers
 *
 * Group 1: Unit tests of buildMergeSetClause helper (no DB needed)
 * Group 2: Unit tests of BaseModel.update() dispatch (mocked db, no real DB)
 * Group 3: Integration acceptance tests (require HOSPEDA_DATABASE_URL)
 *
 * Group 3 tests are skipped automatically when HOSPEDA_DATABASE_URL is not set.
 */
import { BaseModelImpl } from '../../src/base/base.model';
import * as clientModule from '../../src/client';
import { setDb } from '../../src/client';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema';
import type { DrizzleClient } from '../../src/types';
import { buildMergeSetClause } from '../../src/utils/jsonb-merge';

// ---------------------------------------------------------------------------
// Shared table stubs
// ---------------------------------------------------------------------------

/**
 * A table that includes a 'media' column for merge tests.
 * We use integer as a proxy for jsonb since pgTable column types
 * are opaque objects — only the key name matters for buildMergeSetClause.
 */
const tableWithMedia = pgTable('_test_with_media', {
    id: uuid('id').primaryKey().defaultRandom(),
    media: integer('media'),
    name: text('name'),
    slug: text('slug')
});

/**
 * A table that does NOT have a 'media' column.
 * Used to test the defensive fallback path in buildMergeSetClause.
 */
const tableWithoutMedia = pgTable('_test_without_media', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name')
});

// ---------------------------------------------------------------------------
// Group 1: Unit tests of buildMergeSetClause helper (no DB needed)
// ---------------------------------------------------------------------------

describe('buildMergeSetClause — unit', () => {
    it('TC1: returns plain values for columns NOT in mergeableColumns', () => {
        // Arrange
        const data: Record<string, unknown> = { name: 'x' };

        // Act
        const result = buildMergeSetClause(data, tableWithMedia, ['media']);

        // Assert: 'name' is not in mergeableColumns — plain value, no SQL fragment
        expect(result.name).toBe('x');
        // A SQL object from drizzle has a queryChunks array
        expect((result.name as Record<string, unknown>)?.queryChunks).toBeUndefined();
    });

    it('TC2: returns an SQL fragment for columns IN mergeableColumns', () => {
        // Arrange
        const patch = { a: 1 };
        const data: Record<string, unknown> = { media: patch };

        // Act
        const result = buildMergeSetClause(data, tableWithMedia, ['media']);

        // Assert: 'media' is in mergeableColumns AND in the table — must be SQL
        const mediaValue = result.media as Record<string, unknown>;
        expect(Array.isArray(mediaValue.queryChunks)).toBe(true);

        // The serialized fragment must include the JSON string of the patch value.
        // Drizzle SQL queryChunks are a mix of objects (SQL literals) and raw strings
        // (parameter values). We scan for the JSON stringification of the patch as a
        // plain string chunk — JSON.stringify(entire array) fails on circular table refs.
        const chunks = mediaValue.queryChunks as Array<unknown>;
        const patchJson = JSON.stringify(patch);
        const found = chunks.some((c) => typeof c === 'string' && c === patchJson);
        expect(found).toBe(true);
    });

    // SPEC-254 regression: the merge fragment must wrap the existing column in
    // COALESCE(col, '{}'::jsonb). Without it, `NULL || '{...}'::jsonb` evaluates to
    // SQL NULL, so a patch against a nullable JSONB column that has not been set yet
    // (e.g. social_posts.recurrence_params_json on a never-scheduled post) is silently
    // dropped. This test fails if anyone removes the COALESCE wrapper.
    it('TC2c: wraps the existing column in COALESCE so NULL columns merge correctly', () => {
        // Arrange
        const data: Record<string, unknown> = { media: { weekday: 'TUESDAY' } };

        // Act
        const result = buildMergeSetClause(data, tableWithMedia, ['media']);

        // Assert: the SQL fragment for 'media' must contain a COALESCE wrapper.
        // Drizzle SQL literal chunks are objects carrying a `value` array of strings.
        const mediaValue = result.media as Record<string, unknown>;
        const chunks = mediaValue.queryChunks as Array<unknown>;
        const hasCoalesce = chunks.some((c) => {
            if (typeof c === 'string') return c.includes('COALESCE');
            const val = (c as Record<string, unknown>)?.value;
            if (Array.isArray(val))
                return val.some((v) => typeof v === 'string' && v.includes('COALESCE'));
            if (typeof val === 'string') return val.includes('COALESCE');
            return false;
        });
        expect(hasCoalesce).toBe(true);
    });

    it('TC3: skips mergeable keys absent from the table — falls back to plain value', () => {
        // Arrange: 'media' is declared mergeable but tableWithoutMedia has no 'media' column
        const data: Record<string, unknown> = { media: { gallery: [1, 2, 3] } };

        // Act
        const result = buildMergeSetClause(data, tableWithoutMedia, ['media']);

        // Assert: because 'media' is not in the table, the plain value is used (defensive fallback)
        expect(result.media).toEqual({ gallery: [1, 2, 3] });
        // It must NOT be a SQL fragment
        expect((result.media as Record<string, unknown>)?.queryChunks).toBeUndefined();
    });

    it('TC4: mixed patch — merges some columns, replaces others with plain values', () => {
        // Arrange
        const data: Record<string, unknown> = {
            media: { x: 1 },
            name: 'y',
            slug: 'z'
        };

        // Act
        const result = buildMergeSetClause(data, tableWithMedia, ['media']);

        // Assert: 'media' → SQL fragment; 'name' and 'slug' → plain strings
        const mediaValue = result.media as Record<string, unknown>;
        expect(Array.isArray(mediaValue.queryChunks)).toBe(true);

        expect(result.name).toBe('y');
        expect((result.name as Record<string, unknown>)?.queryChunks).toBeUndefined();

        expect(result.slug).toBe('z');
        expect((result.slug as Record<string, unknown>)?.queryChunks).toBeUndefined();
    });

    // SPEC-229 review finding: a `null` value for a mergeable column must NOT take
    // the `||` merge path. `existing::jsonb || 'null'::jsonb` does not clear the
    // column — PostgreSQL yields the corrupt array `[<existing>, null]`. Null must
    // fall through to plain assignment (SET column = NULL) so callers can clear.
    it('TC4b: a null value for a mergeable column falls through to plain assignment (clear)', () => {
        // Arrange
        const data: Record<string, unknown> = { media: null };

        // Act
        const result = buildMergeSetClause(data, tableWithMedia, ['media']);

        // Assert: plain null, NOT a SQL merge fragment
        expect(result.media).toBeNull();
        expect((result.media as Record<string, unknown> | null)?.queryChunks).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// SPEC-229: grouped accommodation JSONB columns merge against the real table
//
// buildMergeSetClause only emits a merge fragment when the column key exists on
// the table (TC3 covers the fallback). These assertions prove the SPEC-229
// columns are real columns on `accommodations` AND that, given the model's
// mergeable list, a partial patch becomes a `||` merge rather than a replace.
// ---------------------------------------------------------------------------

describe('buildMergeSetClause — accommodation grouped columns (SPEC-229)', () => {
    const SPEC_229_COLUMNS = [
        'price',
        'extraInfo',
        'contactInfo',
        'socialNetworks',
        'location'
    ] as const;

    it.each(SPEC_229_COLUMNS)('emits a merge SQL fragment for the %s column', (column) => {
        const result = buildMergeSetClause({ [column]: { someKey: 'value' } }, accommodations, [
            ...SPEC_229_COLUMNS,
            'media'
        ]);
        const value = result[column] as Record<string, unknown>;
        expect(Array.isArray(value?.queryChunks)).toBe(true);
    });

    it('preserves siblings semantics: only the sent key is serialised into the patch', () => {
        const result = buildMergeSetClause({ price: { currency: 'USD' } }, accommodations, [
            'price'
        ]);
        const value = result.price as Record<string, unknown>;
        const chunks = value.queryChunks as Array<unknown>;
        const patchJson = JSON.stringify({ currency: 'USD' });
        expect(chunks.some((c) => typeof c === 'string' && c === patchJson)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Group 2: Unit tests of BaseModel.update() dispatch (mocked db)
// ---------------------------------------------------------------------------

describe('BaseModel.update() JSONB merge dispatch — unit', () => {
    /**
     * Builds a minimal mock for the inner transaction client that supports:
     * - execute() for the SELECT ... FOR UPDATE lock
     * - update().set().where().returning() for the UPDATE
     */
    function buildMockInnerTx(lockRows: unknown[] = [{ id: 'row-1' }]) {
        const returningFn = vi.fn().mockResolvedValue([{ id: 'row-1', media: { gallery: [] } }]);
        const whereUpdateFn = vi.fn(() => ({ returning: returningFn }));
        const setFn = vi.fn(() => ({ where: whereUpdateFn }));
        const updateFn = vi.fn(() => ({ set: setFn }));
        const executeFn = vi.fn().mockResolvedValue({ rows: lockRows });

        return {
            execute: executeFn,
            update: updateFn,
            set: setFn,
            where: whereUpdateFn,
            returning: returningFn
        };
    }

    /**
     * Builds a minimal mock for the plain-path db client (no transaction).
     */
    function buildMockPlainDb() {
        const returningFn = vi.fn().mockResolvedValue([{ id: 'row-1', name: 'foo' }]);
        const whereFn = vi.fn(() => ({ returning: returningFn }));
        const setFn = vi.fn(() => ({ where: whereFn }));
        const updateFn = vi.fn(() => ({ set: setFn }));
        // count query path
        const countWhereFn = vi.fn().mockResolvedValue([{ count: '1' }]);
        const countFromFn = vi.fn(() => ({ where: countWhereFn }));
        const selectFn = vi.fn(() => ({ from: countFromFn }));

        return {
            update: updateFn,
            select: selectFn
        };
    }

    beforeAll(async () => {
        // Make sure any previously injected mock db does not leak
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Clear the db client between tests to avoid cross-test contamination
        try {
            // setDb(null) is intentional for teardown
            setDb(null as unknown as DrizzleClient);
        } catch {
            // ignore
        }
    });

    it('TC5: does NOT open a transaction when mergeableJsonbColumns is empty', async () => {
        // Arrange
        const withTransactionSpy = vi.spyOn(clientModule, 'withTransaction');
        const mockDb = buildMockPlainDb();
        setDb(mockDb as unknown as DrizzleClient);

        class NoMergeModel extends BaseModelImpl<{ id: string; name: string }> {
            protected table = tableWithMedia as unknown as import('drizzle-orm').Table;
            public entityName = 'no_merge';
            // mergeableJsonbColumns defaults to [] — no override
            protected getTableName() {
                return '_test_with_media';
            }
        }

        const model = new NoMergeModel();

        // Act
        await model.update({ id: 'row-1' }, { name: 'foo' });

        // Assert: transaction must NOT have been opened
        expect(withTransactionSpy).not.toHaveBeenCalled();
        // Plain update path was used
        expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it('TC6: does NOT open a transaction when patch keys do NOT intersect mergeableJsonbColumns', async () => {
        // Arrange
        const withTransactionSpy = vi.spyOn(clientModule, 'withTransaction');
        const mockDb = buildMockPlainDb();
        setDb(mockDb as unknown as DrizzleClient);

        class MergeModelNoIntersect extends BaseModelImpl<{
            id: string;
            name: string;
            media: unknown;
        }> {
            protected table = tableWithMedia as unknown as import('drizzle-orm').Table;
            public entityName = 'merge_no_intersect';
            // Declares 'media' as mergeable but the patch only has 'name'
            protected override readonly mergeableJsonbColumns = ['media'] as const;
            protected getTableName() {
                return '_test_with_media';
            }
        }

        const model = new MergeModelNoIntersect();

        // Act — patch only updates 'name', which is NOT in mergeableJsonbColumns
        await model.update({ id: 'row-1' }, { name: 'foo' });

        // Assert: no transaction
        expect(withTransactionSpy).not.toHaveBeenCalled();
        expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it('TC7: opens a transaction and issues FOR UPDATE when the patch triggers merge', async () => {
        // Arrange: intercept withTransaction so we control innerTx
        const mockInnerTx = buildMockInnerTx([{ id: 'row-1' }]);

        const withTransactionSpy = vi
            .spyOn(clientModule, 'withTransaction')
            .mockImplementation(async (callback) => {
                return callback(mockInnerTx as unknown as DrizzleClient);
            });

        // setDb to something minimal so getDb() doesn't throw (plain path won't be used)
        setDb({} as unknown as DrizzleClient);

        class MergeModel extends BaseModelImpl<{ id: string; media: unknown }> {
            protected table = tableWithMedia as unknown as import('drizzle-orm').Table;
            public entityName = 'merge_model';
            protected override readonly mergeableJsonbColumns = ['media'] as const;
            protected getTableName() {
                return '_test_with_media';
            }
        }

        const model = new MergeModel();

        // Act
        const result = await model.update({ id: 'row-1' }, { media: { gallery: [] } });

        // Assert: withTransaction was called exactly once
        expect(withTransactionSpy).toHaveBeenCalledOnce();

        // The FOR UPDATE lock query was issued
        expect(mockInnerTx.execute).toHaveBeenCalledOnce();
        const executedSql = mockInnerTx.execute.mock.calls[0]?.[0];
        // The SQL object's queryChunks contain SQL literal chunks as objects with a
        // `value` array. We look for 'FOR UPDATE' in those value strings.
        // JSON.stringify(executedSql) would fail on circular table refs, so we walk manually.
        const sqlChunks = (executedSql as Record<string, unknown>)?.queryChunks as Array<unknown>;
        const hasForUpdate = sqlChunks?.some((c) => {
            if (typeof c === 'string') return c.includes('FOR UPDATE');
            const obj = c as Record<string, unknown>;
            const val = obj?.value;
            if (Array.isArray(val))
                return val.some((v) => typeof v === 'string' && v.includes('FOR UPDATE'));
            return false;
        });
        expect(hasForUpdate).toBe(true);

        // The UPDATE was issued via innerTx.update
        expect(mockInnerTx.update).toHaveBeenCalledOnce();

        // The set payload for 'media' must be a SQL fragment (not a plain object)
        const setArg = mockInnerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        const mediaArg = setArg?.media as Record<string, unknown>;
        expect(Array.isArray(mediaArg?.queryChunks)).toBe(true);

        // Result is the row returned by innerTx
        expect(result).toEqual({ id: 'row-1', media: { gallery: [] } });
    });

    it('TC8: returns null without UPDATE when the row does not exist (empty lock result)', async () => {
        // Arrange: lock query returns empty rows — row doesn't exist
        const mockInnerTx = buildMockInnerTx([]); // empty rows

        vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) => {
            return callback(mockInnerTx as unknown as DrizzleClient);
        });

        setDb({} as unknown as DrizzleClient);

        class MergeModelNotFound extends BaseModelImpl<{ id: string; media: unknown }> {
            protected table = tableWithMedia as unknown as import('drizzle-orm').Table;
            public entityName = 'merge_not_found';
            protected override readonly mergeableJsonbColumns = ['media'] as const;
            protected getTableName() {
                return '_test_with_media';
            }
        }

        const model = new MergeModelNotFound();

        // Act
        const result = await model.update({ id: 'nonexistent' }, { media: { gallery: [] } });

        // Assert: returned null without calling update
        expect(result).toBeNull();
        expect(mockInnerTx.execute).toHaveBeenCalledOnce(); // lock query was issued
        expect(mockInnerTx.update).not.toHaveBeenCalled(); // no UPDATE issued
    });

    it('TC9: forwards an existing tx via withTransaction passthrough', async () => {
        // Arrange
        const mockInnerTx = buildMockInnerTx([{ id: 'row-1' }]);

        const withTransactionSpy = vi
            .spyOn(clientModule, 'withTransaction')
            .mockImplementation(async (callback) => {
                return callback(mockInnerTx as unknown as DrizzleClient);
            });

        const outerTx = { _isOuterTx: true } as unknown as DrizzleClient;

        setDb({} as unknown as DrizzleClient);

        class MergeModelWithTx extends BaseModelImpl<{ id: string; media: unknown }> {
            protected table = tableWithMedia as unknown as import('drizzle-orm').Table;
            public entityName = 'merge_with_tx';
            protected override readonly mergeableJsonbColumns = ['media'] as const;
            protected getTableName() {
                return '_test_with_media';
            }
        }

        const model = new MergeModelWithTx();

        // Act — pass outerTx as the tx argument
        await model.update({ id: 'row-1' }, { media: { gallery: [] } }, outerTx);

        // Assert: withTransaction was called with the outer tx as the second argument
        expect(withTransactionSpy).toHaveBeenCalledOnce();
        const [, passedTx] = withTransactionSpy.mock.calls[0] as [unknown, unknown];
        expect(passedTx).toBe(outerTx);
    });
});

// ---------------------------------------------------------------------------
// Group 3: Integration acceptance tests (require a real DB)
// ---------------------------------------------------------------------------

const dbAvailable = Boolean(process.env.HOSPEDA_DATABASE_URL);

/** Name of the ephemeral test table. */
const JSONB_TEST_TABLE = '_jsonb_merge_test';

interface TestRow {
    id: string;
    data: Record<string, unknown> | null;
}

async function createTestTable(db: ReturnType<typeof drizzle>): Promise<void> {
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(JSONB_TEST_TABLE)}`);
    await db.execute(
        sql`CREATE TABLE ${sql.identifier(JSONB_TEST_TABLE)} (
            id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            data JSONB
        )`
    );
}

async function dropTestTable(db: ReturnType<typeof drizzle>): Promise<void> {
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(JSONB_TEST_TABLE)}`);
}

async function insertRow(
    db: ReturnType<typeof drizzle>,
    data: Record<string, unknown>
): Promise<string> {
    const result = await db.execute(
        sql`INSERT INTO ${sql.identifier(JSONB_TEST_TABLE)} (data)
            VALUES (${JSON.stringify(data)}::jsonb)
            RETURNING id`
    );
    const rows = (result as unknown as { rows: Array<{ id: string }> }).rows;
    const id = rows[0]?.id;
    if (!id) throw new Error('insertRow: no id returned');
    return id;
}

async function readRow(db: ReturnType<typeof drizzle>, id: string): Promise<TestRow | null> {
    const result = await db.execute(
        sql`SELECT id, data FROM ${sql.identifier(JSONB_TEST_TABLE)} WHERE id = ${id}::uuid`
    );
    const rows = (result as unknown as { rows: TestRow[] }).rows;
    return rows[0] ?? null;
}

async function applyMergeUpdate(
    db: ReturnType<typeof drizzle>,
    id: string,
    patch: Record<string, unknown>
): Promise<void> {
    await db.execute(
        sql`UPDATE ${sql.identifier(JSONB_TEST_TABLE)}
            SET data = data || ${JSON.stringify(patch)}::jsonb
            WHERE id = ${id}::uuid`
    );
}

/**
 * Applies a merge update inside a transaction with a controlled delay after
 * acquiring FOR UPDATE, widening the concurrency window for Test 11.
 */
async function applyMergeUpdateWithLock(
    db: ReturnType<typeof drizzle>,
    id: string,
    patch: Record<string, unknown>,
    delayMs: number
): Promise<void> {
    await (db as unknown as DrizzleClient).transaction(async (tx: DrizzleClient) => {
        await (tx as unknown as ReturnType<typeof drizzle>).execute(
            sql`SELECT id FROM ${sql.identifier(JSONB_TEST_TABLE)} WHERE id = ${id}::uuid FOR UPDATE`
        );

        if (delayMs > 0) {
            await (tx as unknown as ReturnType<typeof drizzle>).execute(
                sql`SELECT pg_sleep(${delayMs / 1000.0})`
            );
        }

        await (tx as unknown as ReturnType<typeof drizzle>).execute(
            sql`UPDATE ${sql.identifier(JSONB_TEST_TABLE)}
                SET data = data || ${JSON.stringify(patch)}::jsonb
                WHERE id = ${id}::uuid`
        );
    });
}

describe('BaseModel JSONB merge semantics — integration', () => {
    let pool: Pool;
    let db: ReturnType<typeof drizzle>;

    beforeAll(async () => {
        if (!dbAvailable) return;
        const connectionString = process.env.HOSPEDA_DATABASE_URL;
        if (!connectionString) return;
        pool = new Pool({ connectionString, max: 5 });
        db = drizzle(pool);
        await createTestTable(db);
    });

    afterAll(async () => {
        if (!dbAvailable || !db) return;
        await dropTestTable(db);
        await pool.end();
    });

    afterEach(async () => {
        if (!dbAvailable || !db) return;
        await db.execute(sql`DELETE FROM ${sql.identifier(JSONB_TEST_TABLE)}`);
    });

    // TC10 — GAP-078-186: gallery patch does not clobber featuredImage
    it.skipIf(!dbAvailable)(
        'TC10 (GAP-078-186): PATCH preserves featuredImage when only gallery is updated',
        async () => {
            // Arrange
            const initial = {
                featuredImage: {
                    url: 'https://res.cloudinary.com/demo/image/upload/v1/featured.jpg'
                },
                gallery: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/img1.jpg' }]
            };
            const id = await insertRow(db, initial);

            // Act
            await applyMergeUpdate(db, id, { gallery: [] });

            // Assert
            const row = await readRow(db, id);
            expect(row).not.toBeNull();
            const data = row?.data as { featuredImage?: unknown; gallery?: unknown[] };
            expect(data.featuredImage).toEqual(initial.featuredImage);
            expect(data.gallery).toEqual([]);
        }
    );

    // TC11 — GAP-078-198: concurrent writers see both keys in the final state
    // NOTE: This test is timing-sensitive. The 50 ms pg_sleep inside applyMergeUpdateWithLock
    // ensures writer A holds the FOR UPDATE lock long enough that writer B is serialised
    // behind it. If the CI host is extremely slow, the test may still be flaky — treat
    // any failure here as a signal to increase delayMs, not as a regression.
    it.skipIf(!dbAvailable)(
        'TC11 (GAP-078-198): two concurrent writers both see their keys in the final state',
        async () => {
            // Arrange
            const id = await insertRow(db, {});

            const featuredImage = {
                url: 'https://res.cloudinary.com/demo/image/upload/v1/featured.jpg'
            };
            const gallery = [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/g1.jpg' }];

            // Act: two concurrent writers — writer A holds the lock for 50 ms
            await Promise.all([
                applyMergeUpdateWithLock(db, id, { featuredImage }, 50),
                applyMergeUpdateWithLock(db, id, { gallery }, 0)
            ]);

            // Assert: both keys present in final row
            const row = await readRow(db, id);
            expect(row).not.toBeNull();
            const data = row?.data as { featuredImage?: unknown; gallery?: unknown[] };
            expect(data.featuredImage).toEqual(featuredImage);
            expect(data.gallery).toEqual(gallery);
        }
    );

    // TC12 — SPEC-254: merging a patch into a row whose JSONB column is NULL must
    // yield the patch, not NULL. Reproduces the recurrence_params_json bug: a
    // never-scheduled post has recurrence_params_json = NULL, and `NULL || patch`
    // returns NULL (dropping the weekday). The COALESCE wrapper fixes it.
    it.skipIf(!dbAvailable)(
        'TC12 (SPEC-254): COALESCE merge into a NULL JSONB column yields the patch',
        async () => {
            // Arrange: insert a row with data = SQL NULL (not JSON 'null')
            const insertResult = await db.execute(
                sql`INSERT INTO ${sql.identifier(JSONB_TEST_TABLE)} (data)
                    VALUES (NULL) RETURNING id`
            );
            const id = (insertResult as unknown as { rows: Array<{ id: string }> }).rows[0]?.id;
            if (!id) throw new Error('TC12: no id returned');

            // Sanity: bare `||` against NULL returns NULL (the bug)
            const buggy = await db.execute(
                sql`SELECT (data || ${JSON.stringify({ weekday: 'TUESDAY' })}::jsonb) AS r
                    FROM ${sql.identifier(JSONB_TEST_TABLE)} WHERE id = ${id}::uuid`
            );
            expect((buggy as unknown as { rows: Array<{ r: unknown }> }).rows[0]?.r).toBeNull();

            // Act: apply the fixed merge — COALESCE(data, '{}') || patch
            await db.execute(
                sql`UPDATE ${sql.identifier(JSONB_TEST_TABLE)}
                    SET data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({ weekday: 'TUESDAY' })}::jsonb
                    WHERE id = ${id}::uuid`
            );

            // Assert: the patch landed
            const row = await readRow(db, id);
            expect(row?.data).toEqual({ weekday: 'TUESDAY' });
        }
    );
});

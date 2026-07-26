/**
 * Tests for the default soft-delete exclusion on `AccommodationModel.findAll`,
 * `AccommodationModel.findAllWithRelations`, and `AccommodationModel.count`
 * (HOS-288).
 *
 * Before this fix `AccommodationModel` had NO default soft-delete filter: reads
 * were safe only because ~6 CUSTOM model methods (`search`,
 * `searchWithRelations`, `countByFilters`, `findTopRated`, `findIdsByOwnerId`,
 * `getMarketComparisonByOwnerId`) add `isNull(accommodations.deletedAt)` by
 * hand. Any caller reaching for the inherited `findAll`/`count`/
 * `findAllWithRelations` fell straight through and leaked soft-deleted rows
 * (production had 107 of them) — see `AccommodationModel#softDeleteCondition`
 * JSDoc. Mirrors the `EventModel`/`PostModel` fix from HOS-274, and this file
 * mirrors `event.model.soft-delete.test.ts`. Covers:
 *   1. Default injection of `isNull(accommodations.deletedAt)` on all three methods.
 *   2. `options.includeDeleted === true` opts out (no condition injected) —
 *      the escape hatch the admin trash/restore view relies on.
 *   3. A caller-supplied `where.deletedAt` key opts out (explicit intent wins,
 *      no double-injection).
 *   4. `items`/`total` consistency: the internal `this.count()` call made by
 *      `findAll`/`findAllWithRelations` receives the SAME `includeDeleted`
 *      value the caller passed, so `items` and `total` never disagree.
 *
 * All tests use mocked Drizzle clients (`vi.spyOn(dbUtils, 'getDb')`) per the
 * project convention — no real DB connection required.
 */
import type { SQL } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Helpers (same SQL-chunk introspection as event.model.soft-delete.test.ts)
// ---------------------------------------------------------------------------

type QueryChunk = { value?: unknown[] };

function chunksOf(clause: unknown): QueryChunk[] | undefined {
    return (clause as { queryChunks?: QueryChunk[] } | undefined)?.queryChunks;
}

function operatorOf(clause: unknown): string | undefined {
    const chunks = chunksOf(clause);
    const middle = chunks?.[2]?.value?.[0];
    return typeof middle === 'string' ? middle : undefined;
}

/** Flattens an `and(...)`-composed clause into its top-level conditions. */
function flattenAndConditions(clause: unknown): unknown[] {
    if (clause === undefined) return [];
    const chunks = chunksOf(clause);
    const isAndWrapper =
        chunks?.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')';
    if (!isAndWrapper) return [clause];

    const innerChunks = chunksOf(chunks?.[1]);
    if (!innerChunks) return [clause];
    return innerChunks.filter((_, i) => i % 2 === 0);
}

/**
 * True when the (possibly AND-composed) clause contains an
 * `isNull(<column named deleted_at>)` condition. `isNull(col)` compiles to the
 * chunk sequence `['', col, ' is null']`, so the column sits at index 1 and the
 * operator at index 2 — the column name is checked too so an unrelated
 * `IS NULL` predicate can never satisfy the assertion.
 */
function hasSoftDeleteCondition(clause: unknown): boolean {
    return flattenAndConditions(clause).some((c) => {
        if (operatorOf(c) !== ' is null') return false;
        const column = chunksOf(c)?.[1] as unknown as { name?: string } | undefined;
        return column?.name === 'deleted_at';
    });
}

/**
 * Chainable mock for `db.select().from().where().$dynamic().limit().offset()`
 * (items query, via BaseModelImpl.findAll) plus `db.select().from().where()`
 * (count query), capturing the WHERE clause passed to each.
 */
function makeFindAllMock(opts: {
    items?: unknown[];
    total?: number;
    captureItemsWhere?: (clause: SQL | undefined) => void;
    captureCountWhere?: (clause: SQL | undefined) => void;
}) {
    const { items = [], total = 0, captureItemsWhere, captureCountWhere } = opts;

    const countWhereFn = vi.fn((clause: SQL | undefined) => {
        captureCountWhere?.(clause);
        return Promise.resolve([{ count: total }]);
    });
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });

    const offsetFn = vi.fn().mockResolvedValue(items);
    const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
    const dynamicFn = vi.fn().mockReturnValue({ limit: limitFn });
    const itemsWhereFn = vi.fn((clause: SQL | undefined) => {
        captureItemsWhere?.(clause);
        return { $dynamic: dynamicFn };
    });
    const itemsFromFn = vi.fn().mockReturnValue({ where: itemsWhereFn });

    let callN = 0;
    const selectFn = vi.fn().mockImplementation(() => {
        callN += 1;
        if (callN <= 1) return { from: itemsFromFn };
        return { from: countFromFn };
    });

    return { db: { select: selectFn } };
}

/** Chainable mock for `findAllWithRelations`: `db.query.accommodations.findMany()` + count query. */
function makeFindAllWithRelationsMock(opts: {
    items?: unknown[];
    total?: number;
    captureFindManyArgs?: (args: unknown) => void;
    captureCountWhere?: (clause: SQL | undefined) => void;
}) {
    const { items = [], total = 0, captureFindManyArgs, captureCountWhere } = opts;

    const findManyFn = vi.fn((args: unknown) => {
        captureFindManyArgs?.(args);
        return Promise.resolve(items);
    });
    const countWhereFn = vi.fn((clause: SQL | undefined) => {
        captureCountWhere?.(clause);
        return Promise.resolve([{ count: total }]);
    });
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });
    const countSelectFn = vi.fn().mockReturnValue({ from: countFromFn });

    return {
        db: {
            query: { accommodations: { findMany: findManyFn } },
            select: countSelectFn
        }
    };
}

/** Chainable mock for a direct `model.count()` call: `db.select().from().where()`. */
function makeCountMock(opts: { total?: number; captureWhere?: (clause: SQL | undefined) => void }) {
    const { total = 0, captureWhere } = opts;
    const whereFn = vi.fn((clause: SQL | undefined) => {
        captureWhere?.(clause);
        return Promise.resolve([{ count: total }]);
    });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });
    return { db: { select: selectFn } };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AccommodationModel — default soft-delete exclusion (HOS-288)', () => {
    let model: AccommodationModel;
    let getDb: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        model = new AccommodationModel();
        getDb = vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('findAll', () => {
        it('injects isNull(deletedAt) by default', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({});

            expect(hasSoftDeleteCondition(itemsWhere)).toBe(true);
        });

        it('still injects isNull(deletedAt) when the caller passes unrelated filters', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({ destinationId: 'd1' });

            expect(hasSoftDeleteCondition(itemsWhere)).toBe(true);
        });

        it('applies the same exclusion to the count query backing `total`', async () => {
            let countWhere: SQL | undefined;
            const { db } = makeFindAllMock({
                captureCountWhere: (c) => {
                    countWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({ destinationId: 'd1' });

            expect(hasSoftDeleteCondition(countWhere)).toBe(true);
        });

        it('does NOT inject the condition when options.includeDeleted === true', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({}, { includeDeleted: true });

            expect(itemsWhere).toBeUndefined();
        });

        it('does NOT double-inject when where.deletedAt is already present', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({ deletedAt: null });

            // Exactly ONE condition present (the caller's own deletedAt=null,
            // translated by buildWhereClause) — not AND-composed with a second
            // isNull(deletedAt) from the model default.
            expect(flattenAndConditions(itemsWhere)).toHaveLength(1);
            expect(hasSoftDeleteCondition(itemsWhere)).toBe(true);
        });

        it('items/total consistency: forwards includeDeleted to the internal count() call', async () => {
            const countSpy = vi.spyOn(model, 'count');
            const { db } = makeFindAllMock({ items: [{ id: '1' }], total: 1 });
            getDb.mockReturnValue(db as never);

            await model.findAll({}, { includeDeleted: true });

            expect(countSpy).toHaveBeenCalledTimes(1);
            const [, countOptions] = countSpy.mock.calls[0] ?? [];
            expect((countOptions as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(
                true
            );
        });
    });

    describe('findAllWithRelations', () => {
        it('injects isNull(deletedAt) by default', async () => {
            let findManyArgs: unknown;
            const { db } = makeFindAllWithRelationsMock({
                captureFindManyArgs: (args) => {
                    findManyArgs = args;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAllWithRelations({ destination: true }, {});

            const where = (findManyArgs as { where?: unknown } | undefined)?.where;
            expect(hasSoftDeleteCondition(where)).toBe(true);
        });

        it('does NOT inject the condition when options.includeDeleted === true', async () => {
            let findManyArgs: unknown;
            const { db } = makeFindAllWithRelationsMock({
                captureFindManyArgs: (args) => {
                    findManyArgs = args;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAllWithRelations({ destination: true }, {}, { includeDeleted: true });

            const where = (findManyArgs as { where?: unknown } | undefined)?.where;
            expect(where).toBeUndefined();
        });

        it('does NOT double-inject when where.deletedAt is already present', async () => {
            let findManyArgs: unknown;
            const { db } = makeFindAllWithRelationsMock({
                captureFindManyArgs: (args) => {
                    findManyArgs = args;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAllWithRelations({ destination: true }, { deletedAt: null });

            const where = (findManyArgs as { where?: unknown } | undefined)?.where;
            expect(flattenAndConditions(where)).toHaveLength(1);
            expect(hasSoftDeleteCondition(where)).toBe(true);
        });

        it('items/total consistency: forwards includeDeleted to the internal count() call', async () => {
            const countSpy = vi.spyOn(model, 'count');
            const { db } = makeFindAllWithRelationsMock({ items: [{ id: '1' }], total: 1 });
            getDb.mockReturnValue(db as never);

            await model.findAllWithRelations({ destination: true }, {}, { includeDeleted: true });

            expect(countSpy).toHaveBeenCalledTimes(1);
            const [, countOptions] = countSpy.mock.calls[0] ?? [];
            expect((countOptions as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(
                true
            );
        });
    });

    describe('count', () => {
        it('injects isNull(deletedAt) by default', async () => {
            let capturedWhere: SQL | undefined;
            const { db } = makeCountMock({
                captureWhere: (c) => {
                    capturedWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.count({});

            expect(hasSoftDeleteCondition(capturedWhere)).toBe(true);
        });

        it('does NOT inject the condition when options.includeDeleted === true', async () => {
            let capturedWhere: SQL | undefined;
            const { db } = makeCountMock({
                captureWhere: (c) => {
                    capturedWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.count({}, { includeDeleted: true });

            expect(capturedWhere).toBeUndefined();
        });

        it('does NOT double-inject when where.deletedAt is already present', async () => {
            let capturedWhere: SQL | undefined;
            const { db } = makeCountMock({
                captureWhere: (c) => {
                    capturedWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.count({ deletedAt: null });

            expect(flattenAndConditions(capturedWhere)).toHaveLength(1);
            expect(hasSoftDeleteCondition(capturedWhere)).toBe(true);
        });
    });
});

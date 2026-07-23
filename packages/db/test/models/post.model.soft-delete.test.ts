/**
 * Tests for the default soft-delete exclusion on `PostModel.findAll`,
 * `PostModel.findAllWithRelations`, and `PostModel.count` (HOS-274).
 *
 * Before this fix, none of the PUBLIC list/count/getByX endpoints for posts
 * filtered `deletedAt IS NULL` — the model-layer fix here closes that gap
 * ONCE for every current and future caller (see `PostModel#softDeleteCondition`
 * JSDoc). Covers:
 *   1. Default injection of `isNull(posts.deletedAt)` on all three methods,
 *      across both the delegation (default sort) and synthetic-sort
 *      (`mostSaved`) code paths of `findAll`. `PostModel.findAllWithRelations`
 *      has only a delegation branch (no synthetic-sort override), unlike
 *      `EventModel`.
 *   2. `options.includeDeleted === true` opts out (no condition injected).
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
import { PostModel } from '../../src/models/post/post.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Helpers
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

/** Flattens an `and(...)`-composed clause into its top-level conditions (see event.model.categories.test.ts for full rationale). */
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

/** True when the (possibly AND-composed) clause contains an `isNull()`-shaped condition. */
function hasSoftDeleteCondition(clause: unknown): boolean {
    return flattenAndConditions(clause).some((c) => operatorOf(c) === ' is null');
}

/**
 * Chainable mock for `db.select().from().where().$dynamic().limit().offset()`
 * (delegation-branch items query, via BaseModelImpl.findAll) plus
 * `db.select().from().where()` (count query), capturing the WHERE clause
 * passed to the items query.
 */
function makeDelegationFindAllMock(opts: {
    items?: unknown[];
    total?: number;
    captureItemsWhere?: (clause: SQL | undefined) => void;
}) {
    const { items = [], total = 0, captureItemsWhere } = opts;

    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
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

/**
 * Chainable mock for the synthetic-sort branch (`mostSaved`), which uses
 * `db.select().from().where().orderBy().limit().offset()` (no `$dynamic()`)
 * for items, plus `db.select().from().where()` for count.
 */
function makeSyntheticSortFindAllMock(opts: {
    items?: unknown[];
    total?: number;
    captureItemsWhere?: (clause: SQL | undefined) => void;
}) {
    const { items = [], total = 0, captureItemsWhere } = opts;

    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });

    const offsetFn = vi.fn().mockResolvedValue(items);
    const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const itemsWhereFn = vi.fn((clause: SQL | undefined) => {
        captureItemsWhere?.(clause);
        return { orderBy: orderByFn };
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

/** Chainable mock for `findAllWithRelations`: `db.query.posts.findMany()` + `db.select().from().where()` for count. */
function makeFindAllWithRelationsMock(opts: {
    items?: unknown[];
    total?: number;
    captureFindManyArgs?: (args: unknown) => void;
}) {
    const { items = [], total = 0, captureFindManyArgs } = opts;

    const findManyFn = vi.fn((args: unknown) => {
        captureFindManyArgs?.(args);
        return Promise.resolve(items);
    });
    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });
    const countSelectFn = vi.fn().mockReturnValue({ from: countFromFn });

    return {
        db: {
            query: { posts: { findMany: findManyFn } },
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

describe('PostModel — default soft-delete exclusion (HOS-274)', () => {
    let model: PostModel;
    let getDb: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        model = new PostModel();
        getDb = vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('findAll — delegation branch (default sort)', () => {
        it('injects isNull(deletedAt) by default', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeDelegationFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({});

            expect(hasSoftDeleteCondition(itemsWhere)).toBe(true);
        });

        it('does NOT inject the condition when options.includeDeleted === true', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeDelegationFindAllMock({
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
            const { db } = makeDelegationFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({ deletedAt: null });

            expect(flattenAndConditions(itemsWhere)).toHaveLength(1);
            expect(hasSoftDeleteCondition(itemsWhere)).toBe(true);
        });

        it('items/total consistency: forwards includeDeleted to the internal count() call', async () => {
            const countSpy = vi.spyOn(model, 'count');
            const { db } = makeDelegationFindAllMock({ items: [{ id: '1' }], total: 1 });
            getDb.mockReturnValue(db as never);

            await model.findAll({}, { includeDeleted: true });

            expect(countSpy).toHaveBeenCalledTimes(1);
            const [, countOptions] = countSpy.mock.calls[0] ?? [];
            expect((countOptions as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(
                true
            );
        });

        it('items/total consistency: forwards includeDeleted=undefined (default) to the internal count() call', async () => {
            const countSpy = vi.spyOn(model, 'count');
            const { db } = makeDelegationFindAllMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as never);

            await model.findAll({});

            const [, countOptions] = countSpy.mock.calls[0] ?? [];
            expect(
                (countOptions as { includeDeleted?: boolean } | undefined)?.includeDeleted
            ).toBeUndefined();
        });
    });

    describe('findAll — synthetic-sort branch (mostSaved)', () => {
        it('injects isNull(deletedAt) by default', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeSyntheticSortFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({}, { sortBy: 'mostSaved' });

            expect(hasSoftDeleteCondition(itemsWhere)).toBe(true);
        });

        it('does NOT inject the condition when options.includeDeleted === true', async () => {
            let itemsWhere: SQL | undefined;
            const { db } = makeSyntheticSortFindAllMock({
                captureItemsWhere: (c) => {
                    itemsWhere = c;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAll({}, { sortBy: 'mostSaved', includeDeleted: true });

            expect(itemsWhere).toBeUndefined();
        });

        it('items/total consistency: forwards includeDeleted to the manual this.count() call', async () => {
            const countSpy = vi.spyOn(model, 'count');
            const { db } = makeSyntheticSortFindAllMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as never);

            await model.findAll({}, { sortBy: 'mostSaved', includeDeleted: true });

            const [, countOptions] = countSpy.mock.calls[0] ?? [];
            expect((countOptions as { includeDeleted?: boolean } | undefined)?.includeDeleted).toBe(
                true
            );
        });
    });

    describe('findAllWithRelations (delegation-only — no synthetic-sort override)', () => {
        it('injects isNull(deletedAt) by default', async () => {
            let findManyArgs: unknown;
            const { db } = makeFindAllWithRelationsMock({
                captureFindManyArgs: (args) => {
                    findManyArgs = args;
                }
            });
            getDb.mockReturnValue(db as never);

            await model.findAllWithRelations({ author: true }, {});

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

            await model.findAllWithRelations({ author: true }, {}, { includeDeleted: true });

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

            await model.findAllWithRelations({ author: true }, { deletedAt: null });

            const where = (findManyArgs as { where?: unknown } | undefined)?.where;
            expect(flattenAndConditions(where)).toHaveLength(1);
            expect(hasSoftDeleteCondition(where)).toBe(true);
        });

        it('items/total consistency: forwards includeDeleted to the internal count() call (via BaseModelImpl)', async () => {
            const countSpy = vi.spyOn(model, 'count');
            const { db } = makeFindAllWithRelationsMock({ items: [{ id: '1' }], total: 1 });
            getDb.mockReturnValue(db as never);

            await model.findAllWithRelations({ author: true }, {}, { includeDeleted: true });

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

/**
 * Tests for the `categories`/`category` manual WHERE branch on PostModel
 * (HOS-96 T-005 / US-2 / US-9).
 *
 * Mirrors `AccommodationModel`'s `types`/`type` blueprint (and the identical
 * fix applied to `EventModel` in T-004): `findAll` and `findAllWithRelations`
 * (both delegate through the same sanitization helper, and `count` gets its
 * own override) must build `inArray(posts.category, categories)` when
 * `categories` has 1+ values, fall back to `eq(posts.category, category)`
 * when only the singular value is present, give the array precedence when
 * both are present, and add NO category clause when `categories` is an empty
 * array and `category` is absent.
 *
 * This is the exact regression the spec calls out: before this fix,
 * `categories` is not a real column on the `posts` table, so the generic
 * `buildWhereClause` silently skipped it as an "unknown key" — the filter was
 * dropped entirely rather than applied, and `?categories=A,B` matched
 * everything instead of the union of A and B.
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

function inArrayValuesOf(clause: unknown): unknown[] | undefined {
    const chunks = chunksOf(clause);
    const paramList = chunks?.[3];
    if (!Array.isArray(paramList)) return undefined;
    return paramList.map((p) => (p as { value?: unknown }).value);
}

function eqValueOf(clause: unknown): unknown {
    const chunks = chunksOf(clause);
    return (chunks?.[3] as { value?: unknown } | undefined)?.value;
}

/**
 * Creates a chainable mock for `db.select().from().where().limit().offset()`
 * (items query) plus `db.select().from().where()` (count query), capturing
 * the WHERE clause passed to the items query.
 */
function makeFindAllMock(opts: {
    items?: unknown[];
    total?: number;
    captureWhere?: (clause: SQL | undefined) => void;
}) {
    const { items = [], total = 0, captureWhere } = opts;

    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });

    const offsetFn = vi.fn().mockResolvedValue(items);
    const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
    const dynamicFn = vi.fn().mockReturnValue({ limit: limitFn });
    const itemsWhereFn = vi.fn((clause: SQL | undefined) => {
        captureWhere?.(clause);
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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PostModel — categories/category manual WHERE branch (HOS-96)', () => {
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

    it('builds inArray(posts.category, [...]) when categories has 1 value', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ categories: ['CULTURE'] });

        expect(operatorOf(capturedWhere)).toBe(' in ');
        expect(inArrayValuesOf(capturedWhere)).toEqual(['CULTURE']);
    });

    it('builds inArray(posts.category, [...]) when categories has N values', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ categories: ['CULTURE', 'GASTRONOMY', 'NATURE'] });

        expect(operatorOf(capturedWhere)).toBe(' in ');
        expect(inArrayValuesOf(capturedWhere)).toEqual(['CULTURE', 'GASTRONOMY', 'NATURE']);
    });

    it('falls back to eq(posts.category, category) when only the singular value is present', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ category: 'CULTURE' });

        expect(operatorOf(capturedWhere)).toBe(' = ');
        expect(eqValueOf(capturedWhere)).toBe('CULTURE');
    });

    it('gives the array precedence when both category and categories are present', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ category: 'CULTURE', categories: ['GASTRONOMY', 'NATURE'] });

        expect(operatorOf(capturedWhere)).toBe(' in ');
        expect(inArrayValuesOf(capturedWhere)).toEqual(['GASTRONOMY', 'NATURE']);
    });

    it('adds no category clause when categories is empty and category is absent', async () => {
        let capturedWhere: SQL | undefined;
        let captured = false;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
                captured = true;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ categories: [] });

        expect(captured).toBe(true);
        expect(capturedWhere).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // Regression (US-9): the exact shipped bug — `?categories=A,B` must match
    // the UNION of A and B, not be silently dropped (returning everything) or
    // rejected. This mock evaluates the real `inArray` condition against a
    // fixture set so the assertion covers actual filtering behavior, not just
    // WHERE-clause shape.
    // -----------------------------------------------------------------------
    it('regression: ?categories=CULTURE,GASTRONOMY matches posts of EITHER category (union)', async () => {
        const fixture = [
            { id: '1', category: 'CULTURE' },
            { id: '2', category: 'GASTRONOMY' },
            { id: '3', category: 'NATURE' }
        ];

        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ categories: ['CULTURE', 'GASTRONOMY'] });

        const matchedValues = inArrayValuesOf(capturedWhere) as string[];
        const unionResult = fixture.filter((row) => matchedValues.includes(row.category));

        expect(unionResult).toHaveLength(2);
        expect(unionResult.map((r) => r.id).sort()).toEqual(['1', '2']);
        expect(unionResult.some((r) => r.category === 'NATURE')).toBe(false);
    });
});

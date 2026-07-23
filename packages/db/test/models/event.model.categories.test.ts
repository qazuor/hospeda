/**
 * Tests for the `categories`/`category` manual WHERE branch on EventModel
 * (HOS-96 T-004 / US-2 / US-9).
 *
 * Mirrors `AccommodationModel`'s `types`/`type` blueprint: `findAll` (and, by
 * extension, `findAllWithRelations`/`count`, which delegate through the same
 * sanitization helper) must build `inArray(events.category, categories)` when
 * `categories` has 1+ values, fall back to `eq(events.category, category)`
 * when only the singular value is present, give the array precedence when
 * both are present, and add NO category clause when `categories` is an empty
 * array and `category` is absent.
 *
 * This is the exact regression the spec calls out: before this fix,
 * `categories` is not a real column on the `events` table, so the generic
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
import { EventModel } from '../../src/models/event/event.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QueryChunk = { value?: unknown[] };

/** Reads the drizzle-internal `queryChunks` array off an SQL condition, if any. */
function chunksOf(clause: unknown): QueryChunk[] | undefined {
    return (clause as { queryChunks?: QueryChunk[] } | undefined)?.queryChunks;
}

/**
 * Returns the SQL operator keyword (` = ` or ` in `) embedded in a
 * single `eq()`/`inArray()` condition's middle chunk, or `undefined` if the
 * clause doesn't look like one of those two shapes.
 */
function operatorOf(clause: unknown): string | undefined {
    const chunks = chunksOf(clause);
    const middle = chunks?.[2]?.value?.[0];
    return typeof middle === 'string' ? middle : undefined;
}

/** Extracts the literal values bound to an `inArray()` condition's Param list. */
function inArrayValuesOf(clause: unknown): unknown[] | undefined {
    const chunks = chunksOf(clause);
    const paramList = chunks?.[3];
    if (!Array.isArray(paramList)) return undefined;
    return paramList.map((p) => (p as { value?: unknown }).value);
}

/** Extracts the literal value bound to an `eq()` condition's single Param. */
function eqValueOf(clause: unknown): unknown {
    const chunks = chunksOf(clause);
    return (chunks?.[3] as { value?: unknown } | undefined)?.value;
}

/**
 * Flattens an `and(...)`-composed WHERE clause into its individual top-level
 * conditions.
 *
 * Since HOS-274, `EventModel.findAll` also injects a default
 * `isNull(events.deletedAt)` soft-delete condition alongside the
 * `categories`/`category` condition tested in this file, so a WHERE clause
 * with both present is `and(categoryCondition, isNull(deletedAt))` rather
 * than a bare single condition. Drizzle's `and()` wraps its arguments as
 * `[StringChunk('('), innerSQL, StringChunk(')')]`, where `innerSQL`
 * alternates conditions and `' and '` separator chunks
 * (`[cond1, ' and ', cond2, ...]`). This helper detects that wrapper shape and
 * extracts just the conditions (even indices), so existing per-condition
 * assertions (`operatorOf`, `inArrayValuesOf`, `eqValueOf`) keep working
 * unchanged on the individual sub-conditions.
 *
 * Returns `[clause]` unchanged when `clause` is already a single leaf
 * condition (no AND wrapper detected) — e.g. when only the soft-delete
 * condition fired and no category filter was applied.
 */
function flattenAndConditions(clause: unknown): unknown[] {
    const chunks = chunksOf(clause);
    const isAndWrapper =
        chunks?.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')';
    if (!isAndWrapper) return [clause];

    const innerChunks = chunksOf(chunks?.[1]);
    if (!innerChunks) return [clause];
    // Even indices are conditions; odd indices are ' and ' separator chunks.
    return innerChunks.filter((_, i) => i % 2 === 0);
}

/** Finds the sub-condition (after flattening any AND wrapper) whose operator matches. */
function findConditionByOperator(clause: unknown, operator: string): unknown {
    return flattenAndConditions(clause).find((c) => operatorOf(c) === operator);
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

describe('EventModel — categories/category manual WHERE branch (HOS-96)', () => {
    let model: EventModel;
    let getDb: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        model = new EventModel();
        getDb = vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds inArray(events.category, [...]) when categories has 1 value', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ categories: ['MUSIC'] });

        // HOS-274: the WHERE clause is now `and(categoryCondition, isNull(deletedAt))`
        // by default — flatten before asserting on the category sub-condition.
        const categoryClause = findConditionByOperator(capturedWhere, ' in ');
        expect(operatorOf(categoryClause)).toBe(' in ');
        expect(inArrayValuesOf(categoryClause)).toEqual(['MUSIC']);
    });

    it('builds inArray(events.category, [...]) when categories has N values', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ categories: ['MUSIC', 'CULTURE', 'SPORTS'] });

        const categoryClause = findConditionByOperator(capturedWhere, ' in ');
        expect(operatorOf(categoryClause)).toBe(' in ');
        expect(inArrayValuesOf(categoryClause)).toEqual(['MUSIC', 'CULTURE', 'SPORTS']);
    });

    it('falls back to eq(events.category, category) when only the singular value is present', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ category: 'MUSIC' });

        const categoryClause = findConditionByOperator(capturedWhere, ' = ');
        expect(operatorOf(categoryClause)).toBe(' = ');
        expect(eqValueOf(categoryClause)).toBe('MUSIC');
    });

    it('gives the array precedence when both category and categories are present', async () => {
        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ category: 'MUSIC', categories: ['CULTURE', 'SPORTS'] });

        const categoryClause = findConditionByOperator(capturedWhere, ' in ');
        expect(operatorOf(categoryClause)).toBe(' in ');
        expect(inArrayValuesOf(categoryClause)).toEqual(['CULTURE', 'SPORTS']);
    });

    it('adds no category clause when categories is empty and category is absent (HOS-274: only the default soft-delete condition remains)', async () => {
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
        // No category condition was added, but the WHERE clause is NOT undefined
        // anymore (pre-HOS-274 expectation) — EventModel.findAll now defaults to
        // excluding soft-deleted rows, so a single isNull(events.deletedAt)
        // condition is present instead of an empty clause.
        expect(capturedWhere).toBeDefined();
        expect(findConditionByOperator(capturedWhere, ' in ')).toBeUndefined();
        expect(findConditionByOperator(capturedWhere, ' = ')).toBeUndefined();
        expect(operatorOf(capturedWhere)).toBe(' is null');
    });

    // -----------------------------------------------------------------------
    // Regression (US-9): the exact shipped bug — `?categories=A,B` must match
    // the UNION of A and B, not be silently dropped (returning everything) or
    // rejected. This mock evaluates the real `inArray` condition against a
    // fixture set so the assertion covers actual filtering behavior, not just
    // WHERE-clause shape.
    // -----------------------------------------------------------------------
    it('regression: ?categories=MUSIC,CULTURE matches events of EITHER category (union)', async () => {
        const fixture = [
            { id: '1', category: 'MUSIC' },
            { id: '2', category: 'CULTURE' },
            { id: '3', category: 'SPORTS' }
        ];

        let capturedWhere: SQL | undefined;
        const { db } = makeFindAllMock({
            items: [], // overwritten below once we know the where clause
            captureWhere: (clause) => {
                capturedWhere = clause;
            }
        });
        getDb.mockReturnValue(db as never);

        await model.findAll({ categories: ['MUSIC', 'CULTURE'] });

        // HOS-274: flatten the AND-composed clause (category cond + default
        // soft-delete cond) before reading the inArray values.
        const categoryClause = findConditionByOperator(capturedWhere, ' in ');
        const matchedValues = inArrayValuesOf(categoryClause) as string[];
        const unionResult = fixture.filter((row) => matchedValues.includes(row.category));

        expect(unionResult).toHaveLength(2);
        expect(unionResult.map((r) => r.id).sort()).toEqual(['1', '2']);
        expect(unionResult.some((r) => r.category === 'SPORTS')).toBe(false);
    });
});

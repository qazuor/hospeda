/**
 * HOS-288 regression — GET /api/v1/public/accommodations/:id/similar must
 * exclude soft-deleted accommodations.
 *
 * This route builds its WHERE clause with a RAW Drizzle relational query
 * (`db.query.accommodations.findMany`), bypassing `AccommodationModel`
 * entirely — so the model-level soft-delete default added in HOS-288 does NOT
 * reach it and the exclusion has to be written out explicitly. Production had
 * 107 soft-deleted accommodations, all of which this endpoint happily returned
 * (it filtered `visibility = 'PUBLIC'` and `lifecycleState = 'ACTIVE'` but
 * never `deleted_at IS NULL`).
 *
 * Asserting on a filtered result set is impossible here: the mocked client
 * returns whatever rows the test hands it, so it can never prove a predicate
 * exists. Instead this test captures the actual WHERE clause the route passes
 * to Drizzle and asserts an `IS NULL` condition on the `deletedAt` column is
 * part of it. The local `@repo/db` mock (which overrides the global one in
 * `test/setup.ts`) stubs each accommodation column as a recognisable string, so
 * the operand of that `IS NULL` can be identified unambiguously.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── DB mock ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFindMany = vi.fn();

/** Sentinel used as the `accommodations.deletedAt` column stub. */
const DELETED_AT_COLUMN = 'acc.deletedAt';

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockSelect,
        query: {
            accommodations: {
                findMany: mockFindMany
            }
        }
    })),
    accommodations: {
        id: 'acc.id',
        slug: 'acc.slug',
        type: 'acc.type',
        destinationId: 'acc.destinationId',
        lifecycleState: 'acc.lifecycleState',
        visibility: 'acc.visibility',
        averageRating: 'acc.averageRating',
        deletedAt: DELETED_AT_COLUMN
    }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        ServiceError: class ServiceError extends Error {
            public readonly code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: unknown,
            params: Record<string, unknown>,
            body: unknown,
            query: Record<string, unknown>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(c, c.req.param(), undefined, c.req.query());
            return c.json({ success: true, data: result });
        });
        return app;
    }
}));

// ── SQL-clause introspection helpers ────────────────────────────────────────
// Same chunk-walking approach as packages/db/test/models/*.soft-delete.test.ts.

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
 * Left-hand operand of a binary/unary condition. `isNull(col)` compiles to the
 * chunk sequence `['', col, ' is null']`, so the operand sits at index 1. With
 * the stubbed (string) columns of this file's `@repo/db` mock, Drizzle keeps the
 * stub in the chunk list verbatim, so the operand IS the stub string.
 */
function leftOperandOf(clause: unknown): unknown {
    return chunksOf(clause)?.[1];
}

/** True when the (possibly AND-composed) clause has an `IS NULL` on `deletedAt`. */
function hasDeletedAtIsNull(clause: unknown): boolean {
    return flattenAndConditions(clause).some(
        (c) => operatorOf(c) === ' is null' && leftOperandOf(c) === DELETED_AT_COLUMN
    );
}

// ── helpers ─────────────────────────────────────────────────────────────────

const SOURCE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const DESTINATION_ID = 'dddddddd-0000-4000-8000-000000000001';

function buildSelectChain(rows: unknown[]) {
    return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows)
    };
}

async function buildApp() {
    vi.resetModules();
    const { publicGetSimilarRoute } = await import(
        '../../../../src/routes/accommodation/public/similar'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetSimilarRoute);
    return app;
}

// ── tests ───────────────────────────────────────────────────────────────────

describe('publicGetSimilarRoute — HOS-288 soft-deleted rows must be excluded', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // select() call: fetch source accommodation (type + destinationId)
        mockSelect.mockImplementation(() =>
            buildSelectChain([{ type: 'CABIN', destinationId: DESTINATION_ID }])
        );
        mockFindMany.mockResolvedValue([]);
    });

    it('adds an IS NULL predicate on deletedAt to the similarity query', async () => {
        const app = await buildApp();
        const res = await app.request(`/${SOURCE_ID}/similar`);
        expect(res.status).toBe(200);

        expect(mockFindMany).toHaveBeenCalledTimes(1);
        const where = (mockFindMany.mock.calls[0]?.[0] as { where?: unknown } | undefined)?.where;
        expect(hasDeletedAtIsNull(where)).toBe(true);
    });

    it('keeps the pre-existing visibility/lifecycle predicates alongside it', async () => {
        const app = await buildApp();
        await app.request(`/${SOURCE_ID}/similar`);

        const where = (mockFindMany.mock.calls[0]?.[0] as { where?: unknown } | undefined)?.where;
        const conditions = flattenAndConditions(where);
        // or(type, destination) + ne(id) + eq(lifecycleState) + eq(visibility) + isNull(deletedAt)
        expect(conditions).toHaveLength(5);
        expect(hasDeletedAtIsNull(where)).toBe(true);
    });
});

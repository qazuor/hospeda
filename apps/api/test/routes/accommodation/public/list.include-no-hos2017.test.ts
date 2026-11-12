/**
 * HOS-2017 — `includeNoPrice` / `includeNoReviews` on
 * GET /api/v1/public/accommodations.
 *
 * Before the fix the API rejected both params as unknown (400), which the web
 * showed as "no results". They must now parse and reach the service as
 * booleans. The route factory mock parses the query through the real HTTP
 * search schema, like list.allows-pets.test.ts.
 */
import { AccommodationSearchHttpSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const mockSearch = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return { search: mockSearch };
        }),
        SearchHistoryService: vi.fn().mockImplementation(function () {
            return { record: vi.fn().mockResolvedValue(undefined) };
        })
    };
});

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    resolveOwnerEntitlementsForOwnerId: vi.fn().mockResolvedValue([]),
    resolveOwnerEntitlementsForOwnerIds: vi.fn().mockResolvedValue(new Map())
}));

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    const guest = { id: '00000000-0000-4000-8000-000000000000', roles: ['GUEST'], permissions: [] };
    return {
        ...actual,
        getActorFromContext: vi.fn(() => guest),
        isGuestActor: vi.fn(() => true),
        createGuestActor: vi.fn(() => guest)
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/routes/accommodation/public/quick-amenity-resolver', () => ({
    resolveQuickAmenityFlags: vi.fn().mockResolvedValue([])
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicListRoute: (options: {
        method: 'get';
        path: string;
        handler: (
            c: unknown,
            params: Record<string, unknown>,
            body: unknown,
            query: Record<string, unknown>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        app[options.method](options.path, async (c) => {
            const query = AccommodationSearchHttpSchema.parse(c.req.query());
            const result = await options.handler(c, c.req.param(), undefined, query);
            return c.json({ success: true, ...(result as object) });
        });
        return app;
    }
}));

async function buildApp() {
    vi.resetModules();
    const { publicListAccommodationsRoute } = await import(
        '../../../../src/routes/accommodation/public/list'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicListAccommodationsRoute);
    return app;
}

describe('publicListAccommodationsRoute — includeNoPrice / includeNoReviews (HOS-2017)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearch.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 10 } });
    });

    it('accepts ?includeNoPrice=false&includeNoReviews=false and forwards booleans', async () => {
        // Arrange
        const app = await buildApp();

        // Act
        const res = await app.request('/?includeNoPrice=false&includeNoReviews=false');

        // Assert
        expect(res.status).toBe(200);
        const params = mockSearch.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(params.includeNoPrice).toBe(false);
        expect(params.includeNoReviews).toBe(false);
    });

    it('does not set the flags when absent', async () => {
        // Arrange
        const app = await buildApp();

        // Act
        await app.request('/');

        // Assert
        const params = mockSearch.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(params.includeNoPrice).toBeUndefined();
        expect(params.includeNoReviews).toBeUndefined();
    });
});

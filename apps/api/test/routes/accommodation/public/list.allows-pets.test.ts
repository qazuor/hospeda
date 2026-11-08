/**
 * HOS-2060 — `allowsPets` on GET /api/v1/public/accommodations.
 *
 * Pets are a house rule, not an amenity: the route forwards the flag as the
 * `allowsPets` domain param (the model matches `policies.pets.admission`) and
 * never asks the amenity resolver for it.
 *
 * The route factory mock parses the query through the real HTTP search schema,
 * so `?allowsPets=true` reaches the handler as the boolean the real factory
 * produces.
 */
import { AccommodationSearchHttpSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const mockSearch = vi.fn();
const mockResolveQuickAmenityFlags = vi.fn();

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
    resolveQuickAmenityFlags: mockResolveQuickAmenityFlags
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

describe('publicListAccommodationsRoute — allowsPets (HOS-2060)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveQuickAmenityFlags.mockResolvedValue([]);
        mockSearch.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 10 } });
    });

    it('forwards ?allowsPets=true to the service as the allowsPets domain param', async () => {
        // Arrange
        const app = await buildApp();

        // Act
        const res = await app.request('/?allowsPets=true');

        // Assert
        expect(res.status).toBe(200);
        expect(mockSearch).toHaveBeenCalledTimes(1);
        const params = mockSearch.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(params.allowsPets).toBe(true);
        expect(params).not.toHaveProperty('anyAmenityGroups');
    });

    it('no longer asks the amenity resolver for allowsPets', async () => {
        // Arrange
        const app = await buildApp();

        // Act
        await app.request('/?allowsPets=true');

        // Assert
        expect(mockResolveQuickAmenityFlags).toHaveBeenCalledTimes(1);
        expect(mockResolveQuickAmenityFlags.mock.calls[0]?.[0]).not.toHaveProperty('allowsPets');
    });

    it('sends no allowsPets param when the flag is absent or false', async () => {
        // Arrange
        const app = await buildApp();

        // Act
        await app.request('/');
        await app.request('/?allowsPets=false');

        // Assert
        for (const call of mockSearch.mock.calls) {
            expect(call[1] as Record<string, unknown>).not.toHaveProperty('allowsPets');
        }
    });
});

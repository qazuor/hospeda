/**
 * HOS-353 regression — every handler on the shared-cached
 * `/api/v1/public/accommodations` prefix must be ACTOR-BLIND.
 *
 * That prefix is the first entry of `PUBLIC_CACHE_ENDPOINTS` and the match is
 * `startsWith`, so all six routes below are stored under `public:<path><query>` —
 * a key with NO actor component, unlike the private branch of `generateCacheKey`
 * right beneath it. `cacheMiddleware` is also registered BEFORE `authMiddleware`,
 * so a cache HIT returns without auth ever running.
 *
 * A payload that varies by READER therefore leaks: the first privileged request
 * parks its response in the slot every anonymous visitor reads for the whole TTL.
 * The services stay actor-aware — that behavior is correct and load-bearing for
 * the protected and admin tiers. What must not vary is what a shared-cached
 * handler ASKS FOR, which is why every case here asserts on the actor handed to
 * the service rather than on the rows that come back.
 *
 * `getByDestination` and `getTopRatedByDestination` are the reference: they
 * already resolved against `createGuestActor()` and were never affected.
 *
 * @module test/routes/accommodation/public/actor-blind-cache
 */

import { EntitlementKey } from '@repo/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Identifiers ───────────────────────────────────────────────────────────────

const ACC_ID = 'aaaaaaaa-0000-4000-8000-000000000353';

/** A privileged reader: staff role plus the VIP visibility entitlement. */
const PRIVILEGED_ACTOR = {
    id: '11111111-0000-4000-8000-000000000353',
    role: 'SUPER_ADMIN',
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    entitlements: new Set(['vip_visibility_access'])
};

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockSearch = vi.fn();
const mockGetById = vi.fn();
const mockGetBySlug = vi.fn();
const mockGetStats = vi.fn();
const mockGetNearbyPois = vi.fn();
const mockRecord = vi.fn();
const mockResolveSingle = vi.fn();
const mockResolveBatch = vi.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                search: mockSearch,
                getById: mockGetById,
                getBySlug: mockGetBySlug,
                getStats: mockGetStats,
                getNearbyPois: mockGetNearbyPois
            };
        }),
        SearchHistoryService: vi.fn().mockImplementation(function () {
            return { record: mockRecord };
        }),
        ServiceError: class ServiceError extends Error {
            public readonly code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
    };
});

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    resolveOwnerEntitlementsForOwnerId: mockResolveSingle,
    resolveOwnerEntitlementsForOwnerIds: mockResolveBatch
}));

// The REAL `createGuestActor` is kept — it is the thing under test. Only the
// request-actor resolver is stubbed, to simulate a privileged caller.
vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => PRIVILEGED_ACTOR),
        isGuestActor: vi.fn(() => false)
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/routes/accommodation/public/quick-amenity-resolver', () => ({
    resolveQuickAmenityFlags: vi.fn().mockResolvedValue([])
}));

vi.mock('../../../../src/utils/route-factory', () => {
    const build = (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: unknown,
            params: Record<string, unknown>,
            body: unknown,
            query: Record<string, string>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(
                c,
                c.req.param(),
                undefined,
                c.req.query() as Record<string, string>
            );
            return c.json({ success: true, data: result });
        });
        return app;
    };
    return {
        createPublicListRoute: build,
        createPublicRoute: build,
        createCRUDRoute: build
    };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Asserts the actor handed to a service is anonymous.
 *
 * Checked positively (role GUEST) AND negatively (no entitlement set, no
 * view-all permission): asserting only "not the privileged actor" would pass for
 * any actor at all, including a differently-privileged one.
 */
function expectGuestActor(actor: unknown): void {
    const a = actor as { role?: string; permissions?: string[]; entitlements?: Set<string> };
    expect(a.role).toBe('GUEST');
    expect(a.entitlements).toBeUndefined();
    expect(a.permissions ?? []).not.toContain('ACCOMMODATION_VIEW_ALL');
}

async function buildApp(modulePath: string, exportName: string) {
    vi.resetModules();
    const mod = (await import(modulePath)) as Record<string, unknown>;
    const app = new Hono<AppBindings>();
    app.route('/', mod[exportName] as Parameters<typeof app.route>[1]);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HOS-353 — the six cached public accommodation handlers resolve as a guest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveSingle.mockResolvedValue([]);
        mockResolveBatch.mockResolvedValue(new Map());
        mockRecord.mockResolvedValue(undefined);
    });

    it('list: hands a guest actor to search, for a VIP/staff caller', async () => {
        mockSearch.mockResolvedValue({ data: { items: [], total: 0 }, error: null });

        const app = await buildApp(
            '../../../../src/routes/accommodation/public/list',
            'publicListAccommodationsRoute'
        );
        expect((await app.request('/')).status).toBe(200);

        expect(mockSearch).toHaveBeenCalledTimes(1);
        expectGuestActor((mockSearch.mock.calls[0] as [unknown])[0]);
    });

    it('getById: hands a guest actor to the service, for a VIP/staff caller', async () => {
        // `null` data short-circuits before the downstream enrichment, which is
        // irrelevant to what this pins.
        mockGetById.mockResolvedValue({ data: null, error: null });

        const app = await buildApp(
            '../../../../src/routes/accommodation/public/getById',
            'publicGetAccommodationByIdRoute'
        );
        expect((await app.request(`/${ACC_ID}`)).status).toBe(200);

        expect(mockGetById).toHaveBeenCalledTimes(1);
        expectGuestActor((mockGetById.mock.calls[0] as [unknown])[0]);
    });

    it('getBySlug: hands a guest actor to the service, for a VIP/staff caller', async () => {
        mockGetBySlug.mockResolvedValue({ data: null, error: null });

        const app = await buildApp(
            '../../../../src/routes/accommodation/public/getBySlug',
            'publicGetAccommodationBySlugRoute'
        );
        expect((await app.request('/slug/cabana-del-rio')).status).toBe(200);

        expect(mockGetBySlug).toHaveBeenCalledTimes(1);
        expectGuestActor((mockGetBySlug.mock.calls[0] as [unknown])[0]);
    });

    it('getSummary: hands a guest actor to the service, for a VIP/staff caller', async () => {
        // The heaviest disclosure of the six: this payload names `visibility`,
        // `lifecycleState`, `ownerId` and `slug`.
        mockGetById.mockResolvedValue({ data: null, error: null });

        const app = await buildApp(
            '../../../../src/routes/accommodation/public/getSummary',
            'getSummaryRoute'
        );
        expect((await app.request(`/${ACC_ID}/summary`)).status).toBe(200);

        expect(mockGetById).toHaveBeenCalledTimes(1);
        expectGuestActor((mockGetById.mock.calls[0] as [unknown])[0]);
    });

    it('getStats: hands a guest actor to BOTH service calls, for a VIP/staff caller', async () => {
        mockGetById.mockResolvedValue({
            data: { id: ACC_ID, name: 'Cabaña' },
            error: null
        });
        mockGetStats.mockResolvedValue({ data: { stats: {} }, error: null });

        const app = await buildApp(
            '../../../../src/routes/accommodation/public/getStats',
            'getStatsRoute'
        );
        expect((await app.request(`/${ACC_ID}/stats`)).status).toBe(200);

        // Both, not just the first: the lookup and the stats call each took the
        // actor, so fixing only one would leave the payload reader-dependent.
        expect(mockGetById).toHaveBeenCalledTimes(1);
        expectGuestActor((mockGetById.mock.calls[0] as [unknown])[0]);
        expect(mockGetStats).toHaveBeenCalledTimes(1);
        expectGuestActor((mockGetStats.mock.calls[0] as [unknown])[0]);
    });

    it('nearbyPois: hands a guest actor to the service, for a VIP/staff caller', async () => {
        mockGetNearbyPois.mockResolvedValue({ data: { items: [] }, error: null });

        const app = await buildApp(
            '../../../../src/routes/accommodation/public/nearbyPois',
            'publicGetAccommodationNearbyPoisRoute'
        );
        expect((await app.request('/cabana-del-rio/nearby-pois?radius=5&limit=10')).status).toBe(
            200
        );

        expect(mockGetNearbyPois).toHaveBeenCalledTimes(1);
        // Actor is the SECOND argument here, not the first.
        expectGuestActor((mockGetNearbyPois.mock.calls[0] as [unknown, unknown])[1]);
    });
});

describe('HOS-353 — the per-caller side effect keeps the REAL actor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveBatch.mockResolvedValue(new Map());
        mockRecord.mockResolvedValue(undefined);
    });

    it('list records search history against the request actor, not the guest one', async () => {
        // The one reason `getActorFromContext` survives in `list.ts`. Search history
        // is a per-caller WRITE, not part of the cached payload, so it must NOT be
        // swept up by the guest-actor substitution. Without this case a cleanup that
        // drops the now nearly-unused `getActorFromContext` would silently kill
        // SPEC-289 recording with a green suite.
        mockSearch.mockResolvedValue({ data: { items: [], total: 0 }, error: null });

        vi.resetModules();
        const { publicListAccommodationsRoute } = await import(
            '../../../../src/routes/accommodation/public/list'
        );
        const app = new Hono<AppBindings>();
        // The recording branch also requires the viewer entitlement, which the real
        // `hasEntitlement` reads off the context — so it has to be set here.
        app.use('*', async (c, next) => {
            c.set('userEntitlements', new Set([EntitlementKey.CAN_VIEW_SEARCH_HISTORY]));
            await next();
        });
        app.route('/', publicListAccommodationsRoute);

        expect((await app.request('/')).status).toBe(200);

        expectGuestActor((mockSearch.mock.calls[0] as [unknown])[0]);
        expect(mockRecord).toHaveBeenCalledTimes(1);
        const recordArg = mockRecord.mock.calls[0]?.[0] as { id?: string } | undefined;
        // Whatever shape `record` takes, the privileged caller's id must reach it.
        expect(JSON.stringify(mockRecord.mock.calls[0])).toContain(PRIVILEGED_ACTOR.id);
        expect(recordArg).toBeDefined();
    });
});

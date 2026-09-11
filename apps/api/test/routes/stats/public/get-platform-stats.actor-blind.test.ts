/**
 * HOS-352 (inventory follow-up) regression — `GET /api/v1/public/stats` must
 * ask `AccommodationService.count()` for the actor-blind visibility scope.
 *
 * `/api/v1/public/stats` is in `PUBLIC_CACHE_ENDPOINTS`
 * (`apps/api/src/middlewares/cache.constants.ts`), and that branch of
 * `generateCacheKey` builds `public:${path}${suffix}` — no actor component AT
 * ALL, unlike the private branch. Whichever caller happens to trigger the
 * cache-refreshing request (anonymous or VIP/staff) determines what every
 * OTHER caller reads for the full 1h TTL.
 *
 * `AccommodationService._executeCount` derives `excludeOwnerSuspended` /
 * `excludePlanRestricted` / `activeOnly` from the actor's VIP/staff
 * entitlements. If a privileged visitor's request is the one that repopulates
 * the cache, the resulting `accommodations` count — including DRAFT,
 * owner-suspended and plan-restricted rows — gets replayed to every visitor
 * for the TTL. The fix hands `AccommodationService.count()` a
 * `createGuestActor()` instead of the real request actor; the other five
 * `count()` calls in this handler are left untouched, since only
 * `AccommodationService` derives filters from the actor.
 *
 * @module test/routes/stats/public/get-platform-stats.actor-blind
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A VIP/staff caller — the branch `_executeCount` widens the count for. */
const PRIVILEGED_ACTOR = {
    id: '11111111-0000-4000-8000-000000000352',
    roles: ['USER', 'SUPER_ADMIN'],
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    entitlements: new Set(['vip_visibility_access'])
};

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockAccommodationCount = vi.fn();
const mockOtherCount = vi.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return { count: mockAccommodationCount };
        }),
        DestinationService: vi.fn().mockImplementation(function () {
            return { count: mockOtherCount };
        }),
        EventService: vi.fn().mockImplementation(function () {
            return { count: mockOtherCount };
        }),
        PostService: vi.fn().mockImplementation(function () {
            return { count: mockOtherCount };
        }),
        AccommodationReviewService: vi.fn().mockImplementation(function () {
            return { count: mockOtherCount };
        }),
        DestinationReviewService: vi.fn().mockImplementation(function () {
            return { count: mockOtherCount };
        }),
        StatsService: vi.fn().mockImplementation(function () {
            return {
                getGlobalAccommodationAverageRating: vi.fn().mockResolvedValue(4.2),
                getRecentReviewerAvatars: vi.fn().mockResolvedValue([])
            };
        })
    };
});

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => PRIVILEGED_ACTOR)
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (c: unknown) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(c);
            return c.json({ success: true, data: result });
        });
        return app;
    }
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function expectGuestActor(actor: unknown): void {
    const a = actor as {
        roles?: readonly string[];
        permissions?: string[];
        entitlements?: Set<string>;
    };
    expect(a.roles).toEqual(['GUEST']);
    expect(a.entitlements).toBeUndefined();
    expect(a.permissions ?? []).not.toContain('ACCOMMODATION_VIEW_ALL');
}

async function buildApp() {
    vi.resetModules();
    const { publicGetPlatformStatsRoute } = await import(
        '../../../../src/routes/stats/public/get-platform-stats'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetPlatformStatsRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publicGetPlatformStatsRoute — HOS-352 actor-blind regression', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAccommodationCount.mockResolvedValue({ data: { count: 3 }, error: null });
        mockOtherCount.mockResolvedValue({ data: { count: 1 }, error: null });
    });

    it('hands a guest actor to AccommodationService.count(), for a VIP/staff caller', async () => {
        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        expect(mockAccommodationCount).toHaveBeenCalledTimes(1);
        expectGuestActor((mockAccommodationCount.mock.calls[0] as [unknown])[0]);
    });

    it('leaves the other five count() calls on the real request actor', async () => {
        const app = await buildApp();
        await app.request('/');

        // Five sibling services (destination, event, post, accommodationReview,
        // destinationReview) share the same mock — all five calls carry the
        // real (privileged) actor, since only AccommodationService derives
        // visibility filters from it.
        expect(mockOtherCount).toHaveBeenCalledTimes(5);
        for (const call of mockOtherCount.mock.calls) {
            expect((call as [unknown])[0]).toBe(PRIVILEGED_ACTOR);
        }
    });
});

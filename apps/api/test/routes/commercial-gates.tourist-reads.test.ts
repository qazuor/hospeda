import { PermissionEnum, RoleEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../src/middlewares/response';
import { compareAccommodationsRoute } from '../../src/routes/accommodation/protected/compare';
import { protectedCreateAccommodationReviewRoute } from '../../src/routes/accommodation/reviews/protected/create';
import { protectedCreateDestinationReviewRoute } from '../../src/routes/destination/reviews/protected/create';
import { getRecommendationsRoute } from '../../src/routes/recommendations/protected/get';
import { listSearchHistoryRoute } from '../../src/routes/search-history/protected/list';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';

const IDS = {
    vip: '11111111-1111-4111-8111-111111111111',
    floor: '22222222-2222-4222-8222-222222222222',
    empty: '33333333-3333-4333-8333-333333333333',
    listing: '44444444-4444-4444-8444-444444444444',
    destination: '55555555-5555-4555-8555-555555555555'
} as const;
const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    compare: vi.fn(),
    accommodationReview: vi.fn(),
    destinationReview: vi.fn(),
    recommendations: vi.fn(),
    history: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: class {
            compareByIds = mocks.compare;
        },
        AccommodationReviewService: class {
            create = mocks.accommodationReview;
        },
        DestinationReviewService: class {
            create = mocks.destinationReview;
        },
        RecommendationService: class {
            getFeed = mocks.recommendations;
        },
        SearchHistoryService: class {
            list = mocks.history;
        }
    };
});
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));
const headers = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    accept: 'application/json'
};
const entries: Record<string, [string, number][]> = {
    [IDS.vip]: [
        ['can_compare_accommodations', 1],
        ['max_compare_items', 5],
        ['write_reviews', 1],
        ['can_view_recommendations', 1],
        ['can_view_search_history', 1],
        ['max_search_history_entries', 200]
    ],
    [IDS.floor]: [['write_reviews', 1]],
    [IDS.empty]: [],
    [`${IDS.empty}-history`]: [['can_view_search_history', 1]],
    [`${IDS.vip}-50`]: [
        ['can_view_search_history', 1],
        ['max_search_history_entries', 50]
    ]
};
function makeApp(
    route: Hono<AppBindings>,
    userId: string | null,
    prefix = '/case'
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((ctx, next) => {
        ctx.set(
            'actor',
            userId
                ? {
                      id: userId,
                      roles: [RoleEnum.USER],
                      permissions: Object.values(PermissionEnum),
                      emailVerified: true
                  }
                : createGuestActor()
        );
        return next();
    });
    app.route(prefix, route);
    return app;
}
function effective(userId: string, vertical: VerticalEnum) {
    return rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: (vertical === VerticalEnum.TOURIST ? (entries[userId] ?? []) : []).map(
            ([key, value]) => ({
                key,
                value,
                strategy: 'MAX' as const
            })
        )
    });
}
async function request(
    route: Hono<AppBindings>,
    userId: string | null,
    path: string,
    method = 'GET',
    body?: unknown
) {
    return makeApp(route, userId).request(path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
}
function assertTouristRead(userId: string) {
    expect(mocks.effectiveSet).toHaveBeenCalledWith({ userId, vertical: VerticalEnum.TOURIST });
}
beforeEach(() => {
    vi.clearAllMocks();
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            effective(userId, vertical)
    );
    mocks.compare.mockResolvedValue({ data: { items: [] } });
    mocks.accommodationReview.mockResolvedValue({
        error: { code: ServiceErrorCode.ALREADY_EXISTS, message: 'Review already exists' }
    });
    mocks.destinationReview.mockResolvedValue({
        error: { code: ServiceErrorCode.ALREADY_EXISTS, message: 'Review already exists' }
    });
    mocks.recommendations.mockResolvedValue({
        data: { items: [], isColdStart: true, generatedAt: new Date() }
    });
    mocks.history.mockResolvedValue({ data: { items: [], total: 0 } });
});

describe('TEST:V5:33 tourist read and write gates', () => {
    it('gates compare before service, accepts exactly five and validates shape before reading grants', async () => {
        let response = await request(
            compareAccommodationsRoute,
            IDS.floor,
            '/case/compare',
            'POST',
            { ids: [IDS.listing, IDS.destination] }
        );
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: 'can_compare_accommodations' }
            }
        });
        expect(mocks.compare).not.toHaveBeenCalled();
        response = await request(compareAccommodationsRoute, IDS.vip, '/case/compare', 'POST', {
            ids: Array(6).fill(IDS.listing)
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.LIMIT_REACHED,
                details: { limitKey: 'max_compare_items', maxAllowed: 5 }
            }
        });
        expect(mocks.compare).not.toHaveBeenCalled();
        response = await request(compareAccommodationsRoute, IDS.vip, '/case/compare', 'POST', {
            ids: Array(5).fill(IDS.listing)
        });
        expect(response.status).toBe(200);
        expect(mocks.compare).toHaveBeenCalledTimes(1);
        assertTouristRead(IDS.vip);
        mocks.effectiveSet.mockClear();
        response = await request(compareAccommodationsRoute, IDS.vip, '/case/compare', 'POST', {
            ids: [IDS.listing]
        });
        expect(response.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it('gates recommendation and search-history reads and passes the effective history limit', async () => {
        let response = await request(getRecommendationsRoute, IDS.floor, '/case');
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: 'can_view_recommendations' }
            }
        });
        expect(mocks.recommendations).not.toHaveBeenCalled();
        response = await request(getRecommendationsRoute, IDS.vip, '/case');
        expect(response.status).toBe(200);
        expect(mocks.recommendations).toHaveBeenCalledTimes(1);
        assertTouristRead(IDS.vip);
        response = await request(listSearchHistoryRoute, IDS.floor, '/case');
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: 'can_view_search_history' }
            }
        });
        expect(mocks.history).not.toHaveBeenCalled();
        response = await request(listSearchHistoryRoute, IDS.vip, '/case');
        expect(response.status).toBe(200);
        expect(mocks.history).toHaveBeenLastCalledWith(expect.anything(), { planLimit: 200 });
        assertTouristRead(IDS.vip);
        response = await request(listSearchHistoryRoute, `${IDS.vip}-50`, '/case');
        expect(response.status).toBe(200);
        expect(mocks.history).toHaveBeenLastCalledWith(expect.anything(), { planLimit: 50 });
        response = await request(listSearchHistoryRoute, `${IDS.empty}-history`, '/case');
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.LIMIT_REACHED,
                details: { limitKey: 'max_search_history_entries', maxAllowed: 0 }
            }
        });
        expect(mocks.history).toHaveBeenCalledTimes(2);
    });

    it('requires write_reviews on the tourist vertical for both review routes', async () => {
        for (const [route, path, service] of [
            [
                protectedCreateAccommodationReviewRoute,
                `/case/${IDS.listing}/reviews`,
                mocks.accommodationReview
            ],
            [
                protectedCreateDestinationReviewRoute,
                `/case/${IDS.destination}/reviews`,
                mocks.destinationReview
            ]
        ] as const) {
            const body =
                route === protectedCreateAccommodationReviewRoute
                    ? {
                          rating: {
                              cleanliness: 5,
                              hospitality: 5,
                              services: 5,
                              accuracy: 5,
                              communication: 5,
                              location: 5
                          }
                      }
                    : {
                          rating: {
                              landscape: 5,
                              attractions: 5,
                              accessibility: 5,
                              safety: 5,
                              cleanliness: 5,
                              hospitality: 5,
                              culturalOffer: 5,
                              gastronomy: 5,
                              affordability: 5,
                              nightlife: 5,
                              infrastructure: 5,
                              environmentalCare: 5,
                              wifiAvailability: 5,
                              shopping: 5,
                              beaches: 5,
                              greenSpaces: 5,
                              localEvents: 5,
                              weatherSatisfaction: 5
                          }
                      };
            const response = await request(route, IDS.empty, path, 'POST', body);
            expect(response.status, JSON.stringify(await response.clone().json())).toBe(403);
            expect(await response.json()).toMatchObject({
                error: {
                    code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    details: { entitlementKey: 'write_reviews' }
                }
            });
            expect(service).not.toHaveBeenCalled();
            const allowed = await request(route, IDS.floor, path, 'POST', body);
            expect(allowed.status).toBe(409);
            assertTouristRead(IDS.floor);
            expect(service).toHaveBeenCalledTimes(1);
            service.mockClear();
            const vipResponse = await request(route, IDS.vip, path, 'POST', body);
            expect(vipResponse.status).toBe(409);
            assertTouristRead(IDS.vip);
            expect(service).toHaveBeenCalledTimes(1);
        }
    });

    it('rejects guests before effective-set lookup', async () => {
        const response = await request(getRecommendationsRoute, null, '/case');
        expect(response.status).toBe(401);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        expect(mocks.recommendations).not.toHaveBeenCalled();
    });
});

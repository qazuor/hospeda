/**
 * HOS-21 T-008: GET /api/v1/protected/owner-promotions/exclusive-deals
 *
 * This route is UNGATED at this point in the implementation — the entitlement
 * gate (`gateExclusiveDeals` + VIP_PROMOTIONS_ACCESS tier resolution) is wired
 * in T-009. T-008 only proves the route exists, is reachable by any
 * authenticated actor, forwards pagination/accommodationId, and reuses
 * `OwnerPromotionService.findExclusiveDeals` (T-005/T-006) rather than the
 * public `search()` path.
 *
 * Mounted at a distinct sub-path (`/exclusive-deals`), NOT at `/`, so it does
 * not fall into the sibling-route middleware-union gotcha that affects
 * `/` and `/:id` (see `tourist-audience.test.ts`).
 */

import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findExclusiveDealsCaptures: Array<{
    actor: unknown;
    params: unknown;
    audienceScope: unknown;
}> = [];

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            // biome-ignore lint/complexity/noUselessConstructor: need to call super
            constructor(...args: ConstructorParameters<typeof orig.OwnerPromotionService>) {
                super(...args);
            }

            override async findExclusiveDeals(
                actor: Parameters<
                    typeof orig.OwnerPromotionService.prototype.findExclusiveDeals
                >[0],
                params: Parameters<
                    typeof orig.OwnerPromotionService.prototype.findExclusiveDeals
                >[1],
                audienceScope: Parameters<
                    typeof orig.OwnerPromotionService.prototype.findExclusiveDeals
                >[2]
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.findExclusiveDeals> {
                findExclusiveDealsCaptures.push({ actor, params, audienceScope });
                return {
                    data: {
                        items: [
                            {
                                id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                                slug: 'summer-deal',
                                ownerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                                accommodationId: null,
                                title: 'Summer Deal',
                                discountType: 'percentage',
                                discountValue: 15,
                                lifecycleState: 'ACTIVE',
                                validFrom: new Date('2025-01-01').toISOString(),
                                validUntil: null,
                                currentRedemptions: 0,
                                maxRedemptions: null,
                                touristAudience: 'plus',
                                createdAt: new Date('2025-01-01').toISOString(),
                                updatedAt: new Date('2025-01-01').toISOString()
                            }
                        ],
                        total: 1
                    },
                    error: undefined
                } as unknown as ReturnType<
                    typeof orig.OwnerPromotionService.prototype.findExclusiveDeals
                >;
            }
        }
    };
});

const { initApp } = await import('../../../../src/app.js');
type AppOpenAPI = Awaited<ReturnType<typeof initApp>>;

const BASE = '/api/v1/protected/owner-promotions/exclusive-deals';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeHeaders(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

describe('GET /api/v1/protected/owner-promotions/exclusive-deals (HOS-21 T-008)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        findExclusiveDealsCaptures.length = 0;
    });

    it('is registered and reachable (not 404)', async () => {
        const res = await app.request(BASE, { headers: makeHeaders() });
        expect(res.status).not.toBe(404);
    });

    it('returns 401 for an unauthenticated request', async () => {
        const res = await app.request(BASE, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(401);
    });

    it('returns 200 with items + pagination for an authenticated actor', async () => {
        const res = await app.request(BASE, { headers: makeHeaders() });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0]).toHaveProperty('touristAudience', 'plus');
        expect(body.data).toHaveProperty('pagination');
    });

    it('calls findExclusiveDeals (not the public search path)', async () => {
        await app.request(BASE, { headers: makeHeaders() });

        expect(findExclusiveDealsCaptures).toHaveLength(1);
    });

    it('forwards accommodationId from the query string', async () => {
        const accommodationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
        await app.request(`${BASE}?accommodationId=${accommodationId}`, {
            headers: makeHeaders()
        });

        expect(findExclusiveDealsCaptures).toHaveLength(1);
        const captured = findExclusiveDealsCaptures[0]?.params as Record<string, unknown>;
        expect(captured.accommodationId).toBe(accommodationId);
    });

    it('forwards page/pageSize from the query string', async () => {
        await app.request(`${BASE}?page=2&pageSize=5`, { headers: makeHeaders() });

        expect(findExclusiveDealsCaptures).toHaveLength(1);
        const captured = findExclusiveDealsCaptures[0]?.params as Record<string, unknown>;
        expect(captured.page).toBe(2);
        expect(captured.pageSize).toBe(5);
    });
});

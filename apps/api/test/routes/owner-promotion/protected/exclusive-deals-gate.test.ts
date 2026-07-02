/**
 * HOS-21 T-009: gateExclusiveDeals + VIP_PROMOTIONS_ACCESS tier resolution on
 * GET /api/v1/protected/owner-promotions/exclusive-deals.
 *
 * `hasEntitlement` is mocked directly (rather than seeding real billing/DB
 * state) so each test controls exactly which entitlements the actor carries,
 * following the module-mock convention used across this test suite
 * (`tourist-audience.test.ts`, `promo-code-t008.test.ts`).
 */

import { EntitlementKey } from '@repo/billing';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockEntitlements: Set<EntitlementKey>;

vi.mock('../../../../src/middlewares/entitlement', async (importOriginal) => {
    const orig = await importOriginal<typeof import('../../../../src/middlewares/entitlement')>();
    return {
        ...orig,
        hasEntitlement: (_c: unknown, key: EntitlementKey) => mockEntitlements.has(key)
    };
});

const findExclusiveDealsCaptures: Array<{ audienceScope: unknown }> = [];

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
                _actor: Parameters<
                    typeof orig.OwnerPromotionService.prototype.findExclusiveDeals
                >[0],
                _params: Parameters<
                    typeof orig.OwnerPromotionService.prototype.findExclusiveDeals
                >[1],
                audienceScope: Parameters<
                    typeof orig.OwnerPromotionService.prototype.findExclusiveDeals
                >[2]
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.findExclusiveDeals> {
                findExclusiveDealsCaptures.push({ audienceScope });
                return {
                    data: { items: [], total: 0 },
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

describe('gateExclusiveDeals + VIP_PROMOTIONS_ACCESS tier resolution (HOS-21 T-009)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        findExclusiveDealsCaptures.length = 0;
        mockEntitlements = new Set();
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the actor lacks EXCLUSIVE_DEALS', async () => {
        mockEntitlements = new Set();

        const res = await app.request(BASE, { headers: makeHeaders() });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(findExclusiveDealsCaptures).toHaveLength(0);
    });

    it('scopes to plus-only when the actor has EXCLUSIVE_DEALS but not VIP_PROMOTIONS_ACCESS', async () => {
        mockEntitlements = new Set([EntitlementKey.EXCLUSIVE_DEALS]);

        const res = await app.request(BASE, { headers: makeHeaders() });

        expect(res.status).toBe(200);
        expect(findExclusiveDealsCaptures).toHaveLength(1);
        expect(findExclusiveDealsCaptures[0]?.audienceScope).toEqual(['plus']);
    });

    it('scopes to plus+vip when the actor has both EXCLUSIVE_DEALS and VIP_PROMOTIONS_ACCESS', async () => {
        mockEntitlements = new Set([
            EntitlementKey.EXCLUSIVE_DEALS,
            EntitlementKey.VIP_PROMOTIONS_ACCESS
        ]);

        const res = await app.request(BASE, { headers: makeHeaders() });

        expect(res.status).toBe(200);
        expect(findExclusiveDealsCaptures).toHaveLength(1);
        expect(findExclusiveDealsCaptures[0]?.audienceScope).toEqual(['plus', 'vip']);
    });
});

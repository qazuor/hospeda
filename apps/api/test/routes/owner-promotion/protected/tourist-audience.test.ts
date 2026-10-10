/**
 * HOS-21 T-007: owner self-service `touristAudience` on create/update.
 *
 * `touristAudience` was added to the shared base schema in T-002
 * (`OwnerPromotionSchema`), which `OwnerPromotionCreateRequestSchema` and
 * `OwnerPromotionUpdateInputSchema` both derive from via `.omit()`/`.partial()`
 * — neither route strips it. These tests confirm the field reaches the
 * service call end-to-end for POST (create), PUT (update), and PATCH.
 *
 * The effective set and the pre-update ownership read are fixture-mocked so
 * the test reaches the real route behavior without a database.
 */

import { PermissionEnum, RoleEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROMOTION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const keys = ['create_promotions'];

const createCaptures: Array<{ actor: unknown; data: unknown }> = [];
const updateCaptures: Array<{ actor: unknown; id: unknown; data: unknown }> = [];

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            // biome-ignore lint/complexity/noUselessConstructor: need to call super
            constructor(...args: ConstructorParameters<typeof orig.OwnerPromotionService>) {
                super(...args);
            }

            override async create(
                actor: Parameters<typeof orig.OwnerPromotionService.prototype.create>[0],
                data: Parameters<typeof orig.OwnerPromotionService.prototype.create>[1]
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.create> {
                createCaptures.push({ actor, data });
                return {
                    data: {
                        id: PROMOTION_ID,
                        slug: 'vip-promo',
                        ownerId: ACTOR_ID,
                        accommodationId: null,
                        title: 'VIP Promotion',
                        description: null,
                        discountType: 'percentage',
                        discountValue: 10,
                        minNights: null,
                        validFrom: new Date('2025-01-01').toISOString(),
                        validUntil: null,
                        maxRedemptions: null,
                        currentRedemptions: 0,
                        lifecycleState: 'DRAFT',
                        touristAudience: 'plus',
                        createdAt: new Date('2025-01-01').toISOString(),
                        updatedAt: new Date('2025-01-01').toISOString(),
                        ...(data as object)
                    },
                    error: undefined
                } as unknown as ReturnType<typeof orig.OwnerPromotionService.prototype.create>;
            }

            override async count(
                ..._args: Parameters<typeof orig.OwnerPromotionService.prototype.count>
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.count> {
                return { data: { count: 0 }, error: undefined } as Awaited<
                    ReturnType<typeof orig.OwnerPromotionService.prototype.count>
                >;
            }

            override async getById(
                _actor: Parameters<typeof orig.OwnerPromotionService.prototype.getById>[0],
                id: Parameters<typeof orig.OwnerPromotionService.prototype.getById>[1]
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.getById> {
                return {
                    data: {
                        id,
                        slug: 'vip-promo',
                        ownerId: ACTOR_ID,
                        accommodationId: null,
                        title: 'VIP Promotion',
                        description: null,
                        discountType: 'percentage',
                        discountValue: 10,
                        validFrom: new Date('2025-01-01'),
                        validUntil: null,
                        maxRedemptions: null,
                        currentRedemptions: 0,
                        lifecycleState: 'DRAFT',
                        touristAudience: 'plus',
                        createdAt: new Date('2025-01-01'),
                        updatedAt: new Date('2025-01-01')
                    },
                    error: undefined
                } as unknown as Awaited<
                    ReturnType<typeof orig.OwnerPromotionService.prototype.getById>
                >;
            }

            override async update(
                actor: Parameters<typeof orig.OwnerPromotionService.prototype.update>[0],
                id: Parameters<typeof orig.OwnerPromotionService.prototype.update>[1],
                data: Parameters<typeof orig.OwnerPromotionService.prototype.update>[2]
            ): ReturnType<typeof orig.OwnerPromotionService.prototype.update> {
                updateCaptures.push({ actor, id, data });
                return {
                    data: {
                        id: PROMOTION_ID,
                        slug: 'vip-promo',
                        ownerId: ACTOR_ID,
                        accommodationId: null,
                        title: 'VIP Promotion',
                        description: null,
                        discountType: 'percentage',
                        discountValue: 10,
                        minNights: null,
                        validFrom: new Date('2025-01-01').toISOString(),
                        validUntil: null,
                        maxRedemptions: null,
                        currentRedemptions: 0,
                        lifecycleState: 'DRAFT',
                        touristAudience: 'plus',
                        createdAt: new Date('2025-01-01').toISOString(),
                        updatedAt: new Date('2025-01-01').toISOString(),
                        ...(data as object)
                    },
                    error: undefined
                } as unknown as ReturnType<typeof orig.OwnerPromotionService.prototype.update>;
            }
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                entries: [
                    ...keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const })),
                    { key: 'max_active_promotions', value: 2147483647, strategy: 'MAX' as const }
                ]
            })
    })
}));

// Imports after all vi.mock() calls.
const { initApp } = await import('../../../../src/app.js');
type AppOpenAPI = Awaited<ReturnType<typeof initApp>>;

const BASE = '/api/v1/protected/owner-promotions';

/**
 * Sibling owner-promotion routes are all mounted at the same base path
 * (see `protected/index.ts`); Hono's OpenAPIHono unions their middleware on
 * resolution regardless of HTTP method (documented gotcha — see
 * `docs/...` and engram `feedback_hono_router_collision`). Tests must grant
 * the union of every sibling route's `requiredPermissions`, not just the one
 * for the method under test.
 */
function makeHeaders(): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([
            PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
            PermissionEnum.OWNER_PROMOTION_CREATE,
            PermissionEnum.OWNER_PROMOTION_UPDATE_OWN
        ])
    };
}

describe('touristAudience on owner-promotion create/update (HOS-21 T-007)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        createCaptures.length = 0;
        updateCaptures.length = 0;
    });

    it('POST accepts touristAudience="vip" and forwards it to the service', async () => {
        const res = await app.request(BASE, {
            method: 'POST',
            headers: makeHeaders(),
            body: JSON.stringify({
                title: 'VIP Promotion',
                discountType: 'percentage',
                discountValue: 10,
                validFrom: '2025-01-01T00:00:00.000Z',
                touristAudience: 'vip'
            })
        });

        expect(res.status).toBe(201);
        expect(createCaptures).toHaveLength(1);
        expect((createCaptures[0]?.data as Record<string, unknown>)?.touristAudience).toBe('vip');
    });

    it('PUT accepts touristAudience="vip" and forwards it to the service', async () => {
        const res = await app.request(`${BASE}/${PROMOTION_ID}`, {
            method: 'PUT',
            headers: makeHeaders(),
            body: JSON.stringify({
                title: 'VIP Promotion',
                discountType: 'percentage',
                discountValue: 10,
                validFrom: '2025-01-01T00:00:00.000Z',
                touristAudience: 'vip'
            })
        });

        expect(res.status).toBe(200);
        expect(updateCaptures).toHaveLength(1);
        expect((updateCaptures[0]?.data as Record<string, unknown>)?.touristAudience).toBe('vip');
    });

    it('PATCH accepts touristAudience="vip" and forwards it to the service', async () => {
        const res = await app.request(`${BASE}/${PROMOTION_ID}`, {
            method: 'PATCH',
            headers: makeHeaders(),
            body: JSON.stringify({ touristAudience: 'vip' })
        });

        expect(res.status).toBe(200);
        expect(updateCaptures).toHaveLength(1);
        expect((updateCaptures[0]?.data as Record<string, unknown>)?.touristAudience).toBe('vip');
    });

    it('does not let a client forge ownerId through the update body', async () => {
        const res = await app.request(`${BASE}/${PROMOTION_ID}`, {
            method: 'PUT',
            headers: makeHeaders(),
            body: JSON.stringify({
                title: 'VIP Promotion',
                discountType: 'percentage',
                discountValue: 10,
                validFrom: '2025-01-01T00:00:00.000Z',
                touristAudience: 'vip',
                ownerId: 'ffffffff-ffff-ffff-ffff-ffffffffffff'
            })
        });

        expect(res.status).toBe(200);
        expect((updateCaptures[0]?.data as Record<string, unknown>)?.ownerId).toBeUndefined();
    });
});

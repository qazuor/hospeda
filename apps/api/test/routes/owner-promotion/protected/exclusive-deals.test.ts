import {
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    RoleEnum,
    ServiceErrorCode,
    TouristAudienceEnum,
    type VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    findExclusiveDeals: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            override findExclusiveDeals = mocks.findExclusiveDeals;
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

const { initApp } = await import('../../../../src/app.js');
type AppOpenAPI = Awaited<ReturnType<typeof initApp>>;

const BASE = '/api/v1/protected/owner-promotions/exclusive-deals';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let hasVipPromotionsAccess = false;

function grantEffectiveSet(): void {
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: [
                    { key: 'exclusive_deals', value: 1, strategy: 'MAX' as const },
                    ...(hasVipPromotionsAccess
                        ? [{ key: 'vip_promotions_access', value: 1, strategy: 'MAX' as const }]
                        : [])
                ]
            })
    );
}

function makeHeaders(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

const DEAL_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEAL_WIDE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** A complete exclusive-deal row (the response schema is enforced). */
function dealRow(overrides: { readonly id: string; readonly accommodationSlug: string | null }) {
    const now = new Date('2026-11-01T00:00:00.000Z');
    return {
        slug: `deal-${overrides.id.slice(0, 4)}`,
        ownerId: ACTOR_ID,
        accommodationId: null,
        title: 'Noche gratis',
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 10,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        validFrom: now,
        validUntil: null,
        currentRedemptions: 0,
        maxRedemptions: null,
        touristAudience: TouristAudienceEnum.PLUS,
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

describe('TEST:V5:32 GET /api/v1/protected/owner-promotions/exclusive-deals', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        mocks.effectiveSet.mockClear();
        hasVipPromotionsAccess = false;
        grantEffectiveSet();
        mocks.findExclusiveDeals.mockReset().mockResolvedValue({
            data: { items: [], total: 4 },
            error: undefined
        });
    });

    it('returns 401 for an unauthenticated request', async () => {
        const res = await app.request(BASE, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(401);
    });

    it('rejects a missing exclusive_deals key before querying promotions', async () => {
        mocks.effectiveSet.mockImplementation(
            async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: true,
                    inheritsTouristVip: false,
                    entries: []
                })
        );

        const res = await app.request(BASE, { headers: makeHeaders() });
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({
            error: {
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: 'exclusive_deals' }
            }
        });
        expect(mocks.findExclusiveDeals).not.toHaveBeenCalled();
    });

    it('lists PLUS deals when the effective set lacks vip_promotions_access', async () => {
        const res = await app.request(`${BASE}?page=2&pageSize=5`, { headers: makeHeaders() });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([]);
        expect(body.data.pagination).toMatchObject({ page: 2, pageSize: 5, total: 4 });
        expect(mocks.findExclusiveDeals).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            { page: 2, pageSize: 5, accommodationId: undefined },
            ['plus']
        );
    });

    it('lists PLUS and VIP deals when the effective set grants vip_promotions_access', async () => {
        hasVipPromotionsAccess = true;
        grantEffectiveSet();

        const res = await app.request(BASE, { headers: makeHeaders() });

        expect(res.status).toBe(200);
        expect(mocks.findExclusiveDeals).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            { page: 1, pageSize: 20, accommodationId: undefined },
            ['plus', 'vip']
        );
    });

    it('rejects an invalid accommodationId before reading effective keys', async () => {
        const res = await app.request(`${BASE}?accommodationId=invalid`, {
            headers: makeHeaders()
        });
        expect(res.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it("carries each deal's accommodation slug (owner decision 17)", async () => {
        // Arrange
        mocks.findExclusiveDeals.mockResolvedValueOnce({
            data: {
                items: [
                    dealRow({ id: DEAL_A, accommodationSlug: 'casa-a' }),
                    dealRow({ id: DEAL_WIDE, accommodationSlug: null })
                ],
                total: 2
            },
            error: undefined
        });

        // Act
        const res = await app.request(BASE, { headers: makeHeaders() });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(
            body.data.items.map(
                (item: { accommodationSlug: string | null }) => item.accommodationSlug
            )
        ).toEqual(['casa-a', null]);
    });
});

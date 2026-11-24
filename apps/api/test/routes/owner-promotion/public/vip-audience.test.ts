/**
 * HOS-2590 regression: VIP-only owner promotions are not served to non-VIP readers.
 *
 * The public list and get-by-id of owner promotions used to hand every reader
 * the promotions whose `touristAudience` is `vip`, discount and conditions
 * included. The route now resolves the reader's audience scope from the tourist
 * effective set (`vip_promotions_access`; a role never decides) and:
 * - passes it to `OwnerPromotionService.search()` through the service context;
 * - answers a VIP-only promotion by id as `null` (like a DRAFT one) to a non-VIP.
 *
 * The response must also never be publicly cacheable, since it now varies per actor.
 */
import {
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    RoleEnum,
    TouristAudienceEnum,
    type VerticalEnum
} from '@repo/schemas';
import { resolveOwnerPromotionAudienceScope, type ServiceContext } from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_CACHE_ENDPOINTS } from '../../../../src/middlewares/cache.constants';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    search: vi.fn(),
    getById: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            override search = mocks.search;
            override getById = mocks.getById;
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

const { initApp } = await import('../../../../src/app.js');
type AppOpenAPI = Awaited<ReturnType<typeof initApp>>;

const BASE = '/api/v1/public/owner-promotions';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOMMODATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROMOTION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Makes the effective set grant (or not) `vip_promotions_access`. */
function setVipAccess(granted: boolean): void {
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: granted
                    ? [{ key: 'vip_promotions_access', value: 1, strategy: 'MAX' as const }]
                    : []
            })
    );
}

const guestHeaders = { 'user-agent': 'vitest', accept: 'application/json' };

/** Headers of a signed-in tourist with no permissions (a role never decides). */
const userHeaders = {
    ...guestHeaders,
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': RoleEnum.USER,
    'x-mock-actor-permissions': JSON.stringify([])
};

/** A complete ACTIVE accommodation promotion row with the given audience. */
function promotionRow(audience: TouristAudienceEnum) {
    const now = new Date('2026-11-01T00:00:00.000Z');
    return {
        id: PROMOTION_ID,
        slug: 'vip-night',
        ownerId: ACTOR_ID,
        accommodationId: ACCOMMODATION_ID,
        entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION,
        entityId: ACCOMMODATION_ID,
        title: 'Noche VIP',
        description: 'Solo para VIP',
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 30,
        minNights: 2,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        validFrom: now,
        validUntil: null,
        currentRedemptions: 0,
        maxRedemptions: null,
        touristAudience: audience,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    };
}

/** The audience scope the route handed to `search()` on its first call. */
function searchedScope(): readonly TouristAudienceEnum[] {
    const [, , ctx] = mocks.search.mock.calls[0] as [unknown, unknown, ServiceContext | undefined];
    return resolveOwnerPromotionAudienceScope({ ctx });
}

describe('HOS-2590 public owner promotions hide VIP-only promotions from non-VIP readers', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        mocks.effectiveSet.mockReset();
        setVipAccess(false);
        mocks.search.mockReset().mockResolvedValue({ data: { items: [], total: 0 } });
        mocks.getById.mockReset();
    });

    describe('GET / (list)', () => {
        it('scopes an anonymous reader to PLUS without reading an effective set', async () => {
            // Act
            const res = await app.request(`${BASE}?accommodationId=${ACCOMMODATION_ID}`, {
                headers: guestHeaders
            });

            // Assert
            expect(res.status).toBe(200);
            expect(searchedScope()).toEqual([TouristAudienceEnum.PLUS]);
            expect(mocks.effectiveSet).not.toHaveBeenCalled();
        });

        it('scopes a signed-in tourist without vip_promotions_access to PLUS', async () => {
            // Act
            const res = await app.request(`${BASE}?accommodationId=${ACCOMMODATION_ID}`, {
                headers: userHeaders
            });

            // Assert
            expect(res.status).toBe(200);
            expect(searchedScope()).toEqual([TouristAudienceEnum.PLUS]);
        });

        it('lets a VIP tourist read PLUS and VIP promotions', async () => {
            // Arrange
            setVipAccess(true);

            // Act
            const res = await app.request(`${BASE}?accommodationId=${ACCOMMODATION_ID}`, {
                headers: userHeaders
            });

            // Assert
            expect(res.status).toBe(200);
            expect(searchedScope()).toEqual([TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP]);
        });

        it('is never publicly cacheable, since the answer varies per actor', async () => {
            // Act
            const res = await app.request(`${BASE}?accommodationId=${ACCOMMODATION_ID}`, {
                headers: guestHeaders
            });

            // Assert
            expect(res.headers.get('cache-control') ?? '').not.toMatch(/public|s-maxage/i);
            expect(PUBLIC_CACHE_ENDPOINTS.some((path) => BASE.startsWith(path))).toBe(false);
        });
    });

    describe('GET /{id}', () => {
        it('answers a VIP-only promotion as null to an anonymous reader', async () => {
            // Arrange
            mocks.getById.mockResolvedValue({ data: promotionRow(TouristAudienceEnum.VIP) });

            // Act
            const res = await app.request(`${BASE}/${PROMOTION_ID}`, { headers: guestHeaders });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toBeNull();
            expect(JSON.stringify(body)).not.toContain('Noche VIP');
        });

        it('answers a VIP-only promotion as null to a tourist without VIP access', async () => {
            // Arrange
            mocks.getById.mockResolvedValue({ data: promotionRow(TouristAudienceEnum.VIP) });

            // Act
            const res = await app.request(`${BASE}/${PROMOTION_ID}`, { headers: userHeaders });

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data).toBeNull();
        });

        it('serves a VIP-only promotion to a VIP tourist', async () => {
            // Arrange
            setVipAccess(true);
            mocks.getById.mockResolvedValue({ data: promotionRow(TouristAudienceEnum.VIP) });

            // Act
            const res = await app.request(`${BASE}/${PROMOTION_ID}`, { headers: userHeaders });

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data).toMatchObject({
                id: PROMOTION_ID,
                discountValue: 30
            });
        });

        it('keeps serving a PLUS promotion to an anonymous reader', async () => {
            // Arrange
            mocks.getById.mockResolvedValue({ data: promotionRow(TouristAudienceEnum.PLUS) });

            // Act
            const res = await app.request(`${BASE}/${PROMOTION_ID}`, { headers: guestHeaders });

            // Assert
            expect(res.status).toBe(200);
            expect((await res.json()).data).toMatchObject({ id: PROMOTION_ID });
        });
    });
});

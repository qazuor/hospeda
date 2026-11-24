/**
 * Regression tests for HOS-2592: the price-alert promo-offer digest must
 * respect each owner promotion's tourist audience.
 *
 * A `vip` promotion is for VIP tourists only. The evaluator used to emit it to
 * every subscriber of the accommodation, so a free tourist received the
 * details of a VIP-only promotion by email. The audience scope is resolved per
 * recipient through the injected `resolveAudienceScope` port (the API wires it
 * to the tourist effective set, `vip_promotions_access`); without the port the
 * evaluator fails closed to `plus` only.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import type { AccommodationModel, OwnerPromotionModel, TouristPriceAlertModel } from '@repo/db';
import type { Accommodation, OwnerPromotion, PriceAlert } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    TouristAudienceEnum
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    PromoOfferEvaluatorService,
    type ResolvePromoOfferAudienceScope
} from '../../../src/services/alert/promo-offer-evaluator.service';
import { getMockId } from '../../factories/utilsFactory';

const OWNER_ID = getMockId('user', 'vip-audience-owner');
const FREE_USER_ID = getMockId('user', 'vip-audience-free');
const VIP_USER_ID = getMockId('user', 'vip-audience-vip');
const ACCOMMODATION_ID = getMockId('accommodation', 'vip-audience-accommodation');
const VIP_PROMOTION_ID = getMockId('ownerPromotion', 'vip-audience-vip-promo');
const PLUS_PROMOTION_ID = getMockId('ownerPromotion', 'vip-audience-plus-promo');

const SINCE = new Date('2026-06-30T08:00:00.000Z');
const NOW = new Date('2026-07-01T08:00:00.000Z');

function makePromotion(overrides: Partial<OwnerPromotion>): OwnerPromotion {
    return {
        id: PLUS_PROMOTION_ID,
        slug: 'promo',
        ownerId: OWNER_ID,
        accommodationId: ACCOMMODATION_ID,
        entityId: ACCOMMODATION_ID,
        entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION,
        touristAudience: TouristAudienceEnum.PLUS,
        title: 'Promo',
        description: null,
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 20,
        minNights: null,
        validFrom: new Date('2026-06-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T00:00:00.000Z'),
        maxRedemptions: null,
        currentRedemptions: 0,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdAt: new Date('2026-06-30T09:00:00.000Z'),
        updatedAt: new Date('2026-06-30T09:00:00.000Z'),
        deletedAt: null,
        ...overrides
    } as OwnerPromotion;
}

const VIP_PROMOTION = makePromotion({
    id: VIP_PROMOTION_ID,
    title: 'VIP only',
    touristAudience: TouristAudienceEnum.VIP
});
const PLUS_PROMOTION = makePromotion({ id: PLUS_PROMOTION_ID, title: 'Everybody' });

function makeAlert(userId: string): PriceAlert {
    return {
        id: getMockId('accommodation', `alert-${userId}`),
        userId,
        accommodationId: ACCOMMODATION_ID,
        basePriceSnapshot: 2_000_000,
        targetPercentDrop: 10,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null
    };
}

const ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    slug: 'hotel-test',
    name: 'Hotel Test',
    ownerId: OWNER_ID
} as unknown as Accommodation;

/** Scope port: VIP_USER_ID is VIP, everybody else is not. */
const scopeByUser: ResolvePromoOfferAudienceScope = async ({ userId }) =>
    userId === VIP_USER_ID
        ? [TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP]
        : [TouristAudienceEnum.PLUS];

function makeService({
    promotions,
    alerts,
    resolveAudienceScope
}: {
    readonly promotions: OwnerPromotion[];
    readonly alerts: PriceAlert[];
    readonly resolveAudienceScope?: ResolvePromoOfferAudienceScope;
}) {
    const ownerPromotionModel = {
        findAll: vi.fn().mockResolvedValue({ items: promotions, total: promotions.length })
    };
    const alertModel = {
        findAll: vi.fn().mockResolvedValue({ items: alerts, total: alerts.length })
    };
    const accommodationModel = {
        findByIds: vi.fn().mockResolvedValue([ACCOMMODATION]),
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
    };
    return new PromoOfferEvaluatorService({
        ownerPromotionModel: ownerPromotionModel as unknown as OwnerPromotionModel,
        accommodationModel: accommodationModel as unknown as AccommodationModel,
        alertModel: alertModel as unknown as TouristPriceAlertModel,
        resolveAudienceScope
    });
}

describe('PromoOfferEvaluatorService — tourist audience (HOS-2592)', () => {
    it('does not send a VIP-only promotion to a non-VIP subscriber', async () => {
        // Arrange
        const service = makeService({
            promotions: [VIP_PROMOTION],
            alerts: [makeAlert(FREE_USER_ID)],
            resolveAudienceScope: scopeByUser
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: SINCE, now: NOW });

        // Assert — nothing left to send, so the user is absent (no empty entry).
        expect(result.has(FREE_USER_ID)).toBe(false);
        expect(result.size).toBe(0);
    });

    it('sends a VIP-only promotion to a VIP subscriber', async () => {
        // Arrange
        const service = makeService({
            promotions: [VIP_PROMOTION],
            alerts: [makeAlert(VIP_USER_ID)],
            resolveAudienceScope: scopeByUser
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: SINCE, now: NOW });

        // Assert
        expect(result.get(VIP_USER_ID)?.map((match) => match.promotionId)).toEqual([
            VIP_PROMOTION_ID
        ]);
    });

    it('keeps the plus promotions of a non-VIP subscriber and drops only the VIP ones', async () => {
        // Arrange
        const service = makeService({
            promotions: [VIP_PROMOTION, PLUS_PROMOTION],
            alerts: [makeAlert(FREE_USER_ID), makeAlert(VIP_USER_ID)],
            resolveAudienceScope: scopeByUser
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: SINCE, now: NOW });

        // Assert
        expect(result.get(FREE_USER_ID)?.map((match) => match.promotionId)).toEqual([
            PLUS_PROMOTION_ID
        ]);
        expect(
            result
                .get(VIP_USER_ID)
                ?.map((match) => match.promotionId)
                .sort()
        ).toEqual([PLUS_PROMOTION_ID, VIP_PROMOTION_ID].sort());
    });

    it('resolves the scope only for recipients with a VIP-only match', async () => {
        // Arrange
        const resolveAudienceScope = vi.fn(scopeByUser);
        const service = makeService({
            promotions: [PLUS_PROMOTION],
            alerts: [makeAlert(FREE_USER_ID)],
            resolveAudienceScope
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: SINCE, now: NOW });

        // Assert
        expect(result.get(FREE_USER_ID)).toHaveLength(1);
        expect(resolveAudienceScope).not.toHaveBeenCalled();
    });

    it('fails closed to plus only when no scope port is injected', async () => {
        // Arrange
        const service = makeService({
            promotions: [VIP_PROMOTION],
            alerts: [makeAlert(VIP_USER_ID)]
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: SINCE, now: NOW });

        // Assert
        expect(result.size).toBe(0);
    });

    it('fails closed to plus only when the scope port throws', async () => {
        // Arrange
        const service = makeService({
            promotions: [VIP_PROMOTION, PLUS_PROMOTION],
            alerts: [makeAlert(VIP_USER_ID)],
            resolveAudienceScope: async () => {
                throw new Error('effective set unavailable');
            }
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: SINCE, now: NOW });

        // Assert
        expect(result.get(VIP_USER_ID)?.map((match) => match.promotionId)).toEqual([
            PLUS_PROMOTION_ID
        ]);
    });

    it('treats a promotion with an unknown audience as VIP-only', async () => {
        // Arrange
        const unknownAudience = makePromotion({
            id: VIP_PROMOTION_ID,
            touristAudience: undefined as unknown as TouristAudienceEnum
        });
        const service = makeService({
            promotions: [unknownAudience],
            alerts: [makeAlert(FREE_USER_ID)],
            resolveAudienceScope: scopeByUser
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: SINCE, now: NOW });

        // Assert
        expect(result.size).toBe(0);
    });
});

/**
 * Unit tests for PromoOfferEvaluatorService (SPEC-286 T-012).
 *
 * Strategy:
 *   - Mock `OwnerPromotionModel` / `AccommodationModel` / `TouristPriceAlertModel`
 *     the way `price-drop-evaluator.service.test.ts` does — no real DB.
 *   - Exercise `evaluatePromoOffers()` (the I/O orchestration) for the 5
 *     required scenarios from the task spec, plus the pure
 *     `isPromotionQualifying()` window decision directly.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import type { AccommodationModel, OwnerPromotionModel, TouristPriceAlertModel } from '@repo/db';
import type { Accommodation, OwnerPromotion, PriceAlert } from '@repo/schemas';
import { LifecycleStatusEnum, OwnerPromotionDiscountTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    isPromotionQualifying,
    PromoOfferEvaluatorService
} from '../../../src/services/alert/promo-offer-evaluator.service';
import { getMockId } from '../../factories/utilsFactory';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const OWNER_ID = getMockId('user', 'promo-offer-owner');
const USER_ID = getMockId('user', 'promo-offer-subscriber');
const OTHER_USER_ID = getMockId('user', 'promo-offer-subscriber-2');
const ACCOMMODATION_ID = getMockId('accommodation', 'promo-offer-accommodation');
const OTHER_ACCOMMODATION_ID = getMockId('accommodation', 'promo-offer-accommodation-2');
const PROMOTION_ID = getMockId('ownerPromotion', 'promo-offer-promotion');
const ALERT_ID = getMockId('accommodation', 'promo-offer-alert-id');

const WINDOW_START = new Date('2026-06-30T08:00:00.000Z');
const NOW = new Date('2026-07-01T08:00:00.000Z');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePromotion(overrides: Partial<OwnerPromotion> = {}): OwnerPromotion {
    return {
        id: PROMOTION_ID,
        slug: 'summer-20-off',
        ownerId: OWNER_ID,
        accommodationId: ACCOMMODATION_ID,
        title: 'Summer 20% off',
        description: null,
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 20,
        minNights: null,
        validFrom: new Date('2026-06-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T00:00:00.000Z'),
        maxRedemptions: null,
        currentRedemptions: 0,
        planRestricted: false,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdAt: new Date('2026-06-30T09:00:00.000Z'),
        updatedAt: new Date('2026-06-30T09:00:00.000Z'),
        deletedAt: null,
        ...overrides
    } as OwnerPromotion;
}

function makeAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
    return {
        id: ALERT_ID,
        userId: USER_ID,
        accommodationId: ACCOMMODATION_ID,
        basePriceSnapshot: 2_000_000,
        targetPercentDrop: 10,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
        ...overrides
    };
}

function makeAccommodation(overrides: Partial<Accommodation> = {}): Accommodation {
    return {
        id: ACCOMMODATION_ID,
        slug: 'hotel-test',
        name: 'Hotel Test',
        ownerId: OWNER_ID,
        ...overrides
    } as unknown as Accommodation;
}

function makeService(deps: {
    promotions: OwnerPromotion[];
    alerts: PriceAlert[];
    ownerAccommodations?: Accommodation[];
    targetedAccommodations?: Accommodation[];
}) {
    const ownerPromotionModel = {
        findAll: vi
            .fn()
            .mockResolvedValue({ items: deps.promotions, total: deps.promotions.length })
    };
    const alertModel = {
        findAll: vi.fn().mockResolvedValue({ items: deps.alerts, total: deps.alerts.length })
    };
    const accommodationModel = {
        findByIds: vi.fn().mockResolvedValue(deps.targetedAccommodations ?? []),
        findAll: vi.fn().mockResolvedValue({
            items: deps.ownerAccommodations ?? [],
            total: (deps.ownerAccommodations ?? []).length
        })
    };

    const service = new PromoOfferEvaluatorService({
        ownerPromotionModel: ownerPromotionModel as unknown as OwnerPromotionModel,
        accommodationModel: accommodationModel as unknown as AccommodationModel,
        alertModel: alertModel as unknown as TouristPriceAlertModel
    });

    return { service, ownerPromotionModel, alertModel, accommodationModel };
}

// ---------------------------------------------------------------------------
// Pure computation
// ---------------------------------------------------------------------------

describe('isPromotionQualifying', () => {
    it('includes a promotion created within the window and currently valid', () => {
        // Arrange
        const input = {
            createdAt: new Date('2026-06-30T09:00:00.000Z'),
            updatedAt: new Date('2026-06-30T09:00:00.000Z'),
            validFrom: new Date('2026-06-01T00:00:00.000Z'),
            validUntil: new Date('2026-12-31T00:00:00.000Z'),
            since: WINDOW_START,
            now: NOW
        };

        // Act
        const result = isPromotionQualifying(input);

        // Assert
        expect(result).toBe(true);
    });

    it('excludes a promotion whose createdAt and updatedAt are both before since', () => {
        // Arrange
        const input = {
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            updatedAt: new Date('2026-06-01T00:00:00.000Z'),
            validFrom: new Date('2026-06-01T00:00:00.000Z'),
            validUntil: new Date('2026-12-31T00:00:00.000Z'),
            since: WINDOW_START,
            now: NOW
        };

        // Act
        const result = isPromotionQualifying(input);

        // Assert
        expect(result).toBe(false);
    });

    it('includes a promotion whose updatedAt (not createdAt) falls within the window (activation case)', () => {
        // Arrange — mirrors a promotion that was created long ago but just
        // transitioned to ACTIVE (updatedAt bumped, createdAt untouched).
        const input = {
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-06-30T09:00:00.000Z'),
            validFrom: new Date('2026-06-01T00:00:00.000Z'),
            validUntil: null,
            since: WINDOW_START,
            now: NOW
        };

        // Act
        const result = isPromotionQualifying(input);

        // Assert
        expect(result).toBe(true);
    });

    it('excludes an expired promotion (validUntil in the past)', () => {
        // Arrange
        const input = {
            createdAt: new Date('2026-06-30T09:00:00.000Z'),
            updatedAt: new Date('2026-06-30T09:00:00.000Z'),
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2026-06-15T00:00:00.000Z'),
            since: WINDOW_START,
            now: NOW
        };

        // Act
        const result = isPromotionQualifying(input);

        // Assert
        expect(result).toBe(false);
    });

    it('excludes a promotion that has not started yet (validFrom in the future)', () => {
        // Arrange
        const input = {
            createdAt: new Date('2026-06-30T09:00:00.000Z'),
            updatedAt: new Date('2026-06-30T09:00:00.000Z'),
            validFrom: new Date('2026-08-01T00:00:00.000Z'),
            validUntil: null,
            since: WINDOW_START,
            now: NOW
        };

        // Act
        const result = isPromotionQualifying(input);

        // Assert
        expect(result).toBe(false);
    });

    it('treats a null validUntil as never-expiring', () => {
        // Arrange
        const input = {
            createdAt: new Date('2026-06-30T09:00:00.000Z'),
            updatedAt: new Date('2026-06-30T09:00:00.000Z'),
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: null,
            since: WINDOW_START,
            now: NOW
        };

        // Act
        const result = isPromotionQualifying(input);

        // Assert
        expect(result).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// I/O orchestration
// ---------------------------------------------------------------------------

describe('PromoOfferEvaluatorService.evaluatePromoOffers', () => {
    it('includes a matching subscriber for a promotion created within the window', async () => {
        // Arrange
        const promotion = makePromotion();
        const alert = makeAlert({ accommodationId: ACCOMMODATION_ID, userId: USER_ID });
        const accommodation = makeAccommodation();
        const { service } = makeService({
            promotions: [promotion],
            alerts: [alert],
            targetedAccommodations: [accommodation]
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        expect(result.has(USER_ID)).toBe(true);
        const matches = result.get(USER_ID);
        expect(matches).toHaveLength(1);
        expect(matches?.[0]).toMatchObject({
            promotionId: PROMOTION_ID,
            accommodationId: ACCOMMODATION_ID,
            accommodationName: 'Hotel Test',
            accommodationSlug: 'hotel-test',
            promotionTitle: 'Summer 20% off',
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            discountValue: 20
        });
    });

    it('excludes a promotion outside the window (createdAt AND updatedAt both before since)', async () => {
        // Arrange
        const promotion = makePromotion({
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            updatedAt: new Date('2026-06-01T00:00:00.000Z')
        });
        const alert = makeAlert({ accommodationId: ACCOMMODATION_ID, userId: USER_ID });
        const accommodation = makeAccommodation();
        const { service } = makeService({
            promotions: [promotion],
            alerts: [alert],
            targetedAccommodations: [accommodation]
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        expect(result.has(USER_ID)).toBe(false);
    });

    it('excludes an expired promotion (validUntil in the past)', async () => {
        // Arrange
        const promotion = makePromotion({
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2026-06-15T00:00:00.000Z')
        });
        const alert = makeAlert({ accommodationId: ACCOMMODATION_ID, userId: USER_ID });
        const accommodation = makeAccommodation();
        const { service } = makeService({
            promotions: [promotion],
            alerts: [alert],
            targetedAccommodations: [accommodation]
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        expect(result.has(USER_ID)).toBe(false);
    });

    it('matches an owner-wide promotion (accommodationId: null) to a subscriber on ANY of the owner accommodations', async () => {
        // Arrange
        const promotion = makePromotion({ accommodationId: null });
        const accommodationA = makeAccommodation({ id: ACCOMMODATION_ID, slug: 'hotel-a' });
        const accommodationB = makeAccommodation({
            id: OTHER_ACCOMMODATION_ID,
            slug: 'hotel-b',
            name: 'Hotel B'
        });
        // Subscriber only has an alert on the SECOND owner accommodation —
        // proving the owner-wide expansion is not limited to a single one.
        const alert = makeAlert({ accommodationId: OTHER_ACCOMMODATION_ID, userId: USER_ID });
        const { service, accommodationModel } = makeService({
            promotions: [promotion],
            alerts: [alert],
            ownerAccommodations: [accommodationA, accommodationB]
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        expect(result.has(USER_ID)).toBe(true);
        expect(result.get(USER_ID)?.[0]).toMatchObject({
            accommodationId: OTHER_ACCOMMODATION_ID,
            accommodationName: 'Hotel B'
        });
        expect(accommodationModel.findAll).toHaveBeenCalledWith(
            { ownerId: OWNER_ID, deletedAt: null },
            { page: 1, pageSize: 200 }
        );
    });

    it('gives a user with alerts on multiple qualifying accommodations a PromoOfferMatch[] with multiple entries', async () => {
        // Arrange — one owner-wide promotion, subscriber has alerts on TWO of
        // the owner's accommodations.
        const promotion = makePromotion({ accommodationId: null });
        const accommodationA = makeAccommodation({ id: ACCOMMODATION_ID, slug: 'hotel-a' });
        const accommodationB = makeAccommodation({
            id: OTHER_ACCOMMODATION_ID,
            slug: 'hotel-b',
            name: 'Hotel B'
        });
        const alertA = makeAlert({
            id: `${ALERT_ID}-a`,
            accommodationId: ACCOMMODATION_ID,
            userId: USER_ID
        });
        const alertB = makeAlert({
            id: `${ALERT_ID}-b`,
            accommodationId: OTHER_ACCOMMODATION_ID,
            userId: USER_ID
        });
        const { service } = makeService({
            promotions: [promotion],
            alerts: [alertA, alertB],
            ownerAccommodations: [accommodationA, accommodationB]
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        const matches = result.get(USER_ID);
        expect(matches).toHaveLength(2);
        expect(matches?.map((match) => match.accommodationId).sort()).toEqual(
            [ACCOMMODATION_ID, OTHER_ACCOMMODATION_ID].sort()
        );
    });

    it('groups matches for multiple distinct subscribers on the same targeted promotion', async () => {
        // Arrange
        const promotion = makePromotion();
        const accommodation = makeAccommodation();
        const alertUser1 = makeAlert({ id: `${ALERT_ID}-1`, userId: USER_ID });
        const alertUser2 = makeAlert({ id: `${ALERT_ID}-2`, userId: OTHER_USER_ID });
        const { service } = makeService({
            promotions: [promotion],
            alerts: [alertUser1, alertUser2],
            targetedAccommodations: [accommodation]
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        expect(result.has(USER_ID)).toBe(true);
        expect(result.has(OTHER_USER_ID)).toBe(true);
    });

    it('returns an empty map when there are no active promotions', async () => {
        // Arrange
        const { service, alertModel } = makeService({ promotions: [], alerts: [] });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        expect(result.size).toBe(0);
        expect(alertModel.findAll).not.toHaveBeenCalled();
    });

    it('returns an empty map when there are no active alerts', async () => {
        // Arrange
        const promotion = makePromotion();
        const { service, accommodationModel } = makeService({
            promotions: [promotion],
            alerts: []
        });

        // Act
        const result = await service.evaluatePromoOffers({ since: WINDOW_START, now: NOW });

        // Assert
        expect(result.size).toBe(0);
        expect(accommodationModel.findByIds).not.toHaveBeenCalled();
    });
});

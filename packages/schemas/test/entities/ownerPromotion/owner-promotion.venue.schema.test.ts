/**
 * HOS-2270: the promotion target pair, the venue request schemas and the benefit
 * type lists.
 */
import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_PROMOTION_DISCOUNT_TYPES,
    OwnerPromotionCreateInputSchema,
    OwnerPromotionCreateRequestSchema,
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    OwnerPromotionSchema,
    OwnerPromotionUpdateInputSchema,
    VENUE_PROMOTION_DISCOUNT_TYPES,
    VenuePromotionCreateRequestSchema,
    VenuePromotionUpdateRequestSchema
} from '../../../src/index.js';
import { createValidOwnerPromotion } from '../../fixtures/ownerPromotion.fixtures.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const VENUE = '22222222-2222-4222-8222-222222222222';
const ACCOMMODATION = '33333333-3333-4333-8333-333333333333';

const baseCreate = {
    ownerId: OWNER,
    title: 'Promo',
    discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
    discountValue: 10,
    validFrom: new Date('2026-12-01T00:00:00.000Z'),
    lifecycleState: 'ACTIVE'
};

/** Messages of the issues a failed parse reports. */
function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
    return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
}

describe('promotion target (entityType + entityId)', () => {
    it('AC-12: a venue promotion without entityId is a validation error, not a DB failure', () => {
        const result = OwnerPromotionCreateInputSchema.safeParse({
            ...baseCreate,
            entityType: OwnerPromotionEntityTypeEnum.VENUE
        });

        expect(result.success).toBe(false);
        expect(messages(result)).toContain('zodError.ownerPromotion.entityId.requiredForVenue');
    });

    it('accepts a venue promotion with its id and an accommodation one without it', () => {
        const venue = OwnerPromotionCreateInputSchema.safeParse({
            ...baseCreate,
            entityType: OwnerPromotionEntityTypeEnum.VENUE,
            entityId: VENUE
        });
        const ownerWide = OwnerPromotionCreateInputSchema.safeParse({
            ...baseCreate,
            entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION,
            entityId: null
        });

        expect(venue.success).toBe(true);
        expect(ownerWide.success).toBe(true);
    });

    it('the create contract stays compatible: no entityType means accommodation', () => {
        const result = OwnerPromotionCreateInputSchema.safeParse({
            ...baseCreate,
            accommodationId: ACCOMMODATION
        });

        expect(result.success).toBe(true);
    });

    it('the entity schema applies the same rule to a stored row', () => {
        const row = {
            ...createValidOwnerPromotion(),
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            minNights: null,
            entityType: OwnerPromotionEntityTypeEnum.VENUE,
            entityId: null
        };

        expect(OwnerPromotionSchema.safeParse(row).success).toBe(false);
        expect(OwnerPromotionSchema.safeParse({ ...row, entityId: VENUE }).success).toBe(true);
    });

    it('the target is fixed at creation: an update carrying it is a 400', () => {
        expect(OwnerPromotionUpdateInputSchema.safeParse({ entityId: VENUE }).success).toBe(false);
        expect(OwnerPromotionUpdateInputSchema.safeParse({ entityType: 'venue' }).success).toBe(
            false
        );
        expect(OwnerPromotionUpdateInputSchema.safeParse({ title: 'ok' }).success).toBe(true);
    });
});

describe('benefit type lists (AC-21)', () => {
    it('special_offer is venue-only and free_night is accommodation-only', () => {
        expect(ACCOMMODATION_PROMOTION_DISCOUNT_TYPES).not.toContain('special_offer');
        expect(ACCOMMODATION_PROMOTION_DISCOUNT_TYPES).toContain('free_night');
        expect(VENUE_PROMOTION_DISCOUNT_TYPES).toContain('special_offer');
        expect(VENUE_PROMOTION_DISCOUNT_TYPES).not.toContain('free_night');
    });

    it('the accommodation create request refuses special_offer', () => {
        const result = OwnerPromotionCreateRequestSchema.safeParse({
            ...baseCreate,
            ownerId: undefined,
            discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER,
            discountValue: 0
        });

        expect(result.success).toBe(false);
        expect(messages(result)).toContain(
            'zodError.ownerPromotion.discountType.notForAccommodation'
        );
    });

    it('the accommodation create request still accepts what it always did', () => {
        const result = OwnerPromotionCreateRequestSchema.safeParse({
            title: 'Promo',
            discountType: OwnerPromotionDiscountTypeEnum.FREE_NIGHT,
            discountValue: 1,
            minNights: 3,
            validFrom: new Date(),
            lifecycleState: 'ACTIVE',
            accommodationId: ACCOMMODATION
        });

        expect(result.success).toBe(true);
    });
});

describe('VenuePromotionCreateRequestSchema', () => {
    const valid = {
        title: '20% en cena',
        discountType: 'percentage',
        discountValue: 20,
        validFrom: '2026-12-01T00:00:00.000Z'
    };

    it('accepts a percentage promotion and defaults the audience to plus', () => {
        const result = VenuePromotionCreateRequestSchema.safeParse(valid);

        expect(result.success).toBe(true);
        expect(result.success && result.data.touristAudience).toBe('plus');
    });

    it.each([
        ['minNights', { minNights: 2 }],
        ['accommodationId', { accommodationId: ACCOMMODATION }],
        ['maxRedemptions', { maxRedemptions: 10 }],
        ['ownerId', { ownerId: OWNER }],
        ['entityType', { entityType: 'venue' }],
        ['entityId', { entityId: VENUE }]
    ])('AC-5: %s in the body is a 400', (_key, extra) => {
        expect(VenuePromotionCreateRequestSchema.safeParse({ ...valid, ...extra }).success).toBe(
            false
        );
    });

    it('free_night is not a venue benefit', () => {
        expect(
            VenuePromotionCreateRequestSchema.safeParse({ ...valid, discountType: 'free_night' })
                .success
        ).toBe(false);
    });

    it('only the general audience is accepted for now (vip comes with HOS-2273)', () => {
        expect(
            VenuePromotionCreateRequestSchema.safeParse({ ...valid, touristAudience: 'vip' })
                .success
        ).toBe(false);
    });

    it('a special_offer needs its text, takes no discountValue and no description', () => {
        const offer = { title: '2x1', discountType: 'special_offer', validFrom: valid.validFrom };

        expect(VenuePromotionCreateRequestSchema.safeParse(offer).success).toBe(false);
        expect(
            VenuePromotionCreateRequestSchema.safeParse({
                ...offer,
                specialOfferText: '2x1 en tragos'
            }).success
        ).toBe(true);
        expect(
            VenuePromotionCreateRequestSchema.safeParse({
                ...offer,
                specialOfferText: '2x1',
                discountValue: 5
            }).success
        ).toBe(false);
        expect(
            VenuePromotionCreateRequestSchema.safeParse({
                ...offer,
                specialOfferText: '2x1',
                description: 'otro texto'
            }).success
        ).toBe(false);
    });

    it('the offer text only belongs to a special_offer', () => {
        const result = VenuePromotionCreateRequestSchema.safeParse({
            ...valid,
            specialOfferText: 'combo'
        });

        expect(result.success).toBe(false);
    });

    it('a percentage is 1 to 100 and a fixed amount at least 1', () => {
        expect(
            VenuePromotionCreateRequestSchema.safeParse({ ...valid, discountValue: 101 }).success
        ).toBe(false);
        expect(
            VenuePromotionCreateRequestSchema.safeParse({ ...valid, discountValue: 0 }).success
        ).toBe(false);
        expect(
            VenuePromotionCreateRequestSchema.safeParse({
                ...valid,
                discountType: 'fixed',
                discountValue: 500
            }).success
        ).toBe(true);
    });

    it('the end date must come after the start date', () => {
        const result = VenuePromotionCreateRequestSchema.safeParse({
            ...valid,
            validUntil: '2026-11-01T00:00:00.000Z'
        });

        expect(result.success).toBe(false);
    });
});

describe('VenuePromotionUpdateRequestSchema', () => {
    it('is partial: a pause carries only the lifecycle state', () => {
        const result = VenuePromotionUpdateRequestSchema.safeParse({ lifecycleState: 'ARCHIVED' });

        expect(result.success).toBe(true);
        expect(result.success && Object.keys(result.data)).toEqual(['lifecycleState']);
    });

    it('AC-5: is strict, so minNights is a 400', () => {
        expect(VenuePromotionUpdateRequestSchema.safeParse({ minNights: 2 }).success).toBe(false);
    });
});

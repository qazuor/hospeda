/**
 * HOS-2270: the venue promotion service and its request translation.
 */
import type { OwnerPromotion } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    PermissionEnum,
    ServiceErrorCode,
    TouristAudienceEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as revalidation from '../../../src/services/listing/listing-revalidation';
import {
    buildVenueCreateInput,
    buildVenueUpdateInput,
    VenuePromotionService
} from '../../../src/services/owner-promotion/ownerPromotion.venue';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockOwnerPromotion } from '../../factories/ownerPromotionFactory';
import { getMockId } from '../../factories/utilsFactory';

const OWNER = getMockId('user', 'venue-owner');
const STRANGER = getMockId('user', 'venue-stranger');
const VENUE = getMockId('accommodation', 'the-venue');
const PROMOTION = getMockId('ownerPromotion', 'venue-promo');
const FROM = new Date('2026-12-01T00:00:00.000Z');
const UNTIL = new Date('2026-12-31T00:00:00.000Z');

const venue = {
    id: VENUE,
    ownerId: OWNER,
    slug: 'la-parrilla',
    destinationId: null,
    publicationStatus: 'PUBLISHED',
    deletedAt: null
};

function stored(overrides: Partial<OwnerPromotion> = {}): OwnerPromotion {
    return createMockOwnerPromotion({
        id: PROMOTION,
        ownerId: OWNER,
        entityType: 'venue',
        entityId: VENUE,
        accommodationId: null,
        minNights: null,
        maxRedemptions: null,
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 20,
        description: null,
        validFrom: FROM,
        validUntil: UNTIL,
        ...overrides
    } as Partial<OwnerPromotion>);
}

describe('buildVenueCreateInput', () => {
    it('AC-1: the owner and the target come from the venue, never the body', () => {
        const input = buildVenueCreateInput({
            venue,
            request: {
                title: '20% off',
                discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
                discountValue: 20,
                validFrom: FROM,
                touristAudience: TouristAudienceEnum.PLUS
            }
        });

        expect(input).toMatchObject({
            ownerId: OWNER,
            entityType: 'venue',
            entityId: VENUE,
            accommodationId: null,
            minNights: null,
            maxRedemptions: null,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            discountValue: 20
        });
    });

    it('AC-20: a special_offer keeps its text in description and a discountValue of 0', () => {
        const input = buildVenueCreateInput({
            venue,
            request: {
                title: '2x1',
                discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER,
                specialOfferText: '2x1 en tragos de 19 a 21',
                validFrom: FROM,
                touristAudience: TouristAudienceEnum.PLUS
            }
        });

        expect(input.description).toBe('2x1 en tragos de 19 a 21');
        expect(input.discountValue).toBe(0);
    });
});

describe('buildVenueUpdateInput', () => {
    it('maps only what the body carries', () => {
        const input = buildVenueUpdateInput({
            existing: stored(),
            request: { lifecycleState: LifecycleStatusEnum.ARCHIVED }
        });

        expect(input).toEqual({ lifecycleState: LifecycleStatusEnum.ARCHIVED });
    });

    it('rejects an offer text on a numeric benefit', () => {
        expect(() =>
            buildVenueUpdateInput({ existing: stored(), request: { specialOfferText: 'combo' } })
        ).toThrow('onlyForSpecialOffer');
    });

    it('clears the old text when a special_offer becomes a numeric benefit', () => {
        const input = buildVenueUpdateInput({
            existing: stored({
                discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER,
                discountValue: 0,
                description: 'Postre gratis'
            }),
            request: { discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE, discountValue: 15 }
        });

        expect(input).toMatchObject({
            discountType: 'percentage',
            discountValue: 15,
            description: null
        });
    });

    it('rejects an end date that is not after the start of the resulting promotion', () => {
        expect(() =>
            buildVenueUpdateInput({
                existing: stored(),
                request: { validUntil: new Date('2026-11-01T00:00:00.000Z') }
            })
        ).toThrow('beforeValidFrom');
    });

    it('rejects a percentage above 100 even when the type is not in the body', () => {
        expect(() =>
            buildVenueUpdateInput({ existing: stored(), request: { discountValue: 150 } })
        ).toThrow('maxPercentage');
    });
});

describe('VenuePromotionService', () => {
    let promotions: {
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        softDelete: ReturnType<typeof vi.fn>;
    };
    let model: {
        findByVenue: ReturnType<typeof vi.fn>;
        countActiveForVenueOwner: ReturnType<typeof vi.fn>;
        findOneOfVenue: ReturnType<typeof vi.fn>;
    };
    let venueModel: { findById: ReturnType<typeof vi.fn> };
    let service: VenuePromotionService;
    let revalidate: ReturnType<typeof vi.spyOn>;
    const actor = createActor({ id: OWNER, permissions: [] });

    beforeEach(() => {
        vi.clearAllMocks();
        promotions = {
            create: vi.fn().mockResolvedValue({ data: stored() }),
            update: vi.fn().mockResolvedValue({ data: stored() }),
            softDelete: vi.fn().mockResolvedValue({ data: { count: 1 } })
        };
        model = {
            findByVenue: vi.fn().mockResolvedValue([stored()]),
            countActiveForVenueOwner: vi.fn().mockResolvedValue(3),
            findOneOfVenue: vi.fn().mockResolvedValue(stored())
        };
        venueModel = { findById: vi.fn().mockResolvedValue(venue) };
        revalidate = vi.spyOn(revalidation, 'scheduleListingRevalidation').mockResolvedValue();
        service = new VenuePromotionService({
            promotionService: promotions as never,
            model: model as never,
            venueModel: venueModel as never
        });
    });

    it('AC-7: a venue of somebody else is a 404 on every operation, never a 403', async () => {
        venueModel.findById.mockResolvedValue({ ...venue, ownerId: STRANGER });
        const request = {
            title: 't',
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            discountValue: 10,
            validFrom: FROM,
            touristAudience: TouristAudienceEnum.PLUS
        } as const;

        const results = await Promise.all([
            service.create({ actor, venueId: VENUE, request }),
            service.update({ actor, venueId: VENUE, promotionId: PROMOTION, request: {} }),
            service.softDelete({ actor, venueId: VENUE, promotionId: PROMOTION })
        ]);

        for (const result of results) {
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        }
        expect(promotions.create).not.toHaveBeenCalled();
        expect(promotions.update).not.toHaveBeenCalled();
        expect(promotions.softDelete).not.toHaveBeenCalled();
    });

    it('a promotion that does not hang from this venue is a 404 (another venue, an accommodation)', async () => {
        model.findOneOfVenue.mockResolvedValue(null);

        const updated = await service.update({
            actor,
            venueId: VENUE,
            promotionId: PROMOTION,
            request: { title: 'x' }
        });
        const deleted = await service.softDelete({ actor, venueId: VENUE, promotionId: PROMOTION });

        expect(updated.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(deleted.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.findOneOfVenue).toHaveBeenCalledWith({
            promotionId: PROMOTION,
            venueId: VENUE
        });
    });

    it('AC-16: every write schedules the revalidation of the venue', async () => {
        await service.create({
            actor,
            venueId: VENUE,
            request: {
                title: 't',
                discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
                discountValue: 10,
                validFrom: FROM,
                touristAudience: TouristAudienceEnum.PLUS
            }
        });
        await service.update({
            actor,
            venueId: VENUE,
            promotionId: PROMOTION,
            request: { title: 'n' }
        });
        await service.softDelete({ actor, venueId: VENUE, promotionId: PROMOTION });

        expect(revalidate).toHaveBeenCalledTimes(3);
        expect(revalidate).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'venue', entity: venue })
        );
    });

    it('does not revalidate when the write failed', async () => {
        promotions.create.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'nope')
        });

        const result = await service.create({
            actor,
            venueId: VENUE,
            request: {
                title: 't',
                discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
                discountValue: 10,
                validFrom: FROM,
                touristAudience: TouristAudienceEnum.PLUS
            }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(revalidate).not.toHaveBeenCalled();
    });

    it('AC-6: listing works for the owner and reports the quota usage', async () => {
        const listActor = createActor({
            id: OWNER,
            permissions: [PermissionEnum.OWNER_PROMOTION_VIEW_OWN]
        });

        const result = await service.list({ actor: listActor, venueId: VENUE });

        expect(result.data).toEqual({ items: [stored()], activeCount: 3 });
        expect(model.countActiveForVenueOwner).toHaveBeenCalledWith({ ownerId: OWNER });
    });

    it('a pause goes through update with only the lifecycle state', async () => {
        await service.update({
            actor,
            venueId: VENUE,
            promotionId: PROMOTION,
            request: { lifecycleState: LifecycleStatusEnum.ARCHIVED }
        });

        expect(promotions.update).toHaveBeenCalledWith(actor, PROMOTION, {
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        });
    });
});

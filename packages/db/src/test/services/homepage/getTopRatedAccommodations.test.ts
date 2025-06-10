import type {
    AccommodationId,
    AmenityId,
    AmenityType,
    DestinationId,
    FeatureId,
    FeatureType,
    UserId
} from '@repo/types';
import { AccommodationTypeEnum } from '@repo/types/enums/accommodation-type.enum';
import { AmenitiesTypeEnum } from '@repo/types/enums/amenity-type.enum';
import { PriceCurrencyEnum } from '@repo/types/enums/currency.enum';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { getTopRatedAccommodationsOutputSchema } from '../../../services/homepage/homepage.schemas';
import { homepageService } from '../../../services/homepage/homepage.service';

const mockFeature: FeatureType = {
    id: '33333333-3333-3333-3333-333333333333' as FeatureId,
    name: 'WiFi',
    description: 'Internet inalámbrico',
    icon: 'wifi',
    isBuiltin: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '44444444-4444-4444-4444-444444444444' as UserId,
    updatedById: '44444444-4444-4444-4444-444444444444' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: { favorite: false }
};

const mockAmenity: AmenityType = {
    id: '22222222-2222-2222-2222-222222222222' as AmenityId,
    name: 'Piscina',
    description: 'Pileta exterior',
    icon: 'pool',
    isBuiltin: true,
    type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '44444444-4444-4444-4444-444444444444' as UserId,
    updatedById: '44444444-4444-4444-4444-444444444444' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: { favorite: false }
};

const mockAccommodation = {
    id: '11111111-1111-1111-1111-111111111111' as AccommodationId,
    slug: 'hotel-uno',
    name: 'Hotel Uno',
    summary: 'Un hotel excelente',
    price: { amount: 100, currency: PriceCurrencyEnum.USD },
    reviewsCount: 12,
    averageRating: 4.9,
    features: [
        {
            accommodationId: '11111111-1111-1111-1111-111111111111' as AccommodationId,
            featureId: mockFeature.id,
            feature: mockFeature
        }
    ],
    amenities: [
        {
            accommodationId: '11111111-1111-1111-1111-111111111111' as AccommodationId,
            amenityId: mockAmenity.id,
            isOptional: false,
            amenity: mockAmenity
        }
    ],
    type: AccommodationTypeEnum.HOTEL,
    description: 'Descripción larga y válida para Zod, más de 30 caracteres.',
    ownerId: '11111111-1111-1111-1111-111111111111' as UserId,
    destinationId: '22222222-2222-2222-2222-222222222222' as DestinationId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    isFeatured: false,
    createdById: '11111111-1111-1111-1111-111111111111' as UserId,
    updatedById: '11111111-1111-1111-1111-111111111111' as UserId,
    adminInfo: undefined
};

describe('homepageService.getTopRatedAccommodations', () => {
    beforeAll(() => {
        vi.spyOn(AccommodationModel, 'list').mockResolvedValue([
            {
                ...mockAccommodation,
                features: [mockFeature],
                amenities: [mockAmenity]
            } as unknown as typeof mockAccommodation
        ]);
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should return top rated accommodations with features and amenities', async () => {
        const input = { limit: 1 };
        const result = await homepageService.getTopRatedAccommodations(input);
        expect(result).toEqual(
            getTopRatedAccommodationsOutputSchema.parse({
                accommodations: [
                    {
                        id: mockAccommodation.id,
                        slug: mockAccommodation.slug,
                        name: mockAccommodation.name,
                        summary: mockAccommodation.summary,
                        price: mockAccommodation.price,
                        reviewsCount: mockAccommodation.reviewsCount,
                        averageRating: mockAccommodation.averageRating,
                        amenities: [
                            {
                                id: mockAmenity.id,
                                name: mockAmenity.name,
                                description: mockAmenity.description,
                                icon: mockAmenity.icon
                            }
                        ],
                        features: [
                            {
                                id: mockFeature.id,
                                name: mockFeature.name,
                                description: mockFeature.description,
                                icon: mockFeature.icon
                            }
                        ]
                    }
                ]
            })
        );
    });

    it('should return an empty array if there are no accommodations', async () => {
        vi.spyOn(AccommodationModel, 'list').mockResolvedValue([]);
        const input = { limit: 5 };
        const result = await homepageService.getTopRatedAccommodations(input);
        expect(result).toEqual(getTopRatedAccommodationsOutputSchema.parse({ accommodations: [] }));
    });

    it('should return accommodation with empty features and amenities if none', async () => {
        const accNoRelations = {
            ...mockAccommodation,
            features: [],
            amenities: [],
            price: { amount: 100, currency: PriceCurrencyEnum.USD }
        };
        vi.spyOn(AccommodationModel, 'list').mockResolvedValue([accNoRelations]);
        const input = { limit: 1 };
        const result = await homepageService.getTopRatedAccommodations(input);
        expect(result.accommodations[0]?.features ?? []).toEqual([]);
        expect(result.accommodations[0]?.amenities ?? []).toEqual([]);
    });

    it('should throw on invalid input: limit = 0', async () => {
        await expect(homepageService.getTopRatedAccommodations({ limit: 0 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit negative', async () => {
        await expect(homepageService.getTopRatedAccommodations({ limit: -5 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit not a number', async () => {
        // @ts-expect-error purposely wrong type
        await expect(homepageService.getTopRatedAccommodations({ limit: 'abc' })).rejects.toThrow();
    });
});

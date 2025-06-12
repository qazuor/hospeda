import { AccommodationModel } from '@repo/db';
import type { AccommodationAmenityType, AccommodationFeatureType } from '@repo/types';
import { PriceCurrencyEnum } from '@repo/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getTopRatedAccommodationsOutputSchema } from '../../homepage/homepage.schemas';
import { homepageService } from '../../homepage/homepage.service';
import {
    getMockAccommodationId,
    getMockAccommodationWithRelations
} from '../factories/accommodationFactory';
import { getMockAmenity, getMockAmenityId } from '../factories/amenityFactory';
import { getMockFeature, getMockFeatureId } from '../factories/featureFactory';

const mockFeature = getMockFeature({
    id: getMockFeatureId(),
    name: 'WiFi',
    description: 'Internet inalámbrico',
    icon: 'wifi',
    isBuiltin: true
});
const mockAmenity = getMockAmenity({
    id: getMockAmenityId(),
    name: 'Piscina',
    description: 'Pileta exterior',
    icon: 'pool',
    isBuiltin: true
});

const mockAccommodation = getMockAccommodationWithRelations({
    id: getMockAccommodationId(),
    slug: 'hotel-uno',
    name: 'Hotel Uno',
    summary: 'Un hotel excelente',
    price: { price: 100, currency: PriceCurrencyEnum.USD },
    reviewsCount: 12,
    averageRating: 4.9,
    features: [mockFeature as unknown as AccommodationFeatureType],
    amenities: [mockAmenity as unknown as AccommodationAmenityType]
});

describe('homepageService.getTopRatedAccommodations', () => {
    beforeAll(() => {
        vi.spyOn(AccommodationModel, 'list').mockResolvedValue([mockAccommodation]);
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
        const accNoRelations = getMockAccommodationWithRelations({
            ...mockAccommodation,
            features: [],
            amenities: [],
            price: { price: 100, currency: PriceCurrencyEnum.USD }
        });
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

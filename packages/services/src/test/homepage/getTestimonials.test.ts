import { AccommodationReviewModel, DestinationReviewModel } from '@repo/db';
import type {
    AccommodationId,
    AccommodationReviewId,
    DestinationId,
    DestinationReviewId,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getTestimonialsOutputSchema } from '../../homepage/homepage.schemas';
import { homepageService } from '../../homepage/homepage.service';

const accReviewId = '11111111-1111-1111-1111-111111111111';
const destReviewId = '22222222-2222-2222-2222-222222222222';
const accId = '33333333-3333-3333-3333-333333333333';
const destId = '44444444-4444-4444-4444-444444444444';
const userId = '55555555-5555-5555-5555-555555555555';
const now = new Date();

const mockAccReview = {
    id: accReviewId as AccommodationReviewId,
    accommodationId: accId as AccommodationId,
    userId: userId as UserId,
    content: 'Excelente alojamiento',
    rating: {
        cleanliness: 5,
        hospitality: 5,
        services: 5,
        accuracy: 5,
        communication: 5,
        location: 5
    },
    createdAt: now,
    updatedAt: now,
    createdById: userId as UserId,
    updatedById: userId as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: { favorite: false }
};

const mockDestReview = {
    id: destReviewId as DestinationReviewId,
    destinationId: destId as DestinationId,
    userId: userId as UserId,
    content: 'Hermoso destino',
    rating: {
        landscape: 5,
        attractions: 5,
        accessibility: 5,
        safety: 5,
        cleanliness: 5,
        hospitality: 5,
        culturalOffer: 5,
        gastronomy: 5,
        affordability: 5,
        nightlife: 5,
        infrastructure: 5,
        environmentalCare: 5,
        wifiAvailability: 5,
        shopping: 5,
        beaches: 5,
        greenSpaces: 5,
        localEvents: 5,
        weatherSatisfaction: 5
    },
    createdAt: now,
    updatedAt: now,
    createdById: userId as UserId,
    updatedById: userId as UserId
};

describe('homepageService.getTestimonials', () => {
    beforeAll(() => {
        vi.spyOn(AccommodationReviewModel, 'list').mockResolvedValue([mockAccReview]);
        vi.spyOn(DestinationReviewModel, 'list').mockResolvedValue([mockDestReview]);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should return testimonials from both accommodation and destination reviews', async () => {
        const input = { limit: 2 };
        const result = await homepageService.getTestimonials(input);
        expect(result.testimonials).toEqual(
            expect.arrayContaining([
                {
                    id: mockAccReview.id,
                    entityType: 'accommodation',
                    entityId: mockAccReview.accommodationId,
                    author: 'Anonymous',
                    rating: 5,
                    comment: mockAccReview.content,
                    createdAt: mockAccReview.createdAt.toISOString()
                },
                {
                    id: mockDestReview.id,
                    entityType: 'destination',
                    entityId: mockDestReview.destinationId,
                    author: 'Anonymous',
                    rating: 5,
                    comment: mockDestReview.content,
                    createdAt: mockDestReview.createdAt.toISOString()
                }
            ])
        );
    });

    it('should return an empty array if there are no reviews', async () => {
        vi.spyOn(AccommodationReviewModel, 'list').mockResolvedValue([]);
        vi.spyOn(DestinationReviewModel, 'list').mockResolvedValue([]);
        const input = { limit: 5 };
        const result = await homepageService.getTestimonials(input);
        expect(result).toEqual(getTestimonialsOutputSchema.parse({ testimonials: [] }));
    });

    it('should throw on invalid input: limit = 0', async () => {
        await expect(homepageService.getTestimonials({ limit: 0 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit negative', async () => {
        await expect(homepageService.getTestimonials({ limit: -5 })).rejects.toThrow();
    });
    it('should throw on invalid input: limit not a number', async () => {
        // @ts-expect-error purposely wrong type
        await expect(homepageService.getTestimonials({ limit: 'abc' })).rejects.toThrow();
    });
});

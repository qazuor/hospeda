import { AccommodationReviewModel, DestinationReviewModel } from '@repo/db';
import type { UserId } from '@repo/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getTestimonialsOutputSchema } from '../../homepage/homepage.schemas';
import { homepageService } from '../../homepage/homepage.service';
import { getMockDestinationId, getMockUserId } from '../factories';
import {
    getMockAccommodationId,
    getMockAccommodationReview,
    getMockAccommodationReviewId
} from '../factories/accommodationFactory';
import {
    getMockDestinationReview,
    getMockDestinationReviewId
} from '../factories/destinationReviewFactory';

const accReviewId = getMockAccommodationReviewId();
const destReviewId = getMockDestinationReviewId();
const userId = getMockUserId();
const now = new Date();

const mockAccReview = getMockAccommodationReview({
    id: accReviewId,
    accommodationId: getMockAccommodationId(),
    userId: userId as UserId,
    content: 'Excelente alojamiento',
    createdAt: now,
    updatedAt: now
});

const mockDestReview = getMockDestinationReview({
    id: destReviewId,
    destinationId: getMockDestinationId(),
    userId: userId as UserId,
    content: 'Hermoso destino',
    createdAt: now,
    updatedAt: now
});

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
                    id: accReviewId,
                    entityType: 'accommodation',
                    entityId: mockAccReview.accommodationId,
                    author: 'Anonymous',
                    rating: 5,
                    comment: mockAccReview.content,
                    createdAt: mockAccReview.createdAt.toISOString()
                },
                {
                    id: destReviewId,
                    entityType: 'destination',
                    entityId: mockDestReview.destinationId,
                    author: 'Anonymous',
                    rating: 4.39,
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

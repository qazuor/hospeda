import type {
    AccommodationReviewId,
    AccommodationReviewType,
    NewAccommodationReviewInputType,
    UpdateAccommodationReviewInputType
} from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for creating a new AccommodationReview
 */
export const CreateAccommodationReviewSchema = z.object({
    accommodationId: z.string().uuid(),
    userId: z.string().uuid(),
    rating: z.object({
        cleanliness: z.number().min(1).max(5),
        hospitality: z.number().min(1).max(5),
        services: z.number().min(1).max(5),
        accuracy: z.number().min(1).max(5),
        communication: z.number().min(1).max(5),
        location: z.number().min(1).max(5)
    }),
    title: z.string().min(1).max(200),
    content: z.string().min(10).max(2000)
});

/**
 * Zod schema for updating an AccommodationReview
 */
export const UpdateAccommodationReviewSchema = CreateAccommodationReviewSchema.partial();

/**
 * Zod schema for identifying an AccommodationReview by id
 */
export const AccommodationReviewIdSchema = z.object({
    id: z.string().uuid()
});

export type {
    AccommodationReviewId,
    AccommodationReviewType,
    NewAccommodationReviewInputType,
    UpdateAccommodationReviewInputType
};

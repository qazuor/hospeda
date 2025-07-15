import { AccommodationReviewSchema } from '@repo/schemas';
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
export const CreateAccommodationReviewSchema = AccommodationReviewSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    lifecycleState: true,
    adminInfo: true
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

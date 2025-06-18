import { AccommodationReviewSchema } from '@repo/schemas/entities/accommodation/accommodation.review.schema';
import { LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Service for managing accommodation reviews, including creation, listing, and stats recalculation.
 * Handles permission checks and updates accommodation stats after review changes.
 */
// Zod schema for creating a review (matches NewAccommodationReviewInputType)
export const AccommodationReviewCreateSchema = AccommodationReviewSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).extend({
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).default(LifecycleStatusEnum.ACTIVE)
});

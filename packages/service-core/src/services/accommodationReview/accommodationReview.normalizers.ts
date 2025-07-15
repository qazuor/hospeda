import type { z } from 'zod';
import type { Actor } from '../../types';
import type {
    CreateAccommodationReviewSchema,
    UpdateAccommodationReviewSchema
} from './accommodationReview.schemas';

/**
 * Normalizes input for creating a new accommodation review (passthrough).
 */
export const normalizeCreateInput = (
    data: z.infer<typeof CreateAccommodationReviewSchema>,
    _actor: Actor
): z.infer<typeof CreateAccommodationReviewSchema> => {
    return data;
};

/**
 * Normalizes input for updating an accommodation review (passthrough).
 */
export const normalizeUpdateInput = (
    data: z.infer<typeof UpdateAccommodationReviewSchema>,
    _actor: Actor
): z.infer<typeof UpdateAccommodationReviewSchema> => {
    return data;
};

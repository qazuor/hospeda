import type { AccommodationReviewCreateInput, AccommodationReviewUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';

/**
 * Normalizes input for creating a new accommodation review (passthrough).
 */
export const normalizeCreateInput = (
    data: AccommodationReviewCreateInput,
    _actor: Actor
): AccommodationReviewCreateInput => {
    return data;
};

/**
 * Normalizes input for updating an accommodation review (passthrough).
 */
export const normalizeUpdateInput = (
    data: AccommodationReviewUpdateInput,
    _actor: Actor
): AccommodationReviewUpdateInput => {
    return data;
};

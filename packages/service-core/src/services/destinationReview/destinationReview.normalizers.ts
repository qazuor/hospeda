import type { DestinationReviewCreateInput, DestinationReviewUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';

export const normalizeCreateInput = (
    data: DestinationReviewCreateInput,
    _actor: Actor
): DestinationReviewCreateInput => {
    return data;
};

export const normalizeUpdateInput = (
    data: DestinationReviewUpdateInput,
    _actor: Actor
): DestinationReviewUpdateInput => {
    return data;
};

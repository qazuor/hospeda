import type { z } from 'zod';
import type { Actor } from '../../types';
import type {
    CreateDestinationReviewSchema,
    UpdateDestinationReviewSchema
} from './destinationReview.schemas';

export const normalizeCreateInput = (
    data: z.infer<typeof CreateDestinationReviewSchema>,
    _actor: Actor
): z.infer<typeof CreateDestinationReviewSchema> => {
    return data;
};

export const normalizeUpdateInput = (
    data: z.infer<typeof UpdateDestinationReviewSchema>,
    _actor: Actor
): z.infer<typeof UpdateDestinationReviewSchema> => {
    return data;
};

import type { NewEntityInput, WithAudit, Writable } from '../../common/helpers.types.js';
import type { DestinationId, DestinationReviewId, UserId } from '../../common/id.types.js';
import type { DestinationRatingType } from './destination.rating.types.js';

/**
 * User review about a destination
 */
export interface DestinationReviewType extends WithAudit {
    id: DestinationReviewId;
    userId: UserId;
    destinationId: DestinationId;
    title?: string;
    content?: string;
    rating: DestinationRatingType;
}

export type PartialDestinationReviewType = Partial<Writable<DestinationReviewType>>;
export type NewDestinationReviewInputType = NewEntityInput<DestinationReviewType>;
export type UpdateDestinationReviewInputType = PartialDestinationReviewType;

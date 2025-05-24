import type { WithAudit, WithId } from '../../common/helpers.types.js';
import type { DestinationId, UserId } from '../../common/id.types.js';
import type { DestinationRatingType } from './destination.rating.types.js';

/**
 * User review about a destination
 */
export interface DestinationReviewType extends WithId, WithAudit {
    userId: UserId;
    destinationId: DestinationId;
    title?: string;
    content?: string;
    rating: DestinationRatingType;
}

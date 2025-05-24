import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState
} from '../../common/helpers.types.js';
import type { AccommodationId, UserId } from '../../common/id.types.js';
import type { AccommodationRatingType } from './accommodation.rating.types.js';

export interface AccommodationReviewType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithAdminInfo {
    accommodationId: AccommodationId;
    userId: UserId;
    title?: string;
    content?: string;
    rating: AccommodationRatingType;
}

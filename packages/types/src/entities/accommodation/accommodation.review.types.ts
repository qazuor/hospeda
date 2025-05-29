import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { AccommodationId, AccommodationReviewId, UserId } from '../../common/id.types.js';
import type { AccommodationRatingType } from './accommodation.rating.types.js';

export interface AccommodationReviewType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: AccommodationReviewId;
    accommodationId: AccommodationId;
    userId: UserId;
    title?: string;
    content?: string;
    rating: AccommodationRatingType;
}

export type PartialAccommodationReviewType = Partial<Writable<AccommodationReviewType>>;
export type NewAccommodationReviewInputType = NewEntityInput<AccommodationReviewType>;
export type UpdateAccommodationReviewInputType = PartialAccommodationReviewType;

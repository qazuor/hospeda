import type {
    WithActivityState,
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSeo,
    WithSoftDelete,
    WithTags
} from '../../common/helpers.types.js';
import type { DestinationId } from '../../common/id.types.js';
import type { BaseLocationType } from '../../common/location.types.js';
import type { MediaType } from '../../common/media.types.js';
import type { VisibilityEnum } from '../../enums/visibility.enum.js';
import type { DestinationAttractionType } from './destination.attraction.types.js';
import type { DestinationReviewType } from './destination.review.types.js';

/**
 * Main destination entity
 */
export interface DestinationType
    extends WithId,
        WithAudit,
        WithAdminInfo,
        WithLifecycleState,
        WithActivityState,
        WithSoftDelete,
        WithTags,
        WithSeo {
    id: DestinationId;
    slug: string;
    name: string;
    summary: string;
    description: string;
    location: BaseLocationType;
    media: MediaType;
    isFeatured?: boolean;
    visibility: VisibilityEnum;

    // Stats
    reviewsCount?: number;
    averageRating?: number;
    accommodationsCount?: number;

    // Related data
    attractions?: DestinationAttractionType[];
    reviews?: DestinationReviewType[];
}

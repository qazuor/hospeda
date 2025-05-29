import type { AccommodationType } from '@repo/types/entities/accommodation/accommodation.types.js';
import type { TagType } from '@repo/types/entities/tag/tag.types.js';
import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    WithModerationState,
    WithReviewState,
    WithSeo,
    WithTags,
    Writable
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
    extends WithAudit,
        WithAdminInfo,
        WithLifecycleState,
        WithModerationState,
        WithReviewState,
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
    accommodationsCount?: number;

    // Related data
    attractions?: DestinationAttractionType[];
    reviews?: DestinationReviewType[];
}

/**
 * Partial editable structure of a DestinationType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialDestinationType = Partial<Writable<DestinationType>>;

/**
 * Input structure used to create a new destination.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewDestinationInputType = NewEntityInput<DestinationType>;

/**
 * Input structure used to update an existing destination.
 * All fields are optional for partial patching.
 */
export type UpdateDestinationInputType = PartialDestinationType;

export type DestinationSummaryType = Pick<
    DestinationType,
    'id' | 'slug' | 'name' | 'summary' | 'media' | 'averageRating' | 'reviewsCount'
>;

export type DestinationWithRelationsType = DestinationType & {
    accommodations?: AccommodationType[];
    reviews?: DestinationReviewType[];
    tags?: TagType[];
    attractions?: DestinationAttractionType[];
};

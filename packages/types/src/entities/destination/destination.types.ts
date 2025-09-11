import type { AccommodationType } from '@repo/types/entities/accommodation/accommodation.types.js';
import type { TagType } from '@repo/types/entities/tag/tag.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    WithModerationState,
    WithOptional,
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
import type { DestinationRatingType } from './destination.rating.types.js';
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
    media?: MediaType;
    isFeatured: boolean;
    visibility: VisibilityEnum;

    // Stats
    accommodationsCount: number;

    // Related data
    attractions?: DestinationAttractionType[];
    reviews?: DestinationReviewType[];
    rating?: DestinationRatingType;
}

/**
 * Partial editable structure of a DestinationType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialDestinationType = Partial<Writable<DestinationType>>;

/**
 * Input structure used to create a new destination.
 * Makes id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById optional for creation.
 *
 * @example
 * // Creating a new destination (id and audit fields are optional)
 * const input: NewDestinationInputType = {
 *   name: 'Beach',
 *   slug: 'beach',
 *   summary: 'A beautiful beach',
 *   description: 'Full description',
 *   location: { lat: 0, lng: 0 },
 *   media: { url: 'beach.jpg' },
 *   visibility: VisibilityEnum.PUBLIC,
 * };
 */
export type NewDestinationInputType = WithOptional<
    DestinationType,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;

/**
 * Input structure used to update an existing destination.
 * All fields are optional for partial patching.
 *
 * @example
 * // Updating a destination (only the fields to update are provided)
 * const input: UpdateDestinationInputType = {
 *   summary: 'Updated summary',
 * };
 */
export type UpdateDestinationInputType = Partial<Writable<DestinationType>>;

export type DestinationSummaryType = Pick<
    DestinationType,
    | 'id'
    | 'slug'
    | 'name'
    | 'summary'
    | 'media'
    | 'location'
    | 'isFeatured'
    | 'averageRating'
    | 'reviewsCount'
    | 'accommodationsCount'
>;

/**
 * DestinationWithRelationsType extends DestinationType with all possible related entities.
 * - accommodations: Array of related AccommodationType (if loaded)
 * - reviews: Array of related DestinationReviewType (if loaded)
 * - tags: Array of related TagType (if loaded)
 * - attractions: Array of related DestinationAttractionType (if loaded)
 */
export type DestinationWithRelationsType = DestinationType & {
    accommodations?: AccommodationType[];
    reviews?: DestinationReviewType[];
    tags?: TagType[];
    attractions?: DestinationAttractionType[];
};

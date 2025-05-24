import type { TagType } from '@repo/types/common/tag.types.js';
import type { AccommodationType } from '@repo/types/entities/accommodation/accommodation.types.js';
import type { DestinationAttractionType } from '@repo/types/entities/destination/destination.attraction.types.js';
import type { DestinationReviewType } from '@repo/types/entities/destination/destination.review.types.js';
import type { DestinationType } from '@repo/types/entities/destination/destination.types.js';

export type DestinationSummary = Pick<
    DestinationType,
    'id' | 'slug' | 'name' | 'summary' | 'media' | 'averageRating' | 'reviewsCount'
>;

export type DestinationWithRelations = DestinationType & {
    accommodations?: AccommodationType[];
    reviews?: DestinationReviewType[];
    tags?: TagType[];
    attractions?: DestinationAttractionType[];
};

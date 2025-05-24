import type { TagType } from '@repo/types/common/tag.types.js';
import type { AmenityType } from '@repo/types/entities/accommodation/accommodation.amenity.types.js';
import type { AccommodationFaqType } from '@repo/types/entities/accommodation/accommodation.faq.types.js';
import type { FeatureType } from '@repo/types/entities/accommodation/accommodation.feature.types.js';
import type { AccommodationIaDataType } from '@repo/types/entities/accommodation/accommodation.ia.types.js';
import type { AccommodationReviewType } from '@repo/types/entities/accommodation/accommodation.review.types.js';
import type { AccommodationType } from '@repo/types/entities/accommodation/accommodation.types.js';
import type { DestinationType } from '@repo/types/entities/destination/destination.types.js';

export type AccommodationSummary = Pick<
    AccommodationType,
    | 'id'
    | 'slug'
    | 'name'
    | 'type'
    | 'media'
    | 'rating'
    | 'reviewsCount'
    | 'location'
    | 'isFeatured'
>;

export type AccommodationWithRelations = AccommodationType & {
    destination?: DestinationType;
    features?: FeatureType[];
    amenities?: AmenityType[];
    reviews?: AccommodationReviewType[];
    faqs?: AccommodationFaqType[];
    iaData?: AccommodationIaDataType[];
    tags?: TagType[];
};

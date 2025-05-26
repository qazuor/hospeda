import type { TagType } from '../../../common/tag.types.js';
import type { DestinationType } from '../../destination/destination.types.js';
import type { AmenityType } from '../accommodation.amenity.types.js';
import type { AccommodationFaqType } from '../accommodation.faq.types.js';
import type { FeatureType } from '../accommodation.feature.types.js';
import type { AccommodationIaDataType } from '../accommodation.ia.types.js';
import type { AccommodationReviewType } from '../accommodation.review.types.js';
import type { AccommodationType } from '../accommodation.types.js';

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

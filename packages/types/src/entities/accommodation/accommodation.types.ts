import type { TagType } from '@repo/types/entities/tag/tag.types.js';
import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    WithModerationState,
    WithReviewState,
    WithSeo,
    WithTags,
    WithVisibility,
    Writable
} from '../../common/helpers.types.js';
import type { AccommodationId, DestinationId, UserId } from '../../common/id.types.js';
import type { FullLocationType } from '../../common/location.types.js';
import type { MediaType } from '../../common/media.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';
import type { AccommodationTypeEnum } from '../../enums/accommodation-type.enum.js';
import type { DestinationType } from '../destination/destination.types.js';
import type { UserType } from '../user/user.types.js';
import type { AccommodationAmenityType, AmenityType } from './accommodation.amenity.types.js';
import type { ExtraInfoType } from './accommodation.extrainfo.types.js';
import type { AccommodationFaqType } from './accommodation.faq.types.js';
import type { AccommodationFeatureType, FeatureType } from './accommodation.feature.types.js';
import type { AccommodationIaDataType } from './accommodation.ia.types.js';
import type { AccommodationPriceType } from './accommodation.price.types.js';
import type { AccommodationRatingType } from './accommodation.rating.types.js';
import type { AccommodationReviewType } from './accommodation.review.types.js';
import type { ScheduleType } from './accommodation.schedule.types.js';

export interface AccommodationType
    extends WithAudit,
        WithLifecycleState,
        WithVisibility,
        WithReviewState,
        WithModerationState,
        WithTags,
        WithSeo,
        WithAdminInfo {
    id: AccommodationId;
    slug: string;
    name: string;
    summary: string;
    type: AccommodationTypeEnum;
    description: string;
    contactInfo?: ContactInfoType;
    socialNetworks?: SocialNetworkType;
    price?: AccommodationPriceType;
    location?: FullLocationType;
    media?: MediaType;
    isFeatured?: boolean;

    ownerId: UserId;
    owner?: UserType;

    destinationId: DestinationId;
    destination?: DestinationType;

    features?: AccommodationFeatureType[];
    amenities?: AccommodationAmenityType[];
    reviews?: AccommodationReviewType[];
    rating?: AccommodationRatingType;
    schedule?: ScheduleType;
    extraInfo?: ExtraInfoType;
    faqs?: AccommodationFaqType[];
    iaData?: AccommodationIaDataType[];
}

/**
 * Partial editable structure of an AccommodationType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialAccommodationType = Partial<Writable<AccommodationType>>;

/**
 * Input structure used to create a new accommodation.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewAccommodationInputType = NewEntityInput<AccommodationType>;

/**
 * Input structure used to update an existing accommodation.
 * All fields are optional for partial patching.
 */
export type UpdateAccommodationInputType = PartialAccommodationType;

export type AccommodationSummaryType = Pick<
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

export type AccommodationWithRelationsType = AccommodationType & {
    destination?: DestinationType;
    features?: FeatureType[];
    amenities?: AmenityType[];
    reviews?: AccommodationReviewType[];
    faqs?: AccommodationFaqType[];
    iaData?: AccommodationIaDataType[];
    tags?: TagType[];
};

import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithReviewState,
    WithSeo,
    WithTags,
    WithVisibility
} from '../../common/helpers.types.js';
import type { DestinationId, UserId } from '../../common/id.types.js';
import type { FullLocationType } from '../../common/location.types.js';
import type { MediaType } from '../../common/media.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';
import type { AccommodationTypeEnum } from '../../enums/accommodation-type.enum.js';
import type { DestinationType } from '../destination/destination.types.js';
import type { UserType } from '../user/user.types.js';
import type { AccommodationAmenityType } from './accommodation.amenity.types.js';
import type { ExtraInfoType } from './accommodation.extrainfo.types.js';
import type { AccommodationFaqType } from './accommodation.faq.types.js';
import type { AccommodationFeatureType } from './accommodation.feature.types.js';
import type { AccommodationIaDataType } from './accommodation.ia.types.js';
import type { AccommodationPriceType } from './accommodation.price.types.js';
import type { AccommodationRatingType } from './accommodation.rating.types.js';
import type { AccommodationReviewType } from './accommodation.review.types.js';
import type { ScheduleType } from './accommodation.schedule.types.js';

export interface AccommodationType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithVisibility,
        WithReviewState,
        WithTags,
        WithSeo,
        WithAdminInfo {
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

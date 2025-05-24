import type { ContactInfoType } from '@repo/types/common/contact.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithReviewState,
    WithSeo,
    WithTags,
    WithVisibility
} from '@repo/types/common/helpers.types.js';
import type { DestinationId, UserId } from '@repo/types/common/id.types.js';
import type { FullLocationType } from '@repo/types/common/location.types.js';
import type { MediaType } from '@repo/types/common/media.types.js';
import type { SocialNetworkType } from '@repo/types/common/social.types.js';
import type { AccommodationAmenityType } from '@repo/types/entities/accommodation/accommodation.amenity.types.js';
import type { ExtraInfoType } from '@repo/types/entities/accommodation/accommodation.extrainfo.types.js';
import type { AccommodationFaqType } from '@repo/types/entities/accommodation/accommodation.faq.types.js';
import type { AccommodationFeatureType } from '@repo/types/entities/accommodation/accommodation.feature.types.js';
import type { AccommodationIaDataType } from '@repo/types/entities/accommodation/accommodation.ia.types.js';
import type { AccommodationPriceType } from '@repo/types/entities/accommodation/accommodation.price.types.js';
import type { AccommodationRatingType } from '@repo/types/entities/accommodation/accommodation.rating.types.js';
import type { AccommodationReviewType } from '@repo/types/entities/accommodation/accommodation.review.types.js';
import type { ScheduleType } from '@repo/types/entities/accommodation/accommodation.schedule.types.js';
import type { DestinationType } from '@repo/types/entities/destination/destination.types.js';
import type { UserType } from '@repo/types/entities/user/user.types.js';
import type { AccommodationTypeEnum } from '@repo/types/enums/accommodation-type.enum.js';

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
    contactInfo: ContactInfoType;
    socialNetworks: SocialNetworkType;
    price: AccommodationPriceType;
    location: FullLocationType;
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

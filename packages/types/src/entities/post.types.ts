import type {
    BaseEntityType,
    BasePriceType,
    ContactInfoType,
    ImageType,
    MediaType,
    SeoType,
    SocialNetworkType
} from '../common.types';
import type { ClientTypeEnum, PostCategoryEnum, StateEnum, VisibilityEnum } from '../enums.types';
import type { AccommodationType } from './accommodation.types';
import type { DestinationType } from './destination.types';
import type { EventType } from './event.types';
import type { UserType } from './user.types';

/**
 * Entity that sponsors a post, typically a business or advertiser.
 */
export interface PostSponsorType extends BaseEntityType {
    type: ClientTypeEnum;
    description: string;
    logo?: ImageType;
    social?: SocialNetworkType;
    contact?: ContactInfoType;
    state: StateEnum;
}

/**
 * Sponsorship details for a specific post.
 * Multiple posts may be sponsored by the same sponsor.
 */
export interface PostSponsorshipType extends BaseEntityType {
    sponsorId: string;
    sponsor?: PostSponsorType;
    message?: string;
    description: string;
    paid: BasePriceType;
    paidAt?: Date;
    fromDate?: Date;
    toDate?: Date;
    isHighlighted?: boolean;
}

/**
 * A blog post, article, or promotional content published on the platform.
 */
export interface PostType extends BaseEntityType {
    slug: string;
    category: PostCategoryEnum;
    title: string;
    summary: string;
    content: string;
    media: MediaType;
    authorId: string;
    author?: UserType;
    isFeatured?: boolean;
    visibility: VisibilityEnum;
    seo?: SeoType;
    sponsorship?: PostSponsorshipType;
    expiresAt?: Date;
    likes?: number;
    comments?: number;
    shares?: number;
    relatedDestinationId?: string; // Optional, if the post is related to a specific destination
    relatedDestination?: DestinationType; // Optional, if the post is related to a specific destination
    relatedAccommodationId?: string; // Optional, if the post is related to a specific accommodation
    relatedAccommodation?: AccommodationType; // Optional, if the post is related to a specific accommodation
    relatedEventId?: string; // Optional, if the post is related to a specific event
    relatedEvent?: EventType; // Optional, if the post is related to a specific event
    isNews?: boolean; // Optional, if the post is a news article
    isFeaturedInWebsite?: boolean; // Optional, if the post is featured on the website
}

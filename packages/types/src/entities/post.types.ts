import type {
    BaseEntityType,
    BasePriceType,
    ContactInfoType,
    ImageType,
    MediaType,
    SeoType,
    SocialNetworkType,
    TagType
} from '../common.types.js';
import type { ClientTypeEnum, PostCategoryEnum, VisibilityEnum } from '../enums.types.js';
import type { AccommodationType } from './accommodation.types.js';
import type { DestinationType } from './destination.types.js';
import type { EventType } from './event.types.js';
import type { UserType } from './user.types.js';

/**
 * Entity that sponsors a post, typically a business or advertiser.
 */
export interface PostSponsorType extends BaseEntityType {
    type: ClientTypeEnum;
    description: string;
    logo?: ImageType;
    social?: SocialNetworkType;
    contact?: ContactInfoType;
    sponsorships?: PostSponsorshipType[];
}

/**
 * Sponsorship details for a specific post.
 * Multiple posts may be sponsored by the same sponsor.
 */
export interface PostSponsorshipType extends BaseEntityType {
    sponsorId: string;
    sponsor?: PostSponsorType;
    postId: string;
    post?: PostType;
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

    sponsorshipId?: string;
    sponsorship?: PostSponsorshipType;

    relatedDestinationId?: string;
    relatedDestination?: DestinationType;

    relatedAccommodationId?: string;
    relatedAccommodation?: AccommodationType;

    relatedEventId?: string;
    relatedEvent?: EventType;

    visibility: VisibilityEnum;
    seo?: SeoType;

    isFeatured?: boolean;
    isNews?: boolean;
    isFeaturedInWebsite?: boolean;

    expiresAt?: Date;
    likes?: number;
    comments?: number;
    shares?: number;
    tags?: TagType[];
}

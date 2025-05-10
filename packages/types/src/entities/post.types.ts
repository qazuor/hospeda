import type {
    AdminInfoType,
    BaseEntityType,
    BasePriceType,
    ContactInfoType,
    ImageType,
    SeoType,
    SocialNetworkType
} from '../common.types';
import type { ClientTypeEnum, PostCategoryEnum, StateEnum, VisibilityEnum } from '../enums.types';

/**
 * Entity that sponsors a post, typically a business or advertiser.
 */
export interface PostSponsorType extends BaseEntityType {
    /**
     * Type of sponsor (e.g., HOST, ADVERTISER).
     */
    type: ClientTypeEnum;

    /**
     * Display name of the sponsor.
     */
    name: string;

    /**
     * Short description of the sponsor or business.
     */
    description: string;

    /**
     * Optional logo or profile image.
     */
    logo?: ImageType;

    /**
     * Social media and contact links.
     */
    social?: SocialNetworkType;

    /**
     * Direct contact details.
     */
    contact?: ContactInfoType;

    /**
     * Tags for categorization or filtering.
     */
    tags: string[];

    /**
     * Current state of the sponsor record.
     */
    state: StateEnum;

    /**
     * Admin metadata.
     */
    adminInfo?: AdminInfoType;
}

/**
 * Sponsorship details for a specific post.
 * Multiple posts may be sponsored by the same sponsor.
 */
export interface PostSponsorshipType extends BaseEntityType {
    /**
     * The sponsor responsible for this sponsorship.
     */
    sponsor?: PostSponsorType;

    /**
     * Message to be displayed with the post (e.g. "Sponsored by...").
     */
    message?: string;

    /**
     * Additional description (internal or public).
     */
    description: string;

    /**
     * Tags for this sponsorship instance.
     */
    tags: string[];

    /**
     * Amount paid for the sponsorship.
     */
    paid: BasePriceType;

    /**
     * Payment date.
     */
    paidAt?: Date;

    /**
     * Start of the display period.
     */
    fromDate?: Date;

    /**
     * End of the display period.
     */
    toDate?: Date;

    /**
     * Whether the sponsorship should be promoted visually.
     */
    isHighlighted?: boolean;

    /**
     * Admin metadata.
     */
    adminInfo?: AdminInfoType;
}

/**
 * A blog post, article, or promotional content published on the platform.
 */
export interface PostType extends BaseEntityType {
    /**
     * Slug used for SEO-friendly URL.
     */
    slug: string;

    /**
     * Post category (e.g. tourism, gastronomy).
     */
    category: PostCategoryEnum;

    /**
     * Post title shown in listing and detail pages.
     */
    title: string;

    /**
     * Short summary or lead for the article.
     */
    summary: string;

    /**
     * Main content of the article (can be HTML or Markdown).
     */
    content: string;

    /**
     * Media attachments (images, videos).
     */
    media: {
        featuredImage: ImageType;
        gallery?: ImageType[];
    };

    /**
     * Optional tags for search and categorization.
     */
    tags?: string[];

    /**
     * ID of the author who created the post.
     */
    authorId: string;

    /**
     * Whether the post is featured/promoted.
     */
    isFeatured?: boolean;

    /**
     * Visibility level (public, draft, private).
     */
    visibility: VisibilityEnum;

    /**
     * SEO metadata for the post.
     */
    seo?: SeoType;

    /**
     * Internal admin metadata.
     */
    adminInfo?: AdminInfoType;

    /**
     * Optional sponsorship info if this post is paid/promoted.
     */
    sponsorship?: PostSponsorshipType;

    /**
     * Optional expiration date for the post.
     */
    expiresAt?: Date;
}

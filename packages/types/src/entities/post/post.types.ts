import type { AccommodationType } from '@repo/types/entities/accommodation/accommodation.types.js';
import type { DestinationType } from '@repo/types/entities/destination/destination.types.js';
import type { EventType } from '@repo/types/entities/event/event.types.js';
import type { PostSponsorshipType } from '@repo/types/entities/post/post.sponsorship.types.js';
import type { TagType } from '@repo/types/entities/tag/tag.types.js';
import type { UserType } from '@repo/types/entities/user/user.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    WithModerationState,
    WithOptional,
    WithSeo,
    WithTags,
    Writable
} from '../../common/helpers.types.js';
import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostId,
    PostSponsorshipId,
    UserId
} from '../../common/id.types.js';
import type { MediaType } from '../../common/media.types.js';
import type { PostCategoryEnum } from '../../enums/post-category.enum.js';
import type { VisibilityEnum } from '../../enums/visibility.enum.js';

export interface PostType
    extends WithAudit,
        WithLifecycleState,
        WithAdminInfo,
        WithModerationState,
        WithTags,
        WithSeo {
    id: PostId;
    slug: string;
    category: PostCategoryEnum;
    title: string;
    summary: string;
    content: string;
    media: MediaType;

    authorId: UserId;
    sponsorshipId?: PostSponsorshipId;

    relatedDestinationId?: DestinationId;
    relatedAccommodationId?: AccommodationId;
    relatedEventId?: EventId;

    visibility: VisibilityEnum;
    isFeatured?: boolean;
    isNews?: boolean;
    isFeaturedInWebsite?: boolean;

    expiresAt?: Date;
    likes?: number;
    comments?: number;
    shares?: number;
}

/**
 * Partial editable structure of a PostType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPostType = Partial<Writable<PostType>>;

/**
 * Input structure used to create a new post.
 * Makes id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById optional for creation.
 *
 * @example
 * // Creating a new post (id and audit fields are optional)
 * const input: NewPostInputType = {
 *   slug: 'post-2024',
 *   category: PostCategoryEnum.BLOG,
 *   title: 'My Post',
 *   summary: 'Short summary',
 *   content: 'Full content',
 *   media: { url: 'image.jpg' },
 *   authorId: 'user-uuid',
 *   visibility: VisibilityEnum.PUBLIC,
 * };
 */
export type NewPostInputType = WithOptional<
    PostType,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;

/**
 * Input structure used to update an existing post.
 * All fields are optional for partial patching.
 *
 * @example
 * // Updating a post (only the fields to update are provided)
 * const input: UpdatePostInputType = {
 *   summary: 'Updated summary',
 * };
 */
export type UpdatePostInputType = Partial<Writable<PostType>>;

export type PostSummaryType = Pick<
    PostType,
    'id' | 'slug' | 'title' | 'summary' | 'category' | 'media' | 'createdAt'
>;

/**
 * PostWithRelationsType extends PostType with all possible related entities.
 * - author: The related UserType (if loaded)
 * - sponsorship: The related PostSponsorshipType (if loaded)
 * - relatedDestination: The related DestinationType (if loaded)
 * - relatedAccommodation: The related AccommodationType (if loaded)
 * - relatedEvent: The related EventType (if loaded)
 * - tags: Array of related TagType (if loaded)
 */
export type PostWithRelationsType = PostType & {
    author?: UserType;
    sponsorship?: PostSponsorshipType;
    relatedDestination?: DestinationType;
    relatedAccommodation?: AccommodationType;
    relatedEvent?: EventType;
    tags?: TagType[];
};

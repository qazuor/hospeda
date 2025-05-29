import type { AccommodationType } from '@repo/types/entities/accommodation/accommodation.types.js';
import type { DestinationType } from '@repo/types/entities/destination/destination.types.js';
import type { EventType } from '@repo/types/entities/event/event.types.js';
import type { PostSponsorshipType } from '@repo/types/entities/post/post.sponsorship.types.js';
import type { TagType } from '@repo/types/entities/tag/tag.types.js';
import type { UserType } from '@repo/types/entities/user/user.types.js';
import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    WithModerationState,
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
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPostInputType = NewEntityInput<PostType>;

/**
 * Input structure used to update an existing post.
 * All fields are optional for partial patching.
 */
export type UpdatePostInputType = PartialPostType;

export type PostSummaryType = Pick<
    PostType,
    'id' | 'slug' | 'title' | 'summary' | 'category' | 'media' | 'createdAt'
>;

export type PostWithRelationsType = PostType & {
    author?: UserType;
    sponsorship?: PostSponsorshipType;
    relatedDestination?: DestinationType;
    relatedAccommodation?: AccommodationType;
    relatedEvent?: EventType;
    tags?: TagType[];
};

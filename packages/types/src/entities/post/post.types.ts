import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSeo,
    WithSoftDelete,
    WithTags
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
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo,
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

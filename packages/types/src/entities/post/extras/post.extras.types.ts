import type { TagType } from '@repo/types/common/tag.types.js';
import type { AccommodationType } from '@repo/types/entities/accommodation/accommodation.types.js';
import type { DestinationType } from '@repo/types/entities/destination/destination.types.js';
import type { EventType } from '@repo/types/entities/event/event.types.js';
import type { PostSponsorshipType } from '@repo/types/entities/post/post.sponsorship.types.js';
import type { PostType } from '@repo/types/entities/post/post.types.js';
import type { UserType } from '@repo/types/entities/user/user.types.js';

export type PostSummary = Pick<
    PostType,
    'id' | 'slug' | 'title' | 'summary' | 'category' | 'media' | 'createdAt'
>;

export type PostWithRelations = PostType & {
    author?: UserType;
    sponsorship?: PostSponsorshipType;
    relatedDestination?: DestinationType;
    relatedAccommodation?: AccommodationType;
    relatedEvent?: EventType;
    tags?: TagType[];
};

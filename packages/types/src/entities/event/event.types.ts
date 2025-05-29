import type { TagType } from '@repo/types/entities/tag/tag.types.js';
import type { UserType } from '@repo/types/entities/user/user.types.js';
import type { ContactInfoType } from '../../common/contact.types.js';
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
import type { EventId, EventLocationId, EventOrganizerId, UserId } from '../../common/id.types.js';
import type { MediaType } from '../../common/media.types.js';
import type { EventCategoryEnum } from '../../enums/event-category.enum.js';
import type { VisibilityEnum } from '../../enums/visibility.enum.js';
import type { EventDateType } from './event.date.types.js';
import type { EventLocationType } from './event.location.types.js';
import type { EventOrganizerType } from './event.organizer.types.js';
import type { EventPriceType } from './event.price.types.js';

export interface EventType
    extends WithAudit,
        WithLifecycleState,
        WithAdminInfo,
        WithModerationState,
        WithTags,
        WithSeo {
    id: EventId;
    slug: string;
    summary: string;
    description?: string;
    media?: MediaType;

    category: EventCategoryEnum;
    date: EventDateType;

    authorId: UserId;

    locationId?: EventLocationId;
    location?: EventLocationType;

    organizerId?: EventOrganizerId;
    organizer?: EventOrganizerType;

    pricing?: EventPriceType;
    contact?: ContactInfoType;

    visibility: VisibilityEnum;
    isFeatured?: boolean;
}

/**
 * Partial editable structure of an EventType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialEventType = Partial<Writable<EventType>>;

/**
 * Input structure used to create a new event.
 * Makes id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById optional for creation.
 */
export type NewEventInputType = WithOptional<
    EventType,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;

/**
 * Input structure used to update an existing event.
 * All fields are optional for partial patching.
 */
export type UpdateEventInputType = Partial<Writable<EventType>>;

export type EventSummaryType = Pick<
    EventType,
    'id' | 'slug' | 'summary' | 'category' | 'date' | 'media' | 'isFeatured'
>;

/**
 * EventWithRelationsType extends EventType with all possible related entities.
 * - author: The related UserType (if loaded)
 * - location: The related EventLocationType (if loaded)
 * - organizer: The related EventOrganizerType (if loaded)
 * - tags: Array of related TagType (if loaded)
 */
export type EventWithRelationsType = EventType & {
    author?: UserType;
    location?: EventLocationType;
    organizer?: EventOrganizerType;
    tags?: TagType[];
};

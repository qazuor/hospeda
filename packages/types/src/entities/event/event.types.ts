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
import type { TagType } from '../tag/tag.types.js';
import type { UserType } from '../user/user.types.js';
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
    name: string;
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
    contactInfo?: ContactInfoType;

    visibility: VisibilityEnum;
    isFeatured: boolean;
}

/**
 * Partial editable structure of an EventType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialEventType = Partial<Writable<EventType>>;

/**
 * Input structure used to create a new event.
 * Makes id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById optional for creation.
 *
 * @example
 * // Creating a new event (id and audit fields are optional)
 * const input: NewEventInputType = {
 *   slug: 'event-2024',
 *   summary: 'Annual Event',
 *   category: EventCategoryEnum.CONFERENCE,
 *   date: { start: new Date(), end: new Date() },
 *   authorId: 'user-uuid',
 *   visibility: VisibilityEnum.PUBLIC,
 * };
 */
export type NewEventInputType = WithOptional<
    EventType,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;

/**
 * Input structure used to update an existing event.
 * All fields are optional for partial patching.
 *
 * @example
 * // Updating an event (only the fields to update are provided)
 * const input: UpdateEventInputType = {
 *   summary: 'Updated summary',
 * };
 */
export type UpdateEventInputType = Partial<Writable<EventType>>;

export type EventSummaryType = Pick<
    EventType,
    'id' | 'slug' | 'name' | 'category' | 'date' | 'media' | 'isFeatured'
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

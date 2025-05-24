import type { TagType } from '@repo/types/common/tag.types.js';
import type { EventLocationType } from '@repo/types/entities/event/event.location.types.js';
import type { EventOrganizerType } from '@repo/types/entities/event/event.organizer.types.js';
import type { EventType } from '@repo/types/entities/event/event.types.js';
import type { UserType } from '@repo/types/entities/user/user.types.js';

export type EventSummary = Pick<
    EventType,
    'id' | 'slug' | 'summary' | 'category' | 'date' | 'media' | 'isFeatured'
>;

export type EventWithRelations = EventType & {
    author?: UserType;
    location?: EventLocationType;
    organizer?: EventOrganizerType;
    tags?: TagType[];
};

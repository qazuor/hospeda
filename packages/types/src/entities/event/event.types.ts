import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSeo,
    WithSoftDelete,
    WithTags
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
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo,
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

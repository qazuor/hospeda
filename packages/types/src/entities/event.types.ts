import type {
    BaseEntityType,
    BaseLocationType,
    BasePriceType,
    ContactInfoType,
    MediaType,
    SeoType,
    SocialNetworkType,
    TagType
} from '../common.types.js';
import type { EventCategoryEnum, RecurrenceTypeEnum, VisibilityEnum } from '../enums.types.js';
import type { UserType } from './user.types.js';

/**
 * Defines the schedule of an event, including recurrence.
 */
export interface EventDateType {
    start: Date;
    end?: Date;
    isAllDay?: boolean;
    recurrence?: RecurrenceTypeEnum; // 'DAILY', 'WEEKLY', etc. from RecurrenceTypeEnum
}

/**
 * Defines pricing rules for attending an event.
 */
export interface EventPriceType extends BasePriceType {
    isFree: boolean;
    priceFrom?: number;
    priceTo?: number;
    pricePerGroup?: number;
}

/**
 * Organizer or host of the event (business, person or institution).
 */
export interface EventOrganizerType extends BaseEntityType {
    logo?: string;
    contactInfo?: ContactInfoType;
    social?: SocialNetworkType;
    events?: EventType[];
}

/**
 * Location where the event takes place, including extended address and name.
 */
export interface EventLocationType extends BaseLocationType {
    id: string;
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    deparment?: string;
    placeName?: string;
    events?: EventType[];
}

/**
 * Main event entity representing a published or upcoming event.
 */
export interface EventType extends BaseEntityType {
    slug: string;
    summary: string;
    description?: string;
    media?: MediaType;

    category: EventCategoryEnum;
    date: EventDateType;

    authorId: string;
    author?: UserType;

    locationId?: string;
    location?: EventLocationType;

    organizerId?: string;
    organizer?: EventOrganizerType;

    pricing?: EventPriceType;
    contact?: ContactInfoType;

    visibility: VisibilityEnum;
    seo?: SeoType;
    isFeatured?: boolean;
    tags?: TagType[];
}

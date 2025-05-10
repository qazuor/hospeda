import type {
    BaseEntityType,
    BaseLocationType,
    BasePriceType,
    ContactInfoType,
    MediaType,
    SeoType,
    SocialNetworkType
} from '../common.types';
import type { EventCategoryEnum, RecurrenceTypeEnum, VisibilityEnum } from '../enums.types';

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
}

export interface EventLocationType extends BaseLocationType {
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    deparment?: string;
    placeName?: string;
}

/**
 * Main type representing a published or upcoming event.
 */
export interface EventType extends BaseEntityType {
    slug: string;
    summary: string;
    description?: string;
    media?: MediaType;
    category: EventCategoryEnum;
    location?: EventLocationType;
    date: EventDateType;
    pricing?: EventPriceType;
    organizer?: EventOrganizerType;
    contact?: ContactInfoType;
    authorId: string;
    isFeatured?: boolean;
    visibility: VisibilityEnum;
    seo?: SeoType;
}

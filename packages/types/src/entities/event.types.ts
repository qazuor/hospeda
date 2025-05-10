import type {
    AdminInfoType,
    BaseEntityType,
    ContactInfoType,
    LocationType,
    MediaType,
    SeoType
} from '../common.types';
import type { EventCategoryEnum, VisibilityEnum } from '../enums.types';

/**
 * Defines the schedule of an event, including recurrence.
 */
export interface EventDateType {
    /**
     * Start datetime of the event (ISO format).
     */
    start: Date;

    /**
     * End datetime of the event (ISO format).
     */
    end: Date;

    /**
     * Whether the event is all-day (no specific time).
     */
    isAllDay?: boolean;

    /**
     * Optional recurrence rule.
     */
    recurrence?: string; // 'DAILY', 'WEEKLY', etc. from RecurrenceTypeEnum
}

/**
 * Defines pricing rules for attending an event.
 */
export interface EventPriceType {
    /**
     * Whether the event is free to attend.
     */
    isFree: boolean;

    /**
     * Currency used for pricing (e.g., ARS, USD).
     */
    currency?: string;

    /**
     * Minimum price for entry.
     */
    priceFrom?: number;

    /**
     * Maximum price (if variable pricing).
     */
    priceTo?: number;
}

/**
 * Organizer or host of the event (business, person or institution).
 */
export interface EventOrganizerType {
    /**
     * Organizer's name (brand or individual).
     */
    name: string;

    /**
     * Optional logo or image of the organizer.
     */
    logo?: string;

    /**
     * Link to external page or website.
     */
    website?: string;
}

/**
 * Main type representing a published or upcoming event.
 */
export interface EventType extends BaseEntityType {
    /**
     * Slug used for SEO-friendly URLs.
     */
    slug: string;

    /**
     * Full title of the event.
     */
    title: string;

    /**
     * Detailed description of the event.
     */
    description: string;

    /**
     * Short summary used in previews or cards.
     */
    summary?: string;

    /**
     * Media content associated with the event.
     */
    media: MediaType;

    /**
     * Event classification (music, sports, etc.).
     */
    category: EventCategoryEnum;

    /**
     * Optional tags for filtering and search.
     */
    tags?: string[];

    /**
     * Location details of where the event takes place.
     */
    location: LocationType;

    /**
     * Date and recurrence schedule.
     */
    date: EventDateType;

    /**
     * Optional ticket pricing information.
     */
    pricing?: EventPriceType;

    /**
     * Organizer details.
     */
    organizer?: EventOrganizerType;

    /**
     * Public contact information.
     */
    contact?: ContactInfoType;

    /**
     * ID of the user who authored/created the event.
     */
    authorId: string;

    /**
     * Whether this event is featured/promoted.
     */
    isFeatured?: boolean;

    /**
     * Controls visibility on the platform.
     */
    visibility: VisibilityEnum;

    /**
     * Search engine optimization metadata.
     */
    seo?: SeoType;

    /**
     * Admin-only notes and control data.
     */
    adminInfo?: AdminInfoType;
}

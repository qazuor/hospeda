/**
 * General state used across all entities.
 */
export enum StateEnum {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
    DELETED = 'DELETED'
}

/**
 * Preferred contact method for a user.
 */
export enum PreferedContactEnum {
    HOME = 'HOME',
    WORK = 'WORK',
    MOBILE = 'MOBILE'
}

/**
 * Accommodation types available in the platform.
 */
export enum AccommodationTypeEnum {
    APARTMENT = 'APARTMENT',
    HOUSE = 'HOUSE',
    COUNTRY_HOUSE = 'COUNTRY_HOUSE',
    CABIN = 'CABIN',
    HOTEL = 'HOTEL',
    HOSTEL = 'HOSTEL',
    CAMPING = 'CAMPING',
    ROOM = 'ROOM'
}

/**
 * Categories of amenities used to group similar features.
 */
export enum AmenitiesTypeEnum {
    CLIMATE_CONTROL = 'CLIMATE_CONTROL',
    CONNECTIVITY = 'CONNECTIVITY',
    ENTERTAINMENT = 'ENTERTAINMENT',
    KITCHEN = 'KITCHEN',
    BED_AND_BATH = 'BED_AND_BATH',
    OUTDOORS = 'OUTDOORS',
    ACCESSIBILITY = 'ACCESSIBILITY',
    PET_FRIENDLY = 'PET_FRIENDLY',
    SERVICES = 'SERVICES',
    SAFETY = 'SAFETY',
    FAMILY_FRIENDLY = 'FAMILY_FRIENDLY',
    WORK_FRIENDLY = 'WORK_FRIENDLY',
    GENERAL_APPLIANCES = 'GENERAL_APPLIANCES'
}

/**
 * System user roles for access control and permissions.
 */
export enum RoleTypeEnum {
    ADMIN = 'ADMIN',
    EDITOR = 'EDITOR',
    CLIENT = 'CLIENT',
    USER = 'USER'
}

/**
 * Blog post or article categories.
 */
export enum PostCategoryEnum {
    EVENTS = 'EVENTS',
    CULTURE = 'CULTURE',
    GASTRONOMY = 'GASTRONOMY',
    NATURE = 'NATURE',
    TOURISM = 'TOURISM',
    GENERAL = 'GENERAL',
    SPORT = 'SPORT'
}

/**
 * Controls whether a resource is visible or restricted.
 */
export enum VisibilityEnum {
    PUBLIC = 'PUBLIC',
    DRAFT = 'DRAFT',
    PRIVATE = 'PRIVATE'
}

/**
 * Used for repeating events.
 */
export enum RecurrenceTypeEnum {
    NONE = 'NONE',
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    YEARLY = 'YEARLY'
}

/**
 * Categories for classifying events on the platform.
 */
export enum EventCategoryEnum {
    MUSIC = 'MUSIC',
    CULTURE = 'CULTURE',
    SPORTS = 'SPORTS',
    GASTRONOMY = 'GASTRONOMY',
    FESTIVAL = 'FESTIVAL',
    NATURE = 'NATURE',
    THEATER = 'THEATER',
    WORKSHOP = 'WORKSHOP',
    OTHER = 'OTHER'
}

/**
 * Types of system-generated notifications.
 */
export enum NotificationTypeEnum {
    SYSTEM = 'SYSTEM',
    REMINDER = 'REMINDER',
    WARNING = 'WARNING',
    MARKETING = 'MARKETING',
    PAYMENT = 'PAYMENT',
    RESERVATION = 'RESERVATION',
    CUSTOM = 'CUSTOM'
}

/**
 * Status of a notification in the delivery lifecycle.
 */
export enum NotificationStateEnum {
    PENDING = 'PENDING',
    SENT = 'SENT',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
    READED = 'READED'
}

/**
 * Channels through which notifications can be delivered.
 */
export enum NotificationChannelEnum {
    EMAIL = 'EMAIL',
    PUSH = 'PUSH',
    WHATSAPP = 'WHATSAPP',
    SMS = 'SMS',
    IN_APP = 'IN_APP'
}

/**
 * Types of clients involved in sponsorship or advertising.
 */
export enum ClientTypeEnum {
    POST_SPONSOR = 'POST_SPONSOR',
    ADVERTISER = 'ADVERTISER',
    HOST = 'HOST'
}

/**
 * Categorization of email templates for system events and campaigns.
 */
export enum EmailTemplateTypeEnum {
    WELCOME = 'WELCOME',
    BOOKING_CONFIRMATION = 'BOOKING_CONFIRMATION',
    PROMO = 'PROMO',
    NEWSLETTER = 'NEWSLETTER',
    MANUAL = 'MANUAL',
    PASSWORD_RESET = 'PASSWORD_RESET'
}

/**
 * Type of chat messages exchanged between users.
 */
export enum MessageTypeEnum {
    TEXT = 'TEXT',
    SYSTEM = 'SYSTEM',
    IMAGE = 'IMAGE',
    BOOKING_REQUEST = 'BOOKING_REQUEST'
}

/**
 * State of an advertising campaign.
 */
export enum CampaignStateEnum {
    DRAFT = 'DRAFT',
    SCHEDULED = 'SCHEDULED',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED'
}

/**
 * Advertising distribution channels.
 */
export enum AdChannelEnum {
    EMAIL = 'EMAIL',
    PUSH = 'PUSH',
    WEB_BANNER = 'WEB_BANNER',
    LISTING_BOOST = 'LISTING_BOOST',
    SEARCH_BOOST = 'SEARCH_BOOST',
    FEATURED_BOOST = 'FEATURED_BOOST',
    SOCIAL_MEDIA = 'SOCIAL_MEDIA'
}

/**
 * Placement positions where ads can appear on the website.
 */
export enum AdPlaceEnum {
    ACCOMMODATION_LIST = 'ACCOMMODATION_LIST',
    ACCOMMODATION_PAGE = 'ACCOMMODATION_PAGE',
    DESTINATION_LIST = 'DESTINATION_LIST',
    DESTINATION_PAGE = 'DESTINATION_PAGE',
    HOME = 'HOME',
    SEARCH = 'SEARCH',
    BLOG_LIST = 'BLOG_LIST',
    BLOG_PAGE = 'BLOG_PAGE'
}

/**
 * Supported currencies for pricing fields.
 */
export enum PriceCurrencyEnum {
    ARS = 'ARS',
    USD = 'USD'
}

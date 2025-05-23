export enum EntityTypeEnum {
    ACCOMMODATION = 'ACCOMMODATION',
    DESTINATION = 'DESTINATION',
    USER = 'USER',
    POST = 'POST',
    EVENT = 'EVENT'
}

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
    ROOM = 'ROOM',
    MOTEL = 'MOTEL',
    RESORT = 'RESORT'
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
    SERVICES = 'SERVICES',
    SAFETY = 'SAFETY',
    FAMILY_FRIENDLY = 'FAMILY_FRIENDLY',
    WORK_FRIENDLY = 'WORK_FRIENDLY',
    GENERAL_APPLIANCES = 'GENERAL_APPLIANCES'
}

/**
 * System user roles for access control and permissions.
 */
export enum BuiltinRoleTypeEnum {
    ADMIN = 'ADMIN',
    EDITOR = 'EDITOR',
    CLIENT = 'CLIENT',
    USER = 'USER'
}

/**
 * Builtin roles permission for access control
 */
export enum BuiltinPermissionTypeEnum {
    USER_CREATE = 'USER_CREATE',
    USER_UPDATE = 'USER_UPDATE',
    USER_DELETE = 'USER_DELETE',
    DESTINATION_CREATE = 'DESTINATION_CREATE',
    DESTINATION_UPDATE = 'DESTINATION_UPDATE',
    DESTINATION_DELETE = 'DESTINATION_DELETE',
    ACCOMMODATION_CREATE = 'ACCOMMODATION_CREATE',
    ACCOMMODATION_UPDATE = 'ACCOMMODATION_UPDATE',
    ACCOMMODATION_DELETE = 'ACCOMMODATION_DELETE',
    EVENT_CREATE = 'EVENT_CREATE',
    EVENT_UPDATE = 'EVENT_UPDATE',
    EVENT_DELETE = 'EVENT_DELETE',
    POST_CREATE = 'POST_CREATE',
    POST_UPDATE = 'POST_UPDATE',
    POST_DELETE = 'POST_DELETE'
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
 * Types of clients involved in sponsorship or advertising.
 */
export enum ClientTypeEnum {
    POST_SPONSOR = 'POST_SPONSOR',
    ADVERTISER = 'ADVERTISER',
    HOST = 'HOST'
}

/**
 * Supported currencies for pricing fields.
 */
export enum PriceCurrencyEnum {
    ARS = 'ARS',
    USD = 'USD'
}

/**
 * Tags color values for UI representation.
 */
export enum TagColorEnum {
    RED = 'RED',
    BLUE = 'BLUE',
    GREEN = 'GREEN',
    YELLOW = 'YELLOW',
    ORANGE = 'ORANGE',
    PURPLE = 'PURPLE',
    PINK = 'PINK',
    BROWN = 'BROWN',
    GREY = 'GREY',
    WHITE = 'WHITE',
    CYAN = 'CYAN',
    MAGENTA = 'MAGENTA',
    LIGHT_BLUE = 'LIGHT_BLUE',
    LIGHT_GREEN = 'LIGHT_GREEN'
}

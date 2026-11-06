/**
 * Feature Category Enum (HOS-2058)
 *
 * Closed set of categories a catalog `feature` row belongs to. Every feature
 * carries exactly one category so the editors and the public detail grids can
 * render features grouped, the same way amenities are grouped by
 * `AmenitiesTypeEnum`.
 *
 * Backed by the `feature_category_enum` pgEnum on `features.category`.
 * New values MUST be appended at the end: Postgres adds enum values at the end
 * of the type, and the enum-consistency test compares order.
 */
export enum FeatureCategoryEnum {
    /** Surroundings and zone (river front, rural area, central area). */
    LOCATION = 'LOCATION',
    /** Views (panoramic view, private viewpoint). */
    VIEW = 'VIEW',
    /** Road and physical access (paved, gravel). */
    ACCESS = 'ACCESS',
    /** Architecture and decor (modern, rustic, themed rooms). */
    STYLE = 'STYLE',
    /** Ideal-for and suitable-for traits (families, couples, seniors). */
    AUDIENCE = 'AUDIENCE',
    /** Offer profile: full rental, room rental, staff and rules-like traits. */
    OFFER_PROFILE = 'OFFER_PROFILE',
    /** Sustainability traits (recycling, solar energy, rainwater). */
    SUSTAINABILITY = 'SUSTAINABILITY',
    /** Activities offered on site (rural, animals, workshops). */
    ACTIVITIES = 'ACTIVITIES',
    /** Venue cuisine types. */
    CUISINE = 'CUISINE',
    /** Venue dietary options. */
    DIETARY = 'DIETARY',
    /** Language traits (bilingual services, guide languages). */
    LANGUAGE = 'LANGUAGE'
}

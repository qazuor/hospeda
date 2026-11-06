/**
 * Amenity Availability Enum (HOS-2058)
 *
 * Whether an amenity linked to a listing is available all year or only in
 * season. Stored on the relation row (`r_accommodation_amenity.availability`).
 *
 * The column is nullable and NULL means "not declared". Never infer a value.
 * Backed by the `amenity_availability_enum` pgEnum.
 */
export enum AmenityAvailabilityEnum {
    /** Available all year round. */
    YEAR_ROUND = 'year_round',
    /** Available only part of the year. */
    SEASONAL = 'seasonal'
}

/**
 * Amenity Scope Enum (HOS-2058)
 *
 * Whether an amenity linked to a listing is for the guest's exclusive use or
 * shared with other guests. Stored on the relation row
 * (`r_accommodation_amenity.scope`), never on the catalog row: the same pool
 * is private in one listing and shared in another.
 *
 * The column is nullable and NULL means "not declared". Never infer a value.
 * Backed by the `amenity_scope_enum` pgEnum.
 */
export enum AmenityScopeEnum {
    /** Exclusive to the guest. */
    PRIVATE = 'private',
    /** Shared with other guests. */
    SHARED = 'shared'
}

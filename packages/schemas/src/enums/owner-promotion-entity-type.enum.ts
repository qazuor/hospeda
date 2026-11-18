/**
 * Owner promotion entity type enum (HOS-2270).
 *
 * Names the kind of listing an owner promotion hangs from. Together with
 * `entityId` it replaces the single `accommodationId` column, which could only
 * ever point at an accommodation.
 *
 * - `accommodation` + `entityId`: promotion of that accommodation.
 * - `accommodation` + null `entityId`: promotion of ALL the owner's
 *   accommodations (D-4 of SPEC-285, unchanged behaviour).
 * - `venue`: promotion of that venue; `entityId` is mandatory (there is no
 *   "all venues of the owner" promotion).
 *
 * Values are lowercase on purpose: they mirror the `owner_promotion_entity_type_enum`
 * Postgres enum, which is unrelated to the uppercase `EntityTypeEnum` used by the
 * tag and QR tables.
 */
export enum OwnerPromotionEntityTypeEnum {
    /** The promotion hangs from an accommodation (or from all of the owner's). */
    ACCOMMODATION = 'accommodation',
    /** The promotion hangs from one venue. */
    VENUE = 'venue'
}

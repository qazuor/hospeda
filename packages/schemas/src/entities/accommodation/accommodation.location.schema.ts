/**
 * Accommodation Location Schema (postal address only)
 *
 * The accommodation `location` is the shared postal address (see
 * `common/postal-address.schema.ts`); geographic context is derived from the
 * `destinationId` FK, not stored here (SPEC-095).
 */
import {
    clearablePostalField,
    PostalAddressReadSchema,
    PostalAddressSchema,
    type PostalAddressType
} from '../../common/postal-address.schema.js';

export { clearablePostalField };

/** Accommodation Location Schema. See {@link PostalAddressSchema}. */
export const AccommodationLocationSchema = PostalAddressSchema;

/** HOS-190 / HOS-1770 read overlay. See {@link PostalAddressReadSchema}. */
export const AccommodationLocationReadSchema = PostalAddressReadSchema;

/** Inferred TypeScript type for the accommodation postal address. */
export type AccommodationLocationType = PostalAddressType;

/**
 * Spread helper for composing AccommodationLocationSchema into the main
 * AccommodationSchema via object spread.
 */
export const AccommodationLocationFields = {
    // Nullable in DB; the column is null until an admin/host fills the location.
    // Without .nullish() the API rejects fresh rows in the create response
    // (SPEC-117 D-ACCOM.4).
    location: AccommodationLocationSchema.nullish()
} as const;
export type AccommodationLocationFieldsType = typeof AccommodationLocationFields;

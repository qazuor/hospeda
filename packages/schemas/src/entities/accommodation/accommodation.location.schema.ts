/**
 * Accommodation Location Schema (postal address only)
 *
 * Defines the postal address fields stored in the `location` JSONB column of an
 * accommodation. This schema intentionally contains NO geographic context fields
 * (city, state, country, zipCode, neighborhood, department) — those are derived
 * from the `destinationId` FK to the destinations table at query time, projected
 * into responses as `cityDestination`.
 *
 * @see SPEC-095 for the rationale behind separating geographic context from
 * postal address.
 */
import { z } from 'zod';
import { CoordinatesSchema } from '../../common/location.schema.js';

/**
 * Accommodation Location Schema — postal address fields only.
 */
export const AccommodationLocationSchema = z.object({
    coordinates: CoordinatesSchema.optional(),
    street: z
        .string({
            message: 'zodError.accommodation.location.street.required'
        })
        .min(2, { message: 'zodError.accommodation.location.street.min' })
        .max(50, { message: 'zodError.accommodation.location.street.max' })
        .optional(),
    number: z
        .string({
            message: 'zodError.accommodation.location.number.required'
        })
        .min(1, { message: 'zodError.accommodation.location.number.min' })
        .max(10, { message: 'zodError.accommodation.location.number.max' })
        .optional(),
    floor: z
        .string({
            message: 'zodError.accommodation.location.floor.required'
        })
        .min(1, { message: 'zodError.accommodation.location.floor.min' })
        .max(10, { message: 'zodError.accommodation.location.floor.max' })
        .optional(),
    apartment: z
        .string({
            message: 'zodError.accommodation.location.apartment.required'
        })
        .min(1, { message: 'zodError.accommodation.location.apartment.min' })
        .max(10, { message: 'zodError.accommodation.location.apartment.max' })
        .optional()
});

/**
 * Inferred TypeScript type for the accommodation postal address.
 */
export type AccommodationLocationType = z.infer<typeof AccommodationLocationSchema>;

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

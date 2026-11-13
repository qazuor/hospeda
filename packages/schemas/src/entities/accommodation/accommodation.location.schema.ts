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
 * One postal-address string the host can CLEAR (HOS-910).
 *
 * `''` is admitted explicitly and means "not informed" — the same thing an
 * absent key means; every reader of the address already treats a falsy value
 * as absent. Same reasoning as `SeoSchema` (HOS-792): the host editor sends a
 * diff, so emptying a saved field puts `''` on the wire, and rejecting it made
 * a stored address impossible to remove without touching the database. The
 * bounds still apply to every non-empty value.
 *
 * @param input.field - The address key, used to build the i18n message keys.
 * @param input.min - Minimum length of a non-empty value.
 * @param input.max - Maximum length.
 * @returns The Zod schema (not yet optional).
 */
export function clearablePostalField({
    field,
    min,
    max
}: {
    readonly field: 'street' | 'number' | 'floor' | 'apartment';
    readonly min: number;
    readonly max: number;
}) {
    return z.union(
        [
            z.literal(''),
            z
                .string({ message: `zodError.accommodation.location.${field}.required` })
                .min(min, { message: `zodError.accommodation.location.${field}.min` })
                .max(max, { message: `zodError.accommodation.location.${field}.max` })
        ],
        // Named so a non-string input reports a translatable key instead of
        // Zod's bare "Invalid input" (see `SeoSchema`).
        { message: `zodError.accommodation.location.${field}.required` }
    );
}

/**
 * Accommodation Location Schema — postal address fields only. Each address
 * string accepts `''` ("cleared", HOS-910); see {@link clearablePostalField}.
 */
export const AccommodationLocationSchema = z.object({
    coordinates: CoordinatesSchema.optional(),
    street: clearablePostalField({ field: 'street', min: 2, max: 50 }).optional(),
    number: clearablePostalField({ field: 'number', min: 1, max: 10 }).optional(),
    floor: clearablePostalField({ field: 'floor', min: 1, max: 10 }).optional(),
    apartment: clearablePostalField({ field: 'apartment', min: 1, max: 10 }).optional()
});

/**
 * HOS-190 / HOS-1770 read overlay: stored postal strings may predate today's
 * write bounds, while coordinates keep their numeric validation.
 */
export const AccommodationLocationReadSchema = z.object({
    coordinates: CoordinatesSchema.optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    floor: z.string().optional(),
    apartment: z.string().optional()
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

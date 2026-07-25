/**
 * EventLocation Address Schema (postal address only, plus destinationId FK)
 *
 * Defines the postal-address fields stored in the event_locations row plus the
 * required FK to a `destination` of type CITY. This schema intentionally has
 * NO geographic context fields (city, state, country, zipCode, neighborhood,
 * department) — those derive from the destination relation at query time and
 * are projected as `cityDestination` in API responses.
 *
 * @see SPEC-095 for the rationale.
 */
import { z } from 'zod';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { CoordinatesSchema } from '../../common/location.schema.js';

/**
 * EventLocation Address Schema — postal address fields plus destinationId FK.
 *
 * `street` is bounded at 150 chars (raised from 50 in HOS-300). The old bound
 * could not hold a real rural Argentine address such as
 * `"Ruta Provincial N.º 39, km 128 (zona rural, Departamento Uruguay)"` (65
 * chars), which is exactly what a production venue carries — so the venue was
 * readable but not editable, since the admin entity form submits the WHOLE
 * form and re-validated the persisted value on every save. The DB column is
 * `text`, so the bound is a product decision, not a storage constraint.
 */
export const EventLocationAddressSchema = z.object({
    destinationId: DestinationIdSchema,
    coordinates: CoordinatesSchema.nullish(),
    street: z
        .string({ message: 'zodError.eventLocation.street.required' })
        .min(2, { message: 'zodError.eventLocation.street.min' })
        .max(150, { message: 'zodError.eventLocation.street.max' })
        .nullish(),
    number: z
        .string({ message: 'zodError.eventLocation.number.required' })
        .min(1, { message: 'zodError.eventLocation.number.min' })
        .max(10, { message: 'zodError.eventLocation.number.max' })
        .nullish(),
    floor: z
        .string({ message: 'zodError.eventLocation.floor.required' })
        .min(1, { message: 'zodError.eventLocation.floor.min' })
        .max(10, { message: 'zodError.eventLocation.floor.max' })
        .nullish(),
    apartment: z
        .string({ message: 'zodError.eventLocation.apartment.required' })
        .min(1, { message: 'zodError.eventLocation.apartment.min' })
        .max(10, { message: 'zodError.eventLocation.apartment.max' })
        .nullish(),
    placeName: z
        .string({ message: 'zodError.eventLocation.placeName.required' })
        .min(2, { message: 'zodError.eventLocation.placeName.min' })
        .max(100, { message: 'zodError.eventLocation.placeName.max' })
        .nullish()
});

/**
 * Inferred TypeScript type for the eventLocation address.
 */
export type EventLocationAddressType = z.infer<typeof EventLocationAddressSchema>;

/**
 * READ-side overlay for the postal address fields (HOS-300).
 *
 * Same fields, same types, no length bounds. Rows reach `event_locations`
 * through seed data-migrations and direct model inserts, both of which bypass
 * the create/update Zod schemas — so a persisted address can legitimately be
 * longer than the write-side maximum. Since the API's `stripWithSchema` is
 * fail-closed, enforcing those bounds on read turns one over-long row into a
 * 500 for an entire paginated response.
 *
 * Read schemas therefore validate the SHAPE and leave the LENGTH to the write
 * path, keeping read ⊇ write. Do not add bounds here — add them to
 * {@link EventLocationAddressSchema}, which the create/update schemas inherit.
 *
 * @see HOS-190 / `ContactInfoReadSchema` for the same pattern on contact info.
 */
export const EventLocationAddressReadFields = {
    street: z.string().nullish(),
    number: z.string().nullish(),
    floor: z.string().nullish(),
    apartment: z.string().nullish(),
    placeName: z.string().nullish()
} as const;
export type EventLocationAddressReadFieldsType = typeof EventLocationAddressReadFields;

/**
 * Spread helper for composing EventLocationAddressSchema into the main
 * EventLocationSchema via object spread.
 */
export const EventLocationAddressFields = EventLocationAddressSchema.shape;
export type EventLocationAddressFieldsType = typeof EventLocationAddressFields;
